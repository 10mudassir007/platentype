"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from "react";

import {
  CARET_OPTIONS,
  CONFIDENCE_OPTIONS,
  COOKIE_OPTIONS,
  DIFFICULTY_OPTIONS,
  FONT_OPTIONS,
  FUNBOX_OPTIONS,
  HIGHLIGHT_OPTIONS,
  LANGUAGE_OPTIONS,
  LAYOUT_OPTIONS,
  LIVE_COLOR_OPTIONS,
  LIVE_STYLE_OPTIONS,
  PACE_CARET_OPTIONS,
  QUICK_RESTART_OPTIONS,
  SPEED_UNIT_OPTIONS,
  TYPO_OPTIONS,
  TYPED_EFFECT_OPTIONS,
  type TestSettings,
} from "@/lib/settings";

interface SettingsDialogProps {
  open: boolean;
  settings: TestSettings;
  onClose: () => void;
  onApply: (settings: TestSettings) => void;
  onReset: () => void;
  onExport: () => void;
  onImport: () => void;
}

type BoolKey = {
  [K in keyof TestSettings]: TestSettings[K] extends boolean ? K : never;
}[keyof TestSettings];

type NumberKey = {
  [K in keyof TestSettings]: TestSettings[K] extends number ? K : never;
}[keyof TestSettings];

type ChoiceOption = { id: string; label: string };

type Row =
  | { kind: "toggle"; key: BoolKey; label: string; note: string }
  | {
      kind: "choice";
      key: keyof TestSettings;
      label: string;
      note: string;
      options: readonly ChoiceOption[];
    }
  | {
      kind: "range";
      key: NumberKey;
      label: string;
      note: string;
      min: number;
      max: number;
      step: number;
      suffix?: string;
    }
  | {
      kind: "text";
      key: keyof TestSettings;
      label: string;
      note: string;
      placeholder: string;
    };

interface Section {
  id: string;
  title: string;
  note: string;
  rows: Row[];
}

const SECTIONS: Section[] = [
  {
    id: "rules",
    title: "test rules",
    note: "what counts as a mistake, and when the run ends early.",
    rows: [
      {
        kind: "choice",
        key: "difficulty",
        label: "difficulty",
        note: "medium fails on a wrong word, hard on any wrong key.",
        options: DIFFICULTY_OPTIONS,
      },
      {
        kind: "range",
        key: "minWpm",
        label: "minimum speed",
        note: "auto-fail below this speed. 0 turns the check off.",
        min: 0,
        max: 200,
        step: 5,
        suffix: " wpm",
      },
      {
        kind: "range",
        key: "minAccuracy",
        label: "minimum accuracy",
        note: "auto-fail below this accuracy. 0 turns the check off.",
        min: 0,
        max: 100,
        step: 5,
        suffix: "%",
      },
      {
        kind: "range",
        key: "minBurst",
        label: "minimum word burst",
        note: "auto-fail below this recent speed. 0 turns the check off.",
        min: 0,
        max: 200,
        step: 5,
        suffix: " wpm",
      },
      {
        kind: "toggle",
        key: "stopOnError",
        label: "stop on error",
        note: "the run waits until the mistake is corrected.",
      },
      {
        kind: "toggle",
        key: "deleteOnError",
        label: "delete on error",
        note: "a wrong letter is deleted automatically.",
      },
      {
        kind: "choice",
        key: "confidence",
        label: "confidence mode",
        note: "on blocks going back; max disables backspace entirely.",
        options: CONFIDENCE_OPTIONS,
      },
      {
        kind: "toggle",
        key: "freedom",
        label: "freedom mode",
        note: "backspace can reopen and delete correct words.",
      },
      {
        kind: "toggle",
        key: "strictSpace",
        label: "strict space",
        note: "a leading space is typed as a character, not ignored.",
      },
      {
        kind: "toggle",
        key: "oppositeShift",
        label: "opposite shift",
        note: "uppercase letters must use the other hand's shift key.",
      },
      {
        kind: "toggle",
        key: "quickEnd",
        label: "quick end",
        note: "the last word ends the run even when it is wrong.",
      },
      {
        kind: "toggle",
        key: "blindMode",
        label: "blind mode",
        note: "hides every error colour, marker and typo hint.",
      },
    ],
  },
  {
    id: "navigation",
    title: "navigation",
    note: "how a test restarts and what the result keeps.",
    rows: [
      {
        kind: "choice",
        key: "quickRestart",
        label: "quick restart",
        note: "choose the key that starts the test over.",
        options: QUICK_RESTART_OPTIONS,
      },
      {
        kind: "toggle",
        key: "repeatQuotes",
        label: "repeat quotes",
        note: "a restart keeps the same quote instead of drawing a new one.",
      },
      {
        kind: "toggle",
        key: "wordsHistory",
        label: "always show words history",
        note: "adds the word-by-word breakdown to every result.",
      },
      {
        kind: "toggle",
        key: "singleList",
        label: "single list command line",
        note: "hides command hints and keeps one flat list.",
      },
    ],
  },
  {
    id: "input",
    title: "language and input",
    note: "the words in the drill, and the keys you use to type them.",
    rows: [
      {
        kind: "choice",
        key: "language",
        label: "language",
        note: "British swaps common American spellings in the corpus.",
        options: LANGUAGE_OPTIONS,
      },
      {
        kind: "choice",
        key: "funbox",
        label: "funbox",
        note: "novelty text transforms. custom text is left untouched.",
        options: FUNBOX_OPTIONS,
      },
      {
        kind: "toggle",
        key: "lazyMode",
        label: "lazy mode",
        note: "accents become plain letters, so you never chase a diacritic.",
      },
      {
        kind: "choice",
        key: "layout",
        label: "layout",
        note: "type as if the physical keys were in another layout.",
        options: LAYOUT_OPTIONS,
      },
      {
        kind: "toggle",
        key: "codeUnindent",
        label: "code unindent on backspace",
        note: "backspace removes a whole indent in code-like text.",
      },
      {
        kind: "toggle",
        key: "compositionDisplay",
        label: "composition display",
        note: "shows IME composition above the strike line.",
      },
    ],
  },
  {
    id: "errors",
    title: "error display",
    note: "how much of a mistake the test shows you.",
    rows: [
      {
        kind: "choice",
        key: "indicateTypos",
        label: "indicate typos",
        note: "show the wrong key below the letter, or replace the letter.",
        options: TYPO_OPTIONS,
      },
      {
        kind: "toggle",
        key: "hideExtraLetters",
        label: "hide extra letters",
        note: "extra letters no longer reflow the line.",
      },
    ],
  },
  {
    id: "sound",
    title: "sound",
    note: "the arena is silent until a key lands.",
    rows: [
      {
        kind: "range",
        key: "volume",
        label: "volume",
        note: "applies to every hit, miss and warning.",
        min: 0,
        max: 100,
        step: 5,
        suffix: "%",
      },
      {
        kind: "toggle",
        key: "clickSound",
        label: "click sound",
        note: "jabs, heavy strikes, kicks and slaps.",
      },
      {
        kind: "toggle",
        key: "errorSound",
        label: "error sound",
        note: "the low hit when a key is wrong.",
      },
      {
        kind: "toggle",
        key: "timeWarningSound",
        label: "time warning sound",
        note: "a two-tone warning at five seconds.",
      },
    ],
  },
  {
    id: "carets",
    title: "carets",
    note: "the strike line and the ghost that chases your pace.",
    rows: [
      {
        kind: "toggle",
        key: "smoothCaret",
        label: "smooth caret",
        note: "the line glides between letters instead of snapping.",
      },
      {
        kind: "choice",
        key: "caretStyle",
        label: "caret style",
        note: "line, block, underline or off.",
        options: CARET_OPTIONS,
      },
      {
        kind: "choice",
        key: "paceCaret",
        label: "pace caret",
        note: "a ghost caret at your average or personal-best speed.",
        options: PACE_CARET_OPTIONS,
      },
      {
        kind: "toggle",
        key: "repeatedPace",
        label: "repeated pace",
        note: "the pace caret restarts on every word.",
      },
      {
        kind: "choice",
        key: "paceCaretStyle",
        label: "pace caret style",
        note: "set it apart from the main caret.",
        options: CARET_OPTIONS,
      },
    ],
  },
  {
    id: "live",
    title: "live stats",
    note: "the speed, accuracy and burst readout in the hud.",
    rows: [
      {
        kind: "choice",
        key: "liveStyle",
        label: "live style",
        note: "text readout or small bar meters.",
        options: LIVE_STYLE_OPTIONS,
      },
      {
        kind: "choice",
        key: "liveColor",
        label: "live colour",
        note: "accent, body text or muted.",
        options: LIVE_COLOR_OPTIONS,
      },
      {
        kind: "range",
        key: "liveOpacity",
        label: "live opacity",
        note: "how far the readout sits back from the test.",
        min: 10,
        max: 100,
        step: 5,
        suffix: "%",
      },
    ],
  },
  {
    id: "display",
    title: "text display",
    note: "the shape of the word stream.",
    rows: [
      {
        kind: "choice",
        key: "highlightMode",
        label: "highlight mode",
        note: "mark the whole active word or just the next letter.",
        options: HIGHLIGHT_OPTIONS,
      },
      {
        kind: "choice",
        key: "typedEffect",
        label: "typed effect",
        note: "fade or pop letters after they land.",
        options: TYPED_EFFECT_OPTIONS,
      },
      {
        kind: "toggle",
        key: "tapeMode",
        label: "tape mode",
        note: "one continuous scrolling line instead of a word queue.",
      },
      {
        kind: "range",
        key: "tapeMargin",
        label: "tape margin",
        note: "how far the strike line sits from the left edge.",
        min: 0,
        max: 160,
        step: 8,
        suffix: " px",
      },
      {
        kind: "toggle",
        key: "smoothLineScroll",
        label: "smooth line scroll",
        note: "glide the stream instead of snapping it.",
      },
      {
        kind: "toggle",
        key: "showAllLines",
        label: "show all lines",
        note: "keep wrapped lines visible instead of fading them.",
      },
      {
        kind: "range",
        key: "maxLineWidth",
        label: "max line width",
        note: "0 uses the full stage.",
        min: 0,
        max: 1400,
        step: 40,
        suffix: " px",
      },
      {
        kind: "range",
        key: "fontSize",
        label: "font size",
        note: "0 uses the responsive size.",
        min: 0,
        max: 56,
        step: 1,
        suffix: " px",
      },
      {
        kind: "choice",
        key: "fontFamily",
        label: "font family",
        note: "JetBrains Mono, Berkeley Mono or the system mono.",
        options: FONT_OPTIONS,
      },
      {
        kind: "toggle",
        key: "useLocalFont",
        label: "use local font",
        note: "prefer the installed font before the bundled one.",
      },
      {
        kind: "toggle",
        key: "keymapMode",
        label: "keymap mode",
        note: "show an on-screen keyboard and the last key.",
      },
      {
        kind: "toggle",
        key: "flipTestColors",
        label: "flip test colours",
        note: "invert the word stream against the stage.",
      },
      {
        kind: "toggle",
        key: "colorfulMode",
        label: "colourful mode",
        note: "give every word its own hue.",
      },
    ],
  },
  {
    id: "results",
    title: "results",
    note: "how the score is written after the run.",
    rows: [
      {
        kind: "toggle",
        key: "resultDecimals",
        label: "always show decimal places",
        note: "keep one decimal on speed results.",
      },
      {
        kind: "choice",
        key: "speedUnit",
        label: "typing speed unit",
        note: "wpm, characters per minute, or per second.",
        options: SPEED_UNIT_OPTIONS,
      },
      {
        kind: "toggle",
        key: "graphStartZero",
        label: "start graphs at zero",
        note: "anchor the speed graph to zero instead of its minimum.",
      },
      {
        kind: "toggle",
        key: "showAverage",
        label: "show average of last 10",
        note: "adds a ten-run average to the result.",
      },
    ],
  },
  {
    id: "appearance",
    title: "appearance",
    note: "the page behind the arena. theme lives in the top bar.",
    rows: [
      {
        kind: "text",
        key: "customBackground",
        label: "custom background",
        note: "a colour or CSS gradient. leave empty for the theme.",
        placeholder: "#0b0d12 or linear-gradient(...)",
      },
      {
        kind: "toggle",
        key: "randomTheme",
        label: "random theme",
        note: "pick a different theme whenever a test restarts.",
      },
    ],
  },
  {
    id: "misc",
    title: "misc",
    note: "small courtesies and local data controls.",
    rows: [
      {
        kind: "toggle",
        key: "keyTips",
        label: "key tips",
        note: "show the shortcut strip under the arena.",
      },
      {
        kind: "toggle",
        key: "outOfFocusWarning",
        label: "out of focus warning",
        note: "nudge the player back to the test when the tab loses focus.",
      },
      {
        kind: "toggle",
        key: "capsLockWarning",
        label: "caps lock warning",
        note: "show a badge when caps lock is on.",
      },
      {
        kind: "toggle",
        key: "ads",
        label: "ad slot",
        note: "show a discreet sponsor line in the footer.",
      },
      {
        kind: "choice",
        key: "cookies",
        label: "cookie preferences",
        note: "stored locally. this build sets no tracking cookies.",
        options: COOKIE_OPTIONS,
      },
    ],
  },
];

const KEEP_FOCUS = (event: MouseEvent) => event.preventDefault();

export default function SettingsDialog({
  open,
  settings,
  onClose,
  onApply,
  onReset,
  onExport,
  onImport,
}: SettingsDialogProps) {
  const [draft, setDraft] = useState<TestSettings>(settings);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(settings);
    const timer = window.setTimeout(() => {
      panelRef.current?.focus({ preventScroll: true });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open, settings]);

  if (!open) return null;

  const update = (key: keyof TestSettings, next: unknown) => {
    setDraft((current) => ({ ...current, [key]: next }) as TestSettings);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onApply(draft);
    }
  };

  return (
    <div
      className="command-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="custom-panel settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="custom-head">
          <h2 className="custom-title" id="settings-title">
            settings
          </h2>
          <kbd>esc</kbd>
        </div>

        <div className="settings-scroll">
          {SECTIONS.map((section) => (
            <section
              className="settings-section"
              key={section.id}
              aria-labelledby={`settings-${section.id}`}
            >
              <div className="settings-head">
                <h3 className="settings-title" id={`settings-${section.id}`}>
                  {section.title}
                </h3>
                <p className="settings-note">{section.note}</p>
              </div>

              <div className="settings-rows">
                {section.rows.map((row) => {
                  const value = draft[row.key];
                  const controlId = `setting-${String(row.key)}`;

                  return (
                    <div className="settings-row" key={String(row.key)}>
                      <label className="settings-copy" htmlFor={controlId}>
                        <b>{row.label}</b>
                        <span>{row.note}</span>
                      </label>

                      {row.kind === "toggle" && (
                        <button
                          id={controlId}
                          type="button"
                          className={`set-toggle ${value ? "is-on" : ""}`}
                          role="switch"
                          aria-checked={Boolean(value)}
                          onClick={() => update(row.key, !value)}
                          onMouseDown={KEEP_FOCUS}
                        >
                          <span className="set-toggle-dot" aria-hidden="true" />
                          <span className="set-toggle-text">
                            {value ? "on" : "off"}
                          </span>
                        </button>
                      )}

                      {row.kind === "choice" && (
                        <div
                          className="set-choice"
                          role="group"
                          aria-label={row.label}
                        >
                          {row.options.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={`set-choice-option ${
                                String(value) === option.id ? "is-active" : ""
                              }`}
                              aria-pressed={String(value) === option.id}
                              onClick={() => update(row.key, option.id)}
                              onMouseDown={KEEP_FOCUS}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {row.kind === "range" && (
                        <div className="set-range">
                          <input
                            id={controlId}
                            type="range"
                            min={row.min}
                            max={row.max}
                            step={row.step}
                            value={Number(value)}
                            onChange={(event) =>
                              update(row.key, Number(event.target.value))
                            }
                            aria-label={row.label}
                          />
                          <span className="set-value">
                            {Number(value)}
                            {row.suffix ?? ""}
                          </span>
                        </div>
                      )}

                      {row.kind === "text" && (
                        <input
                          id={controlId}
                          type="text"
                          className="set-text"
                          value={String(value)}
                          placeholder={row.placeholder}
                          onChange={(event) =>
                            update(row.key, event.target.value)
                          }
                          spellCheck={false}
                          autoComplete="off"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="custom-foot settings-foot">
          <div className="settings-data">
            <button
              type="button"
              className="button"
              onClick={onReset}
              onMouseDown={KEEP_FOCUS}
            >
              reset
            </button>
            <button
              type="button"
              className="button"
              onClick={onExport}
              onMouseDown={KEEP_FOCUS}
            >
              export
            </button>
            <button
              type="button"
              className="button"
              onClick={onImport}
              onMouseDown={KEEP_FOCUS}
            >
              import
            </button>
          </div>
          <div className="custom-actions">
            <button
              type="button"
              className="button"
              onClick={onClose}
              onMouseDown={KEEP_FOCUS}
            >
              cancel
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => onApply(draft)}
              onMouseDown={KEEP_FOCUS}
            >
              use settings <kbd>ctrl enter</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
