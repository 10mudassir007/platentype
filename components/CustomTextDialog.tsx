"use client";

import { useEffect, useRef, useState } from "react";

interface CustomTextDialogProps {
  open: boolean;
  initialText: string;
  onClose: () => void;
  onApply: (text: string) => void;
}

export default function CustomTextDialog({
  open,
  initialText,
  onClose,
  onApply,
}: CustomTextDialogProps) {
  const [draft, setDraft] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initialText);
    const timer = window.setTimeout(() => {
      textareaRef.current?.focus({ preventScroll: true });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [initialText, open]);

  if (!open) return null;

  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const chars = draft.length;

  return (
    <div
      className="command-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="custom-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Custom text"
      >
        <div className="custom-head">
          <h2 className="custom-title">paste or write your own drill</h2>
          <kbd>esc</kbd>
        </div>

        <textarea
          ref={textareaRef}
          className="custom-textarea"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              onApply(draft);
            }
          }}
          placeholder="Paste an article, a poem, or a sentence you want to drill."
          aria-label="Custom drill text"
          spellCheck={false}
        />

        <div className="custom-foot">
          <p className="custom-count">
            <span>
              <b>{words}</b> words
            </span>
            <span>
              <b>{chars}</b> chars
            </span>
            <span className="custom-note">
              kept as written · text rules shape the run
            </span>
          </p>
          <div className="custom-actions">
            <button
              type="button"
              className="button"
              onClick={onClose}
              onMouseDown={(event) => event.preventDefault()}
            >
              cancel
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => onApply(draft)}
              onMouseDown={(event) => event.preventDefault()}
              disabled={!draft.trim()}
            >
              use text <kbd>ctrl enter</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
