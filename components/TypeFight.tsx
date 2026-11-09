"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  Fighter,
  JAB_CONTACT_MS,
  type FighterHandle,
  type Finisher,
} from "./Fighter";
import CommandLine, { type CommandItem } from "./CommandLine";
import CustomTextDialog from "./CustomTextDialog";
import DuelHud from "./DuelHud";
import ModeBar from "./ModeBar";
import MultiplayerDialog from "./MultiplayerDialog";
import SettingsDialog from "./SettingsDialog";
import TextRulesDialog from "./TextRulesDialog";
import AuthDialog from "./AuthDialog";
import LeaderboardDialog from "./LeaderboardDialog";
import {
  CUSTOM_LIMIT_OPTIONS,
  CUSTOM_ORDER_OPTIONS,
  CUSTOM_SECTION_OPTIONS,
  CUSTOM_TIME_OPTIONS,
  CUSTOM_WORD_OPTIONS,
  DEFAULT_SETTINGS,
  QUOTE_OPTIONS,
  TIME_OPTIONS,
  WORD_OPTIONS,
  bestKeyFor,
  clearSettings,
  formatSpeed,
  loadSettings,
  modeLabel,
  modeSummary,
  saveSettings,
  sanitizeSettings,
  speedUnitLabel,
  variantLabel,
  type TestMode,
  type TestSettings,
} from "@/lib/settings";
import {
  charsPerMinute,
  charsPerSecond,
  consistencyFromSamples,
  netChars,
  scoreRun,
  wordsPerSecondFromChars,
  wpmFromCorrectChars,
  type RunStats,
  type WordEntry,
} from "@/lib/stats";
import { duelSettingsFrom, useDuel } from "@/lib/duel";
import { useAuth } from "@/lib/auth";
import {
  playSound,
  primeAudio,
  setSoundConfig,
  setSoundEnabled,
  type SoundName,
} from "@/lib/sfx";
import {
  keymapRows,
  layoutChar,
  oppositeShiftCheck,
} from "@/lib/input";
import {
  DEFAULT_CUSTOM_TEXT,
  extendTest,
  generateTest,
  makeSeed,
  type TestText,
} from "@/lib/text";
import {
  DEFAULT_THEME_ID,
  THEME_KEY,
  THEME_MODES,
  THEME_OPTIONS,
  isThemeFamily,
  isThemeId,
  themeMode,
  themeOption,
  type ThemeId,
  type ThemeMode,
} from "@/lib/theme";

type Status = "idle" | "running" | "finished";

type FxKind = "hit" | "heavy" | "miss";

interface Fx {
  id: number;
  x: number;
  y: number;
  kind: FxKind;
}

interface Smash {
  id: number;
  text: string;
  kind: Finisher | "miss";
}

interface LiveStats {
  wpm: number;
  accuracy: number;
  progress: number;
  burst: number;
  score: number;
}

interface Result extends RunStats {
  elapsed: number;
  samples: number[];
  failed: boolean;
  failReason: string | null;
  entries: WordEntry[];
}

interface TestRecord {
  wpm: number;
  accuracy: number;
  score?: number;
  mode: string;
  at: number;
}

const STRIKE_X = 18;
const SOUND_KEY = "platen:sound";
const HISTORY_KEY = "platen:history";
const MAX_HISTORY = 10;

/* One finisher per completed word, cycling so every move appears early. */
const FINISHERS: Finisher[] = [
  "kick",
  "cross",
  "slap",
  "hook",
  "uppercut",
  "elbow",
];

/* Heavy effects wait for the actual contact frame of each move. */
const FINISHER_FEEDBACK: Record<
  Finisher,
  { delay: number; shake: number; sound: SoundName }
> = {
  kick: { delay: 235, shake: 8, sound: "kick" },
  cross: { delay: 145, shake: 5, sound: "heavy" },
  slap: { delay: 126, shake: 3.5, sound: "slap" },
  hook: { delay: 150, shake: 5.5, sound: "heavy" },
  uppercut: { delay: 170, shake: 6.5, sound: "heavy" },
  elbow: { delay: 180, shake: 5, sound: "heavy" },
};

const EMPTY_STATS: LiveStats = {
  wpm: 0,
  accuracy: 100,
  progress: 0,
  burst: 0,
  score: 0,
};

function makeEntries(words: string[]): WordEntry[] {
  return words.map((word) => ({
    word,
    typed: "",
    submitted: false,
    correct: null,
  }));
}

/** Custom runs end on the clock only when their limit is time. */
function isTimedMode(settings: TestSettings): boolean {
  return (
    settings.mode === "time" ||
    (settings.mode === "custom" && settings.customLimit === "time")
  );
}

function runSeconds(settings: TestSettings): number {
  return settings.mode === "custom" && settings.customLimit === "time"
    ? settings.customSeconds
    : settings.duration;
}

function runIsFinite(settings: TestSettings): boolean {
  return (
    settings.mode === "words" ||
    settings.mode === "quote" ||
    (settings.mode === "custom" && settings.customLimit !== "time")
  );
}

/** Grouped custom words keep their inner space; render it as a real width. */
function visibleGlyph(character: string): string {
  return character === " " ? "\u00a0" : character;
}

function readNumber(key: string): number {
  try {
    const value = Number(window.localStorage.getItem(key) ?? 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function storeNumber(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Private mode can reject writes; the run still works.
  }
}

function readHistory(): TestRecord[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is TestRecord =>
          Boolean(entry) &&
          typeof entry.wpm === "number" &&
          typeof entry.accuracy === "number",
      )
      .slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

function writeHistory(records: TestRecord[]) {
  try {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(records.slice(-MAX_HISTORY)),
    );
  } catch {
    // Ignore storage failures.
  }
}

/** The strike line can be moved by tape margin, so the fighter follows it. */
function strikeOffset(settings: TestSettings): number {
  return settings.tapeMode ? settings.tapeMargin : STRIKE_X;
}

function fontStack(settings: TestSettings): string {
  const fallback = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';
  if (settings.fontFamily === "berkeley") {
    return settings.useLocalFont
      ? `"Berkeley Mono", ${fallback}`
      : `"Berkeley Mono", "JetBrains Mono", ui-monospace, monospace`;
  }
  if (settings.fontFamily === "system") {
    return 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
  }
  return settings.useLocalFont
    ? `${fallback}, "Berkeley Mono"`
    : fallback;
}

function averageRecord(records: TestRecord[]): number {
  if (!records.length) return 0;
  const total = records.reduce((sum, record) => sum + record.wpm, 0);
  return Math.round(total / records.length);
}

/** Result graph points in a 320 × 56 box. */
function sparklinePoints(samples: number[], startZero: boolean): string {
  if (samples.length < 2) return "";
  const max = Math.max(...samples, 1);
  const min = startZero ? 0 : Math.min(...samples);
  const span = Math.max(1, max - min);
  return samples
    .map((value, index) => {
      const x = (index / (samples.length - 1)) * 320;
      const y = 52 - ((value - min) / span) * 48;
      return `${x.toFixed(1)},${Math.max(2, Math.min(54, y)).toFixed(1)}`;
    })
    .join(" ");
}

function reducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function statPill(label: string, value: ReactNode, accent = false) {
  return (
    <div className={`stat-pill ${accent ? "is-accent" : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export default function TypeFight({ initialSeed }: { initialSeed: number }) {
  const fighterRef = useRef<FighterHandle>(null);
  const opponentFighterRef = useRef<FighterHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const wordLineRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const errorVeilRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handlerRef = useRef<(event: KeyboardEvent) => void>(() => {});
  const loopRef = useRef<() => void>(() => {});
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const pausedRef = useRef<number | null>(null);
  const wordStartRef = useRef<number | null>(null);
  const paceRef = useRef<HTMLSpanElement>(null);
  const seedRef = useRef(initialSeed);
  const extendRef = useRef(0);
  const statusRef = useRef<Status>("idle");
  const entriesRef = useRef<WordEntry[]>([]);
  const activeRef = useRef(0);
  const typedRef = useRef("");
  const keysTotalRef = useRef(0);
  const keysCorrectRef = useRef(0);
  const samplesRef = useRef<number[]>([]);
  const nextSampleRef = useRef(1);
  const lastSampleRef = useRef({ time: 0, correct: 0 });
  const lastPaintRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const fxIdRef = useRef(0);
  const smashIdRef = useRef(0);
  const soundRef = useRef(true);
  const warnedRef = useRef(false);
  const settingsRef = useRef<TestSettings>(DEFAULT_SETTINGS);
  const themeIdRef = useRef<ThemeId>(DEFAULT_THEME_ID);
  const historyRef = useRef<TestRecord[]>([]);
  const duelLockRef = useRef(false);
  const duelStartedRef = useRef(0);
  const duelRaceRef = useRef<number | null>(null);
  const lastDuelStateRef = useRef(0);

  const [settings, setSettings] = useState<TestSettings>(DEFAULT_SETTINGS);
  const [test, setTest] = useState<TestText>(() =>
    generateTest(initialSeed, DEFAULT_SETTINGS),
  );
  const [status, setStatus] = useState<Status>("idle");
  const [entries, setEntries] = useState<WordEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [remaining, setRemaining] = useState(DEFAULT_SETTINGS.duration);
  const [elapsed, setElapsed] = useState(0);
  const [live, setLive] = useState<LiveStats>(EMPTY_STATS);
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [history, setHistory] = useState<TestRecord[]>([]);
  const [fx, setFx] = useState<Fx[]>([]);
  const [smash, setSmash] = useState<Smash | null>(null);
  const [sound, setSound] = useState(true);
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [focused, setFocused] = useState(true);
  const [composition, setComposition] = useState("");
  const [notice, setNotice] = useState("");
  const [lastKey, setLastKey] = useState("");
  const [multiplayerOpen, setMultiplayerOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [duelCountdown, setDuelCountdown] = useState(0);
  const [submitRank, setSubmitRank] = useState<number | null>(null);
  const [arenaMenuOpen, setArenaMenuOpen] = useState(false);

  const auth = useAuth();
  const duel = useDuel(auth.displayName, auth.user?.id ?? null);
  const duelRef = useRef(duel);
  const authNameRef = useRef(auth.displayName);
  const beginRunRef = useRef<() => void>(() => {});
  duelRef.current = duel;
  authNameRef.current = auth.displayName;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const applyThemeId = useCallback((next: ThemeId) => {
    const option = themeOption(next);
    const root = document.documentElement;
    root.dataset.theme = option.mode;
    root.dataset.scheme = option.family;
    themeIdRef.current = next;
    setThemeId(next);
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (meta) meta.content = option.bg;
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const replay = useCallback(() => {
    if (duelRef.current.race) {
      setNotice("duel in progress — finish the race or leave the room");
      return;
    }
    setResult(null);
    setNewBest(false);
    setLastKey("");
    setSubmitRank(null);
    const current = settingsRef.current;
    if (current.randomTheme) {
      const pool = THEME_OPTIONS.filter(
        (entry) => entry.id !== themeIdRef.current,
      );
      const pick = pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
      if (pick) applyThemeId(pick.id);
    }
    const repeat = current.mode === "quote" && current.repeatQuotes;
    const seed = repeat ? seedRef.current : makeSeed();
    seedRef.current = seed;
    extendRef.current = 0;
    setTest(generateTest(seed, current));
  }, [applyThemeId]);

  const resetRun = useCallback(
    (nextTest: TestText) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      clearTimers();

      const nextEntries = makeEntries(nextTest.words);
      entriesRef.current = nextEntries;
      activeRef.current = 0;
      typedRef.current = "";
      startRef.current = null;
      pausedRef.current = null;
      wordStartRef.current = null;
      extendRef.current = 0;
      keysTotalRef.current = 0;
      keysCorrectRef.current = 0;
      samplesRef.current = [];
      nextSampleRef.current = 1;
      lastSampleRef.current = { time: 0, correct: 0 };
      lastPaintRef.current = 0;
      warnedRef.current = false;
      setComposition("");

      statusRef.current = "idle";
      setEntries(nextEntries);
      setActiveIndex(0);
      setTyped("");
      setStatus("idle");
      setRemaining(runSeconds(settingsRef.current));
      setElapsed(0);
      setLive(EMPTY_STATS);
      setResult(null);
      setNewBest(false);
      setSubmitRank(null);
      setFx([]);
      setSmash(null);
      fighterRef.current?.reset();
      opponentFighterRef.current?.reset();
    },
    [clearTimers],
  );

  useEffect(() => {
    resetRun(test);
  }, [test, resetRun]);

  useEffect(() => {
    const stored = loadSettings();
    settingsRef.current = stored;
    setSettings(stored);
    seedRef.current = initialSeed;
    setTest(generateTest(initialSeed, stored));
    setSoundConfig({
      volume: stored.volume / 100,
      click: stored.clickSound,
      error: stored.errorSound,
      timeWarning: stored.timeWarningSound,
    });

    const records = readHistory();
    historyRef.current = records;
    setHistory(records);
    setSound(stored.clickSound || stored.errorSound);

    try {
      const savedSound = window.localStorage.getItem(SOUND_KEY);
      const on = savedSound === null ? true : savedSound === "1";
      setSound(on);
      soundRef.current = on;
      setSoundEnabled(on);
    } catch {
      // Ignore storage failures.
    }

    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      let active: ThemeId = DEFAULT_THEME_ID;
      if (isThemeId(saved)) {
        active = saved;
      } else {
        const legacyMode: ThemeMode = saved === "light" ? "light" : "dark";
        const legacyFamily = window.localStorage.getItem("platen:palette");
        const family = isThemeFamily(legacyFamily) ? legacyFamily : "slate";
        active = `${family}-${legacyMode}` as ThemeId;
      }
      const option = themeOption(active);
      const root = document.documentElement;
      root.dataset.theme = option.mode;
      root.dataset.scheme = option.family;
      themeIdRef.current = active;
      setThemeId(active);
      const meta = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]',
      );
      if (meta) meta.content = option.bg;
      window.localStorage.setItem(THEME_KEY, active);
    } catch {
      // Ignore storage failures.
    }
  }, [initialSeed]);

  /* A safe colour or gradient paints the page behind the arena. */
  useEffect(() => {
    const root = document.documentElement;
    const background = settings.customBackground.trim();
    if (background) root.style.setProperty("--custom-background", background);
    else root.style.removeProperty("--custom-background");
    return () => {
      root.style.removeProperty("--custom-background");
    };
  }, [settings.customBackground]);

  useEffect(() => {
    if (!paletteOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".palette-picker")) setPaletteOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [paletteOpen]);

  useEffect(() => {
    setBest(readNumber(bestKeyFor(settings)));
    setNewBest(false);
  }, [settings]);

  useEffect(() => {
    if (commandOpen || editorOpen || rulesOpen || settingsOpen) return;
    if (multiplayerOpen || leaderboardOpen || authOpen) return;
    const focus = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(focus);
  }, [
    commandOpen,
    editorOpen,
    rulesOpen,
    settingsOpen,
    multiplayerOpen,
    leaderboardOpen,
    authOpen,
    status,
  ]);

  useEffect(() => {
    const onCaps = (event: KeyboardEvent) => {
      if (typeof event.getModifierState !== "function") return;
      setCapsLock(event.getModifierState("CapsLock"));
    };
    const onFocus = () => setFocused(true);
    const onBlur = () => setFocused(false);
    const onCompositionStart = () => setComposition("");
    const onCompositionUpdate = (event: CompositionEvent) =>
      setComposition(event.data ?? "");
    const onCompositionEnd = () => setComposition("");
    window.addEventListener("keydown", onCaps);
    window.addEventListener("keyup", onCaps);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("compositionstart", onCompositionStart);
    window.addEventListener("compositionupdate", onCompositionUpdate);
    window.addEventListener("compositionend", onCompositionEnd);
    return () => {
      window.removeEventListener("keydown", onCaps);
      window.removeEventListener("keyup", onCaps);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("compositionstart", onCompositionStart);
      window.removeEventListener("compositionupdate", onCompositionUpdate);
      window.removeEventListener("compositionend", onCompositionEnd);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!auth.notice) return;
    setNotice(auth.notice);
    auth.clearNotice();
    // clearNotice is recreated every render; the notice value is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.notice]);

  useEffect(() => {
    if (!arenaMenuOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".arena-picker")) setArenaMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [arenaMenuOpen]);

  useEffect(() => {
    const cleanup = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimers();
    };
    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
    };
  }, [clearTimers]);

  /* Keep the caret at the strike line no matter how long the word is. */
  const alignTrack = useCallback(() => {
    const word = activeWordRef.current;
    const probe = probeRef.current;
    const track = trackRef.current;
    if (!word || !probe || !track) return;
    const entry = entriesRef.current[activeRef.current];
    const typedNow = typedRef.current;
    let offset = word.offsetLeft + probe.offsetLeft;
    if (entry && typedNow.length > entry.word.length) {
      // Extra letters have no punched-out animation, so park the first extra
      // on the strike line where it can actually be read and deleted.
      const extra = word.querySelector<HTMLElement>(".glyph.is-extra");
      if (extra) offset = word.offsetLeft + extra.offsetLeft;
    } else if (
      entry &&
      typedNow.length > 0 &&
      typedNow.length <= entry.word.length &&
      typedNow[typedNow.length - 1] !== entry.word[typedNow.length - 1]
    ) {
      // A wrong final letter would sit behind the glove; keep it in view.
      const last = word.querySelector<HTMLElement>(
        `[data-letter="${typedNow.length - 1}"]`,
      );
      if (last) offset = word.offsetLeft + last.offsetLeft;
    }
    // A fully typed word stays parked at its own end. Jumping to the next word
    // here would hide the inter-word gap and make it ambiguous whether the
    // player still needs to press space.
    track.style.transform = `translate3d(${strikeOffset(settingsRef.current) - offset}px, 0, 0)`;
  }, []);

  /* The word line rides on the resting glove, so the fist always lands it. */
  const syncStrikeLine = useCallback(() => {
    const stage = stageRef.current;
    const svg = stage?.querySelector<SVGSVGElement>(
      ".fighter-col-player .fighter-svg",
    );
    const col = stage?.querySelector<HTMLElement>(".fighter-col-player");
    if (!stage || !svg || !col) return;
    const stageBox = stage.getBoundingClientRect();
    const colBox = col.getBoundingClientRect();
    if (!stageBox.height || !colBox.width) return;

    // Size the fighter from the column width so the body never clips on narrow
    // screens, but never taller than the stage.
    const compact = window.matchMedia("(max-width: 820px)").matches;
    const spill = compact ? 1.35 : 1.23;
    const heightCap = (stageBox.height * 0.96 * 380) / 460;
    const width = Math.min(colBox.width * spill, heightCap);
    // The glove rim (7 viewBox units past the 380-wide box) must meet the caret.
    const right = (7 / 380) * width - strikeOffset(settingsRef.current);
    svg.style.width = `${width}px`;
    svg.style.height = "auto";
    svg.style.right = `${right}px`;

    const svgBox = svg.getBoundingClientRect();
    if (!svgBox.height) return;
    const gloveY = svgBox.top - stageBox.top + svgBox.height * 0.4;
    stage.style.setProperty("--strike-y", `${gloveY}px`);
  }, []);

  useLayoutEffect(() => {
    alignTrack();
  }, [alignTrack, activeIndex, typed, entries]);

  useLayoutEffect(() => {
    syncStrikeLine();
    alignTrack();
  }, [
    alignTrack,
    syncStrikeLine,
    settings.tapeMode,
    settings.tapeMargin,
    settings.maxLineWidth,
    settings.fontSize,
    settings.fontFamily,
    settings.useLocalFont,
  ]);

  useEffect(() => {
    const align = () => {
      syncStrikeLine();
      alignTrack();
    };
    align();
    window.addEventListener("resize", align);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && arenaRef.current) {
      observer = new ResizeObserver(align);
      observer.observe(arenaRef.current);
      if (stageRef.current) observer.observe(stageRef.current);
    }
    void document.fonts?.ready.then(align);
    const timer = window.setTimeout(align, 250);
    return () => {
      window.removeEventListener("resize", align);
      observer?.disconnect();
      window.clearTimeout(timer);
    };
  }, [alignTrack, syncStrikeLine]);

  const spawnFx = useCallback((x: number, y: number, kind: FxKind) => {
    const id = fxIdRef.current++;
    setFx((current) => [...current.slice(-20), { id, x, y, kind }]);
    const timer = window.setTimeout(() => {
      setFx((current) => current.filter((item) => item.id !== id));
    }, 700);
    timersRef.current.push(timer);
  }, []);

  const spawnSmash = useCallback((text: string, kind: Finisher | "miss") => {
    const id = smashIdRef.current++;
    setSmash({ id, text, kind });
    const timer = window.setTimeout(() => {
      setSmash((current) => (current?.id === id ? null : current));
    }, 620);
    timersRef.current.push(timer);
  }, []);

  const arenaPoint = useCallback(() => {
    const arena = arenaRef.current;
    const line = wordLineRef.current;
    if (!arena) return { x: 48, y: 220 };
    const a = arena.getBoundingClientRect();
    const l = line?.getBoundingClientRect();
    const y = l ? l.top - a.top + l.height / 2 : a.height * 0.39;
    return { x: 48, y };
  }, []);

  const letterPoint = useCallback(
    (index: number) => {
      const arena = arenaRef.current;
      const word = activeWordRef.current;
      if (!arena || !word) return arenaPoint();
      const letter = word.querySelector<HTMLElement>(`[data-letter="${index}"]`);
      if (!letter) return arenaPoint();
      const a = arena.getBoundingClientRect();
      const r = letter.getBoundingClientRect();
      return {
        x: Math.max(10, Math.min(a.width - 10, r.left - a.left + r.width / 2)),
        y: r.top - a.top + r.height / 2,
      };
    },
    [arenaPoint],
  );

  const shake = useCallback((intensity: number) => {
    if (reducedMotion()) return;
    stageRef.current?.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: `translate(${-intensity}px, ${intensity * 0.5}px)`, offset: 0.2 },
        { transform: `translate(${intensity * 0.8}px, ${-intensity * 0.4}px)`, offset: 0.45 },
        { transform: `translate(${-intensity * 0.4}px, ${intensity * 0.2}px)`, offset: 0.7 },
        { transform: "translate(0, 0)" },
      ],
      { duration: 210, easing: "ease-out" },
    );
  }, []);

  const flashError = useCallback(() => {
    const veil = errorVeilRef.current;
    if (!veil || reducedMotion()) return;
    veil.animate(
      [{ opacity: 0 }, { opacity: 0.55, offset: 0.18 }, { opacity: 0 }],
      { duration: 280, easing: "ease-out" },
    );
  }, []);

  const maybeExtend = useCallback((index: number) => {
    const current = settingsRef.current;
    const extendable =
      current.mode === "zen" || isTimedMode(current);
    if (!extendable) return;
    if (index < entriesRef.current.length - 24) return;
    // Still static: the tail of timed and zen runs keeps going with more words
    // from the same corpus or custom source, never generated text.
    extendRef.current += 1;
    const additions = makeEntries(
      extendTest(
        seedRef.current + extendRef.current * 7919,
        current,
      ),
    );
    const next = [...entriesRef.current, ...additions];
    entriesRef.current = next;
    setEntries(next);
  }, []);

  const finishRun = useCallback(
    (seconds: number, failReason: string | null = null) => {
      if (statusRef.current !== "running") return;
      statusRef.current = "finished";
      setStatus("finished");
      pausedRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;

      const net = netChars(
        entriesRef.current,
        activeRef.current,
        typedRef.current,
      );
      const safeSeconds = Math.max(0.1, seconds);
      const wpm = wpmFromCorrectChars(net.correct, safeSeconds);
      const raw = wpmFromCorrectChars(net.all, safeSeconds);
      const totalKeys = keysTotalRef.current;
      const accuracy = totalKeys
        ? Math.round((keysCorrectRef.current / totalKeys) * 100)
        : 100;
      const consistency = consistencyFromSamples(samplesRef.current);
      const incorrect = Math.max(0, net.all - net.correct);
      const failed = Boolean(failReason);
      const wps = wordsPerSecondFromChars(net.correct, safeSeconds);
      const cpm = charsPerMinute(net.correct, safeSeconds);
      const cps = charsPerSecond(net.correct, safeSeconds);
      const score = scoreRun({
        correctChars: net.correct,
        correctWords: net.correctWords,
        wpm,
        accuracy,
        difficulty: settingsRef.current.difficulty,
      });

      const nextResult: Result = {
        wpm,
        raw,
        wps,
        cpm,
        cps,
        accuracy,
        consistency,
        correctChars: net.correct,
        incorrectChars: incorrect,
        extraChars: net.extra,
        missedChars: net.missed,
        correctWords: net.correctWords,
        wrongWords: net.wrongWords,
        score,
        elapsed: safeSeconds,
        samples: samplesRef.current.slice(),
        failed,
        failReason,
        entries: entriesRef.current.map((entry) => ({ ...entry })),
      };

      setResult(nextResult);
      setRemaining(0);
      setElapsed(safeSeconds);
      setLastKey("");
      const recentSamples = samplesRef.current.slice(-3);
      const burst = recentSamples.length
        ? Math.round(
            recentSamples.reduce((sum, value) => sum + value, 0) /
              recentSamples.length,
          )
        : wpm;
      setLive({ wpm, accuracy, progress: 1, burst, score });

      if (!failed) {
        const bestKey = bestKeyFor(settingsRef.current);
        const previous = readNumber(bestKey);
        if (wpm > previous) {
          storeNumber(bestKey, wpm);
          setBest(wpm);
          setNewBest(true);
        } else {
          setBest(previous);
          setNewBest(false);
        }

        const record: TestRecord = {
          wpm,
          accuracy,
          score,
          mode: modeLabel(settingsRef.current),
          at: Date.now(),
        };
        const records = [...historyRef.current, record].slice(-MAX_HISTORY);
        historyRef.current = records;
        setHistory(records);
        writeHistory(records);

        const runSettings = settingsRef.current;
        void fetch("/api/leaderboard", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            score,
            wpm,
            accuracy,
            difficulty: runSettings.difficulty,
            mode: runSettings.mode,
            duration: isTimedMode(runSettings) ? runSeconds(runSettings) : 0,
            correctChars: net.correct,
            correctWords: net.correctWords,
            name: authNameRef.current || "fighter",
          }),
        })
          .then(async (response) => {
            if (!response.ok) return;
            const payload = (await response.json()) as { rank?: number | null };
            if (typeof payload.rank === "number") setSubmitRank(payload.rank);
          })
          .catch(() => {
            // A leaderboard miss never blocks the result panel.
          });
      } else {
        setNewBest(false);
      }

      const raceNow = duelRef.current.race;
      if (raceNow) {
        duelRef.current.sendFinish({
          score,
          wpm,
          accuracy,
          correctChars: net.correct,
        });
      }

      if (failed) {
        fighterRef.current?.hurt();
        playSound("miss");
        flashError();
      } else {
        fighterRef.current?.heavy("cross");
        playSound("heavy");
      }
    },
    [flashError],
  );

  const updatePace = useCallback((elapsedNow: number, correctNow: number) => {
    const element = paceRef.current;
    const current = settingsRef.current;
    if (!element) return;
    if (current.paceCaret === "off") {
      element.style.opacity = "0";
      return;
    }

    let target = 60;
    if (current.paceCaret === "best") {
      target = readNumber(bestKeyFor(current)) || 60;
    } else {
      const usable = samplesRef.current.filter((value) => value > 0);
      target = usable.length
        ? usable.reduce((sum, value) => sum + value, 0) / usable.length
        : 60;
    }

    const rate = (target * 5) / 60;
    const word = entriesRef.current[activeRef.current];
    const box = activeWordRef.current?.getBoundingClientRect();
    const charWidth =
      box && word && word.word.length ? box.width / word.word.length : 10;
    const expected =
      current.repeatedPace && wordStartRef.current !== null
        ? ((performance.now() - wordStartRef.current) / 1000) * rate
        : elapsedNow * rate;
    const actual = current.repeatedPace
      ? typedRef.current.length
      : correctNow;
    const diff = Math.max(-60, Math.min(240, expected - actual));

    element.style.opacity = "1";
    element.style.transform = `translateX(${strikeOffset(current) + diff * charWidth}px)`;
  }, []);

  const startLoop = useCallback(() => {
    const tick = () => {
      if (
        statusRef.current !== "running" ||
        startRef.current === null ||
        pausedRef.current !== null
      ) {
        return;
      }
      const currentSettings = settingsRef.current;
      const elapsedNow = (performance.now() - startRef.current) / 1000;
      const net = netChars(entriesRef.current, activeRef.current, typedRef.current);

      while (elapsedNow >= nextSampleRef.current) {
        const sampleAt = nextSampleRef.current;
        const previous = lastSampleRef.current;
        const delta = Math.max(0, net.correct - previous.correct);
        const windowSeconds = sampleAt - previous.time;
        samplesRef.current.push(
          windowSeconds > 0 ? (delta / 5) * (60 / windowSeconds) : 0,
        );
        lastSampleRef.current = { time: sampleAt, correct: net.correct };
        nextSampleRef.current = sampleAt + 1;
      }

      const now = performance.now();
      if (now - lastPaintRef.current > 90) {
        lastPaintRef.current = now;
        const totalKeys = keysTotalRef.current;
        const timed = isTimedMode(currentSettings);
        const limit = runSeconds(currentSettings);
        const progress = timed
          ? Math.min(1, elapsedNow / limit)
          : currentSettings.mode === "zen"
            ? 0
            : entriesRef.current.length
              ? Math.min(1, activeRef.current / entriesRef.current.length)
              : 0;
        const accuracyNow = totalKeys
          ? Math.round((keysCorrectRef.current / totalKeys) * 100)
          : 100;
        const wpmNow = wpmFromCorrectChars(net.correct, Math.max(0.5, elapsedNow));
        if (timed) {
          setRemaining(Math.max(0, limit - elapsedNow));
        }
        setElapsed(elapsedNow);
        const recentSamples = samplesRef.current.slice(-3);
        const burstNow = recentSamples.length
          ? Math.round(
              recentSamples.reduce((sum, value) => sum + value, 0) /
                recentSamples.length,
            )
          : wpmNow;
        setLive({
          wpm: wpmNow,
          accuracy: accuracyNow,
          progress,
          burst: burstNow,
          score: scoreRun({
            correctChars: net.correct,
            correctWords: net.correctWords,
            wpm: wpmNow,
            accuracy: accuracyNow,
            difficulty: currentSettings.difficulty,
          }),
        });

        const losing =
          elapsedNow > 2.5 &&
          totalKeys > 8 &&
          ((currentSettings.minWpm > 0 && wpmNow < currentSettings.minWpm) ||
            (currentSettings.minAccuracy > 0 &&
              accuracyNow < currentSettings.minAccuracy));
        if (losing) {
          const reason =
            currentSettings.minAccuracy > 0 &&
            accuracyNow < currentSettings.minAccuracy
              ? "accuracy fell below the minimum"
              : "speed fell below the minimum";
          finishRun(elapsedNow, reason);
          return;
        }

        if (currentSettings.minBurst > 0 && elapsedNow > 4) {
          const recent = samplesRef.current.slice(-3);
          const burst = recent.length
            ? recent.reduce((sum, value) => sum + value, 0) / recent.length
            : wpmNow;
          if (burst < currentSettings.minBurst) {
            finishRun(elapsedNow, "word burst fell below the minimum");
            return;
          }
        }

        updatePace(elapsedNow, net.correct);
      }

      if (
        isTimedMode(currentSettings) &&
        currentSettings.timeWarningSound &&
        !warnedRef.current &&
        runSeconds(currentSettings) - elapsedNow <= 5
      ) {
        warnedRef.current = true;
        playSound("time");
      }

      if (isTimedMode(currentSettings) && elapsedNow >= runSeconds(currentSettings)) {
        finishRun(elapsedNow);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [finishRun, updatePace]);

  const beginRun = useCallback(() => {
    primeAudio();
    startRef.current = performance.now();
    wordStartRef.current = performance.now();
    pausedRef.current = null;
    warnedRef.current = false;
    statusRef.current = "running";
    setStatus("running");
    setElapsed(0);
    setRemaining(runSeconds(settingsRef.current));
    lastSampleRef.current = { time: 0, correct: 0 };
    nextSampleRef.current = 1;
    samplesRef.current = [];
    startLoop();
  }, [startLoop]);

  loopRef.current = startLoop;
  beginRunRef.current = beginRun;

  /* A race carries its own seed and settings, so both machines type the same
     words with the same clock. */
  const lastRaceRef = useRef(0);
  useEffect(() => {
    const race = duel.race;
    if (!race) {
      if (lastRaceRef.current !== 0) {
        lastRaceRef.current = 0;
        duelLockRef.current = false;
        setDuelCountdown(0);
      }
      return;
    }
    if (lastRaceRef.current === race.nonce) return;
    lastRaceRef.current = race.nonce;
    duelLockRef.current = true;
    const merged = sanitizeSettings({
      ...settingsRef.current,
      mode: race.settings.mode,
      duration: race.settings.duration,
      wordCount: race.settings.wordCount,
      punctuation: race.settings.punctuation,
      numbers: race.settings.numbers,
      difficulty: race.settings.difficulty,
      language: race.settings.language,
      funbox: "none",
      lazyMode: false,
      minWpm: 0,
      minAccuracy: 0,
      minBurst: 0,
      stopOnError: false,
      deleteOnError: false,
      quickEnd: false,
    });
    settingsRef.current = merged;
    setSettings(merged);
    seedRef.current = race.seed;
    extendRef.current = 0;
    setResult(null);
    setSubmitRank(null);
    setTest(generateTest(race.seed, merged));
  }, [duel.race]);

  /* The server clock is authoritative; compensate for the client's offset. */
  useEffect(() => {
    const race = duel.race;
    if (!race) return;
    const startAt = race.startAt - duel.clockOffset.current;
    const tick = () => {
      setDuelCountdown(Math.max(0, Math.ceil((startAt - Date.now()) / 1000)));
    };
    tick();
    const interval = window.setInterval(tick, 120);
    const start = window.setTimeout(
      () => {
        setDuelCountdown(0);
        duelLockRef.current = false;
        if (statusRef.current === "idle") beginRunRef.current();
      },
      Math.max(0, startAt - Date.now()),
    );
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(start);
    };
  }, [duel.race, duel.clockOffset]);

  useEffect(() => {
    if (duel.race) setMultiplayerOpen(false);
  }, [duel.race]);

  /* The opponent's keys must animate their fighter, not just update numbers. */
  useEffect(() => {
    const key = duel.peerKey;
    if (!key) return;
    if (key.correct) opponentFighterRef.current?.jab();
    else opponentFighterRef.current?.hurt();
  }, [duel.peerKey]);

  useEffect(() => {
    const word = duel.peerWord;
    if (!word) return;
    if (!word.correct) {
      opponentFighterRef.current?.hurt();
      return;
    }
    const kind = (FINISHERS as string[]).includes(word.kind)
      ? (word.kind as Finisher)
      : "cross";
    opponentFighterRef.current?.heavy(kind);
  }, [duel.peerWord]);

  useEffect(() => {
    if (!duel.peerFinish) return;
    const name =
      duel.room?.players.find((player) => player.id === duel.peerFinish?.id)?.name ??
      "opponent";
    setNotice(`${name} finished with ${duel.peerFinish.result.score} points`);
  }, [duel.peerFinish]);

  /* Send a compact state snapshot; keys and words already travel separately. */
  useEffect(() => {
    const race = duel.race;
    const room = duel.room;
    if (!race || !room) return;
    const now = performance.now();
    if (status === "running" && now - lastDuelStateRef.current < 140) return;
    lastDuelStateRef.current = now;
    const entry = entries[activeIndex];
    duelRef.current.sendState({
      status,
      wpm: live.wpm,
      accuracy: live.accuracy,
      progress: live.progress,
      score: live.score,
      index: activeIndex,
      word: entry?.word ?? "",
      typed: entry && !entry.submitted ? typed : entry?.typed ?? "",
      combo: 0,
    });
  }, [
    duel.race,
    duel.room,
    status,
    live.wpm,
    live.accuracy,
    live.progress,
    live.score,
    activeIndex,
    typed,
    entries,
  ]);

  const pauseRun = useCallback(() => {
    if (statusRef.current !== "running" || pausedRef.current !== null) return;
    pausedRef.current = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const resumeRun = useCallback(() => {
    if (pausedRef.current === null) return;
    const pausedFor = performance.now() - pausedRef.current;
    pausedRef.current = null;
    if (startRef.current !== null) startRef.current += pausedFor;
    if (statusRef.current === "running") loopRef.current();
  }, []);

  useEffect(() => {
    if (commandOpen || editorOpen || rulesOpen || settingsOpen) pauseRun();
    else resumeRun();
  }, [commandOpen, editorOpen, rulesOpen, settingsOpen, pauseRun, resumeRun]);

  const applySettings = useCallback((patch: Partial<TestSettings>) => {
    const next = sanitizeSettings({ ...settingsRef.current, ...patch });
    settingsRef.current = next;
    setSettings(next);
    saveSettings(next);
    setSoundConfig({
      volume: next.volume / 100,
      click: next.clickSound,
      error: next.errorSound,
      timeWarning: next.timeWarningSound,
    });
    const seed = makeSeed();
    seedRef.current = seed;
    extendRef.current = 0;
    setTest(generateTest(seed, next));
  }, []);

  const openCommand = useCallback(() => {
    setPaletteOpen(false);
    setCommandOpen(true);
  }, []);

  const selectMode = useCallback(
    (mode: TestMode) => {
      applySettings({ mode });
      if (mode === "custom" && !settingsRef.current.customText.trim()) {
        setEditorOpen(true);
      }
    },
    [applySettings],
  );

  const openCustomEditor = useCallback(() => setEditorOpen(true), []);

  const openRules = useCallback(() => {
    setPaletteOpen(false);
    setRulesOpen(true);
  }, []);

  const applyRules = useCallback(
    (patch: Partial<TestSettings>) => {
      setRulesOpen(false);
      applySettings({ mode: "custom", ...patch });
    },
    [applySettings],
  );

  const applyCustomText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setEditorOpen(false);
      applySettings({ mode: "custom", customText: trimmed });
    },
    [applySettings],
  );

  const flashNotice = useCallback((message: string) => {
    setNotice(message);
  }, []);

  const openSettings = useCallback(() => {
    setPaletteOpen(false);
    setCommandOpen(false);
    setSettingsOpen(true);
  }, []);

  const applySettingsDialog = useCallback(
    (next: TestSettings) => {
      setSettingsOpen(false);
      applySettings(next);
      flashNotice("settings applied");
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 40);
    },
    [applySettings, flashNotice],
  );

  const resetAllSettings = useCallback(() => {
    clearSettings();
    try {
      window.localStorage.removeItem("platen:palette");
      window.localStorage.removeItem(THEME_KEY);
      window.localStorage.removeItem(SOUND_KEY);
      window.localStorage.removeItem(HISTORY_KEY);
      const doomed: string[] = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith("platen:best:")) doomed.push(key);
      }
      doomed.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Ignore storage failures.
    }

    settingsRef.current = DEFAULT_SETTINGS;
    setSettings(DEFAULT_SETTINGS);
    setSound(true);
    soundRef.current = true;
    setSoundEnabled(true);
    setSoundConfig({
      volume: DEFAULT_SETTINGS.volume / 100,
      click: true,
      error: true,
      timeWarning: true,
    });
    applyThemeId(DEFAULT_THEME_ID);
    historyRef.current = [];
    setHistory([]);
    setBest(0);
    setNewBest(false);
    setSettingsOpen(false);
    seedRef.current = makeSeed();
    extendRef.current = 0;
    setTest(generateTest(seedRef.current, DEFAULT_SETTINGS));
    flashNotice("settings reset");
  }, [applyThemeId, flashNotice]);

  const exportSettings = useCallback(() => {
    const payload = JSON.stringify(settingsRef.current, null, 2);
    const done = () => flashNotice("settings copied to clipboard");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(payload).then(done).catch(() => {
        window.prompt("Copy your settings", payload);
      });
    } else {
      window.prompt("Copy your settings", payload);
    }
  }, [flashNotice]);

  const importSettings = useCallback(() => {
    const raw = window.prompt("Paste a Platen settings JSON export");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const next = sanitizeSettings(parsed);
      setSettingsOpen(false);
      applySettings(next);
      flashNotice("settings imported");
    } catch {
      flashNotice("that settings file could not be read");
    }
  }, [applySettings, flashNotice]);

  const hasWrongPrefix = useCallback((currentTyped: string, word: string) => {
    for (let i = 0; i < currentTyped.length; i += 1) {
      if (currentTyped[i] !== word[i]) return true;
    }
    return false;
  }, []);

  const pushChar = useCallback(
    (char: string, shiftWrong = false) => {
      if (duelLockRef.current) return;
      if (statusRef.current === "finished") {
        return;
      }
      if (statusRef.current === "idle") {
        const first = entriesRef.current[0];
        if (!first) return;
        beginRun();
      }
      if (statusRef.current !== "running") return;

      const current = settingsRef.current;
      const entry = entriesRef.current[activeRef.current];
      if (!entry) return;
      const currentTyped = typedRef.current;
      if (currentTyped.length >= entry.word.length + 8) return;
      if (current.stopOnError && hasWrongPrefix(currentTyped, entry.word)) {
        return;
      }

      const expected = entry.word[currentTyped.length];
      const correct = !shiftWrong && expected === char;
      keysTotalRef.current += 1;
      if (correct) keysCorrectRef.current += 1;
      duelRef.current.sendKey(char, correct, activeRef.current);

      const point = letterPoint(Math.min(currentTyped.length, entry.word.length));
      const nextTyped = currentTyped + char;
      setLastKey(char);
      if (current.compositionDisplay) setComposition("");

      if (correct) {
        typedRef.current = nextTyped;
        setTyped(nextTyped);
        fighterRef.current?.jab();
        // The fist needs a beat to reach the letter; fire the impact and the
        // sound on that contact frame instead of on the keypress.
        const hit = window.setTimeout(() => {
          playSound("jab");
          spawnFx(point.x, point.y, "hit");
        }, JAB_CONTACT_MS);
        timersRef.current.push(hit);
        return;
      }

      fighterRef.current?.hurt();
      playSound("miss");
      spawnFx(point.x, point.y, "miss");
      if (!current.blindMode) flashError();

      if (current.difficulty === "hard") {
        const end = startRef.current
          ? (performance.now() - startRef.current) / 1000
          : 0;
        finishRun(end, "hard difficulty: any wrong key fails the run");
        return;
      }

      // Delete on error keeps a wrong key from ever entering the word.
      if (current.deleteOnError) return;

      typedRef.current = nextTyped;
      setTyped(nextTyped);
    },
    [
      beginRun,
      finishRun,
      flashError,
      hasWrongPrefix,
      letterPoint,
      spawnFx,
    ],
  );

  const backspace = useCallback(() => {
    if (duelLockRef.current) return;
    if (statusRef.current !== "running") return;
    const current = settingsRef.current;
    if (current.confidence === "max") return;

    const entry = entriesRef.current[activeRef.current];
    if (!entry) return;

    if (current.codeUnindent && typedRef.current && !typedRef.current.trim()) {
      typedRef.current = "";
      setTyped("");
      return;
    }

    if (typedRef.current) {
      const next = typedRef.current.slice(0, -1);
      typedRef.current = next;
      setTyped(next);
      return;
    }

    // Freedom mode reopens the previous word, even when it was correct.
    if (!current.freedom || current.confidence !== "off" || activeRef.current === 0) {
      return;
    }
    const previousIndex = activeRef.current - 1;
    const previous = entriesRef.current[previousIndex];
    if (!previous) return;
    const restored = previous.typed.slice(0, -1);
    const nextEntries = entriesRef.current.slice();
    nextEntries[previousIndex] = {
      ...previous,
      typed: restored,
      submitted: false,
      correct: null,
    };
    entriesRef.current = nextEntries;
    setEntries(nextEntries);
    activeRef.current = previousIndex;
    setActiveIndex(previousIndex);
    typedRef.current = restored;
    setTyped(restored);
    wordStartRef.current = performance.now();
  }, []);

  const submitWord = useCallback(() => {
    if (duelLockRef.current) return;
    if (statusRef.current !== "running") return;
    const current = settingsRef.current;
    const currentTyped = typedRef.current;
    if (!currentTyped) return;
    const index = activeRef.current;
    const entry = entriesRef.current[index];
    if (!entry) return;

    const exact = currentTyped === entry.word;
    if (current.stopOnError && !exact && hasWrongPrefix(currentTyped, entry.word)) {
      return;
    }

    const point = arenaPoint();
    const nextEntries = entriesRef.current.slice();
    nextEntries[index] = {
      ...entry,
      typed: currentTyped,
      submitted: true,
      correct: exact,
    };
    entriesRef.current = nextEntries;
    setEntries(nextEntries);

    typedRef.current = "";
    setTyped("");
    const nextIndex = index + 1;
    activeRef.current = nextIndex;
    setActiveIndex(nextIndex);
    wordStartRef.current = performance.now();
    duelRef.current.sendWord(
      entry.word,
      exact ? FINISHERS[index % FINISHERS.length] : "miss",
      exact,
      index,
    );

    if (exact) {
      const finisher = FINISHERS[index % FINISHERS.length];
      const feedback = FINISHER_FEEDBACK[finisher];
      fighterRef.current?.heavy(finisher);
      // The move winds up first; the impact lands at its contact frame.
      const impact = window.setTimeout(() => {
        playSound(feedback.sound);
        spawnSmash(entry.word, finisher);
        spawnFx(point.x + 12, point.y, "heavy");
        shake(feedback.shake);
      }, feedback.delay);
      timersRef.current.push(impact);
    } else {
      playSound("miss");
      if (!current.blindMode) {
        spawnSmash(entry.word, "miss");
        spawnFx(point.x + 12, point.y, "miss");
        shake(2);
        flashError();
      }
    }

    if (!exact && current.difficulty === "medium") {
      const endedAt = startRef.current
        ? (performance.now() - startRef.current) / 1000
        : 0;
      const fail = window.setTimeout(
        () => finishRun(endedAt, "medium difficulty: a wrong word fails the run"),
        220,
      );
      timersRef.current.push(fail);
      return;
    }

    const atEnd = nextIndex >= entriesRef.current.length;
    if (atEnd && runIsFinite(current)) {
      // Quick end forgives the last word. Without it, a wrong last word pulls
      // more text in so the run ends on a landed word.
      const extendable =
        current.mode === "words" ||
        (current.mode === "custom" && current.customLimit !== "time");
      if (!exact && !current.quickEnd && extendable) {
        maybeExtend(nextIndex);
        return;
      }
      // Let the final finisher reach its contact frame before the overlay.
      const finishedAt = startRef.current
        ? (performance.now() - startRef.current) / 1000
        : 0;
      const done = window.setTimeout(() => finishRun(finishedAt), 420);
      timersRef.current.push(done);
      return;
    }

    maybeExtend(nextIndex);
  }, [
    arenaPoint,
    finishRun,
    flashError,
    hasWrongPrefix,
    maybeExtend,
    shake,
    spawnFx,
    spawnSmash,
  ]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.isComposing) return;
      // A child (command input, custom editor, rules dialog) handled this key.
      if (event.defaultPrevented) return;
      if (commandOpen || editorOpen || rulesOpen || settingsOpen) return;
      if (multiplayerOpen || leaderboardOpen || authOpen) return;
      if (duelLockRef.current) {
        if (event.key !== "Escape") event.preventDefault();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "p"
      ) {
        event.preventDefault();
        openCommand();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const current = settingsRef.current;

      if (event.key === "Escape") {
        event.preventDefault();
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        if (current.quickRestart === "esc" && statusRef.current === "running") {
          replay();
          return;
        }
        openCommand();
        return;
      }
      if (event.key === "Tab") {
        if (paletteOpen) return;
        if (current.quickRestart === "tab") {
          event.preventDefault();
          replay();
        }
        return;
      }

      if (statusRef.current === "finished") {
        if (duelRef.current.race) {
          if (
            duelRef.current.result &&
            duelRef.current.room?.hostId === duelRef.current.selfId &&
            (event.key === "Enter" || event.key.toLowerCase() === "n")
          ) {
            event.preventDefault();
            duelRef.current.rematch();
          }
          return;
        }
        if (event.key === "Enter" || event.key.toLowerCase() === "n") {
          event.preventDefault();
          replay();
        }
        return;
      }

      if (
        event.key === "Enter" &&
        statusRef.current === "running" &&
        current.mode === "zen"
      ) {
        event.preventDefault();
        if (startRef.current !== null) {
          finishRun((performance.now() - startRef.current) / 1000);
        }
        return;
      }

      if (
        event.key === "Enter" &&
        current.quickRestart === "enter" &&
        statusRef.current === "idle"
      ) {
        event.preventDefault();
        replay();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        setLastKey(" ");
        const entry = entriesRef.current[activeRef.current];
        const insideGroup =
          statusRef.current === "running" &&
          entry &&
          typedRef.current.length < entry.word.length &&
          entry.word[typedRef.current.length] === " ";
        if (insideGroup) {
          // A pipe-delimited custom group keeps its words together, so the
          // space between them is typed instead of submitting the entry.
          pushChar(" ");
        } else if (!typedRef.current && current.strictSpace) {
          pushChar(" ");
        } else {
          submitWord();
        }
        return;
      }
      if (event.key === "Enter") return;
      if (event.key.length !== 1) return;

      const char = layoutChar(event, current.layout);
      if (char === null) return;
      event.preventDefault();
      setLastKey(char);

      let shiftWrong = false;
      if (current.oppositeShift && /[A-Z]/.test(char)) {
        shiftWrong = oppositeShiftCheck(event, char).wrong;
      }
      pushChar(char, shiftWrong);
    },
    [
      backspace,
      commandOpen,
      editorOpen,
      finishRun,
      multiplayerOpen,
      leaderboardOpen,
      authOpen,
      openCommand,
      paletteOpen,
      pushChar,
      replay,
      rulesOpen,
      settingsOpen,
      submitWord,
    ],
  );

  handlerRef.current = onKeyDown;

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handlerRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const applySound = useCallback((next: boolean) => {
    soundRef.current = next;
    setSound(next);
    setSoundEnabled(next);
    if (next) {
      primeAudio();
      playSound("jab");
    }
    try {
      window.localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const toggleSound = useCallback(() => {
    applySound(!soundRef.current);
  }, [applySound]);

  const chooseTheme = useCallback(
    (next: ThemeId) => {
      applyThemeId(next);
      setPaletteOpen(false);
    },
    [applyThemeId],
  );

  const focusInput = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const finishNow = useCallback(() => {
    if (statusRef.current !== "running" || startRef.current === null) return;
    const end = pausedRef.current ?? performance.now();
    finishRun((end - startRef.current) / 1000);
  }, [finishRun]);

  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];
    const add = (
      id: string,
      label: string,
      hint: string,
      run: () => void,
    ) => items.push({ id, label, hint, run });

    TIME_OPTIONS.forEach((duration) =>
      add(
        `time-${duration}`,
        `time ${duration}`,
        `${duration} second test`,
        () => applySettings({ mode: "time", duration }),
      ),
    );
    WORD_OPTIONS.forEach((wordCount) =>
      add(
        `words-${wordCount}`,
        `words ${wordCount}`,
        `${wordCount} word test`,
        () => applySettings({ mode: "words", wordCount }),
      ),
    );
    QUOTE_OPTIONS.forEach((option) =>
      add(
        `quote-${option.id}`,
        `quote ${option.label}`,
        `${option.label} quotes`,
        () => applySettings({ mode: "quote", quoteLength: option.id }),
      ),
    );
    add("mode-zen", "zen", "endless run, enter finishes", () =>
      applySettings({ mode: "zen" }),
    );
    add("mode-custom", "custom", "write or paste your own text", () => {
      applySettings({ mode: "custom" });
      setEditorOpen(true);
    });
    add(
      "text-rules",
      "text rules",
      "order, limit, delimiter, cleanup",
      () => {
        applySettings({ mode: "custom" });
        openRules();
      },
    );
    CUSTOM_ORDER_OPTIONS.forEach((option) =>
      add(
        `custom-order-${option.id}`,
        `custom ${option.label}`,
        `${option.label} word order`,
        () => applySettings({ mode: "custom", customOrder: option.id }),
      ),
    );
    CUSTOM_LIMIT_OPTIONS.forEach((option) =>
      add(
        `custom-limit-${option.id}`,
        `limit ${option.label}`,
        `custom runs end by ${option.label}`,
        () => applySettings({ mode: "custom", customLimit: option.id }),
      ),
    );
    CUSTOM_WORD_OPTIONS.forEach((customWords) =>
      add(
        `custom-words-${customWords}`,
        `custom words ${customWords}`,
        `${customWords} words from your text`,
        () =>
          applySettings({
            mode: "custom",
            customLimit: "words",
            customWords,
          }),
      ),
    );
    CUSTOM_TIME_OPTIONS.forEach((customSeconds) =>
      add(
        `custom-time-${customSeconds}`,
        `custom time ${customSeconds}`,
        `${customSeconds} second custom run`,
        () =>
          applySettings({
            mode: "custom",
            customLimit: "time",
            customSeconds,
          }),
      ),
    );
    CUSTOM_SECTION_OPTIONS.forEach((customSections) =>
      add(
        `custom-sections-${customSections}`,
        `custom sections ${customSections}`,
        `${customSections} ${
          customSections === 1 ? "section" : "sections"
        } of your text`,
        () =>
          applySettings({
            mode: "custom",
            customLimit: "sections",
            customSections,
          }),
      ),
    );
    add("delimiter-space", "delimiter space", "spaces split words", () =>
      applySettings({ mode: "custom", wordDelimiter: " " }),
    );
    add("delimiter-pipe", "delimiter pipe", "pipe splits, spaces stay grouped", () =>
      applySettings({ mode: "custom", wordDelimiter: "|" }),
    );
    add(
      "zero-width",
      "remove zero-width",
      settings.removeZeroWidth
        ? "turn zero-width cleanup off"
        : "turn zero-width cleanup on",
      () =>
        applySettings({
          mode: "custom",
          removeZeroWidth: !settings.removeZeroWidth,
        }),
    );
    add(
      "fancy-typography",
      "remove fancy typography",
      settings.removeFancyTypography
        ? "keep curly quotes and dashes"
        : "turn curly quotes and dashes into keys",
      () =>
        applySettings({
          mode: "custom",
          removeFancyTypography: !settings.removeFancyTypography,
        }),
    );
    add(
      "control-chars",
      "replace control characters",
      settings.replaceControlChars
        ? "keep literal control escapes"
        : "turn literal \\n and \\t into real ones",
      () =>
        applySettings({
          mode: "custom",
          replaceControlChars: !settings.replaceControlChars,
        }),
    );
    add(
      "newlines",
      "replace newlines",
      settings.replaceNewlines
        ? "keep line breaks as sections"
        : "flatten line breaks into one stream",
      () =>
        applySettings({
          mode: "custom",
          replaceNewlines: !settings.replaceNewlines,
        }),
    );
    add(
      "add-periods",
      "add periods",
      settings.addPeriods
        ? "stop adding periods to flattened lines"
        : "end each flattened line with a period",
      () =>
        applySettings({
          mode: "custom",
          addPeriods: !settings.addPeriods,
        }),
    );
    add(
      "punctuation-toggle",
      "punctuation",
      settings.punctuation ? "turn punctuation off" : "turn punctuation on",
      () => applySettings({ punctuation: !settings.punctuation }),
    );
    add("punctuation-on", "punctuation on", "keep the corpus punctuation", () =>
      applySettings({ punctuation: true }),
    );
    add("punctuation-off", "punctuation off", "strip edge punctuation", () =>
      applySettings({ punctuation: false }),
    );
    add(
      "numbers-toggle",
      "numbers",
      settings.numbers ? "turn numbers off" : "turn numbers on",
      () => applySettings({ numbers: !settings.numbers }),
    );
    add("numbers-on", "numbers on", "inject numeric drill tokens", () =>
      applySettings({ numbers: true }),
    );
    add("numbers-off", "numbers off", "use words only", () =>
      applySettings({ numbers: false }),
    );
    THEME_OPTIONS.forEach((option) =>
      add(
        `theme-${option.id}`,
        `theme ${option.label} ${option.mode}`,
        `${option.label} in ${option.mode} mode`,
        () => chooseTheme(option.id),
      ),
    );
    add("sound-toggle", "sound", "toggle sound", toggleSound);
    add("sound-on", "sound on", "enable hits and impacts", () =>
      applySound(true),
    );
    add("sound-off", "sound off", "mute the arena", () => applySound(false));
    add("settings", "settings", "every test, input, display and audio rule", () =>
      openSettings(),
    );
    add("settings-export", "export settings", "copy a settings JSON file", exportSettings);
    add("settings-import", "import settings", "paste a settings JSON file", importSettings);
    add("settings-reset", "reset settings", "restore every default", resetAllSettings);

    add("difficulty-easy", "difficulty easy", "mistakes are forgiven", () =>
      applySettings({ difficulty: "easy" }),
    );
    add("difficulty-medium", "difficulty medium", "a wrong word ends the run", () =>
      applySettings({ difficulty: "medium" }),
    );
    add("difficulty-hard", "difficulty hard", "any wrong key ends the run", () =>
      applySettings({ difficulty: "hard" }),
    );
    add("duel", "duel arena", "create or join a live race", () => {
      setArenaMenuOpen(false);
      setMultiplayerOpen(true);
    });
    add("leaderboard", "leaderboard", "best scores by difficulty", () => {
      setArenaMenuOpen(false);
      setLeaderboardOpen(true);
    });
    add("account", "account", "username and oauth sign-in", () => {
      setArenaMenuOpen(false);
      setAuthOpen(true);
    });
    add(
      "stop-on-error",
      "stop on error",
      settings.stopOnError ? "let typing continue past mistakes" : "block progress until fixed",
      () => applySettings({ stopOnError: !settings.stopOnError }),
    );
    add(
      "delete-on-error",
      "delete on error",
      settings.deleteOnError ? "keep wrong keys visible" : "remove wrong keys at once",
      () => applySettings({ deleteOnError: !settings.deleteOnError }),
    );
    add(
      "blind-mode",
      "blind mode",
      settings.blindMode ? "show errors again" : "hide every error marker",
      () => applySettings({ blindMode: !settings.blindMode }),
    );
    add(
      "freedom",
      "freedom mode",
      settings.freedom ? "lock previous words" : "delete correct words with backspace",
      () => applySettings({ freedom: !settings.freedom }),
    );
    add(
      "strict-space",
      "strict space",
      settings.strictSpace ? "ignore leading spaces" : "count leading spaces as keys",
      () => applySettings({ strictSpace: !settings.strictSpace }),
    );
    add(
      "quick-end",
      "quick end",
      settings.quickEnd ? "require a clean final word" : "end on the last word even if wrong",
      () => applySettings({ quickEnd: !settings.quickEnd }),
    );

    add("language-english", "language english", "standard american spellings", () =>
      applySettings({ language: "english" }),
    );
    add("language-british", "language british", "colour, centre, realise", () =>
      applySettings({ language: "british" }),
    );
    ["none", "mirror", "reverse", "caps"].forEach((funbox) =>
      add(
        `funbox-${funbox}`,
        `funbox ${funbox}`,
        funbox === "none" ? "plain drill text" : `${funbox} novelty text`,
        () => applySettings({ funbox: funbox as TestSettings["funbox"] }),
      ),
    );
    ["qwerty", "dvorak", "colemak"].forEach((layout) =>
      add(
        `layout-${layout}`,
        `layout ${layout}`,
        `type as if the keys were ${layout}`,
        () => applySettings({ layout: layout as TestSettings["layout"] }),
      ),
    );
    add(
      "lazy-mode",
      "lazy mode",
      settings.lazyMode ? "restore accents" : "plain letters for accented text",
      () => applySettings({ lazyMode: !settings.lazyMode }),
    );

    ["tab", "esc", "enter", "off"].forEach((key) =>
      add(
        `quick-restart-${key}`,
        `quick restart ${key}`,
        key === "off" ? "disable the restart key" : `${key} restarts the test`,
        () => applySettings({ quickRestart: key as TestSettings["quickRestart"] }),
      ),
    );
    add(
      "repeat-quotes",
      "repeat quotes",
      settings.repeatQuotes ? "draw a new quote on restart" : "keep the quote on restart",
      () => applySettings({ repeatQuotes: !settings.repeatQuotes }),
    );
    add(
      "words-history",
      "words history",
      settings.wordsHistory ? "hide the word breakdown" : "show every word after a run",
      () => applySettings({ wordsHistory: !settings.wordsHistory }),
    );

    add(
      "tape-mode",
      "tape mode",
      settings.tapeMode ? "return to the word queue" : "one scrolling line",
      () => applySettings({ tapeMode: !settings.tapeMode }),
    );
    add(
      "smooth-caret",
      "smooth caret",
      settings.smoothCaret ? "snap the caret" : "glide the caret",
      () => applySettings({ smoothCaret: !settings.smoothCaret }),
    );
    ["line", "block", "underline", "off"].forEach((style) =>
      add(
        `caret-${style}`,
        `caret ${style}`,
        `${style} caret style`,
        () => applySettings({ caretStyle: style as TestSettings["caretStyle"] }),
      ),
    );
    add(
      "keymap-mode",
      "keymap mode",
      settings.keymapMode ? "hide the on-screen keys" : "show the on-screen keyboard",
      () => applySettings({ keymapMode: !settings.keymapMode }),
    );
    add(
      "colourful",
      "colourful mode",
      settings.colorfulMode ? "one colour for every word" : "give each word its own hue",
      () => applySettings({ colorfulMode: !settings.colorfulMode }),
    );
    add(
      "flip-colours",
      "flip test colours",
      settings.flipTestColors ? "restore the test colours" : "invert the word stream",
      () => applySettings({ flipTestColors: !settings.flipTestColors }),
    );
    ["wpm", "cpm", "wps", "cps"].forEach((unit) =>
      add(
        `unit-${unit}`,
        `speed unit ${unit}`,
        `${unit} result and live readout`,
        () => applySettings({ speedUnit: unit as TestSettings["speedUnit"] }),
      ),
    );
    add(
      "result-decimals",
      "always show decimals",
      settings.resultDecimals ? "round speed results" : "keep one decimal place",
      () => applySettings({ resultDecimals: !settings.resultDecimals }),
    );
    add(
      "show-average",
      "show average",
      settings.showAverage ? "hide the last-ten average" : "show the last-ten average",
      () => applySettings({ showAverage: !settings.showAverage }),
    );

    add(
      "random-theme",
      "random theme",
      settings.randomTheme ? "keep the current theme" : "new theme each restart",
      () => applySettings({ randomTheme: !settings.randomTheme }),
    );
    add(
      "key-tips",
      "key tips",
      settings.keyTips ? "hide the shortcut strip" : "show the shortcut strip",
      () => applySettings({ keyTips: !settings.keyTips }),
    );
    add(
      "focus-warning",
      "out of focus warning",
      settings.outOfFocusWarning ? "hide the focus nudge" : "nudge when focus is lost",
      () => applySettings({ outOfFocusWarning: !settings.outOfFocusWarning }),
    );
    add(
      "caps-warning",
      "caps lock warning",
      settings.capsLockWarning ? "hide the caps lock badge" : "show the caps lock badge",
      () => applySettings({ capsLockWarning: !settings.capsLockWarning }),
    );
    add("cookies-accept", "cookies accept", "store the local preference", () =>
      applySettings({ cookies: "accepted" }),
    );
    add("cookies-reject", "cookies reject", "decline tracking cookies", () =>
      applySettings({ cookies: "rejected" }),
    );
    add(
      "ads-toggle",
      "ads",
      settings.ads ? "hide the sponsor line" : "show a sponsor line",
      () => applySettings({ ads: !settings.ads }),
    );

    add("restart", "restart", "new text with these settings", replay);
    add("edit-text", "edit text", "open the custom text editor", () =>
      setEditorOpen(true),
    );
    add("finish-run", "finish run", "end the current run now", finishNow);

    return items;
  }, [
    applySettings,
    applySound,
    applyThemeId,
    chooseTheme,
    exportSettings,
    finishNow,
    importSettings,
    openRules,
    openSettings,
    replay,
    resetAllSettings,
    settings.addPeriods,
    settings.ads,
    settings.blindMode,
    settings.colorfulMode,
    settings.deleteOnError,
    settings.flipTestColors,
    settings.freedom,
    settings.keyTips,
    settings.lazyMode,
    settings.numbers,
    settings.outOfFocusWarning,
    settings.punctuation,
    settings.quickEnd,
    settings.randomTheme,
    settings.removeFancyTypography,
    settings.removeZeroWidth,
    settings.repeatQuotes,
    settings.replaceControlChars,
    settings.replaceNewlines,
    settings.resultDecimals,
    settings.showAverage,
    settings.smoothCaret,
    settings.stopOnError,
    settings.strictSpace,
    settings.tapeMode,
    settings.wordsHistory,
    settings.capsLockWarning,
    settings.keymapMode,
    toggleSound,
  ]);

  const timedMode = isTimedMode(settings);
  const countMode =
    settings.mode === "words" ||
    (settings.mode === "custom" && settings.customLimit === "words");
  const sectionMode =
    settings.mode === "custom" && settings.customLimit === "sections";
  const sectionStarts = test.sectionStarts ?? [];
  const doneSections = sectionStarts.filter((start) => start < activeIndex).length;
  const sectionsLeft = Math.max(0, sectionStarts.length - doneSections);
  const clock = timedMode
    ? Math.max(0, Math.ceil(remaining))
    : countMode
      ? Math.max(0, entries.length - activeIndex)
      : sectionMode
        ? sectionsLeft
        : Math.floor(elapsed);
  const clockUnit = timedMode
    ? "sec"
    : countMode
      ? "words"
      : sectionMode
        ? "sect"
        : "sec";
  const clockUrgent = timedMode && clock <= 5 && status === "running";
  const activeEntry = entries[activeIndex];
  const currentTyped = activeEntry ? typed : "";
  const editorSeed =
    settings.customText ||
    (settings.mode === "custom" ? test.text : DEFAULT_CUSTOM_TEXT);
  const activeTheme = themeOption(themeId);
  const themeGroups = THEME_MODES.map((mode) => ({
    mode,
    options: THEME_OPTIONS.filter((option) => option.mode === mode),
  }));
  const speedUnit = settings.speedUnit;
  const recentAverage = averageRecord(history);
  const strike = strikeOffset(settings);
  const stageStyle = {
    "--strike-x": `${strike}px`,
    "--drill-font": fontStack(settings),
    ...(settings.fontSize > 0
      ? { "--word-size": `${settings.fontSize}px` }
      : {}),
  } as CSSProperties;
  const stageClass = [
    "stage",
    settings.blindMode ? "is-blind" : "",
    settings.flipTestColors ? "is-flipped" : "",
    settings.colorfulMode ? "is-colourful" : "",
    settings.tapeMode ? "is-tape" : "",
    settings.showAllLines ? "show-all-lines" : "",
    settings.highlightMode === "word" ? "highlight-word" : "",
    settings.highlightMode === "letter" ? "highlight-letter" : "",
    settings.typedEffect !== "off" ? `effect-${settings.typedEffect}` : "",
    settings.hideExtraLetters ? "hide-extras" : "",
    settings.smoothLineScroll ? "smooth-scroll" : "snap-scroll",
    settings.smoothCaret ? "smooth-caret" : "snap-caret",
  ]
    .filter(Boolean)
    .join(" ");
  const liveColor =
    settings.liveColor === "accent"
      ? "var(--accent)"
      : settings.liveColor === "text"
        ? "var(--text)"
        : "var(--muted)";

  const peerPlayer = duel.room?.players.find(
    (player) => player.id !== duel.selfId,
  );
  const duelWinner = duel.result?.players.find(
    (player) => player.id === duel.result?.winnerId,
  );
  const duelOutcome = duel.result
    ? duel.result.winnerId === duel.selfId
      ? "win"
      : duel.result.winnerId
        ? "loss"
        : "draw"
    : null;
  const selfEntry = entries[activeIndex];
  const selfDuelState = {
    name: auth.displayName,
    score: live.score,
    wpm: live.wpm,
    accuracy: live.accuracy,
    progress: live.progress,
    word: selfEntry?.word ?? "",
    typed: selfEntry && !selfEntry.submitted ? typed : selfEntry?.typed ?? "",
  };

  return (
    <main
      className="app"
      style={
        settings.customBackground
          ? ({ "--custom-background": settings.customBackground } as CSSProperties)
          : undefined
      }
      onMouseDown={() => {
        if (
          commandOpen ||
          editorOpen ||
          rulesOpen ||
          settingsOpen ||
          multiplayerOpen ||
          leaderboardOpen ||
          authOpen
        ) {
          return;
        }
        focusInput();
      }}
    >
      <div className="ambient" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="brand-name">platen</span>
          <span className="brand-tag">arena</span>
        </div>

        <button
          type="button"
          className="mode-pill"
          onClick={openCommand}
          onMouseDown={(event) => event.preventDefault()}
          aria-label={`Current mode: ${modeSummary(settings)}. Open the command line.`}
          title="Open the command line (esc)"
        >
          <span className="mode-label">{modeLabel(settings)}</span>
          <span className="mode-value">{variantLabel(settings)}</span>
          <span className="mode-hint">esc</span>
        </button>

        <div className="topbar-actions">
          {capsLock && settings.capsLockWarning && (
            <span className="caps-badge" role="status">
              caps lock
            </span>
          )}
          <div className="palette-picker">
            <button
              type="button"
              className="icon-button palette-trigger"
              onClick={() => setPaletteOpen((open) => !open)}
              onMouseDown={(event) => event.preventDefault()}
              aria-label={`Theme: ${activeTheme.label} ${activeTheme.mode}`}
              aria-expanded={paletteOpen}
              aria-controls="theme-menu"
              title={`Theme: ${activeTheme.label} ${activeTheme.mode}`}
            >
              <span
                className="palette-swatch"
                style={{ background: activeTheme.accent }}
                aria-hidden="true"
              />
            </button>
            {paletteOpen && (
              <div
                className="palette-menu theme-menu"
                id="theme-menu"
                role="group"
                aria-label="Theme"
              >
                {themeGroups.map((group) => (
                  <div className="theme-group" key={group.mode}>
                    <span className="palette-menu-label">{group.mode}</span>
                    {group.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={option.id === themeId}
                        className={`palette-option ${option.id === themeId ? "is-active" : ""}`}
                        onClick={() => chooseTheme(option.id)}
                        onMouseDown={(event) => event.preventDefault()}
                      >
                        <span
                          className="palette-swatch"
                          style={{ background: option.accent }}
                          aria-hidden="true"
                        />
                        <span className="palette-name">{option.label}</span>
                        <span className="palette-check" aria-hidden="true">
                          {option.id === themeId ? "✓" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="palette-picker arena-picker">
            <button
              type="button"
              className={`icon-button arena-trigger ${duel.room ? "is-duel" : ""}`}
              onClick={() => setArenaMenuOpen((open) => !open)}
              onMouseDown={(event) => event.preventDefault()}
              aria-label="Arena menu: duel, leaderboard, account"
              aria-expanded={arenaMenuOpen}
              aria-controls="arena-menu"
              title="Duel, leaderboard and account"
            >
              {duel.room ? (
                <span className="arena-live-dot" aria-hidden="true" />
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m4 20 6-6M7 3l14 14M14 3l7 7M3 10l7 7" />
                  <path d="m14 3 7 7M3 10l7 7" />
                </svg>
              )}
            </button>
            {arenaMenuOpen && (
              <div
                className="palette-menu arena-menu"
                id="arena-menu"
                role="menu"
                aria-label="Arena"
              >
                <button
                  type="button"
                  className="palette-option"
                  role="menuitem"
                  onClick={() => {
                    setArenaMenuOpen(false);
                    setMultiplayerOpen(true);
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <span className="menu-glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
              <path d="M12 2L3 7l9 9 9-9z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="13" r="4" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </span>
                  <span className="palette-name">duel</span>
                  <span className="palette-check">
                    {duel.room
                      ? `${duel.room.players.length}/2`
                      : duel.connection === "open"
                        ? "live"
                        : ""}
                  </span>
                </button>
                <button
                  type="button"
                  className="palette-option"
                  role="menuitem"
                  onClick={() => {
                    setArenaMenuOpen(false);
                    setLeaderboardOpen(true);
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <span className="menu-glyph" aria-hidden="true">▲</span>
                  <span className="palette-name">leaderboard</span>
                  <span className="palette-check" />
                </button>
                <button
                  type="button"
                  className="palette-option"
                  role="menuitem"
                  onClick={() => {
                    setArenaMenuOpen(false);
                    setAuthOpen(true);
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <span className="menu-glyph" aria-hidden="true">@</span>
                  <span className="palette-name">{auth.displayName}</span>
                  <span className="palette-check">
                    {auth.user && !auth.user.guest ? auth.user.provider : "guest"}
                  </span>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={openSettings}
            onMouseDown={(event) => event.preventDefault()}
            aria-label="Open settings"
            title="Settings"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={toggleSound}
            onMouseDown={(event) => event.preventDefault()}
            aria-label={sound ? "Mute sound" : "Enable sound"}
            title={sound ? "Mute sound" : "Enable sound"}
          >
            {sound ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9v6h4l5 4V5L8 9H4Z" />
                <path d="M16.5 8.5a5 5 0 0 1 0 7" />
                <path d="M19 6a8.5 8.5 0 0 1 0 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9v6h4l5 4V5L8 9H4Z" />
                <path d="m16 9 5 6M21 9l-5 6" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={replay}
            onMouseDown={(event) => event.preventDefault()}
            aria-label="Restart test"
            title="Restart test (tab)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 7h-6V3" />
              <path d="M20 7a8 8 0 1 0 1 8" />
            </svg>
          </button>
        </div>
      </header>

      <ModeBar
        settings={settings}
        locked={Boolean(duel.race)}
        onChange={applySettings}
        onSelectMode={selectMode}
        onEditCustom={openCustomEditor}
        onOpenRules={openRules}
      />

      <section
        className="hud"
        aria-label="Run stats"
        style={{ "--live-color": liveColor } as CSSProperties}
      >
        <div className={`clock ${clockUrgent ? "is-urgent" : ""}`}>
          <span className="clock-value">{String(clock).padStart(2, "0")}</span>
          <span className="clock-unit">{clockUnit}</span>
        </div>

        <div
          className={`progress-track ${settings.mode === "zen" ? "is-endless" : ""}`}
          aria-hidden="true"
        >
          {settings.mode !== "zen" && (
            <span
              className="progress-fill"
              style={{ transform: `scaleX(${Math.min(1, Math.max(0, live.progress))})` }}
            />
          )}
        </div>

        <div
          className={`hud-stats ${settings.liveStyle === "bars" ? "is-bars" : ""}`}
          style={{ opacity: settings.liveOpacity / 100 }}
        >
          {settings.liveStyle === "bars" ? (
            <>
              <div className="live-bar">
                <span className="live-bar-label">score</span>
                <span className="live-bar-track">
                  <span
                    className="live-bar-fill"
                    style={{
                      transform: `scaleX(${Math.min(1, live.score / 2000)})`,
                    }}
                  />
                </span>
                <b>{live.score}</b>
              </div>
              <div className="live-bar">
                <span className="live-bar-label">{speedUnitLabel(speedUnit)}</span>
                <span className="live-bar-track">
                  <span
                    className="live-bar-fill"
                    style={{
                      transform: `scaleX(${Math.min(1, live.wpm / 120)})`,
                    }}
                  />
                </span>
                <b>{formatSpeed(live.wpm, speedUnit, false)}</b>
              </div>
              <div className="live-bar">
                <span className="live-bar-label">acc</span>
                <span className="live-bar-track">
                  <span
                    className="live-bar-fill"
                    style={{ transform: `scaleX(${Math.min(1, live.accuracy / 100)})` }}
                  />
                </span>
                <b>{live.accuracy}%</b>
              </div>
              <div className="live-bar">
                <span className="live-bar-label">burst</span>
                <span className="live-bar-track">
                  <span
                    className="live-bar-fill"
                    style={{
                      transform: `scaleX(${Math.min(1, live.burst / 120)})`,
                    }}
                  />
                </span>
                <b>{formatSpeed(live.burst, speedUnit, false)}</b>
              </div>
            </>
          ) : (
            <>
              {statPill("score", live.score, true)}
              {statPill(
                speedUnitLabel(speedUnit),
                formatSpeed(live.wpm, speedUnit, false),
              )}
              {statPill("acc", `${live.accuracy}%`)}
              {statPill("burst", formatSpeed(live.burst, speedUnit, false))}
            </>
          )}
        </div>
      </section>

      {duel.room && (
        <DuelHud
          duel={duel}
          selfState={selfDuelState}
          countdown={duelCountdown}
          outcome={duelOutcome}
          winnerName={duelWinner?.name ?? peerPlayer?.name ?? null}
        />
      )}

      <section
        className={stageClass}
        ref={stageRef}
        style={stageStyle}
        data-running={status === "running"}
        data-finished={status === "finished"}
        onClick={focusInput}
      >
        <div className="stage-bg" aria-hidden="true">
          <div className="stage-glow" />
          <div className="floor-grid" />
          <div className="speed-lines" />
          <div className="vignette" />
        </div>

        {duel.room && (
          <div className="fighter-col fighter-col-peer" aria-hidden="true">
            <Fighter ref={opponentFighterRef} className="fighter-peer" />
            <span className="peer-fighter-name">{peerPlayer?.name ?? "opponent"}</span>
          </div>
        )}

        <div className="fighter-col fighter-col-player">
          <Fighter ref={fighterRef} />
        </div>

        <div className="arena" ref={arenaRef}>
          <div className="strike" aria-hidden="true">
            <span className="strike-hair" />
            <span className="strike-diamond" />
          </div>

          <div
            className="word-line"
            ref={wordLineRef}
            style={
              settings.maxLineWidth > 0
                ? { width: `min(100%, ${settings.maxLineWidth}px)` }
                : undefined
            }
          >
            <div className="track" ref={trackRef}>
              {entries.map((entry, index) => {
                const isActive = index === activeIndex && status !== "finished";
                const isPast = index < activeIndex || (index === activeIndex && status === "finished");
                const hue = (index * 47 + 188) % 360;
                const wordColor = settings.colorfulMode
                  ? `hsl(${hue} 68% ${themeMode(themeId) === "light" ? "34%" : "72%"})`
                  : undefined;
                if (isActive) {
                  const letters = entry.word.split("");
                  const extra =
                    currentTyped.length > entry.word.length
                      ? currentTyped.slice(entry.word.length).split("")
                      : [];
                  return (
                    <span
                      className={`word active ${
                        settings.highlightMode === "word" ? "is-highlighted" : ""
                      }`}
                      key={`${index}-${entry.word}`}
                      ref={activeWordRef}
                      style={wordColor ? { color: wordColor } : undefined}
                      aria-hidden="true"
                    >
                      {letters.map((letter, letterIndex) => {
                        const typedChar = currentTyped[letterIndex];
                        const hasTyped = letterIndex < currentTyped.length;
                        const isBad = hasTyped && typedChar !== letter;
                        const isGood = hasTyped && typedChar === letter;
                        const isCursor = letterIndex === currentTyped.length;
                        const shown =
                          settings.indicateTypos === "replace" && isBad
                            ? typedChar
                            : letter;
                        return (
                          <span
                            className={`glyph-wrap ${
                              isCursor && settings.highlightMode === "letter"
                                ? "is-cursor"
                                : ""
                            }`}
                            key={letterIndex}
                          >
                            {isCursor && (
                              <span className="probe" ref={probeRef} aria-hidden="true" />
                            )}
                            <span
                              data-letter={letterIndex}
                              className={`glyph ${isGood ? "is-good" : ""} ${
                                isBad ? "is-bad" : ""
                              }`}
                            >
                              {visibleGlyph(shown)}
                            </span>
                            {isBad &&
                              settings.indicateTypos === "below" &&
                              !settings.blindMode && (
                                <span className="typo-hint" aria-hidden="true">
                                  {visibleGlyph(typedChar)}
                                </span>
                              )}
                          </span>
                        );
                      })}
                      {currentTyped.length === entry.word.length && (
                        <span className="probe" ref={probeRef} aria-hidden="true" />
                      )}
                      {extra.map((letter, extraIndex) => (
                        <span
                          key={`extra-${extraIndex}`}
                          data-letter={`e${entry.word.length + extraIndex}`}
                          className="glyph is-extra"
                        >
                          {visibleGlyph(letter)}
                        </span>
                      ))}
                      {currentTyped.length > entry.word.length && (
                        <span className="probe" ref={probeRef} aria-hidden="true" />
                      )}
                    </span>
                  );
                }
                return (
                  <span
                    className={`word ${isPast ? "is-past" : "is-upcoming"}`}
                    data-ahead={index - activeIndex}
                    key={`${index}-${entry.word}`}
                    style={wordColor ? { color: wordColor } : undefined}
                    aria-hidden="true"
                  >
                    {entry.word.split("").map(visibleGlyph).join("")}
                  </span>
                );
              })}
            </div>
          </div>

          {settings.mode === "quote" && test.author && status !== "finished" && (
            <p className="quote-credit">by {test.author}</p>
          )}

          {smash && (
            <div className={`smash smash-${smash.kind}`} key={smash.id} aria-hidden="true">
              {smash.text.split("").map((letter, index) => {
                const size = smash.text.length;
                const center = index - (size - 1) / 2;
                const jitter = ((index * 37 + smash.id * 17) % 17) - 8;
                let dx = 90 + index * 9;
                let dy = -40 + center * 14 + jitter;
                let rot = jitter * 3;
                if (smash.kind === "kick") {
                  dx = 80 + index * 10;
                  dy = 25 - center * 9 + jitter;
                  rot = center * 9;
                } else if (smash.kind === "uppercut") {
                  dx = 45 + index * 7;
                  dy = -110 - center * 10 + jitter;
                  rot = center * -7;
                } else if (smash.kind === "miss") {
                  dx = -10 + index * 3;
                  dy = 80 + index * 8;
                  rot = jitter * 5;
                }
                return (
                  <span
                    key={index}
                    style={
                      {
                        "--dx": `${dx}px`,
                        "--dy": `${dy}px`,
                        "--rot": `${rot}deg`,
                      } as CSSProperties
                    }
                  >
                    {visibleGlyph(letter)}
                  </span>
                );
              })}
            </div>
          )}

          <div className="fx-layer" aria-hidden="true">
            {fx.map((item) => {
              const count = item.kind === "heavy" ? 10 : 5;
              return (
                <span
                  className={`fx fx-${item.kind}`}
                  key={item.id}
                  style={{ left: item.x, top: item.y }}
                >
                  <span className="fx-ring" />
                  {Array.from({ length: count }).map((_, index) => (
                    <span
                      key={index}
                      className="fx-spark"
                      style={
                        {
                          "--angle": `${(360 / count) * index + (item.id % 13)}deg`,
                          "--dist": `${item.kind === "heavy" ? 46 : 26}px`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </span>
              );
            })}
          </div>

          <div
            className={`strike-caret caret-${settings.caretStyle}`}
            aria-hidden="true"
          />
          {settings.paceCaret !== "off" && (
            <span
              ref={paceRef}
              className={`pace-caret caret-${settings.paceCaretStyle}`}
              style={{ opacity: 0 }}
              aria-hidden="true"
            />
          )}

          {settings.compositionDisplay && composition && (
            <div className="composition-display" aria-live="polite">
              {composition}
            </div>
          )}

          {settings.outOfFocusWarning && !focused && status !== "finished" && (
            <div className="focus-warning" role="status">
              <span className="start-dot" />
              click the arena to keep typing
            </div>
          )}

          {status === "idle" && (
            <div className="start-hint" aria-hidden="true">
              <span className="start-dot" />
              start typing
            </div>
          )}

        </div>

        <div className="error-veil" ref={errorVeilRef} aria-hidden="true" />

        {status === "finished" && result && (
          <div className="results" role="status" aria-live="polite">
            <div className="results-panel">
              <div className="results-topline">
                <span className="eyebrow">
                  {result.failed ? "run failed" : "run complete"} ·{" "}
                  {modeSummary(settings)}
                </span>
                {newBest && !result.failed && (
                  <span className="best-badge">new best</span>
                )}
                {result.failed && <span className="fail-badge">failed</span>}
              </div>

              <div className="result-hero">
                <div className="score">
                  <span className="score-value">
                    {result.score.toLocaleString()}
                  </span>
                  <span className="score-unit">
                    score · {settings.difficulty}
                  </span>
                </div>
                <div className="result-speed">
                  <b>{formatSpeed(result.wpm, speedUnit, settings.resultDecimals)}</b>
                  <span>{speedUnitLabel(speedUnit)}</span>
                </div>
              </div>

              {duel.result && (
                <p className={`duel-result-line is-${duelOutcome ?? "draw"}`}>
                  <b>
                    {duelOutcome === "win"
                      ? "duel won"
                      : duelOutcome === "loss"
                        ? `duel lost to ${duelWinner?.name ?? "opponent"}`
                        : "duel drawn"}
                  </b>
                  <span>
                    {duel.result.players
                      .slice()
                      .sort((a, b) => b.score - a.score)
                      .map((player) => `${player.name} ${player.score}`)
                      .join(" · ")}
                  </span>
                </p>
              )}

              {result.failed && result.failReason && (
                <p className="fail-reason">{result.failReason}</p>
              )}

              <div className="result-grid">
                <div>
                  <span>wpm</span>
                  <b>{result.wpm}</b>
                </div>
                <div>
                  <span>wps</span>
                  <b>{result.wps.toFixed(settings.resultDecimals ? 1 : 0)}</b>
                </div>
                <div>
                  <span>cpm</span>
                  <b>{Math.round(result.cpm)}</b>
                </div>
                <div>
                  <span>cps</span>
                  <b>{result.cps.toFixed(settings.resultDecimals ? 1 : 0)}</b>
                </div>
                <div>
                  <span>accuracy</span>
                  <b>{result.accuracy}%</b>
                </div>
                <div>
                  <span>raw</span>
                  <b>
                    {formatSpeed(result.raw, speedUnit, settings.resultDecimals)}
                  </b>
                </div>
                <div>
                  <span>consistency</span>
                  <b>{result.consistency}%</b>
                </div>
                <div>
                  <span>characters</span>
                  <b>
                    {result.correctChars}
                    <i>/{result.incorrectChars}</i>
                  </b>
                </div>
              </div>

              <p className="result-detail-line">
                extra <b>{result.extraChars}</b> missed{" "}
                <b>{result.missedChars}</b> clean words{" "}
                <b>{result.correctWords}</b> wrong words{" "}
                <b>{result.wrongWords}</b>{" "}
                {submitRank !== null && !result.failed && (
                  <>
                    leaderboard <b>#{submitRank}</b>
                  </>
                )}
              </p>

              {result.samples.length > 1 && (
                <div className="result-graph" aria-hidden="true">
                  <svg viewBox="0 0 320 56" preserveAspectRatio="none">
                    <line
                      x1="0"
                      y1={settings.graphStartZero ? "52" : "0"}
                      x2="320"
                      y2={settings.graphStartZero ? "52" : "0"}
                    />
                    <polyline
                      points={sparklinePoints(
                        result.samples,
                        settings.graphStartZero,
                      )}
                    />
                  </svg>
                  <span>
                    speed over {Math.round(result.elapsed)}s ·{" "}
                    {settings.graphStartZero ? "zero-based" : "auto scale"}
                  </span>
                </div>
              )}

              {result.failed ? (
                <p className="best-line is-failed">
                  {result.correctWords} clean words, {result.wrongWords} missed,{" "}
                  <b>{result.elapsed.toFixed(1)}</b>s
                </p>
              ) : (
                <p className="best-line">
                  best{" "}
                  <b>
                    {formatSpeed(best || result.wpm, speedUnit, false)}
                  </b>{" "}
                  {speedUnitLabel(speedUnit)}, {result.correctWords} clean words,{" "}
                  {result.wrongWords} missed,{" "}
                  <b>{result.elapsed.toFixed(1)}</b>s
                </p>
              )}

              {settings.showAverage && history.length > 0 && (
                <p className="average-line">
                  last {history.length}{" "}
                  {history.length === 1 ? "run" : "runs"} average{" "}
                  <b>{formatSpeed(recentAverage, speedUnit, false)}</b>{" "}
                  {speedUnitLabel(speedUnit)}
                </p>
              )}

              {settings.wordsHistory && (
                <div className="words-history" aria-label="Words history">
                  {result.entries.map((entry, index) => (
                    <span
                      key={`${index}-${entry.word}`}
                      className={`history-word ${
                        entry.submitted
                          ? entry.correct
                            ? "is-correct"
                            : "is-wrong"
                          : "is-open"
                      }`}
                      title={entry.typed ? `typed: ${entry.typed}` : "not typed"}
                    >
                      {entry.word}
                    </span>
                  ))}
                </div>
              )}

              <div className="result-actions">
                <button
                  type="button"
                  className="button primary"
                  onClick={(event) => {
                    event.currentTarget.blur();
                    replay();
                  }}
                >
                  run it back <kbd>enter</kbd>
                </button>
                {settings.mode === "custom" ? (
                  <button
                    type="button"
                    className="button"
                    onClick={(event) => {
                      event.currentTarget.blur();
                      setEditorOpen(true);
                    }}
                  >
                    edit text
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button"
                    onClick={(event) => {
                      event.currentTarget.blur();
                      replay();
                    }}
                  >
                    new text <kbd>n</kbd>
                  </button>
                )}
              </div>

              {settings.mode === "quote" && test.author && (
                <p className="result-source">
                  <span className="source-dot" />
                  {test.author}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {settings.keymapMode && (
        <section className="keymap" aria-label="On-screen keyboard">
          <div className="keymap-rows">
            {keymapRows(settings.layout).map((row, rowIndex) => (
              <div className="keymap-row" key={rowIndex}>
                {row.map((key) => (
                  <span
                    className={`keymap-key ${
                      lastKey && lastKey.toLowerCase() === key.toLowerCase()
                        ? "is-hit"
                        : ""
                    }`}
                    key={key}
                  >
                    {key}
                  </span>
                ))}
              </div>
            ))}
            <div className="keymap-row">
              <span
                className={`keymap-key keymap-space ${
                  lastKey === " " ? "is-hit" : ""
                }`}
              >
                space
              </span>
            </div>
          </div>
        </section>
      )}

      <footer className="footer">
        {settings.keyTips ? (
          <p className="shortcuts" aria-label="Keyboard shortcuts">
            {settings.quickRestart !== "off" && (
              <>
                <span>
                  <kbd>{settings.quickRestart}</kbd> restart test
                </span>
                <span className="hint-sep" aria-hidden="true" />
              </>
            )}
            <span>
              <kbd>esc</kbd> command line
            </span>
            <span className="hint-sep" aria-hidden="true" />
            <span>
              <kbd>ctrl</kbd>
              <kbd>shift</kbd>
              <kbd>p</kbd> command line
            </span>
            <span className="hint-sep" aria-hidden="true" />
            <span>
              <kbd>enter</kbd> replay / finish zen
            </span>
          </p>
        ) : (
          <span />
        )}
        {settings.ads ? (
          <p className="sponsor-line">
            train with platen · no tracking, no accounts, just keys
          </p>
        ) : (
          <p className="shortcut-note">more in the command line</p>
        )}
      </footer>

      {notice && (
        <div className="toast" role="status" aria-live="polite">
          {notice}
        </div>
      )}

      <CommandLine
        open={commandOpen}
        commands={commands}
        compact={settings.singleList}
        onClose={() => setCommandOpen(false)}
      />
      <CustomTextDialog
        open={editorOpen}
        initialText={editorSeed}
        onClose={() => setEditorOpen(false)}
        onApply={applyCustomText}
      />
      <TextRulesDialog
        open={rulesOpen}
        settings={settings}
        onClose={() => setRulesOpen(false)}
        onApply={applyRules}
      />
      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onApply={applySettingsDialog}
        onReset={resetAllSettings}
        onExport={exportSettings}
        onImport={importSettings}
      />
      <MultiplayerDialog
        open={multiplayerOpen}
        duel={duel}
        auth={auth}
        settings={settings}
        onClose={() => setMultiplayerOpen(false)}
        onOpenAuth={() => {
          setMultiplayerOpen(false);
          setAuthOpen(true);
        }}
      />
      <AuthDialog
        open={authOpen}
        auth={auth}
        onClose={() => setAuthOpen(false)}
      />
      <LeaderboardDialog
        open={leaderboardOpen}
        auth={auth}
        onClose={() => setLeaderboardOpen(false)}
        onOpenAuth={() => {
          setLeaderboardOpen(false);
          setAuthOpen(true);
        }}
      />

      <input
        ref={inputRef}
        className="ghost-input"
        type="text"
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        tabIndex={-1}
        aria-label="Typing input"
        value=""
        onChange={() => {}}
      />

      <div className="screen-reader-only" aria-live="polite">
        {status === "finished" && result
          ? `Test complete. ${result.wpm} words per minute, ${result.accuracy} percent accuracy.`
          : ""}
      </div>
    </main>
  );
}
