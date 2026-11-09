export type TestMode = "time" | "words" | "quote" | "zen" | "custom";

export type QuoteLength = "short" | "medium" | "long" | "all";

export type CustomOrder = "repeat" | "shuffle" | "random";

export type CustomLimit = "words" | "time" | "sections";

export type Difficulty = "easy" | "medium" | "hard";

export type Confidence = "off" | "on" | "max";

export type QuickRestart = "off" | "tab" | "esc" | "enter";

export type Language = "english" | "british";

export type Funbox = "none" | "mirror" | "reverse" | "caps";

export type Layout = "qwerty" | "dvorak" | "colemak";

export type TypoDisplay = "off" | "below" | "replace";

export type CaretStyle = "line" | "block" | "underline" | "off";

export type PaceCaret = "off" | "average" | "best";

export type LiveStyle = "text" | "bars";

export type LiveColor = "accent" | "text" | "muted";

export type HighlightMode = "off" | "word" | "letter";

export type TypedEffect = "off" | "fade" | "pop";

export type FontFamily = "jetbrains" | "berkeley" | "system";

export type SpeedUnit = "wpm" | "cpm" | "wps" | "cps";

export type CookieChoice = "unset" | "accepted" | "rejected";

export interface TestSettings {
  mode: TestMode;
  /** Seconds, used by time mode. */
  duration: number;
  /** Word target, used by words mode. */
  wordCount: number;
  /** Quote bucket, used by quote mode. */
  quoteLength: QuoteLength;
  punctuation: boolean;
  numbers: boolean;
  customText: string;
  /** How custom text is repeated or rearranged. */
  customOrder: CustomOrder;
  /** What ends a custom run. */
  customLimit: CustomLimit;
  /** Word target for a custom run limited by words. */
  customWords: number;
  /** Seconds for a custom run limited by time. */
  customSeconds: number;
  /** Paragraph count for a custom run limited by sections. */
  customSections: number;
  /** Character that splits words; a space preserves normal word breaks. */
  wordDelimiter: string;
  removeZeroWidth: boolean;
  removeFancyTypography: boolean;
  replaceControlChars: boolean;
  replaceNewlines: boolean;
  addPeriods: boolean;

  /* ── test rules ─────────────────────────────────────────────── */
  difficulty: Difficulty;
  /** Auto-fail below this WPM. 0 disables the check. */
  minWpm: number;
  /** Auto-fail below this accuracy percentage. 0 disables the check. */
  minAccuracy: number;
  /** Auto-fail below this WPM over the last few seconds. 0 disables it. */
  minBurst: number;
  stopOnError: boolean;
  deleteOnError: boolean;
  confidence: Confidence;
  freedom: boolean;
  strictSpace: boolean;
  oppositeShift: boolean;
  quickEnd: boolean;
  blindMode: boolean;

  /* ── navigation ─────────────────────────────────────────────── */
  quickRestart: QuickRestart;
  repeatQuotes: boolean;
  wordsHistory: boolean;
  singleList: boolean;

  /* ── language and input ─────────────────────────────────────── */
  language: Language;
  funbox: Funbox;
  lazyMode: boolean;
  layout: Layout;
  codeUnindent: boolean;
  compositionDisplay: boolean;

  /* ── error display ──────────────────────────────────────────── */
  indicateTypos: TypoDisplay;
  hideExtraLetters: boolean;

  /* ── sound ──────────────────────────────────────────────────── */
  volume: number;
  clickSound: boolean;
  errorSound: boolean;
  timeWarningSound: boolean;

  /* ── carets ─────────────────────────────────────────────────── */
  smoothCaret: boolean;
  caretStyle: CaretStyle;
  paceCaret: PaceCaret;
  repeatedPace: boolean;
  paceCaretStyle: CaretStyle;

  /* ── live stats ─────────────────────────────────────────────── */
  liveStyle: LiveStyle;
  liveColor: LiveColor;
  liveOpacity: number;

  /* ── text display ───────────────────────────────────────────── */
  highlightMode: HighlightMode;
  typedEffect: TypedEffect;
  tapeMode: boolean;
  tapeMargin: number;
  smoothLineScroll: boolean;
  showAllLines: boolean;
  maxLineWidth: number;
  fontSize: number;
  fontFamily: FontFamily;
  useLocalFont: boolean;
  keymapMode: boolean;
  flipTestColors: boolean;
  colorfulMode: boolean;

  /* ── results ────────────────────────────────────────────────── */
  resultDecimals: boolean;
  speedUnit: SpeedUnit;
  graphStartZero: boolean;
  showAverage: boolean;

  /* ── appearance ─────────────────────────────────────────────── */
  customBackground: string;
  randomTheme: boolean;

  /* ── misc ───────────────────────────────────────────────────── */
  keyTips: boolean;
  outOfFocusWarning: boolean;
  capsLockWarning: boolean;
  ads: boolean;
  cookies: CookieChoice;
}

export const TEST_MODES: { id: TestMode; label: string }[] = [
  { id: "time", label: "time" },
  { id: "words", label: "words" },
  { id: "quote", label: "quote" },
  { id: "zen", label: "zen" },
  { id: "custom", label: "custom" },
];

export const TIME_OPTIONS = [15, 30, 60, 90] as const;
export const WORD_OPTIONS = [10, 25, 50, 100] as const;
export const QUOTE_OPTIONS: { id: QuoteLength; label: string }[] = [
  { id: "short", label: "short" },
  { id: "medium", label: "medium" },
  { id: "long", label: "long" },
  { id: "all", label: "all" },
];
export const CUSTOM_ORDER_OPTIONS: { id: CustomOrder; label: string }[] = [
  { id: "repeat", label: "repeat" },
  { id: "shuffle", label: "shuffle" },
  { id: "random", label: "random" },
];
export const CUSTOM_LIMIT_OPTIONS: { id: CustomLimit; label: string }[] = [
  { id: "words", label: "words" },
  { id: "time", label: "time" },
  { id: "sections", label: "sections" },
];
export const CUSTOM_WORD_OPTIONS = [10, 25, 50, 100] as const;
export const CUSTOM_TIME_OPTIONS = [15, 30, 60, 90] as const;
export const CUSTOM_SECTION_OPTIONS = [1, 2, 3, 5] as const;

export const DIFFICULTY_OPTIONS: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "easy" },
  { id: "medium", label: "medium" },
  { id: "hard", label: "hard" },
];
export const CONFIDENCE_OPTIONS: { id: Confidence; label: string }[] = [
  { id: "off", label: "off" },
  { id: "on", label: "on" },
  { id: "max", label: "max" },
];
export const QUICK_RESTART_OPTIONS: { id: QuickRestart; label: string }[] = [
  { id: "off", label: "off" },
  { id: "tab", label: "tab" },
  { id: "esc", label: "esc" },
  { id: "enter", label: "enter" },
];
export const LANGUAGE_OPTIONS: { id: Language; label: string }[] = [
  { id: "english", label: "english" },
  { id: "british", label: "british" },
];
export const FUNBOX_OPTIONS: { id: Funbox; label: string }[] = [
  { id: "none", label: "none" },
  { id: "mirror", label: "mirror" },
  { id: "reverse", label: "reverse" },
  { id: "caps", label: "caps" },
];
export const LAYOUT_OPTIONS: { id: Layout; label: string }[] = [
  { id: "qwerty", label: "qwerty" },
  { id: "dvorak", label: "dvorak" },
  { id: "colemak", label: "colemak" },
];
export const TYPO_OPTIONS: { id: TypoDisplay; label: string }[] = [
  { id: "off", label: "off" },
  { id: "below", label: "below" },
  { id: "replace", label: "replace" },
];
export const CARET_OPTIONS: { id: CaretStyle; label: string }[] = [
  { id: "line", label: "line" },
  { id: "block", label: "block" },
  { id: "underline", label: "underline" },
  { id: "off", label: "off" },
];
export const PACE_CARET_OPTIONS: { id: PaceCaret; label: string }[] = [
  { id: "off", label: "off" },
  { id: "average", label: "average" },
  { id: "best", label: "best" },
];
export const LIVE_STYLE_OPTIONS: { id: LiveStyle; label: string }[] = [
  { id: "text", label: "text" },
  { id: "bars", label: "bars" },
];
export const LIVE_COLOR_OPTIONS: { id: LiveColor; label: string }[] = [
  { id: "accent", label: "accent" },
  { id: "text", label: "text" },
  { id: "muted", label: "muted" },
];
export const HIGHLIGHT_OPTIONS: { id: HighlightMode; label: string }[] = [
  { id: "off", label: "off" },
  { id: "word", label: "word" },
  { id: "letter", label: "letter" },
];
export const TYPED_EFFECT_OPTIONS: { id: TypedEffect; label: string }[] = [
  { id: "off", label: "off" },
  { id: "fade", label: "fade" },
  { id: "pop", label: "pop" },
];
export const FONT_OPTIONS: { id: FontFamily; label: string }[] = [
  { id: "jetbrains", label: "jetbrains" },
  { id: "berkeley", label: "berkeley" },
  { id: "system", label: "system" },
];
export const SPEED_UNIT_OPTIONS: { id: SpeedUnit; label: string }[] = [
  { id: "wpm", label: "wpm" },
  { id: "cpm", label: "cpm" },
  { id: "wps", label: "wps" },
  { id: "cps", label: "cps" },
];
export const COOKIE_OPTIONS: { id: CookieChoice; label: string }[] = [
  { id: "unset", label: "unset" },
  { id: "accepted", label: "accepted" },
  { id: "rejected", label: "rejected" },
];

const SETTINGS_KEY = "platen:settings";

export const DEFAULT_SETTINGS: TestSettings = {
  mode: "time",
  duration: 30,
  wordCount: 25,
  quoteLength: "all",
  punctuation: true,
  numbers: false,
  customText: "",
  customOrder: "repeat",
  customLimit: "sections",
  customWords: 50,
  customSeconds: 30,
  customSections: 1,
  wordDelimiter: " ",
  removeZeroWidth: true,
  removeFancyTypography: false,
  replaceControlChars: false,
  replaceNewlines: true,
  addPeriods: false,

  difficulty: "easy",
  minWpm: 0,
  minAccuracy: 0,
  minBurst: 0,
  stopOnError: false,
  deleteOnError: false,
  confidence: "off",
  freedom: false,
  strictSpace: false,
  oppositeShift: false,
  quickEnd: false,
  blindMode: false,

  quickRestart: "tab",
  repeatQuotes: false,
  wordsHistory: false,
  singleList: false,

  language: "english",
  funbox: "none",
  lazyMode: false,
  layout: "qwerty",
  codeUnindent: false,
  compositionDisplay: false,

  indicateTypos: "off",
  hideExtraLetters: false,

  volume: 70,
  clickSound: true,
  errorSound: true,
  timeWarningSound: true,

  smoothCaret: true,
  caretStyle: "line",
  paceCaret: "off",
  repeatedPace: false,
  paceCaretStyle: "line",

  liveStyle: "text",
  liveColor: "accent",
  liveOpacity: 100,

  highlightMode: "off",
  typedEffect: "off",
  tapeMode: false,
  tapeMargin: 48,
  smoothLineScroll: true,
  showAllLines: true,
  maxLineWidth: 0,
  fontSize: 0,
  fontFamily: "jetbrains",
  useLocalFont: false,
  keymapMode: false,
  flipTestColors: false,
  colorfulMode: false,

  resultDecimals: false,
  speedUnit: "wpm",
  graphStartZero: true,
  showAverage: true,

  customBackground: "",
  randomTheme: false,

  keyTips: true,
  outOfFocusWarning: true,
  capsLockWarning: true,
  ads: false,
  cookies: "unset",
};

function oneOf<T extends string | number>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function num(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/** A background may be a colour or gradient, never a remote or script URL. */
function safeBackground(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_SETTINGS.customBackground;
  const next = value.trim().slice(0, 160);
  if (!next) return "";
  if (/url\s*\(|javascript:|expression\s*\(/i.test(next)) return "";
  return next;
}

/** Old builds called the three rungs normal / expert / master. */
function difficultyFrom(value: unknown): Difficulty {
  if (value === "normal") return "easy";
  if (value === "expert") return "medium";
  if (value === "master") return "hard";
  return oneOf(
    value,
    DIFFICULTY_OPTIONS.map((option) => option.id),
    DEFAULT_SETTINGS.difficulty,
  );
}

export function sanitizeSettings(raw: unknown): TestSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const value = raw as Partial<Record<keyof TestSettings, unknown>>;
  const d = DEFAULT_SETTINGS;
  return {
    mode: oneOf(
      value.mode,
      TEST_MODES.map((mode) => mode.id),
      d.mode,
    ),
    duration: oneOf(value.duration, TIME_OPTIONS, d.duration),
    wordCount: oneOf(value.wordCount, WORD_OPTIONS, d.wordCount),
    quoteLength: oneOf(
      value.quoteLength,
      QUOTE_OPTIONS.map((option) => option.id),
      d.quoteLength,
    ),
    punctuation: bool(value.punctuation, d.punctuation),
    numbers: bool(value.numbers, d.numbers),
    customText:
      typeof value.customText === "string"
        ? value.customText.slice(0, 20000)
        : d.customText,
    customOrder: oneOf(
      value.customOrder,
      CUSTOM_ORDER_OPTIONS.map((option) => option.id),
      d.customOrder,
    ),
    customLimit: oneOf(
      value.customLimit,
      CUSTOM_LIMIT_OPTIONS.map((option) => option.id),
      d.customLimit,
    ),
    customWords: oneOf(value.customWords, CUSTOM_WORD_OPTIONS, d.customWords),
    customSeconds: oneOf(
      value.customSeconds,
      CUSTOM_TIME_OPTIONS,
      d.customSeconds,
    ),
    customSections: oneOf(
      value.customSections,
      CUSTOM_SECTION_OPTIONS,
      d.customSections,
    ),
    wordDelimiter: value.wordDelimiter === "|" ? "|" : " ",
    removeZeroWidth: bool(value.removeZeroWidth, d.removeZeroWidth),
    removeFancyTypography: bool(
      value.removeFancyTypography,
      d.removeFancyTypography,
    ),
    replaceControlChars: bool(
      value.replaceControlChars,
      d.replaceControlChars,
    ),
    replaceNewlines: bool(value.replaceNewlines, d.replaceNewlines),
    addPeriods: bool(value.addPeriods, d.addPeriods),

    difficulty: difficultyFrom(value.difficulty),
    minWpm: num(value.minWpm, d.minWpm, 0, 200),
    minAccuracy: num(value.minAccuracy, d.minAccuracy, 0, 100),
    minBurst: num(value.minBurst, d.minBurst, 0, 200),
    stopOnError: bool(value.stopOnError, d.stopOnError),
    deleteOnError: bool(value.deleteOnError, d.deleteOnError),
    confidence: oneOf(
      value.confidence,
      CONFIDENCE_OPTIONS.map((option) => option.id),
      d.confidence,
    ),
    freedom: bool(value.freedom, d.freedom),
    strictSpace: bool(value.strictSpace, d.strictSpace),
    oppositeShift: bool(value.oppositeShift, d.oppositeShift),
    quickEnd: bool(value.quickEnd, d.quickEnd),
    blindMode: bool(value.blindMode, d.blindMode),

    quickRestart: oneOf(
      value.quickRestart,
      QUICK_RESTART_OPTIONS.map((option) => option.id),
      d.quickRestart,
    ),
    repeatQuotes: bool(value.repeatQuotes, d.repeatQuotes),
    wordsHistory: bool(value.wordsHistory, d.wordsHistory),
    singleList: bool(value.singleList, d.singleList),

    language: oneOf(
      value.language,
      LANGUAGE_OPTIONS.map((option) => option.id),
      d.language,
    ),
    funbox: oneOf(
      value.funbox,
      FUNBOX_OPTIONS.map((option) => option.id),
      d.funbox,
    ),
    lazyMode: bool(value.lazyMode, d.lazyMode),
    layout: oneOf(
      value.layout,
      LAYOUT_OPTIONS.map((option) => option.id),
      d.layout,
    ),
    codeUnindent: bool(value.codeUnindent, d.codeUnindent),
    compositionDisplay: bool(
      value.compositionDisplay,
      d.compositionDisplay,
    ),

    indicateTypos: oneOf(
      value.indicateTypos,
      TYPO_OPTIONS.map((option) => option.id),
      d.indicateTypos,
    ),
    hideExtraLetters: bool(value.hideExtraLetters, d.hideExtraLetters),

    volume: num(value.volume, d.volume, 0, 100),
    clickSound: bool(value.clickSound, d.clickSound),
    errorSound: bool(value.errorSound, d.errorSound),
    timeWarningSound: bool(value.timeWarningSound, d.timeWarningSound),

    smoothCaret: bool(value.smoothCaret, d.smoothCaret),
    caretStyle: oneOf(
      value.caretStyle,
      CARET_OPTIONS.map((option) => option.id),
      d.caretStyle,
    ),
    paceCaret: oneOf(
      value.paceCaret,
      PACE_CARET_OPTIONS.map((option) => option.id),
      d.paceCaret,
    ),
    repeatedPace: bool(value.repeatedPace, d.repeatedPace),
    paceCaretStyle: oneOf(
      value.paceCaretStyle,
      CARET_OPTIONS.map((option) => option.id),
      d.paceCaretStyle,
    ),

    liveStyle: oneOf(
      value.liveStyle,
      LIVE_STYLE_OPTIONS.map((option) => option.id),
      d.liveStyle,
    ),
    liveColor: oneOf(
      value.liveColor,
      LIVE_COLOR_OPTIONS.map((option) => option.id),
      d.liveColor,
    ),
    liveOpacity: num(value.liveOpacity, d.liveOpacity, 10, 100),

    highlightMode: oneOf(
      value.highlightMode,
      HIGHLIGHT_OPTIONS.map((option) => option.id),
      d.highlightMode,
    ),
    typedEffect: oneOf(
      value.typedEffect,
      TYPED_EFFECT_OPTIONS.map((option) => option.id),
      d.typedEffect,
    ),
    tapeMode: bool(value.tapeMode, d.tapeMode),
    tapeMargin: num(value.tapeMargin, d.tapeMargin, 0, 160),
    smoothLineScroll: bool(value.smoothLineScroll, d.smoothLineScroll),
    showAllLines: bool(value.showAllLines, d.showAllLines),
    maxLineWidth: num(value.maxLineWidth, d.maxLineWidth, 0, 1400),
    fontSize: num(value.fontSize, d.fontSize, 0, 56),
    fontFamily: oneOf(
      value.fontFamily,
      FONT_OPTIONS.map((option) => option.id),
      d.fontFamily,
    ),
    useLocalFont: bool(value.useLocalFont, d.useLocalFont),
    keymapMode: bool(value.keymapMode, d.keymapMode),
    flipTestColors: bool(value.flipTestColors, d.flipTestColors),
    colorfulMode: bool(value.colorfulMode, d.colorfulMode),

    resultDecimals: bool(value.resultDecimals, d.resultDecimals),
    speedUnit: oneOf(
      value.speedUnit,
      SPEED_UNIT_OPTIONS.map((option) => option.id),
      d.speedUnit,
    ),
    graphStartZero: bool(value.graphStartZero, d.graphStartZero),
    showAverage: bool(value.showAverage, d.showAverage),

    customBackground: safeBackground(value.customBackground),
    randomTheme: bool(value.randomTheme, d.randomTheme),

    keyTips: bool(value.keyTips, d.keyTips),
    outOfFocusWarning: bool(value.outOfFocusWarning, d.outOfFocusWarning),
    capsLockWarning: bool(value.capsLockWarning, d.capsLockWarning),
    ads: bool(value.ads, d.ads),
    cookies: oneOf(
      value.cookies,
      COOKIE_OPTIONS.map((option) => option.id),
      d.cookies,
    ),
  };
}

export function loadSettings(): TestSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = window.localStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return sanitizeSettings(JSON.parse(stored));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: TestSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private mode can reject writes; the run still works.
  }
}

export function clearSettings() {
  try {
    window.localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/** Best WPM is kept per mode and per variant, like a per-rule high score. */
export function bestKeyFor(settings: TestSettings): string {
  switch (settings.mode) {
    case "time":
      return `platen:best:time:${settings.duration}`;
    case "words":
      return `platen:best:words:${settings.wordCount}`;
    case "quote":
      return `platen:best:quote:${settings.quoteLength}`;
    case "zen":
      return "platen:best:zen";
    case "custom":
      return "platen:best:custom";
  }
}

export function modeLabel(settings: TestSettings): string {
  switch (settings.mode) {
    case "time":
      return "time";
    case "words":
      return "words";
    case "quote":
      return "quote";
    case "zen":
      return "zen";
    case "custom":
      return "custom";
  }
}

export function variantLabel(settings: TestSettings): string {
  switch (settings.mode) {
    case "time":
      return `${settings.duration}s`;
    case "words":
      return `${settings.wordCount}`;
    case "quote":
      return settings.quoteLength;
    case "zen":
      return "endless";
    case "custom":
      return customLimitText(settings);
  }
}

export function customLimitText(settings: TestSettings): string {
  switch (settings.customLimit) {
    case "words":
      return `${settings.customWords} words`;
    case "time":
      return `${settings.customSeconds}s`;
    case "sections":
      return `${settings.customSections} ${
        settings.customSections === 1 ? "section" : "sections"
      }`;
  }
}

export function customRulesSummary(settings: TestSettings): string {
  const delimiter =
    settings.wordDelimiter === "|" ? " · pipe delimiter" : " · space delimiter";
  return `${settings.customOrder} · ${customLimitText(settings)}${delimiter}`;
}

export function modeSummary(settings: TestSettings): string {
  if (settings.mode === "time") return `time · ${settings.duration}s`;
  if (settings.mode === "words") return `words · ${settings.wordCount}`;
  if (settings.mode === "quote") return `quote · ${settings.quoteLength}`;
  if (settings.mode === "zen") return "zen · endless";
  return `custom · ${customLimitText(settings)}`;
}

export function supportsOptions(settings: TestSettings): boolean {
  return (
    settings.mode === "time" ||
    settings.mode === "words" ||
    settings.mode === "zen"
  );
}

export function speedUnitLabel(unit: SpeedUnit): string {
  return unit;
}

/**
 * The engine works in WPM, the one unit every result and best score is stored
 * in. These are the display conversions only.
 */
export function speedFromWpm(wpm: number, unit: SpeedUnit): number {
  switch (unit) {
    case "wpm":
      return wpm;
    case "cpm":
      return wpm * 5;
    case "wps":
      return wpm / 60;
    case "cps":
      return (wpm * 5) / 60;
  }
}

export function formatSpeed(
  wpm: number,
  unit: SpeedUnit,
  decimals: boolean,
): string {
  const converted = speedFromWpm(wpm, unit);
  if (decimals || unit === "wps" || unit === "cps") {
    return converted.toFixed(1);
  }
  return String(Math.round(converted));
}
