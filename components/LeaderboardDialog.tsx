"use client";

import { useCallback, useEffect, useState } from "react";

import type { Auth } from "@/lib/auth";

interface LeaderboardDialogProps {
  open: boolean;
  auth: Auth;
  onClose: () => void;
  onOpenAuth: () => void;
}

interface Entry {
  id: string;
  name: string;
  provider: string;
  avatar: string | null;
  score: number;
  wpm: number;
  accuracy: number;
  difficulty: string;
  mode: string;
  duration: number;
  correctChars: number;
  correctWords: number;
  rank: number;
}

const DIFFICULTIES = ["all", "easy", "medium", "hard"];
const MODES = ["all", "time", "words", "quote", "zen", "custom"];

export default function LeaderboardDialog({
  open,
  auth,
  onClose,
  onOpenAuth,
}: LeaderboardDialogProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [difficulty, setDifficulty] = useState("all");
  const [mode, setMode] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ difficulty, mode, limit: "50" });
      const response = await fetch(`/api/leaderboard?${params}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("the board could not be read");
      const payload = (await response.json()) as { entries: Entry[] };
      setEntries(payload.entries ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "the board could not be read");
    } finally {
      setLoading(false);
    }
  }, [difficulty, mode]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const mine = auth.user
    ? entries.find((entry) => entry.name === auth.user?.name)
    : null;

  return (
    <div
      className="command-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="custom-panel arena-panel board-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Leaderboard"
      >
        <div className="custom-head">
          <div>
            <h2 className="custom-title">leaderboard</h2>
          </div>
          <div className="arena-head-tools">
            <button
              type="button"
              className="button"
              onClick={() => void load()}
              onMouseDown={(event) => event.preventDefault()}
            >
              {loading ? "loading" : "refresh"}
            </button>
            <button
              type="button"
              className="button"
              onClick={onClose}
              onMouseDown={(event) => event.preventDefault()}
            >
              close <kbd>esc</kbd>
            </button>
          </div>
        </div>

        <div className="board-filters">
          <div className="board-filter">
            <span className="arena-label">difficulty</span>
            <div className="board-chips">
              {DIFFICULTIES.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`mode-option ${difficulty === value ? "is-active" : ""}`}
                  aria-pressed={difficulty === value}
                  onClick={() => setDifficulty(value)}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="board-filter">
            <span className="arena-label">mode</span>
            <div className="board-chips">
              {MODES.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`mode-option ${mode === value ? "is-active" : ""}`}
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="arena-error" role="alert">
            {error}
          </p>
        )}

        <div className="board-table-wrap">
          <table className="board-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">player</th>
                <th scope="col">score</th>
                <th scope="col">wpm</th>
                <th scope="col">acc</th>
                <th scope="col">run</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="board-empty">
                    {loading
                      ? "reading the board..."
                      : "no scores here yet. finish a run and the board fills up."}
                  </td>
                </tr>
              )}
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className={mine?.id === entry.id ? "is-you" : undefined}
                >
                  <td className="board-rank">{entry.rank}</td>
                  <td>
                    <span className="board-player">
                      <b>{entry.name}</b>
                      <small>
                        {entry.provider === "guest" ? "guest" : entry.provider}
                      </small>
                    </span>
                  </td>
                  <td className="board-score">{entry.score.toLocaleString()}</td>
                  <td>{entry.wpm}</td>
                  <td>{entry.accuracy}%</td>
                  <td>
                    {entry.mode === "time"
                      ? `${entry.duration}s`
                      : entry.mode}{" "}
                    · {entry.difficulty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="arena-actions">
          {auth.user ? (
            <span className="arena-note">
              signed in as <b>{auth.user.name}</b> · every finished run is
              submitted automatically
            </span>
          ) : (
            <>
              <span className="arena-note">
                sign in with a username to keep your scores together
              </span>
              <button
                type="button"
                className="button"
                onClick={onOpenAuth}
                onMouseDown={(event) => event.preventDefault()}
              >
                set username
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
