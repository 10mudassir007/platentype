import { randomInt } from "node:crypto";

import { WebSocketServer, WebSocket } from "ws";

/**
 * Same-origin realtime arena. The browser connects to /api/ws, so a LAN player
 * only needs the host's address and never a second port. Rooms live in memory:
 * a restart clears them, and that is fine for a duel lobby.
 */

const MAX_PLAYERS = 2;
const COUNTDOWN_MS = 3200;
const ROOM_TTL_MS = 30 * 60 * 1000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const rooms = new Map();
const clients = new Map();
const quickQueue = [];
let nextClientId = 1;

function code() {
  let value = "";
  for (let index = 0; index < 5; index += 1) {
    value += ALPHABET[randomInt(ALPHABET.length)];
  }
  return rooms.has(value) ? code() : value;
}

function send(client, payload) {
  if (!client || client.ws.readyState !== WebSocket.OPEN) return;
  try {
    client.ws.send(JSON.stringify(payload));
  } catch {
    // A dead socket is cleaned up by the close handler.
  }
}

function broadcast(room, payload, exceptId = null) {
  for (const player of room.players.values()) {
    if (player.id === exceptId) continue;
    send(player, payload);
  }
}

function roomView(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    settings: room.settings,
    seed: room.seed,
    startAt: room.startAt,
    players: [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      userId: player.userId ?? null,
      connected: player.ws.readyState === WebSocket.OPEN,
      finished: Boolean(player.result),
      score: player.result?.score ?? player.state?.score ?? 0,
      wpm: player.result?.wpm ?? player.state?.wpm ?? 0,
      accuracy: player.result?.accuracy ?? player.state?.accuracy ?? 0,
    })),
  };
}

function publicRoom(room) {
  return {
    code: room.code,
    host: [...room.players.values()][0]?.name ?? "host",
    names: [...room.players.values()].map((player) => player.name),
    count: room.players.size,
    max: MAX_PLAYERS,
    status: room.status,
    mode: room.settings?.mode ?? "time",
    duration: room.settings?.duration ?? 30,
    wordCount: room.settings?.wordCount ?? 25,
    difficulty: room.settings?.difficulty ?? "easy",
  };
}

function publicRooms() {
  return [...rooms.values()]
    .filter((room) => room.status !== "done")
    .map(publicRoom)
    .sort((a, b) => (a.status === "lobby" ? -1 : 1) - (b.status === "lobby" ? -1 : 1));
}

function roomsMessage(client) {
  return { t: "rooms", rooms: publicRooms(), you: client.id };
}

function broadcastRooms() {
  for (const client of clients.values()) {
    if (!client.roomCode) send(client, roomsMessage(client));
  }
}

function cleanSettings(raw) {
  const mode = raw?.mode === "words" ? "words" : "time";
  return {
    mode,
    duration: [15, 30, 60, 90].includes(Number(raw?.duration))
      ? Number(raw.duration)
      : 30,
    wordCount: [10, 25, 50, 100].includes(Number(raw?.wordCount))
      ? Number(raw.wordCount)
      : 25,
    punctuation: raw?.punctuation !== false,
    numbers: Boolean(raw?.numbers),
    difficulty: ["easy", "medium", "hard"].includes(raw?.difficulty)
      ? raw.difficulty
      : "easy",
    language: raw?.language === "british" ? "british" : "english",
  };
}

function removeFromQueue(client) {
  const index = quickQueue.indexOf(client);
  if (index >= 0) quickQueue.splice(index, 1);
}

function leaveRoom(client) {
  removeFromQueue(client);
  const room = rooms.get(client.roomCode);
  client.roomCode = null;
  if (!room) return;
  room.players.delete(client.id);

  if (room.players.size === 0) {
    if (room.timer) clearTimeout(room.timer);
    rooms.delete(room.code);
    client.roomCode = null;
    broadcastRooms();
    return;
  }

  if (room.hostId === client.id) {
    room.hostId = [...room.players.keys()][0];
  }

  if (room.status === "running" || room.status === "countdown") {
    // A departure during a race ends it for the player who stayed.
    finalizeRoom(room, "opponent left");
  } else {
    broadcast(room, { t: "room", room: roomView(room) });
  }
  client.roomCode = null;
  broadcastRooms();
}

function createRoom(host, settings) {
  const room = {
    code: code(),
    hostId: host.id,
    players: new Map([[host.id, host]]),
    settings: cleanSettings(settings),
    seed: null,
    startAt: null,
    status: "lobby",
    finished: new Map(),
    result: null,
    createdAt: Date.now(),
    timer: null,
  };
  rooms.set(room.code, room);
  host.roomCode = room.code;
  host.result = null;
  host.state = null;
  return room;
}

function enterRoom(client, room) {
  client.roomCode = room.code;
  client.result = null;
  client.state = null;
  room.players.set(client.id, client);
  send(client, { t: "room", room: roomView(room) });
  broadcast(room, { t: "room", room: roomView(room) }, client.id);
  broadcastRooms();
}

function startRace(room) {
  if (room.status !== "lobby" || room.players.size < MAX_PLAYERS) return false;
  room.seed = randomInt(1, 2 ** 31 - 1);
  room.startAt = Date.now() + COUNTDOWN_MS;
  room.status = "countdown";
  room.finished.clear();
  room.result = null;
  for (const player of room.players.values()) {
    player.result = null;
    player.state = null;
  }
  broadcast(room, {
    t: "race",
    code: room.code,
    seed: room.seed,
    settings: room.settings,
    startAt: room.startAt,
    countdownMs: COUNTDOWN_MS,
  });
  const limitSeconds =
    room.settings.mode === "time" ? room.settings.duration : 300;
  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(
    () => {
      if (room.status === "countdown" || room.status === "running") {
        room.status = "running";
        finalizeRoom(room, "time");
      }
    },
    COUNTDOWN_MS + limitSeconds * 1000 + 20000,
  );
  broadcast(room, { t: "room", room: roomView(room) });
  return true;
}

function finalizeRoom(room, reason = "complete") {
  if (room.status === "done") return;
  room.status = "done";
  if (room.timer) clearTimeout(room.timer);
  const players = [...room.players.values()].map((player) => ({
    id: player.id,
    name: player.name,
    finished: Boolean(player.result),
    score: player.result?.score ?? player.state?.score ?? 0,
    wpm: player.result?.wpm ?? player.state?.wpm ?? 0,
    accuracy: player.result?.accuracy ?? player.state?.accuracy ?? 0,
    correctChars: player.result?.correctChars ?? 0,
    at: player.result?.at ?? null,
  }));
  players.sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.score !== b.score) return b.score - a.score;
    if (a.at && b.at && a.at !== b.at) return a.at - b.at;
    return b.wpm - a.wpm;
  });
  room.result = {
    winnerId: players[0]?.id ?? null,
    reason,
    players,
  };
  broadcast(room, { t: "result", room: roomView(room), result: room.result });
  broadcastRooms();
}

function maybeFinalize(room) {
  if (room.players.size === 0) return;
  const allFinished = [...room.players.values()].every(
    (player) => player.result || player.ws.readyState !== WebSocket.OPEN,
  );
  if (allFinished) finalizeRoom(room, "complete");
}

function matchQuick(client, settings) {
  removeFromQueue(client);
  if (quickQueue.length) {
    const other = quickQueue.shift();
    if (!other || other.ws.readyState !== WebSocket.OPEN || other.roomCode) {
      quickQueue.push(client);
      send(client, { t: "queued", position: quickQueue.length });
      return;
    }
    // The first player in the queue hosts, so both see the same text.
    const room = createRoom(other, other.pendingSettings ?? settings);
    enterRoom(client, room);
    other.pendingSettings = null;
    client.pendingSettings = null;
    send(other, { t: "room", room: roomView(room) });
    send(client, { t: "room", room: roomView(room) });
    startRace(room);
    return;
  }
  client.pendingSettings = cleanSettings(settings);
  client.roomCode = null;
  quickQueue.push(client);
  send(client, { t: "queued", position: quickQueue.length });
}

function cancelQuick(client) {
  removeFromQueue(client);
  send(client, { t: "queued", position: 0 });
}

function handle(client, raw) {
  let message;
  try {
    message = JSON.parse(String(raw));
  } catch {
    return;
  }
  if (!message || typeof message !== "object") return;

  switch (message.t) {
    case "hello": {
      client.name = String(message.name ?? "fighter").slice(0, 20) || "fighter";
      client.userId = message.userId ? String(message.userId).slice(0, 64) : null;
      send(client, {
        t: "welcome",
        id: client.id,
        name: client.name,
        max: MAX_PLAYERS,
        now: Date.now(),
      });
      send(client, roomsMessage(client));
      return;
    }
    case "set-name": {
      client.name = String(message.name ?? client.name).slice(0, 20) || client.name;
      const room = rooms.get(client.roomCode);
      if (room) broadcast(room, { t: "room", room: roomView(room) });
      return;
    }
    case "list":
      send(client, roomsMessage(client));
      return;
    case "create": {
      leaveRoom(client);
      const room = createRoom(client, message.settings);
      send(client, { t: "room", room: roomView(room) });
      broadcastRooms();
      return;
    }
    case "join": {
      const wanted = String(message.code ?? "").toUpperCase().trim();
      const room = rooms.get(wanted);
      if (!room) {
        send(client, { t: "error", message: "that room no longer exists" });
        return;
      }
      if (room.players.size >= MAX_PLAYERS && !room.players.has(client.id)) {
        send(client, { t: "error", message: "that room is already full" });
        return;
      }
      if (room.status !== "lobby" && !room.players.has(client.id)) {
        send(client, { t: "error", message: "that race already started" });
        return;
      }
      leaveRoom(client);
      enterRoom(client, room);
      return;
    }
    case "quick":
      leaveRoom(client);
      matchQuick(client, message.settings);
      return;
    case "cancel-quick":
      cancelQuick(client);
      return;
    case "start": {
      const room = rooms.get(client.roomCode);
      if (!room) return;
      if (room.hostId !== client.id) {
        send(client, { t: "error", message: "only the host can start" });
        return;
      }
      if (room.players.size < MAX_PLAYERS) {
        send(client, { t: "error", message: "waiting for an opponent" });
        return;
      }
      startRace(room);
      return;
    }
    case "rematch": {
      const room = rooms.get(client.roomCode);
      if (!room || room.hostId !== client.id) return;
      room.status = "lobby";
      room.result = null;
      room.seed = null;
      room.startAt = null;
      if (room.timer) clearTimeout(room.timer);
      for (const player of room.players.values()) {
        player.result = null;
        player.state = null;
      }
      broadcast(room, { t: "room", room: roomView(room) });
      return;
    }
    case "state": {
      const room = rooms.get(client.roomCode);
      if (!room || room.status === "done") return;
      const state = message.state && typeof message.state === "object" ? message.state : {};
      client.state = {
        status: String(state.status ?? "idle").slice(0, 12),
        wpm: Math.max(0, Math.round(Number(state.wpm) || 0)),
        accuracy: Math.max(0, Math.min(100, Math.round(Number(state.accuracy) || 0))),
        progress: Math.max(0, Math.min(1, Number(state.progress) || 0)),
        score: Math.max(0, Math.round(Number(state.score) || 0)),
        index: Math.max(0, Math.round(Number(state.index) || 0)),
        word: String(state.word ?? "").slice(0, 40),
        typed: String(state.typed ?? "").slice(0, 48),
        combo: Math.max(0, Math.round(Number(state.combo) || 0)),
      };
      broadcast(room, { t: "peer", id: client.id, state: client.state }, client.id);
      return;
    }
    case "key": {
      const room = rooms.get(client.roomCode);
      if (!room) return;
      broadcast(
        room,
        {
          t: "peer-key",
          id: client.id,
          char: String(message.char ?? "").slice(0, 2),
          correct: Boolean(message.correct),
          index: Math.max(0, Math.round(Number(message.index) || 0)),
          at: Date.now(),
        },
        client.id,
      );
      return;
    }
    case "word": {
      const room = rooms.get(client.roomCode);
      if (!room) return;
      broadcast(
        room,
        {
          t: "peer-word",
          id: client.id,
          word: String(message.word ?? "").slice(0, 40),
          kind: String(message.kind ?? "cross").slice(0, 12),
          correct: Boolean(message.correct),
          index: Math.max(0, Math.round(Number(message.index) || 0)),
          at: Date.now(),
        },
        client.id,
      );
      return;
    }
    case "finish": {
      const room = rooms.get(client.roomCode);
      if (!room) return;
      const result = message.result && typeof message.result === "object" ? message.result : {};
      client.result = {
        score: Math.max(0, Math.round(Number(result.score) || 0)),
        wpm: Math.max(0, Math.round(Number(result.wpm) || 0)),
        accuracy: Math.max(0, Math.min(100, Math.round(Number(result.accuracy) || 0))),
        correctChars: Math.max(0, Math.round(Number(result.correctChars) || 0)),
        at: Date.now(),
      };
      broadcast(room, { t: "peer-finish", id: client.id, result: client.result }, client.id);
      broadcast(room, { t: "room", room: roomView(room) });
      maybeFinalize(room);
      return;
    }
    case "leave":
      leaveRoom(client);
      send(client, roomsMessage(client));
      return;
    default:
      return;
  }
}

export function attachRealtime(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    let pathname = "";
    try {
      pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    } catch {
      return;
    }
    if (pathname !== "/api/ws") return;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    const client = {
      id: `c${nextClientId++}`,
      ws,
      name: "fighter",
      userId: null,
      roomCode: null,
      state: null,
      result: null,
      pendingSettings: null,
      alive: true,
    };
    clients.set(client.id, client);
    ws.on("pong", () => {
      client.alive = true;
    });
    ws.on("message", (data) => handle(client, data));
    ws.on("close", () => {
      leaveRoom(client);
      clients.delete(client.id);
    });
    ws.on("error", () => {
      try {
        ws.terminate();
      } catch {
        // Already gone.
      }
    });
    send(client, { t: "welcome", id: client.id, name: client.name, max: MAX_PLAYERS, now: Date.now() });
    send(client, roomsMessage(client));
  });

  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const client of clients.values()) {
      if (!client.alive) {
        try {
          client.ws.terminate();
        } catch {
          // Already gone.
        }
        continue;
      }
      client.alive = false;
      try {
        client.ws.ping();
      } catch {
        // The close handler will clean up.
      }
    }
    for (const room of rooms.values()) {
      if (now - room.createdAt > ROOM_TTL_MS && room.players.size === 0) {
        rooms.delete(room.code);
      }
    }
  }, 25000);
  heartbeat.unref?.();

  return wss;
}
