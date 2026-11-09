import type { Layout } from "@/lib/settings";

/**
 * Physical-key to character maps for layout emulation. A player on a QWERTY
 * keyboard can type as if the keys were Dvorak or Colemak; the drill still
 * shows the layout's letters.
 */
const DVORAK: Record<string, string> = {
  KeyQ: "'",
  KeyW: ",",
  KeyE: ".",
  KeyR: "p",
  KeyT: "y",
  KeyY: "f",
  KeyU: "g",
  KeyI: "c",
  KeyO: "r",
  KeyP: "l",
  KeyA: "a",
  KeyS: "o",
  KeyD: "e",
  KeyF: "u",
  KeyG: "i",
  KeyH: "d",
  KeyJ: "h",
  KeyK: "t",
  KeyL: "n",
  Semicolon: "s",
  KeyZ: ";",
  KeyX: "q",
  KeyC: "j",
  KeyV: "k",
  KeyB: "x",
  KeyN: "b",
  KeyM: "m",
  Comma: "w",
  Period: "v",
  Slash: "z",
};

const COLEMAK: Record<string, string> = {
  KeyQ: "q",
  KeyW: "w",
  KeyE: "f",
  KeyR: "p",
  KeyT: "g",
  KeyY: "j",
  KeyU: "l",
  KeyI: "u",
  KeyO: "y",
  KeyP: ";",
  KeyA: "a",
  KeyS: "r",
  KeyD: "s",
  KeyF: "t",
  KeyG: "d",
  KeyH: "h",
  KeyJ: "n",
  KeyK: "e",
  KeyL: "i",
  Semicolon: "o",
  KeyZ: "z",
  KeyX: "x",
  KeyC: "c",
  KeyV: "v",
  KeyB: "b",
  KeyN: "k",
  KeyM: "m",
  Comma: ",",
  Period: ".",
  Slash: "/",
};

const MAPS: Record<Exclude<Layout, "qwerty">, Record<string, string>> = {
  dvorak: DVORAK,
  colemak: COLEMAK,
};

/** Translate a physical key into the active layout's character. */
export function layoutChar(
  event: KeyboardEvent,
  layout: Layout,
): string | null {
  if (layout === "qwerty") return event.key.length === 1 ? event.key : null;
  const mapped = MAPS[layout][event.code];
  if (!mapped) return event.key.length === 1 ? event.key : null;
  if (!event.shiftKey) return mapped;
  if (mapped.length === 1 && /[a-z]/.test(mapped)) return mapped.toUpperCase();
  const shifted: Record<string, string> = {
    "'": '"',
    ",": "<",
    ".": ">",
    "/": "?",
    ";": ":",
    "[": "{",
    "]": "}",
    "\\": "|",
    "-": "_",
    "=": "+",
    "`": "~",
    "1": "!",
    "2": "@",
    "3": "#",
    "4": "$",
    "5": "%",
    "6": "^",
    "7": "&",
    "8": "*",
    "9": "(",
    "0": ")",
  };
  return shifted[mapped] ?? mapped;
}

const LEFT_CODES = /^(Key[QWERTASDFGZXCVB]|Digit[1-5]|Backquote|Tab|CapsLock)$/;

/**
 * Which hand owns a physical key. Used by opposite-shift mode: an uppercase
 * character must be reached with the shift key on the other side.
 */
export function keyHand(code: string): "left" | "right" | null {
  if (LEFT_CODES.test(code)) return "left";
  if (/^(Key|Digit|Minus|Equal|Bracket|Semicolon|Quote|Comma|Period|Slash|Backslash)/.test(code)) {
    return "right";
  }
  return null;
}

export interface ShiftCheck {
  /** Shift side actually used, if the browser reports it. */
  used: "left" | "right" | null;
  required: "left" | "right" | null;
  wrong: boolean;
}

/**
 * Opposite-shift validation. Shift is only meaningful for characters whose
 * physical key sits on one hand and which require the other hand's shift.
 */
export function oppositeShiftCheck(
  event: KeyboardEvent,
  character: string,
): ShiftCheck {
  const used =
    event.location === 1 ? "left" : event.location === 2 ? "right" : null;
  if (!used || !/[A-Z]/.test(character)) {
    return { used, required: null, wrong: false };
  }
  const hand = keyHand(event.code);
  if (!hand) return { used, required: null, wrong: false };
  const required = hand === "left" ? "right" : "left";
  return { used, required, wrong: used !== required };
}

/** The keyboard shown by keymap mode, in the active layout. */
export function keymapRows(layout: Layout): string[][] {
  const letters: Record<Exclude<Layout, "qwerty">, string[]> = {
    dvorak: [
      "' , . p y",
      "a o e u i d h t n s",
      "; q j k x b m w v z",
    ],
    colemak: ["q w f p g j l u y ;", "a r s t d h n e i o", "z x c v b k m , . /"],
  };
  if (layout === "qwerty") {
    return ["q w e r t y u i o p", "a s d f g h j k l", "z x c v b n m"].map(
      (row) => row.split(" "),
    );
  }
  return letters[layout].map((row) => row.split(" "));
}
