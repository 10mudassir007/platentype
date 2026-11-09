"use client";

import { useEffect, useState } from "react";

import type { Auth } from "@/lib/auth";
import { duelSettingsFrom, type Duel } from "@/lib/duel";
import type { TestSettings } from "@/lib/settings";

interface MultiplayerDialogProps {
  open: boolean;
  duel: Duel;
  auth: Auth;
  settings: TestSettings;
  onClose: () => void;
  onOpenAuth: () => void;
}

interface NetworkInfo {
  urls: string[];
  configured: string | null;
  online: boolean;
}

export default function MultiplayerDialog({
  open,
  duel,
  auth,
  settings,
  onClose,
  onOpenAuth,
}: MultiplayerDialogProps) {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState("");
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    duel.connect();
    duel.listRooms();
    const timer = window.setInterval(() => duel.listRooms(), 4000);
    let cancelled = false;
    void fetch("/api/network", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: NetworkInfo) => {
        if (!cancelled) setNetwork(payload);
      })
      .catch(() => {
        if (!cancelled) setNetwork(null);
      });
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // duel callbacks are stable; only the open state should restart polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(""), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!open) return null;

  const room = duel.room;
  const roomSettings = room?.settings ?? duelSettingsFrom(settings);
  const isHost = Boolean(room && duel.selfId === room.hostId);
  const inRoom = Boolean(room);
  const connectionLabel =
    duel.connection === "open"
      ? "connected"
      : duel.connection === "connecting"
        ? "connecting"
        : duel.connection === "closed"
          ? "reconnecting"
          : "idle";

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied("copy failed");
    }
  };

  const join = () => {
    const wanted = code.trim().toUpperCase();
    if (wanted.length < 4) return;
    setBusy(true);
    duel.joinRoom(wanted);
    window.setTimeout(() => setBusy(false), 900);
  };

  return (
    <div
      className="command-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="custom-panel arena-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Multiplayer duel"
      >
        <div className="custom-head">
          <div>
            <h2 className="custom-title">duel arena</h2>
          </div>
          <div className="arena-head-tools">
            <span className={`arena-status is-${duel.connection}`}>
              <span className="duel-dot" aria-hidden="true" />
              {connectionLabel}
            </span>
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

        <div className="arena-identity">
          <div>
            <span className="arena-label">playing as</span>
            <b className="arena-name">{auth.displayName}</b>
            <span className="arena-provider">
              {auth.user?.guest === false
                ? auth.user.provider
                : "guest"}
            </span>
          </div>
          <button
            type="button"
            className="button"
            onClick={onOpenAuth}
            onMouseDown={(event) => event.preventDefault()}
          >
            account
          </button>
        </div>

        {duel.error && (
          <p className="arena-error" role="alert">
            {duel.error}
          </p>
        )}

        {!inRoom ? (
          <>
            <div className="arena-actions">
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  duel.cancelQuick();
                  duel.quickMatch(duelSettingsFrom(settings));
                }}
                onMouseDown={(event) => event.preventDefault()}
              >
                quick match
              </button>
              <button
                type="button"
                className="button"
                onClick={() => duel.createRoom(duelSettingsFrom(settings))}
                onMouseDown={(event) => event.preventDefault()}
              >
                create room
              </button>
              <span className="arena-note">
                {roomSettings.mode === "words"
                  ? `${roomSettings.wordCount} words`
                  : `${roomSettings.duration}s`}{" "}
                · {roomSettings.difficulty}
              </span>
            </div>

            {duel.queuePosition > 0 && (
              <div className="arena-queue" role="status">
                <span className="start-dot" />
                waiting for a second player · position {duel.queuePosition}
                <button
                  type="button"
                  className="arena-link"
                  onClick={() => duel.cancelQuick()}
                >
                  cancel
                </button>
              </div>
            )}

            <div className="arena-join">
              <label className="arena-label" htmlFor="duel-code">
                join with a room code
              </label>
              <div className="arena-join-row">
                <input
                  id="duel-code"
                  className="arena-input arena-code-input"
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z2-9]/g, "")
                        .slice(0, 5),
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") join();
                  }}
                  placeholder="ABC12"
                  aria-label="Room code"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="button"
                  onClick={join}
                  disabled={busy || code.trim().length < 4}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  join
                </button>
              </div>
            </div>

            <div className="arena-board">
              <div className="arena-board-head">
                <span className="arena-label">open rooms</span>
                <button
                  type="button"
                  className="arena-link"
                  onClick={() => duel.listRooms()}
                >
                  refresh
                </button>
              </div>
              {duel.rooms.length === 0 ? (
                <p className="arena-empty">
                  no rooms yet. create one, or use quick match.
                </p>
              ) : (
                <ul className="arena-room-list">
                  {duel.rooms.map((entry) => (
                    <li key={entry.code}>
                      <button
                        type="button"
                        className="arena-room"
                        onClick={() => duel.joinRoom(entry.code)}
                        disabled={entry.count >= entry.max || entry.status !== "lobby"}
                      >
                        <span className="arena-room-code">{entry.code}</span>
                        <span className="arena-room-host">{entry.host}</span>
                        <span className="arena-room-meta">
                          {entry.mode === "words"
                            ? `${entry.wordCount}w`
                            : `${entry.duration}s`}{" "}
                          · {entry.difficulty}
                        </span>
                        <span className="arena-room-count">
                          {entry.count}/{entry.max}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="arena-room-view">
            <div className="arena-code-card">
              <span className="arena-label">room code</span>
              <b className="arena-big-code">{room?.code}</b>
              <button
                type="button"
                className="button"
                onClick={() => copy(room?.code ?? "", "code copied")}
                onMouseDown={(event) => event.preventDefault()}
              >
                {copied === "code copied" ? "copied" : "copy code"}
              </button>
            </div>

            <div className="arena-players">
              {room?.players.map((player) => (
                <div className="arena-player" key={player.id}>
                  <span className="duel-dot" aria-hidden="true" />
                  <b>{player.name}</b>
                  <span>
                    {player.id === room.hostId ? "host" : "guest"}
                    {player.id === duel.selfId ? " · you" : ""}
                  </span>
                  <em>{player.finished ? "finished" : player.connected ? "ready" : "away"}</em>
                </div>
              ))}
              {room && room.players.length < 2 && (
                <div className="arena-player is-open">
                  <span className="start-dot" aria-hidden="true" />
                  <b>waiting for an opponent</b>
                  <span>share the code</span>
                </div>
              )}
            </div>

            <p className="arena-note">
              {roomSettings.mode === "words"
                ? `${roomSettings.wordCount} words`
                : `${roomSettings.duration}s`}{" "}
              · {roomSettings.difficulty} · same seed for both players
            </p>

            <div className="arena-actions">
              {isHost ? (
                <button
                  type="button"
                  className="button primary"
                  onClick={() => duel.startRace()}
                  disabled={!room || room.players.length < 2 || room.status !== "lobby"}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  {room?.status === "lobby" ? "start duel" : "duel running"}
                </button>
              ) : (
                <span className="arena-wait">
                  {room?.status === "lobby" ? "waiting for the host" : "race in progress"}
                </span>
              )}
              <button
                type="button"
                className="button"
                onClick={() => {
                  duel.leaveRoom();
                  duel.listRooms();
                }}
                onMouseDown={(event) => event.preventDefault()}
              >
                leave room
              </button>
            </div>
          </div>
        )}

        <div className="arena-lan">
          <span className="arena-label">local network</span>
          {network?.urls.length ? (
            <div className="arena-lan-row">
              {network.urls.map((url) => (
                <button
                  type="button"
                  className="arena-link"
                  key={url}
                  onClick={() => copy(url, "address copied")}
                  title="Copy this address"
                >
                  {url}
                </button>
              ))}
              <span className="arena-note">
                open this address on the other device, then join the same room
              </span>
            </div>
          ) : (
            <p className="arena-note">
              no LAN address found. open the page from the host machine or a
              public URL.
            </p>
          )}
          {network?.configured && (
            <p className="arena-note">
              online: {network.configured} · set PLATEN_BASE_URL to the public
              address
            </p>
          )}
          {copied === "address copied" && (
            <p className="arena-note is-good">address copied</p>
          )}
        </div>
      </div>
    </div>
  );
}
