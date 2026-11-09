export type ThemeMode = "dark" | "light";

export type ThemeFamily =
  | "slate"
  | "ember"
  | "forest"
  | "iris"
  | "ocean"
  | "rose"
  | "sand"
  | "lime"
  | "coffee"
  | "ice"
  | "plum"
  | "mono";

export type ThemeId = `${ThemeFamily}-${ThemeMode}`;

export interface ThemeFamilyDefinition {
  id: ThemeFamily;
  label: string;
  /** Accent colour per mode, also used by the picker swatch. */
  accent: Record<ThemeMode, string>;
  /** Page background per mode, used for the browser theme-color meta tag. */
  bg: Record<ThemeMode, string>;
}

export interface ThemeOption {
  id: ThemeId;
  family: ThemeFamily;
  mode: ThemeMode;
  label: string;
  accent: string;
  bg: string;
}

/** One key now holds the whole theme: family plus mode. */
export const THEME_KEY = "platen:theme";

export const DEFAULT_THEME_ID: ThemeId = "slate-dark";

/**
 * Twelve theme families. Every family ships a dark half and a light half with
 * the same accent temperature, so the picker can offer both as separate
 * themes without a second light/dark control.
 */
export const THEME_FAMILIES: ThemeFamilyDefinition[] = [
  {
    id: "slate",
    label: "slate",
    accent: { dark: "#3ddbd9", light: "#0a7572" },
    bg: { dark: "#14161c", light: "#f3f4f7" },
  },
  {
    id: "ember",
    label: "ember",
    accent: { dark: "#f2a65a", light: "#a4520f" },
    bg: { dark: "#17130f", light: "#f8f2ea" },
  },
  {
    id: "forest",
    label: "forest",
    accent: { dark: "#5fdcac", light: "#0b7a52" },
    bg: { dark: "#0f1613", light: "#f2f7f3" },
  },
  {
    id: "iris",
    label: "iris",
    accent: { dark: "#b49bff", light: "#5b3fc4" },
    bg: { dark: "#14121c", light: "#f5f2fb" },
  },
  {
    id: "ocean",
    label: "ocean",
    accent: { dark: "#5ec8ff", light: "#0b63a8" },
    bg: { dark: "#0f1520", light: "#f1f5fb" },
  },
  {
    id: "rose",
    label: "rose",
    accent: { dark: "#ff8fb3", light: "#b0245c" },
    bg: { dark: "#1a1015", light: "#fbf1f4" },
  },
  {
    id: "sand",
    label: "sand",
    accent: { dark: "#e8c37a", light: "#8a6420" },
    bg: { dark: "#17140e", light: "#faf5e9" },
  },
  {
    id: "lime",
    label: "lime",
    accent: { dark: "#b6ec5a", light: "#4f7a10" },
    bg: { dark: "#12160c", light: "#f4f9ec" },
  },
  {
    id: "coffee",
    label: "coffee",
    accent: { dark: "#d9a066", light: "#8a4b1c" },
    bg: { dark: "#17110c", light: "#f7f0e7" },
  },
  {
    id: "ice",
    label: "ice",
    accent: { dark: "#8fe4f0", light: "#0c6f80" },
    bg: { dark: "#0d151a", light: "#eef8fa" },
  },
  {
    id: "plum",
    label: "plum",
    accent: { dark: "#f08bd8", light: "#a3298c" },
    bg: { dark: "#17101a", light: "#faf0f8" },
  },
  {
    id: "mono",
    label: "mono",
    accent: { dark: "#d7dbe3", light: "#3f4652" },
    bg: { dark: "#141518", light: "#f4f5f7" },
  },
];

export const THEME_MODES: ThemeMode[] = ["dark", "light"];

export const THEME_OPTIONS: ThemeOption[] = THEME_FAMILIES.flatMap((family) =>
  THEME_MODES.map((mode) => ({
    id: `${family.id}-${mode}` as ThemeId,
    family: family.id,
    mode,
    label: family.label,
    accent: family.accent[mode],
    bg: family.bg[mode],
  })),
);

const THEME_IDS = THEME_OPTIONS.map((option) => option.id);

const THEME_BY_ID = Object.fromEntries(
  THEME_OPTIONS.map((option) => [option.id, option]),
) as Record<ThemeId, ThemeOption>;

const FAMILY_IDS = THEME_FAMILIES.map((family) => family.id);

export const DEFAULT_THEME = THEME_BY_ID[DEFAULT_THEME_ID];
export const DEFAULT_THEME_BG = DEFAULT_THEME.bg;

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId);
}

export function isThemeFamily(value: unknown): value is ThemeFamily {
  return typeof value === "string" && FAMILY_IDS.includes(value as ThemeFamily);
}

export function themeOption(id: ThemeId): ThemeOption {
  return THEME_BY_ID[id] ?? DEFAULT_THEME;
}

export function themeMode(id: ThemeId): ThemeMode {
  return themeOption(id).mode;
}

/**
 * Runs before the app paints so the saved theme never flashes the wrong
 * colours. It also migrates the old split `platen:theme` / `platen:palette`
 * pair into one theme id.
 */
export const THEME_INIT_SCRIPT = `(function(){document.documentElement.classList.add("js");try{var options=${JSON.stringify(
  Object.fromEntries(
    THEME_OPTIONS.map((option) => [
      option.id,
      { family: option.family, mode: option.mode, bg: option.bg },
    ]),
  ),
)};var families=${JSON.stringify(
  FAMILY_IDS,
)};var saved=localStorage.getItem("${THEME_KEY}");if(!options[saved]){var legacyMode=saved==="light"?"light":saved==="dark"?"dark":null;var legacyFamily=localStorage.getItem("platen:palette");if(legacyMode){if(families.indexOf(legacyFamily)<0){legacyFamily="slate";}saved=legacyFamily+"-"+legacyMode;}else{saved="${DEFAULT_THEME_ID}";}}var picked=options[saved]||options["${DEFAULT_THEME_ID}"];var root=document.documentElement;root.dataset.theme=picked.mode;root.dataset.scheme=picked.family;var meta=document.querySelector('meta[name="theme-color"]');if(meta){meta.setAttribute("content",picked.bg);}}catch(e){document.documentElement.dataset.theme="dark";document.documentElement.dataset.scheme="slate";}})();`;
