export interface RunStats {
  /** Net words per minute: correctly typed characters / 5 / minutes. */
  wpm: number;
  /** Raw words per minute: every character in the final typed text. */
  raw: number;
  /** Net words per second, the same data divided by sixty. */
  wps: number;
  /** Correct characters per minute. */
  cpm: number;
  /** Correct characters per second. */
  cps: number;
  /** Keypress accuracy, mistakes are remembered even after correction. */
  accuracy: number;
  /** How stable the raw speed was across the run, 0–100. */
  consistency: number;
  correctChars: number;
  incorrectChars: number;
  extraChars: number;
  missedChars: number;
  correctWords: number;
  wrongWords: number;
  /** Game score for this run, multiplied by the chosen difficulty. */
  score: number;
}

export interface WordEntry {
  word: string;
  typed: string;
  submitted: boolean;
  correct: boolean | null;
}

/** Number of correctly placed characters in one word, ignoring extras. */
export function correctInWord(entry: WordEntry): number {
  const limit = Math.min(entry.word.length, entry.typed.length);
  let correct = 0;
  for (let i = 0; i < limit; i += 1) {
    if (entry.typed[i] === entry.word[i]) correct += 1;
  }
  return correct;
}

export function countIncorrect(entry: WordEntry): number {
  const limit = Math.min(entry.word.length, entry.typed.length);
  let wrong = 0;
  for (let i = 0; i < limit; i += 1) {
    if (entry.typed[i] !== entry.word[i]) wrong += 1;
  }
  wrong += Math.max(0, entry.typed.length - entry.word.length);
  return wrong;
}

/**
 * MonkeyType-style net character count: correctly typed letters plus the
 * space that follows a fully correct word.
 */
export function netChars(
  entries: WordEntry[],
  activeIndex: number,
  currentTyped: string,
): {
  correct: number;
  all: number;
  correctWords: number;
  wrongWords: number;
  extra: number;
  missed: number;
} {
  let correct = 0;
  let all = 0;
  let correctWords = 0;
  let wrongWords = 0;
  let extra = 0;
  let missed = 0;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const typed = i === activeIndex ? currentTyped : entry.typed;
    const isCurrent = i === activeIndex;

    extra += Math.max(0, typed.length - entry.word.length);

    if (!isCurrent && entry.submitted) {
      all += typed.length + 1;
      const exact = typed === entry.word;
      if (exact) {
        correct += entry.word.length + 1;
        correctWords += 1;
      } else {
        wrongWords += 1;
        const c = correctInWord({ ...entry, typed });
        correct += c;
        missed += Math.max(0, entry.word.length - c);
      }
    } else if (isCurrent) {
      all += typed.length;
      correct += correctInWord({
        word: entry.word,
        typed,
        submitted: false,
        correct: null,
      });
    }
  }

  return { correct, all, correctWords, wrongWords, extra, missed };
}

export function wpmFromCorrectChars(
  correctChars: number,
  elapsedSeconds: number,
): number {
  if (elapsedSeconds <= 0) return 0;
  const minutes = elapsedSeconds / 60;
  return Math.max(0, Math.round(correctChars / 5 / minutes));
}

export function wordsPerSecondFromChars(
  correctChars: number,
  elapsedSeconds: number,
): number {
  if (elapsedSeconds <= 0) return 0;
  return correctChars / 5 / elapsedSeconds;
}

export function charsPerMinute(correctChars: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  return correctChars / (elapsedSeconds / 60);
}

export function charsPerSecond(correctChars: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  return correctChars / elapsedSeconds;
}

const DIFFICULTY_MULTIPLIER: Record<string, number> = {
  easy: 1,
  medium: 1.2,
  hard: 1.5,
};

/**
 * One score used everywhere: live HUD, result panel, leaderboard. Correct
 * characters and clean words carry the base, speed adds a small premium, and
 * accuracy scales the whole run. Hard mode is worth more because it fails on
 * the first wrong key.
 */
export function scoreRun(input: {
  correctChars: number;
  correctWords: number;
  wpm: number;
  accuracy: number;
  difficulty: string;
}): number {
  const base =
    Math.max(0, input.correctChars) * 2 +
    Math.max(0, input.correctWords) * 12 +
    Math.max(0, input.wpm) * 3;
  const quality = Math.max(0, Math.min(100, input.accuracy)) / 100;
  const multiplier = DIFFICULTY_MULTIPLIER[input.difficulty] ?? 1;
  return Math.max(0, Math.round(base * quality * multiplier));
}

export function consistencyFromSamples(samples: number[]): number {
  const usable = samples.filter((value) => Number.isFinite(value) && value > 0);
  if (usable.length < 2) return 0;
  const mean = usable.reduce((sum, value) => sum + value, 0) / usable.length;
  if (mean <= 0) return 0;
  const variance =
    usable.reduce((sum, value) => sum + (value - mean) ** 2, 0) / usable.length;
  const deviation = Math.sqrt(variance);
  return Math.max(0, Math.min(100, Math.round(100 - (deviation / mean) * 100)));
}

export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  return String(whole).padStart(2, "0");
}
