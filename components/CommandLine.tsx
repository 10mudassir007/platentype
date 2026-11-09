"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface CommandItem {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

interface CommandLineProps {
  open: boolean;
  commands: CommandItem[];
  /** Flattens the list: no hints, no footer legend. */
  compact?: boolean;
  onClose: () => void;
}

export default function CommandLine({
  open,
  commands,
  compact = false,
  onClose,
}: CommandLineProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(needle) ||
        command.hint.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    const item = listRef.current?.children[index] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const run = (command: CommandItem | undefined) => {
    if (!command) return;
    command.run();
    onClose();
  };

  return (
    <div
      className="command-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`command-panel ${compact ? "is-compact" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Command line"
      >
        <div className="command-input-row">
          <span className="command-prompt" aria-hidden="true">
            &gt;
          </span>
          <input
            ref={inputRef}
            className="command-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((current) =>
                  matches.length ? (current + 1) % matches.length : 0,
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((current) =>
                  matches.length
                    ? (current - 1 + matches.length) % matches.length
                    : 0,
                );
              } else if (event.key === "Tab") {
                event.preventDefault();
                const item = matches[index];
                if (item) setQuery(item.label);
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(matches[index]);
              }
            }}
            placeholder="type a command: time 30, words 50, zen, theme"
            aria-label="Command"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>esc</kbd>
        </div>

        {matches.length > 0 ? (
          <ul className="command-list" role="listbox" ref={listRef}>
            {matches.map((command, commandIndex) => (
              <li key={command.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={commandIndex === index}
                  className={`command-item ${commandIndex === index ? "is-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setIndex(commandIndex)}
                  onClick={() => run(command)}
                >
                  <span className="command-label">{command.label}</span>
                  {!compact && <span className="command-hint">{command.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="command-empty">no command matches “{query.trim()}”</p>
        )}

        {!compact && (
          <p className="command-foot">
            <span>
              <kbd>↑</kbd> <kbd>↓</kbd> move
            </span>
            <span>
              <kbd>enter</kbd> run
            </span>
            <span>
              <kbd>esc</kbd> close
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
