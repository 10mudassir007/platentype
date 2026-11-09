import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Platen keeps its server state in one JSON file. It is deliberately boring:
 * no database to install, no service to run, and a file you can copy or delete
 * when you want a clean arena. Every write goes through a single queue so two
 * requests cannot clobber each other.
 */
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "platen.json");

const EMPTY = { users: {}, sessions: {}, leaderboard: [] };

export const SESSION_COOKIE = "platen_session";
export const OAUTH_COOKIE = "platen_oauth";
export const SESSION_DAYS = 30;

let cache = null;
let writeChain = Promise.resolve();
let writableDir = DATA_DIR;

/**
 * Try to write a test file to determine if DATA_DIR is writable.
 * On Vercel/serverless, the project root is read-only; fall back to /tmp.
 */
async function ensureWritableDir() {
  if (writableDir !== DATA_DIR) return;
  const testFile = path.join(DATA_DIR, ".write-test");
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(testFile, "ok", "utf8");
    await rename(testFile, testFile + ".bak");
    try {
      await rename(testFile + ".bak", testFile);
    } catch {
      // ignore
    }
  } catch {
    writableDir = "/tmp";
  }
}

async function load() {
  if (cache) return cache;
  await ensureWritableDir();
  const file = path.join(writableDir, "platen.json");
  try {
    cache = normalize(JSON.parse(await readFile(file, "utf8")));
  } catch {
    cache = structuredClone(EMPTY);
  }
  return cache;
}

async function persist() {
  await ensureWritableDir();
  const dir = writableDir;
  const file = path.join(dir, "platen.json");
  const snapshot = JSON.stringify(cache, null, 2);
  writeChain = writeChain.then(async () => {
    await mkdir(dir, { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, snapshot, "utf8");
    await rename(temp, file);
  });
  return writeChain;
}

function prune(store) {
  const now = Date.now();
  for (const [token, session] of Object.entries(store.sessions)) {
    if (!session || typeof session.expiresAt !== "number" || session.expiresAt < now) {
      delete store.sessions[token];
    }
  }
}

export function newId(prefix) {
  return `${prefix}_${randomBytes(9).toString("hex")}`;
}

export function newToken() {
  return randomBytes(24).toString("hex");
}

export function cleanName(value, fallback = "fighter") {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
  return text.length >= 2 ? text : fallback;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    provider: user.provider,
    avatar: user.avatar ?? null,
    guest: user.provider === "guest",
  };
}

export async function getUserBySession(token) {
  if (!token) return null;
  const store = await load();
  const session = store.sessions[token];
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    delete store.sessions[token];
    await persist();
    return null;
  }
  return store.users[session.userId] ?? null;
}

export async function createSession(userId) {
  const store = await load();
  prune(store);
  const token = newToken();
  const now = Date.now();
  store.sessions[token] = {
    userId,
    createdAt: now,
    expiresAt: now + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  await persist();
  return token;
}

export async function deleteSession(token) {
  if (!token) return;
  const store = await load();
  if (store.sessions[token]) {
    delete store.sessions[token];
    await persist();
  }
}

export async function renameUser(userId, name) {
  const store = await load();
  const user = store.users[userId];
  if (!user) return null;
  user.name = cleanName(name, user.name);
  await persist();
  return user;
}

export async function createGuest(name) {
  const store = await load();
  prune(store);
  const user = {
    id: newId("u"),
    name: cleanName(name),
    provider: "guest",
    avatar: null,
    createdAt: Date.now(),
  };
  store.users[user.id] = user;
  await persist();
  return user;
}

export async function upsertOAuthUser(provider, profile) {
  const store = await load();
  prune(store);
  const providerId = String(profile?.id ?? "");
  if (!providerId) throw new Error("OAuth profile has no id");
  const existing = Object.values(store.users).find(
    (user) => user.provider === provider && user.providerId === providerId,
  );
  if (existing) {
    existing.name = cleanName(profile.name, existing.name);
    if (profile.avatar) existing.avatar = profile.avatar;
    await persist();
    return existing;
  }
  const user = {
    id: newId("u"),
    name: cleanName(profile.name, `${provider} fighter`),
    provider,
    providerId,
    avatar: profile.avatar ?? null,
    createdAt: Date.now(),
  };
  store.users[user.id] = user;
  await persist();
  return user;
}

function scoreEntry(entry) {
  return {
    id: entry.id,
    userId: entry.userId,
    name: entry.name,
    provider: entry.provider,
    avatar: entry.avatar ?? null,
    score: entry.score,
    wpm: entry.wpm,
    accuracy: entry.accuracy,
    difficulty: entry.difficulty,
    mode: entry.mode,
    duration: entry.duration,
    correctChars: entry.correctChars,
    correctWords: entry.correctWords,
    at: entry.at,
  };
}

export async function listLeaderboard({ difficulty = "all", mode = "all", limit = 25 } = {}) {
  const store = await load();
  const rows = store.leaderboard
    .filter((entry) => difficulty === "all" || entry.difficulty === difficulty)
    .filter((entry) => mode === "all" || entry.mode === mode)
    .sort((a, b) => b.score - a.score || b.wpm - a.wpm || a.at - b.at)
    .slice(0, Math.min(100, Math.max(1, Number(limit) || 25)));
  return rows.map((entry, index) => ({ ...scoreEntry(entry), rank: index + 1 }));
}

export async function submitScore(user, run) {
  const store = await load();
  prune(store);
  const entry = {
    id: newId("s"),
    userId: user.id,
    name: user.name,
    provider: user.provider,
    avatar: user.avatar ?? null,
    score: Math.max(0, Math.round(Number(run.score) || 0)),
    wpm: Math.max(0, Math.round(Number(run.wpm) || 0)),
    accuracy: Math.max(0, Math.min(100, Math.round(Number(run.accuracy) || 0))),
    difficulty: String(run.difficulty ?? "easy").slice(0, 12),
    mode: String(run.mode ?? "time").slice(0, 16),
    duration: Math.max(0, Math.round(Number(run.duration) || 0)),
    correctChars: Math.max(0, Math.round(Number(run.correctChars) || 0)),
    correctWords: Math.max(0, Math.round(Number(run.correctWords) || 0)),
    at: Date.now(),
  };

  // One best row per player per board keeps the list readable.
  const index = store.leaderboard.findIndex(
    (existing) =>
      existing.userId === user.id &&
      existing.difficulty === entry.difficulty &&
      existing.mode === entry.mode,
  );
  let improved = true;
  if (index >= 0) {
    const previous = store.leaderboard[index];
    improved = entry.score > previous.score;
    if (improved) store.leaderboard[index] = entry;
  } else {
    store.leaderboard.push(entry);
  }

  if (store.leaderboard.length > 500) {
    store.leaderboard.sort((a, b) => b.score - a.score);
    store.leaderboard = store.leaderboard.slice(0, 500);
  }
  if (improved) await persist();

  const board = await listLeaderboard({
    difficulty: entry.difficulty,
    mode: entry.mode,
    limit: 100,
  });
  const row = board.find((item) => item.id === (improved ? entry.id : store.leaderboard[index]?.id));
  return { entry: scoreEntry(entry), improved, rank: row?.rank ?? null };
}

export async function personalBest(userId, difficulty, mode) {
  const store = await load();
  const rows = store.leaderboard.filter(
    (entry) =>
      entry.userId === userId &&
      (difficulty === "all" || entry.difficulty === difficulty) &&
      (mode === "all" || entry.mode === mode),
  );
  return rows.reduce((best, entry) => Math.max(best, entry.score), 0);
}
