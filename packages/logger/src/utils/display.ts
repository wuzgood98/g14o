/**
 * Terminal display helpers: ANSI stripping, visible width, and Unicode glyph fallbacks.
 * Width estimation covers common combining marks, CJK, and emoji without runtime deps.
 */

import { isBrowserEnv } from "./env";

const ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

/** Minimum terminal width before right-aligning the timestamp column. */
export const MIN_ALIGN_COLUMNS = 80;

/** Strips ANSI escape codes for visible-width measurement. */
export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

interface ProcessLike {
  env?: Record<string, string | undefined>;
  platform?: string;
}

function getProcess(): ProcessLike | undefined {
  if (typeof process === "undefined") {
    return;
  }
  return process as ProcessLike;
}

/**
 * Heuristic for whether the current terminal can render common Unicode glyphs.
 * Browsers always support Unicode; Windows uses known-terminal env checks.
 */
export function isUnicodeSupported(): boolean {
  if (isBrowserEnv()) {
    return true;
  }

  const proc = getProcess();
  if (!proc) {
    return true;
  }

  const env = proc.env ?? {};
  const platform = proc.platform ?? "";

  if (platform !== "win32") {
    // Linux console (kernel) has limited Unicode glyph coverage.
    return env.TERM !== "linux";
  }

  return (
    Boolean(env.WT_SESSION) ||
    Boolean(env.TERMINUS_SUBLIME) ||
    env.ConEmuTask === "{cmd::Cmder}" ||
    env.TERM_PROGRAM === "Terminus-Sublime" ||
    env.TERM_PROGRAM === "vscode" ||
    env.TERM === "xterm-256color" ||
    env.TERM === "alacritty" ||
    env.TERMINAL_EMULATOR === "JetBrains-JediTerm" ||
    Boolean(env.TERM?.startsWith("rxvt-unicode"))
  );
}

/** Selects `unicode` when supported, otherwise `fallback`. */
export function selectGlyph(unicode: string, fallback: string): string {
  return isUnicodeSupported() ? unicode : fallback;
}

const EMOJI_PRESENTATION = "\uFE0F";
const TEXT_PRESENTATION = "\uFE0E";

/**
 * Forces text presentation so terminals honor ANSI/`%c` foreground colors
 * for emoji-capable glyphs (e.g. ✔, ⚠).
 */
export function forceTextPresentation(glyph: string): string {
  let base = glyph;
  if (base.endsWith(EMOJI_PRESENTATION)) {
    base = base.slice(0, -EMOJI_PRESENTATION.length);
  } else if (base.endsWith(TEXT_PRESENTATION)) {
    base = base.slice(0, -TEXT_PRESENTATION.length);
  }
  return `${base}${TEXT_PRESENTATION}`;
}

function isCombiningMark(codePoint: number): boolean {
  return (
    (codePoint >= 0x03_00 && codePoint <= 0x03_6f) ||
    (codePoint >= 0x1a_b0 && codePoint <= 0x1a_ff) ||
    (codePoint >= 0x1d_c0 && codePoint <= 0x1d_ff) ||
    (codePoint >= 0x20_d0 && codePoint <= 0x20_ff) ||
    (codePoint >= 0xfe_20 && codePoint <= 0xfe_2f)
  );
}

function isFullWidth(codePoint: number): boolean {
  return (
    (codePoint >= 0x11_00 && codePoint <= 0x11_5f) ||
    codePoint === 0x23_29 ||
    codePoint === 0x23_2a ||
    (codePoint >= 0x2e_80 && codePoint <= 0xa4_cf && codePoint !== 0x30_3f) ||
    (codePoint >= 0xac_00 && codePoint <= 0xd7_a3) ||
    (codePoint >= 0xf9_00 && codePoint <= 0xfa_ff) ||
    (codePoint >= 0xfe_10 && codePoint <= 0xfe_19) ||
    (codePoint >= 0xfe_30 && codePoint <= 0xfe_6f) ||
    (codePoint >= 0xff_00 && codePoint <= 0xff_60) ||
    (codePoint >= 0xff_e0 && codePoint <= 0xff_e6) ||
    (codePoint >= 0x2_00_00 && codePoint <= 0x3_ff_fd)
  );
}

function isEmoji(codePoint: number): boolean {
  return (
    (codePoint >= 0x1_f3_00 && codePoint <= 0x1_fa_ff) ||
    (codePoint >= 0x1_f1_e6 && codePoint <= 0x1_f1_ff) ||
    (codePoint >= 0x26_00 && codePoint <= 0x27_bf) ||
    codePoint === 0x20_0d ||
    codePoint === 0xfe_0f
  );
}

/**
 * Estimates terminal cell width after stripping ANSI.
 * Combining marks contribute 0; full-width CJK and common emoji contribute 2.
 */
export function stringWidth(value: string): number {
  const plain = stripAnsi(value);
  let width = 0;

  for (const char of plain) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) {
      continue;
    }
    if (
      isCombiningMark(codePoint) ||
      (codePoint >= 0xfe_00 && codePoint <= 0xfe_0f) ||
      codePoint === 0x20_0d
    ) {
      continue;
    }
    if (isFullWidth(codePoint) || isEmoji(codePoint)) {
      width += 2;
      continue;
    }
    width += 1;
  }

  return width;
}

/**
 * Pads content so suffix aligns to the right edge when there is room,
 * otherwise joins with a single space (compact layout).
 *
 * @param minAlign - Minimum terminal width before right-aligning; `false` always compact.
 */
export function padToRight(
  content: string,
  suffix: string,
  width: number,
  minAlign: number | false = MIN_ALIGN_COLUMNS
): string {
  if (!suffix) {
    return content;
  }

  if (minAlign === false) {
    return `${content} ${suffix}`;
  }

  const contentWidth = stringWidth(content);
  const suffixWidth = stringWidth(suffix);
  const padding = width - contentWidth - suffixWidth;

  if (padding > 0 && width >= minAlign) {
    return `${content}${" ".repeat(padding)}${suffix}`;
  }

  return `${content} ${suffix}`;
}
