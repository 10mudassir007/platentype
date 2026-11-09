"use client";

import { useEffect, useState } from "react";

import type { Auth } from "@/lib/auth";

interface AuthDialogProps {
  open: boolean;
  auth: Auth;
  onClose: () => void;
}

export default function AuthDialog({ open, auth, onClose }: AuthDialogProps) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(auth.user?.name ?? auth.displayName);
    setError("");
    setSaved(false);
  }, [auth.displayName, auth.user?.name, open]);

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

  const save = async () => {
    const name = draft.trim();
    if (name.length < 2) {
      setError("a name needs at least two characters");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await auth.setName(name);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "could not save that name");
    } finally {
      setSaving(false);
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
        className="custom-panel arena-panel auth-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Account"
      >
        <div className="custom-head">
          <div>
            <h2 className="custom-title">account</h2>
          </div>
          <button
            type="button"
            className="button"
            onClick={onClose}
            onMouseDown={(event) => event.preventDefault()}
          >
            close <kbd>esc</kbd>
          </button>
        </div>

        <div className="auth-identity">
          <span className="auth-avatar" aria-hidden="true">
            {auth.user?.avatar ? (
              // Provider avatars are remote; next/image is unnecessary here.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={auth.user.avatar} alt="" />
            ) : (
              (auth.user?.name ?? auth.displayName).slice(0, 1).toUpperCase()
            )}
          </span>
          <div>
            <b>{auth.user?.name ?? auth.displayName}</b>
            <span>
              {auth.user
                ? auth.user.guest
                  ? "guest session"
                  : `signed in with ${auth.user.provider}`
                : "not signed in yet"}
            </span>
          </div>
          {auth.user && (
            <button
              type="button"
              className="arena-link"
              onClick={() => {
                void auth.logout();
                setSaved(false);
              }}
            >
              sign out
            </button>
          )}
        </div>

        <div className="auth-section">
          <label className="arena-label" htmlFor="auth-name">
            username
          </label>
          <div className="arena-join-row">
            <input
              id="auth-name"
              className="arena-input"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value.slice(0, 20));
                setSaved(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void save();
              }}
              placeholder="fighter name"
              autoComplete="nickname"
              spellCheck={false}
            />
            <button
              type="button"
              className="button primary"
              onClick={() => void save()}
              disabled={saving || draft.trim().length < 2}
              onMouseDown={(event) => event.preventDefault()}
            >
              {saving ? "saving" : saved ? "saved" : "save name"}
            </button>
          </div>
          <p className="arena-note">
            Your name travels with your score, duel room and leaderboard row.
          </p>
          {error && (
            <p className="arena-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="auth-section">
          <span className="arena-label">oauth2 sign-in</span>
          <div className="auth-providers">
            <button
              type="button"
              className="button"
              disabled={!auth.providers.github}
              onClick={() => auth.signIn("github")}
              onMouseDown={(event) => event.preventDefault()}
              title={
                auth.providers.github
                  ? "Sign in with GitHub"
                  : "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on the server"
              }
            >
              github
              {!auth.providers.github && <small>not configured</small>}
            </button>
            <button
              type="button"
              className="button"
              disabled={!auth.providers.google}
              onClick={() => auth.signIn("google")}
              onMouseDown={(event) => event.preventDefault()}
              title={
                auth.providers.google
                  ? "Sign in with Google"
                  : "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server"
              }
            >
              google
              {!auth.providers.google && <small>not configured</small>}
            </button>
          </div>
          <p className="arena-note">
            Guest play works without OAuth. Add provider credentials to `.env`
            and restart the server to enable the buttons.
          </p>
        </div>

        {auth.notice && <p className="arena-note is-good">{auth.notice}</p>}
      </div>
    </div>
  );
}
