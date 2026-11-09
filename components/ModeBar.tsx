"use client";

import type { MouseEvent } from "react";

import {
  DIFFICULTY_OPTIONS,
  QUOTE_OPTIONS,
  TEST_MODES,
  TIME_OPTIONS,
  WORD_OPTIONS,
  customRulesSummary,
  supportsOptions,
  type TestMode,
  type TestSettings,
} from "@/lib/settings";

interface ModeBarProps {
  settings: TestSettings;
  locked?: boolean;
  onChange: (patch: Partial<TestSettings>) => void;
  onSelectMode: (mode: TestMode) => void;
  onEditCustom: () => void;
  onOpenRules: () => void;
}

const KEEP_FOCUS = (event: MouseEvent) => event.preventDefault();

export default function ModeBar({
  settings,
  locked = false,
  onChange,
  onSelectMode,
  onEditCustom,
  onOpenRules,
}: ModeBarProps) {
  const optionsEnabled = supportsOptions(settings);

  return (
    <div
      className={`modebar ${locked ? "is-locked" : ""}`}
      role="toolbar"
      aria-label="Test mode and options"
      aria-disabled={locked}
    >
      <div className="modebar-group mode-tabs">
        {TEST_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`mode-tab ${settings.mode === mode.id ? "is-active" : ""}`}
            aria-pressed={settings.mode === mode.id}
            onMouseDown={KEEP_FOCUS}
            onClick={() => onSelectMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <span className="modebar-rule" aria-hidden="true" />

      <div className="modebar-group variant-tabs" role="group" aria-label="Mode length">
        {settings.mode === "time" &&
          TIME_OPTIONS.map((duration) => (
            <button
              key={duration}
              type="button"
              className={`mode-option ${settings.duration === duration ? "is-active" : ""}`}
              aria-pressed={settings.duration === duration}
              onMouseDown={KEEP_FOCUS}
              onClick={() => onChange({ duration })}
            >
              {duration}s
            </button>
          ))}

        {settings.mode === "words" &&
          WORD_OPTIONS.map((wordCount) => (
            <button
              key={wordCount}
              type="button"
              className={`mode-option ${settings.wordCount === wordCount ? "is-active" : ""}`}
              aria-pressed={settings.wordCount === wordCount}
              onMouseDown={KEEP_FOCUS}
              onClick={() => onChange({ wordCount })}
            >
              {wordCount}
            </button>
          ))}

        {settings.mode === "quote" && (
          <>
            {QUOTE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`mode-option ${settings.quoteLength === option.id ? "is-active" : ""}`}
                aria-pressed={settings.quoteLength === option.id}
                onMouseDown={KEEP_FOCUS}
                onClick={() => onChange({ quoteLength: option.id })}
              >
                {option.label}
              </button>
            ))}
          </>
        )}

        {settings.mode === "zen" && (
          <span className="modebar-note">endless · enter finishes</span>
        )}

        {settings.mode === "custom" && (
          <>
            <button
              type="button"
              className="mode-option is-ghost"
              onMouseDown={KEEP_FOCUS}
              onClick={onEditCustom}
            >
              edit text
            </button>
            <button
              type="button"
              className="mode-option is-ghost"
              title={customRulesSummary(settings)}
              aria-haspopup="dialog"
              onMouseDown={KEEP_FOCUS}
              onClick={onOpenRules}
            >
              rules
            </button>
            <span className="modebar-note">
              {settings.customOrder} ·{" "}
              {settings.wordDelimiter === "|" ? "pipe" : "space"}
            </span>
          </>
        )}
      </div>

      <span className="modebar-spacer" aria-hidden="true" />

      <div className="modebar-group difficulty-tabs" role="group" aria-label="Difficulty">
        {DIFFICULTY_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`mode-option ${settings.difficulty === option.id ? "is-active" : ""}`}
            aria-pressed={settings.difficulty === option.id}
            onMouseDown={KEEP_FOCUS}
            onClick={() => onChange({ difficulty: option.id })}
            title={
              option.id === "easy"
                ? "mistakes are forgiven"
                : option.id === "medium"
                  ? "a wrong word ends the run"
                  : "any wrong key ends the run"
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <span className="modebar-rule" aria-hidden="true" />

      <div className="modebar-group option-toggles" role="group" aria-label="Text options">
        <button
          type="button"
          className={`option-chip ${settings.punctuation ? "is-on" : ""}`}
          aria-pressed={settings.punctuation}
          disabled={!optionsEnabled}
          title={
            optionsEnabled
              ? "Toggle punctuation in the drill text"
              : "Punctuation applies to time, words and zen"
          }
          onMouseDown={KEEP_FOCUS}
          onClick={() => onChange({ punctuation: !settings.punctuation })}
        >
          <span className="chip-mark" aria-hidden="true">
            @
          </span>
          punctuation
        </button>
        <button
          type="button"
          className={`option-chip ${settings.numbers ? "is-on" : ""}`}
          aria-pressed={settings.numbers}
          disabled={!optionsEnabled}
          title={
            optionsEnabled
              ? "Toggle numeric tokens in the drill text"
              : "Numbers apply to time, words and zen"
          }
          onMouseDown={KEEP_FOCUS}
          onClick={() => onChange({ numbers: !settings.numbers })}
        >
          <span className="chip-mark" aria-hidden="true">
            #
          </span>
          numbers
        </button>
      </div>
    </div>
  );
}
