import passages from "@/data/passages.json";
import quotes from "@/data/quotes.json";
import type { CustomOrder, QuoteLength, TestSettings } from "@/lib/settings";

export interface TestText {
  text: string;
  /** Every drill word, already split and ordered, ready for the engine. */
  words: string[];
  /** Present in quote mode so the run can credit the author. */
  author?: string;
  /** Word index where each custom section begins, used by the section clock. */
  sectionStarts?: number[];
}

interface QuoteRecord {
  text: string;
  author: string;
}

export const DEFAULT_CUSTOM_TEXT =
  "Type your own text here. Open the editor to replace this sentence with anything you want to practice, then land every word.";

const QUOTE_CORPUS = quotes as QuoteRecord[];

/** Zero-width spaces, joiners, directional marks and the BOM. */
const ZERO_WIDTH = /[\u200b-\u200f\u2060-\u2064\ufeff]/g;

/**
 * Curly quotes and fancy dashes become the keys a player can actually find.
 * Spaces that are not the plain space bar are folded too.
 */
const FANCY_TYPOGRAPHY: [RegExp, string][] = [
  [/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, "'"],
  [/[\u201c\u201d\u201e\u201f\u2033\u2036]/g, '"'],
  [/[\u2010-\u2015\u2212\u2e3a\u2e3b]/g, "-"],
  [/\u2026/g, "..."],
  [/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, " "],
];

const LINE_END = /[.!?\u2026:;,]$/;

/** A fresh seed for a new drill. Safe on the server and in the browser. */
export function makeSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LEADING_PUNCTUATION = /^[^\p{L}\p{N}]+/u;
const TRAILING_PUNCTUATION = /[^\p{L}\p{N}]+$/u;

/**
 * Punctuation off removes only the punctuation that clings to the edge of a
 * word. Internal apostrophes and hyphens stay, because removing them would
 * turn real words into different words.
 */
function stripBoundaryPunctuation(word: string): string {
  return word
    .replace(LEADING_PUNCTUATION, "")
    .replace(TRAILING_PUNCTUATION, "");
}

/** Swap a word for a numeric drill token while keeping its edge punctuation. */
function asNumberToken(word: string, random: () => number): string {
  const leading = word.match(LEADING_PUNCTUATION)?.[0] ?? "";
  const trailing = word.match(TRAILING_PUNCTUATION)?.[0] ?? "";
  const length = 1 + Math.floor(random() * 3);
  const min = length === 1 ? 1 : length === 2 ? 10 : 100;
  const max = length === 1 ? 9 : length === 2 ? 99 : 999;
  const digits = String(min + Math.floor(random() * (max - min + 1)));
  return `${leading}${digits}${trailing}`;
}

function applyOptions(
  word: string,
  settings: TestSettings,
  random: () => number,
  allowNumber: boolean,
): { word: string; numbered: boolean } {
  let next = word;
  let numbered = false;
  if (settings.numbers && allowNumber && random() < 0.11) {
    next = asNumberToken(next, random);
    numbered = true;
  }
  if (!settings.punctuation) {
    next = stripBoundaryPunctuation(next);
  }
  return { word: next, numbered };
}

function timeWordTarget(duration: number): number {
  return Math.max(80, Math.ceil(duration * 4.2));
}

/**
 * Walk the static passage corpus from a seeded offset. The generator only
 * ever reads data/passages.json, so every drill is reproducible from its seed.
 */
function corpusWords(
  seed: number,
  count: number,
  settings: TestSettings,
): string[] {
  const random = mulberry32(seed);
  const total = passages.length;
  const start = Math.abs(Math.floor(seed)) % total;
  const words: string[] = [];
  let passageIndex = start;
  let guard = 0;
  let previousNumber = false;

  while (words.length < count && guard < total * 4) {
    const source = passages[passageIndex % total];
    const rawWords = source.split(/\s+/).filter(Boolean);
    const offset =
      words.length === 0 && rawWords.length > 1
        ? Math.floor(random() * rawWords.length)
        : 0;

    for (let index = offset; index < rawWords.length; index += 1) {
      if (words.length >= count) break;
      const next = applyOptions(
        rawWords[index],
        settings,
        random,
        !previousNumber,
      );
      previousNumber = next.numbered;
      if (next.word) words.push(next.word);
    }

    passageIndex += 1;
    guard += 1;
  }

  return words;
}

/* ── language, funbox and lazy text ───────────────────────────────── */

/**
 * British spellings for the American forms that show up most often in the
 * static corpus. Words keep their edge punctuation and capitalisation.
 */
const BRITISH_SPELLINGS: Record<string, string> = {
  color: "colour",
  colors: "colours",
  colored: "coloured",
  colorful: "colourful",
  favorite: "favourite",
  favorites: "favourites",
  honor: "honour",
  honors: "honours",
  honorable: "honourable",
  labor: "labour",
  labors: "labours",
  neighbor: "neighbour",
  neighbors: "neighbours",
  behavior: "behaviour",
  behaviors: "behaviours",
  center: "centre",
  centers: "centres",
  centered: "centred",
  theater: "theatre",
  theaters: "theatres",
  meter: "metre",
  meters: "metres",
  liter: "litre",
  liters: "litres",
  defense: "defence",
  offense: "offence",
  license: "licence",
  organize: "organise",
  organized: "organised",
  realize: "realise",
  realized: "realised",
  analyze: "analyse",
  analyzed: "analysed",
  traveling: "travelling",
  traveled: "travelled",
  canceled: "cancelled",
  modeling: "modelling",
  program: "programme",
  gray: "grey",
  aluminum: "aluminium",
  airplane: "aeroplane",
  math: "maths",
  mom: "mum",
  tire: "tyre",
  pajamas: "pyjamas",
  jewelry: "jewellery",
  judgment: "judgement",
  acknowledgment: "acknowledgement",
  fulfill: "fulfil",
  enroll: "enrol",
  skillful: "skilful",
  woolen: "woollen",
};

function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function replaceBritishSpelling(word: string): string {
  const leading = word.match(LEADING_PUNCTUATION)?.[0] ?? "";
  const trailing = word.match(TRAILING_PUNCTUATION)?.[0] ?? "";
  const end = word.length - trailing.length;
  const core = word.slice(leading.length, end);
  if (!core) return word;
  const mapped = BRITISH_SPELLINGS[core.toLowerCase()];
  if (!mapped) return word;
  const cased =
    core[0] === core[0].toUpperCase()
      ? `${mapped[0].toUpperCase()}${mapped.slice(1)}`
      : mapped;
  return `${leading}${cased}${trailing}`;
}

/**
 * Language and novelty transforms run on the finished word list, after the
 * corpus options. Funbox is deliberately not applied to custom text: that
 * text is always typed as written.
 */
function styleWords(
  words: string[],
  settings: TestSettings,
  allowFunbox: boolean,
): string[] {
  let next = words;
  if (settings.lazyMode) next = next.map(stripDiacritics);
  if (settings.language === "british") {
    next = next.map(replaceBritishSpelling);
  }
  if (!allowFunbox || settings.funbox === "none") return next;
  if (settings.funbox === "mirror") {
    return next.map((word) => word.split("").reverse().join(""));
  }
  if (settings.funbox === "reverse") {
    return next.slice().reverse();
  }
  return next.map((word) => word.toUpperCase());
}

function quoteBucket(text: string): Exclude<QuoteLength, "all"> {
  if (text.length <= 70) return "short";
  if (text.length <= 140) return "medium";
  return "long";
}

function quotePool(length: QuoteLength): QuoteRecord[] {
  if (length === "all") return QUOTE_CORPUS;
  const pool = QUOTE_CORPUS.filter((quote) => quoteBucket(quote.text) === length);
  return pool.length ? pool : QUOTE_CORPUS;
}

/* ── custom text pipeline ─────────────────────────────────────────── */

function flattenNewlines(text: string, addPeriods: boolean): string {
  const lines = text.split("\n");
  const parts: string[] = [];
  for (const line of lines) {
    let next = line.trim();
    if (!next) continue;
    if (addPeriods && !LINE_END.test(next)) next = `${next}.`;
    parts.push(next);
  }
  return parts.join(" ");
}

/**
 * Cleanup runs in a fixed order: invisible characters, fancy typography,
 * literal control escapes, then newline flattening. Splitting comes after,
 * so no cleanup step can create a stray empty word.
 */
function customSource(settings: TestSettings): string {
  let text = settings.customText.replace(/\r\n?/g, "\n").trim();
  if (!text) text = DEFAULT_CUSTOM_TEXT;

  if (settings.removeZeroWidth) text = text.replace(ZERO_WIDTH, "");

  if (settings.removeFancyTypography) {
    for (const [pattern, replacement] of FANCY_TYPOGRAPHY) {
      text = text.replace(pattern, replacement);
    }
  }

  if (settings.replaceControlChars) {
    text = text
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\n");
  }

  if (settings.replaceNewlines) {
    text = flattenNewlines(text, settings.addPeriods);
  }

  return text;
}

function splitCustomLine(line: string, delimiter: string): string[] {
  if (delimiter === "|") {
    // The pipe is the only word break, so spaces inside a chunk stay and the
    // group is typed as one continuous phrase.
    return line
      .split("|")
      .map((chunk) => chunk.trim().replace(/\s+/g, " "))
      .filter(Boolean);
  }
  return line.trim().split(/\s+/).filter(Boolean);
}

function customSections(settings: TestSettings): string[][] {
  const source = customSource(settings);
  const sections = source
    .split("\n")
    .map((line) => splitCustomLine(line, settings.wordDelimiter))
    .filter((words) => words.length > 0);
  if (sections.length) return sections;
  return customSections({ ...settings, customText: DEFAULT_CUSTOM_TEXT });
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const next = items.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function pickWord(
  pool: readonly string[],
  previous: string,
  random: () => number,
): string {
  let word = pool[Math.floor(random() * pool.length)];
  // A stray immediate repeat reads like a bug rather than a shuffle.
  let guard = 0;
  while (word === previous && pool.length > 1 && guard < 6) {
    word = pool[Math.floor(random() * pool.length)];
    guard += 1;
  }
  return word;
}

function orderedWords(
  sections: string[][],
  order: CustomOrder,
  count: number,
  seed: number,
): string[] {
  const pool = sections.flat();
  if (!pool.length || count <= 0) return [];
  const random = mulberry32(seed);

  if (order === "random") {
    const words: string[] = [];
    let previous = "";
    for (let index = 0; index < count; index += 1) {
      const word = pickWord(pool, previous, random);
      words.push(word);
      previous = word;
    }
    return words;
  }

  if (order === "shuffle") {
    const words: string[] = [];
    while (words.length < count) {
      words.push(...shuffle(pool, random));
    }
    return words.slice(0, count);
  }

  // repeat keeps the source order and cycles whole sections.
  const words: string[] = [];
  let sectionIndex = 0;
  while (words.length < count) {
    words.push(...sections[sectionIndex % sections.length]);
    sectionIndex += 1;
  }
  return words.slice(0, count);
}

interface SectionPlan {
  words: string[];
  sectionStarts: number[];
}

function orderedSections(
  sections: string[][],
  order: CustomOrder,
  count: number,
  seed: number,
): SectionPlan {
  if (!sections.length || count <= 0) return { words: [], sectionStarts: [] };
  const random = mulberry32(seed);
  const selected: string[][] = [];

  if (order === "repeat") {
    for (let index = 0; index < count; index += 1) {
      selected.push(sections[index % sections.length]);
    }
  } else if (order === "shuffle") {
    while (selected.length < count) {
      const cycle = shuffle(sections, random).map((section) =>
        shuffle(section, random),
      );
      for (const section of cycle) {
        if (selected.length >= count) break;
        selected.push(section);
      }
    }
  } else {
    // Random picks individual words, but keeps source-sized sections so the
    // section limit still means something.
    const pool = sections.flat();
    for (let index = 0; index < count; index += 1) {
      const size = sections[Math.floor(random() * sections.length)].length;
      const section: string[] = [];
      let previous = "";
      for (let wordIndex = 0; wordIndex < size; wordIndex += 1) {
        const word = pickWord(pool, previous, random);
        section.push(word);
        previous = word;
      }
      selected.push(section);
    }
  }

  const words: string[] = [];
  const sectionStarts: number[] = [];
  for (const section of selected) {
    if (!section.length) continue;
    sectionStarts.push(words.length);
    words.push(...section);
  }
  return { words, sectionStarts };
}

function customTest(seed: number, settings: TestSettings): TestText {
  const sections = customSections(settings);

  if (settings.customLimit === "sections") {
    const plan = orderedSections(
      sections,
      settings.customOrder,
      settings.customSections,
      seed,
    );
    const words = styleWords(plan.words, settings, false);
    return {
      text: words.join(" "),
      words,
      sectionStarts: plan.sectionStarts,
    };
  }

  const count =
    settings.customLimit === "words"
      ? settings.customWords
      : timeWordTarget(settings.customSeconds);
  const words = styleWords(
    orderedWords(sections, settings.customOrder, count, seed),
    settings,
    false,
  );
  return { text: words.join(" "), words };
}

function customExtension(
  seed: number,
  settings: TestSettings,
  count: number,
): string[] {
  const sections = customSections(settings);
  return styleWords(
    orderedWords(sections, settings.customOrder, count, seed),
    settings,
    false,
  );
}

/* ── public generation API ────────────────────────────────────────── */

export function generateTest(seed: number, settings: TestSettings): TestText {
  if (settings.mode === "custom") {
    return customTest(seed, settings);
  }

  if (settings.mode === "quote") {
    const pool = quotePool(settings.quoteLength);
    const quote = pool[Math.abs(Math.floor(seed)) % pool.length];
    const words = styleWords(
      quote.text.split(/\s+/).filter(Boolean),
      settings,
      true,
    );
    return {
      text: words.join(" "),
      words,
      author: quote.author,
    };
  }

  const target =
    settings.mode === "time"
      ? timeWordTarget(settings.duration)
      : settings.mode === "words"
        ? settings.wordCount
        : 200;
  const words = styleWords(corpusWords(seed, target, settings), settings, true);
  return { text: words.join(" "), words };
}

/** Appends more static text for timed and zen runs that outlast the first block. */
export function extendTest(
  seed: number,
  settings: TestSettings,
  count = 48,
): string[] {
  if (settings.mode === "custom") {
    return customExtension(seed, settings, count);
  }
  return styleWords(corpusWords(seed, count, settings), settings, true);
}
