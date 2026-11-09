"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TestSettings } from "@/lib/settings";

export type DuelConnection = "off" | "connecting" | "open" | "closed";

export type DuelStatus = "lobby" | "countdown" | "running" | "done";

export interface DuelSettings {
  mode: "time" | "words";
  duration: number;
  wordCount: number;
  punctuation: boolean;
  numbers: boolean;
  difficulty: "easy" | "medium" | "hard";
  language: "english" | "british";
}

export interface DuelPlayer {
  id: string;
  name: string;
  userId: string | null;
  connected: boolean;
  finished: boolean;
  score: number;
  wpm: number;
  accuracy: number;
}

export interface DuelRoom {
  code: string;
  hostId: string;
  status: DuelStatus;
  settings: DuelSettings;
  seed: number | null;
  startAt: number | null;
  players: DuelPlayer[];
}

export interface DuelRoomSummary {
  code: string;
  host: string;
  names: string[];
  count: number;
  max: number;
  status: DuelStatus;
  mode: "time" | "words";
  duration: number;
  wordCount: number;
  difficulty: string;
}

export interface DuelRace {
  code: string;
  seed: number;
  settings: DuelSettings;
  startAt: number;
  countdownMs: number;
  /** Changes on every new race so effects can fire again. */
  nonce: number;
}

export interface DuelPeerState {
  status: string;
  wpm: number;
  accuracy: number;
  progress: number;
  score: number;
  index: number;
  word: string;
  typed: string;
  combo: number;
}

export interface DuelKeyEvent {
  id: string;
  char: string;
  correct: boolean;
  index: number;
  at: number;
  nonce: number;
}

export interface DuelWordEvent {
  id: string;
  word: string;
  kind: string;
  correct: boolean;
  index: number;
  at: number;
  nonce: number;
}

export interface DuelResult {
  winnerId: string | null;
  reason: string;
  players: {
    id: string;
    name: string;
    finished: boolean;
    score: number;
    wpm: number;
    accuracy: number;
    correctChars: number;
    at: number | null;
  }[];
}

export function duelSettingsFrom(settings: TestSettings): DuelSettings {
  return {
    mode: settings.mode === "words" ? "words" : "time",
    duration: settings.duration,
    wordCount: settings.wordCount,
    punctuation: settings.punctuation,
    numbers: settings.numbers,
    difficulty:
      settings.difficulty === "hard"
        ? "hard"
        : settings.difficulty === "medium"
          ? "medium"
          : "easy",
    language: settings.language,
  };
}

/**
 * One socket per tab, opened when the multiplayer panel opens. The server is
 * the same origin as the page, so this works identically on localhost, a LAN
 * address, or a public deployment.
 */
export function useDuel(name: string, userId: string | null) {
  const [connection, setConnection] = useState<DuelConnection>("off");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<DuelRoomSummary[]>([]);
  const [room, setRoom] = useState<DuelRoom | null>(null);
  const [race, setRace] = useState<DuelRace | null>(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [error, setError] = useState("");
  const [peerState, setPeerState] = useState<DuelPeerState | null>(null);
  const [peerKey, setPeerKey] = useState<DuelKeyEvent | null>(null);
  const [peerWord, setPeerWord] = useState<DuelWordEvent | null>(null);
  const [peerFinish, setPeerFinish] = useState<{
    id: string;
    result: { score: number; wpm: number; accuracy: number; at: number };
  } | null>(null);
  const [result, setResult] = useState<DuelResult | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const wantRef = useRef(false);
  const retryRef = useRef<number | null>(null);
  const nameRef = useRef(name);
  const userRef = useRef(userId);
  const roomCodeRef = useRef<string | null>(null);
  const nonceRef = useRef(0);
  const offsetRef = useRef(0);
  const errorTimerRef = useRef<number | null>(null);

  nameRef.current = name;
  userRef.current = userId;

  const send = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    wantRef.current = true;
    const existing = socketRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    if (retryRef.current) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    setConnection("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          t: "hello",
          name: nameRef.current,
          userId: userRef.current,
        }),
      );
    };

    socket.onmessage = (event) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      switch (message.t) {
        case "welcome": {
          setConnection("open");
          setSelfId(String(message.id ?? ""));
          const now = Number(message.now);
          if (Number.isFinite(now)) offsetRef.current = now - Date.now();
          const code = roomCodeRef.current;
          if (code) socket.send(JSON.stringify({ t: "join", code }));
          return;
        }
        case "rooms":
          setRooms(Array.isArray(message.rooms) ? (message.rooms as DuelRoomSummary[]) : []);
          return;
        case "room": {
          const next = message.room as DuelRoom | null;
          setRoom(next);
          roomCodeRef.current = next?.code ?? null;
          if (next && next.status === "lobby") {
            setResult(null);
            setRace(null);
            setPeerState(null);
            setPeerKey(null);
            setPeerWord(null);
            setPeerFinish(null);
          }
          return;
        }
        case "race": {
          nonceRef.current += 1;
          setResult(null);
          setPeerState(null);
          setPeerKey(null);
          setPeerWord(null);
          setPeerFinish(null);
          setRace({
            code: String(message.code ?? ""),
            seed: Number(message.seed) || 1,
            settings: message.settings as DuelSettings,
            startAt: Number(message.startAt) || Date.now(),
            countdownMs: Number(message.countdownMs) || 3200,
            nonce: nonceRef.current,
          });
          return;
        }
        case "peer":
          setPeerState(message.state as DuelPeerState);
          return;
        case "peer-key": {
          nonceRef.current += 1;
          setPeerKey({
            id: String(message.id ?? ""),
            char: String(message.char ?? ""),
            correct: Boolean(message.correct),
            index: Number(message.index) || 0,
            at: Number(message.at) || Date.now(),
            nonce: nonceRef.current,
          });
          return;
        }
        case "peer-word": {
          nonceRef.current += 1;
          setPeerWord({
            id: String(message.id ?? ""),
            word: String(message.word ?? ""),
            kind: String(message.kind ?? "cross"),
            correct: Boolean(message.correct),
            index: Number(message.index) || 0,
            at: Number(message.at) || Date.now(),
            nonce: nonceRef.current,
          });
          return;
        }
        case "peer-finish":
          setPeerFinish({
            id: String(message.id ?? ""),
            result: message.result as {
              score: number;
              wpm: number;
              accuracy: number;
              at: number;
            },
          });
          return;
        case "result":
          setResult(message.result as DuelResult);
          if (message.room) setRoom(message.room as DuelRoom);
          return;
        case "queued":
          setQueuePosition(Number(message.position) || 0);
          return;
        case "error":
          setError(String(message.message ?? "something went wrong"));
          if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
          errorTimerRef.current = window.setTimeout(() => setError(""), 3600);
          return;
        default:
          return;
      }
    };

    socket.onclose = () => {
      socketRef.current = null;
      setConnection(wantRef.current ? "closed" : "off");
      setSelfId(null);
      if (wantRef.current) {
        retryRef.current = window.setTimeout(() => {
          retryRef.current = null;
          connect();
        }, 1600);
      }
    };

    socket.onerror = () => {
      try {
        socket.close();
      } catch {
        // The close handler owns the retry.
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    wantRef.current = false;
    if (retryRef.current) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      try {
        socket.close();
      } catch {
        // Already closed.
      }
    }
    roomCodeRef.current = null;
    setConnection("off");
    setSelfId(null);
    setRoom(null);
    setRooms([]);
    setRace(null);
    setResult(null);
    setPeerState(null);
    setPeerKey(null);
    setPeerWord(null);
    setPeerFinish(null);
    setQueuePosition(0);
  }, []);

  useEffect(
    () => () => {
      wantRef.current = false;
      if (retryRef.current) window.clearTimeout(retryRef.current);
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
      socketRef.current?.close();
    },
    [],
  );

  const listRooms = useCallback(() => send({ t: "list" }), [send]);
  const createRoom = useCallback(
    (settings: DuelSettings) => {
      setRace(null);
      setResult(null);
      setPeerState(null);
      send({ t: "create", settings });
    },
    [send],
  );
  const joinRoom = useCallback(
    (code: string) => {
      send({ t: "join", code: code.toUpperCase().trim() });
    },
    [send],
  );
  const quickMatch = useCallback(
    (settings: DuelSettings) => {
      send({ t: "quick", settings });
    },
    [send],
  );
  const cancelQuick = useCallback(() => {
    setQueuePosition(0);
    send({ t: "cancel-quick" });
  }, [send]);
  const leaveRoom = useCallback(() => {
    roomCodeRef.current = null;
    send({ t: "leave" });
    setRoom(null);
    setRace(null);
    setResult(null);
    setPeerState(null);
    setPeerKey(null);
    setPeerWord(null);
    setPeerFinish(null);
    setQueuePosition(0);
  }, [send]);
  const startRace = useCallback(() => send({ t: "start" }), [send]);
  const rematch = useCallback(() => {
    setResult(null);
    setRace(null);
    send({ t: "rematch" });
  }, [send]);

  const sendState = useCallback(
    (state: Partial<DuelPeerState>) => {
      send({ t: "state", state });
    },
    [send],
  );
  const sendKey = useCallback(
    (char: string, correct: boolean, index: number) => {
      send({ t: "key", char, correct, index });
    },
    [send],
  );
  const sendWord = useCallback(
    (word: string, kind: string, correct: boolean, index: number) => {
      send({ t: "word", word, kind, correct, index });
    },
    [send],
  );
  const sendFinish = useCallback(
    (run: {
      score: number;
      wpm: number;
      accuracy: number;
      correctChars: number;
    }) => {
      send({ t: "finish", result: run });
    },
    [send],
  );

  return {
    connection,
    selfId,
    rooms,
    room,
    race,
    queuePosition,
    error,
    peerState,
    peerKey,
    peerWord,
    peerFinish,
    result,
    clockOffset: offsetRef,
    connect,
    disconnect,
    listRooms,
    createRoom,
    joinRoom,
    quickMatch,
    cancelQuick,
    leaveRoom,
    startRace,
    rematch,
    sendState,
    sendKey,
    sendWord,
    sendFinish,
  };
}

export type Duel = ReturnType<typeof useDuel>;
