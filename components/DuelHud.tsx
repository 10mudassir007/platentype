"use client";

import type { Duel, DuelPeerState } from "@/lib/duel";

export interface SelfDuelState {
  name: string;
  score: number;
  wpm: number;
  accuracy: number;
  progress: number;
  word: string;
  typed: string;
}

interface DuelHudProps {
  duel: Duel;
  selfState: SelfDuelState;
  countdown: number;
  outcome: "win" | "loss" | "draw" | null;
  winnerName: string | null;
}

function TypedWord({
  word,
  typed,
  empty,
}: {
  word: string;
  typed: string;
  empty: string;
}) {
  if (!word && !typed) {
    return <span className="duel-typed is-empty">{empty}</span>;
  }
  const letters = word.split("");
  return (
    <span className="duel-typed">
      {letters.map((letter, index) => {
        const typedChar = typed[index];
        const has = index < typed.length;
        const cls = has
          ? typedChar === letter
            ? "is-good"
            : "is-bad"
          : index === typed.length
            ? "is-cursor"
            : "";
        return (
          <span className={cls} key={index}>
            {letter === " " ? "\u00a0" : letter}
          </span>
        );
      })}
      {typed.length > word.length && (
        <span className="is-bad">{typed.slice(word.length)}</span>
      )}
    </span>
  );
}

function scoreLine(state: DuelPeerState | null) {
  return {
    score: state?.score ?? 0,
    wpm: state?.wpm ?? 0,
    accuracy: state?.accuracy ?? 100,
    progress: state?.progress ?? 0,
    word: state?.word ?? "",
    typed: state?.typed ?? "",
    status: state?.status ?? "idle",
  };
}

export default function DuelHud({
  duel,
  selfState,
  countdown,
  outcome,
  winnerName,
}: DuelHudProps) {
  const room = duel.room;
  if (!room) return null;
  const peer = room.players.find((player) => player.id !== duel.selfId);
  const peerState = duel.peerState;
  const peerLive = scoreLine(peerState);
  const result = duel.result;
  const peerName = peer?.name ?? "waiting";
  const code = room.code;

  return (
    <section className="duel-hud" aria-label="Duel status">
      <article className={`duel-card is-peer ${peerState?.status === "running" ? "is-live" : ""}`}>
        <div className="duel-card-head">
          <span className="duel-dot" aria-hidden="true" />
          <b>{peerName}</b>
          <span className="duel-tag">opponent</span>
        </div>
        <div className="duel-card-stats">
          <span>
            <b>{peerLive.score}</b> score
          </span>
          <span>
            <b>{peerLive.wpm}</b> wpm
          </span>
          <span>
            <b>{peerLive.accuracy}%</b> acc
          </span>
        </div>
        <TypedWord
          word={peerLive.word}
          typed={peerLive.typed}
          empty={peerState ? "waiting for keys" : "not connected yet"}
        />
        <div className="duel-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.min(1, peerLive.progress)})` }} />
        </div>
      </article>

      <div className="duel-vs" aria-hidden="true">
        <span>vs</span>
        <small>{code}</small>
      </div>

      <article className={`duel-card is-self ${duel.race ? "is-live" : ""}`}>
        <div className="duel-card-head">
          <span className="duel-dot" aria-hidden="true" />
          <b>{selfState.name}</b>
          <span className="duel-tag">you</span>
        </div>
        <div className="duel-card-stats">
          <span>
            <b>{selfState.score}</b> score
          </span>
          <span>
            <b>{selfState.wpm}</b> wpm
          </span>
          <span>
            <b>{selfState.accuracy}%</b> acc
          </span>
        </div>
        <TypedWord word={selfState.word} typed={selfState.typed} empty="ready" />
        <div className="duel-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.min(1, selfState.progress)})` }} />
        </div>
      </article>

      {countdown > 0 && (
        <div className="duel-countdown-box" role="status" aria-live="assertive">
          <b>{countdown}</b>
          <span>get ready</span>
        </div>
      )}

      {result && (
        <div className={`duel-verdict ${outcome ?? ""}`} role="status">
          <b>
            {outcome === "win"
              ? "you win"
              : outcome === "loss"
                ? `${winnerName ?? "opponent"} wins`
                : "draw"}
          </b>
          <span>
            {result.players
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((player) => `${player.name} ${player.score}`)
              .join(" · ")}
          </span>
        </div>
      )}
    </section>
  );
}
