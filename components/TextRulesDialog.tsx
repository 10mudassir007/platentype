"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from "react";

import {
  CUSTOM_LIMIT_OPTIONS,
  CUSTOM_ORDER_OPTIONS,
  CUSTOM_SECTION_OPTIONS,
  CUSTOM_TIME_OPTIONS,
  CUSTOM_WORD_OPTIONS,
  customRulesSummary,
  type TestSettings,
} from "@/lib/settings";

interface TextRulesDialogProps {
  open: boolean;
  settings: TestSettings;
  onClose: () => void;
  onApply: (patch: Partial<TestSettings>) => void;
}

type RuleDraft = Pick<
  TestSettings,
  | "customOrder"
  | "customLimit"
  | "customWords"
  | "customSeconds"
  | "customSections"
  | "wordDelimiter"
  | "removeZeroWidth"
  | "removeFancyTypography"
  | "replaceControlChars"
  | "replaceNewlines"
  | "addPeriods"
>;

function draftFrom(settings: TestSettings): RuleDraft {
  return {
    customOrder: settings.customOrder,
    customLimit: settings.customLimit,
    customWords: settings.customWords,
    customSeconds: settings.customSeconds,
    customSections: settings.customSections,
    wordDelimiter: settings.wordDelimiter,
    removeZeroWidth: settings.removeZeroWidth,
    removeFancyTypography: settings.removeFancyTypography,
    replaceControlChars: settings.replaceControlChars,
    replaceNewlines: settings.replaceNewlines,
    addPeriods: settings.addPeriods,
  };
}

const KEEP_FOCUS = (event: MouseEvent) => event.preventDefault();

const ORDER_NOTES: Record<RuleDraft["customOrder"], string> = {
  repeat: "keeps your text in order and cycles it when the limit needs more.",
  shuffle: "reshuffles the words each time the text starts over.",
  random: "picks words from your text at random, so repeats are possible.",
};

interface RuleSwitchProps {
  name: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  sub?: boolean;
  onToggle: () => void;
}

function RuleSwitch({
  name,
  description,
  checked,
  disabled = false,
  sub = false,
  onToggle,
}: RuleSwitchProps) {
  return (
    <div
      className={`rules-switch-row ${checked ? "is-on" : ""} ${
        disabled ? "is-disabled" : ""
      } ${sub ? "rules-switch-sub" : ""}`}
    >
      <button
        type="button"
        className="rules-switch"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onMouseDown={KEEP_FOCUS}
        onClick={onToggle}
      >
        <span className="rules-switch-dot" aria-hidden="true" />
        <span className="rules-switch-name">{name}</span>
      </button>
      <p className="rules-switch-desc">{description}</p>
    </div>
  );
}

export default function TextRulesDialog({
  open,
  settings,
  onClose,
  onApply,
}: TextRulesDialogProps) {
  const [draft, setDraft] = useState<RuleDraft>(() => draftFrom(settings));
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(draftFrom(settings));
    const timer = window.setTimeout(() => {
      panelRef.current?.focus({ preventScroll: true });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open, settings]);

  if (!open) return null;

  const patch = (next: Partial<RuleDraft>) =>
    setDraft((current) => ({ ...current, ...next }));

  const apply = () => onApply({ ...draft });

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      apply();
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
        className="custom-panel rules-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="custom-head">
          <h2 className="custom-title" id="rules-title">
            text rules
          </h2>
          <kbd>esc</kbd>
        </div>

        <div className="rules-scroll">
          <section className="rules-section" aria-labelledby="rules-order">
            <div className="rules-head">
              <h3 className="rules-label" id="rules-order">
                mode
              </h3>
              <p className="rules-note">{ORDER_NOTES[draft.customOrder]}</p>
            </div>
            <div className="rules-chips" role="group" aria-label="Word order">
              {CUSTOM_ORDER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`rules-chip ${
                    draft.customOrder === option.id ? "is-active" : ""
                  }`}
                  aria-pressed={draft.customOrder === option.id}
                  onMouseDown={KEEP_FOCUS}
                  onClick={() => patch({ customOrder: option.id })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rules-section" aria-labelledby="rules-limit">
            <div className="rules-head">
              <h3 className="rules-label" id="rules-limit">
                limit
              </h3>
              <p className="rules-note">what ends the run.</p>
            </div>
            <div className="rules-chips" role="group" aria-label="Run limit">
              {CUSTOM_LIMIT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`rules-chip ${
                    draft.customLimit === option.id ? "is-active" : ""
                  }`}
                  aria-pressed={draft.customLimit === option.id}
                  onMouseDown={KEEP_FOCUS}
                  onClick={() => patch({ customLimit: option.id })}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="rules-values">
              {draft.customLimit === "words" &&
                CUSTOM_WORD_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`rules-chip rules-value ${
                      draft.customWords === value ? "is-active" : ""
                    }`}
                    aria-pressed={draft.customWords === value}
                    onMouseDown={KEEP_FOCUS}
                    onClick={() => patch({ customWords: value })}
                  >
                    {value}
                  </button>
                ))}
              {draft.customLimit === "time" &&
                CUSTOM_TIME_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`rules-chip rules-value ${
                      draft.customSeconds === value ? "is-active" : ""
                    }`}
                    aria-pressed={draft.customSeconds === value}
                    onMouseDown={KEEP_FOCUS}
                    onClick={() => patch({ customSeconds: value })}
                  >
                    {value}s
                  </button>
                ))}
              {draft.customLimit === "sections" &&
                CUSTOM_SECTION_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`rules-chip rules-value ${
                      draft.customSections === value ? "is-active" : ""
                    }`}
                    aria-pressed={draft.customSections === value}
                    onMouseDown={KEEP_FOCUS}
                    onClick={() => patch({ customSections: value })}
                  >
                    {value}
                  </button>
                ))}
            </div>
            <p className="rules-footnote">
              sections are the line breaks in your text. flatten new lines to
              turn the whole text into one section.
            </p>
          </section>

          <section className="rules-section" aria-labelledby="rules-delimiter">
            <div className="rules-head">
              <h3 className="rules-label" id="rules-delimiter">
                word delimiter
              </h3>
              <p className="rules-note">what splits one word from the next.</p>
            </div>
            <div className="rules-chips" role="group" aria-label="Word delimiter">
              <button
                type="button"
                className={`rules-chip ${
                  draft.wordDelimiter === " " ? "is-active" : ""
                }`}
                aria-pressed={draft.wordDelimiter === " "}
                onMouseDown={KEEP_FOCUS}
                onClick={() => patch({ wordDelimiter: " " })}
              >
                space
              </button>
              <button
                type="button"
                className={`rules-chip ${
                  draft.wordDelimiter === "|" ? "is-active" : ""
                }`}
                aria-pressed={draft.wordDelimiter === "|"}
                onMouseDown={KEEP_FOCUS}
                onClick={() => patch({ wordDelimiter: "|" })}
              >
                pipe |
              </button>
            </div>
            <p className="rules-example">
              <code>one|two three</code>
              {draft.wordDelimiter === "|" ? (
                <span>
                  → <b>one</b>, then <b>two three</b> as one group
                </span>
              ) : (
                <span>
                  → <b>one|two</b>, then <b>three</b>
                </span>
              )}
            </p>
          </section>

          <section className="rules-section" aria-labelledby="rules-cleanup">
            <div className="rules-head">
              <h3 className="rules-label" id="rules-cleanup">
                cleanup
              </h3>
              <p className="rules-note">applied before the words are split.</p>
            </div>
            <div className="rules-switches">
              <RuleSwitch
                name="zero-width characters"
                description="strips invisible characters that cause unexplainable typos."
                checked={draft.removeZeroWidth}
                onToggle={() =>
                  patch({ removeZeroWidth: !draft.removeZeroWidth })
                }
              />
              <RuleSwitch
                name="fancy typography"
                description="curly quotes and fancy dashes become plain keyboard keys."
                checked={draft.removeFancyTypography}
                onToggle={() =>
                  patch({
                    removeFancyTypography: !draft.removeFancyTypography,
                  })
                }
              />
              <RuleSwitch
                name="control characters"
                description="literal \n and \t become real line breaks and tabs."
                checked={draft.replaceControlChars}
                onToggle={() =>
                  patch({
                    replaceControlChars: !draft.replaceControlChars,
                  })
                }
              />
              <RuleSwitch
                name="flatten new lines"
                description="turns every line break into a space so the text becomes one stream."
                checked={draft.replaceNewlines}
                onToggle={() =>
                  patch({
                    replaceNewlines: !draft.replaceNewlines,
                    addPeriods: draft.replaceNewlines
                      ? false
                      : draft.addPeriods,
                  })
                }
              />
              <RuleSwitch
                name="add periods"
                description="ends each line with a period before it is flattened."
                checked={draft.addPeriods}
                disabled={!draft.replaceNewlines}
                sub
                onToggle={() => patch({ addPeriods: !draft.addPeriods })}
              />
            </div>
          </section>
        </div>

        <div className="custom-foot">
          <p className="rules-summary">{customRulesSummary({ ...settings, ...draft })}</p>
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
              onClick={apply}
              onMouseDown={KEEP_FOCUS}
            >
              use rules <kbd>ctrl enter</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
