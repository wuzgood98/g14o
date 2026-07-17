/**
 * Based on https://github.com/jorgebucaran/colorette
 * Read LICENSE file for more information
 * https://github.com/jorgebucaran/colorette/blob/20fc196d07d0f87c61e0256eadd7831c79b24108/index.js
 */

export type ColorFn = (value: string) => string;

export interface Colors {
  bgFatal: ColorFn;
  bgRed: ColorFn;
  bgWarn: ColorFn;
  black: ColorFn;
  bold: ColorFn;
  debug: ColorFn;
  dim: ColorFn;
  error: ColorFn;
  fatal: ColorFn;
  gray: ColorFn;
  greenBright: ColorFn;
  info: ColorFn;
  magenta: ColorFn;
  reset: ColorFn;
  stackGreen: ColorFn;
  trace: ColorFn;
  warn: ColorFn;
  whiteBright: ColorFn;
}

interface ProcessLike {
  argv?: string[];
  env?: Record<string, string | undefined>;
  platform?: string;
  stdout?: { isTTY?: boolean };
}

function getProcess(): ProcessLike | undefined {
  if (typeof process === "undefined") {
    return;
  }
  return process as ProcessLike;
}

/** True when the current environment supports ANSI colors (Colorette rules). */
export function isColorSupported(): boolean {
  const proc = getProcess();
  if (!proc) {
    return false;
  }

  const env = proc.env ?? {};
  const argv = proc.argv ?? [];
  const platform = proc.platform ?? "";

  const isDisabled = "NO_COLOR" in env || argv.includes("--no-color");
  const isForced = "FORCE_COLOR" in env || argv.includes("--color");
  const isWindows = platform === "win32";
  const isDumbTerminal = env.TERM === "dumb";

  const isCompatibleTerminal =
    Boolean(proc.stdout?.isTTY) && Boolean(env.TERM) && !isDumbTerminal;

  const isCI =
    "CI" in env &&
    ("GITHUB_ACTIONS" in env || "GITLAB_CI" in env || "CIRCLECI" in env);

  return (
    !isDisabled &&
    (isForced || (isWindows && !isDumbTerminal) || isCompatibleTerminal || isCI)
  );
}

function replaceClose(
  index: number,
  string: string,
  close: string,
  replace: string
): string {
  let result = "";
  let current = string;
  let at = index;

  while (at >= 0) {
    result += current.slice(0, at) + replace;
    current = current.slice(at + close.length);
    at = current.indexOf(close);
  }

  return result + current;
}

function clearBleed(
  index: number,
  string: string,
  open: string,
  close: string,
  replace: string
): string {
  return index < 0
    ? open + string + close
    : open + replaceClose(index, string, close, replace) + close;
}

function filterEmpty(
  open: string,
  close: string,
  replace = open,
  at = open.length + 1
): ColorFn {
  return (string: string): string =>
    string || !(string === "" || string === undefined)
      ? clearBleed(`${string}`.indexOf(close, at), string, open, close, replace)
      : "";
}

function init(
  open: number | string,
  close: number | string,
  replace?: string
): ColorFn {
  return filterEmpty(`\x1b[${open}m`, `\x1b[${close}m`, replace);
}

const ENABLED_COLORS: Colors = {
  reset: init(0, 0),
  bold: init(1, 22, "\x1b[22m\x1b[1m"),
  dim: init(2, 22, "\x1b[22m\x1b[2m"),
  black: init(30, 39),
  magenta: init(35, 39),
  gray: init(90, 39),
  greenBright: init(92, 39),
  whiteBright: init(97, 39),
  bgRed: init(41, 49),
  bgFatal: init("48;5;88", 49),
  debug: init("38;5;103", 39),
  info: init("38;5;37", 39),
  stackGreen: init("38;5;43", 39),
  trace: init("38;5;245", 39),
  warn: init("38;5;227", 39),
  error: init(91, 39),
  fatal: init("38;5;88", 39),
  bgWarn: init("48;5;227", 49),
};

const DISABLED_COLORS: Colors = {
  reset: String,
  bold: String,
  dim: String,
  black: String,
  magenta: String,
  gray: String,
  greenBright: String,
  whiteBright: String,
  bgRed: String,
  bgFatal: String,
  debug: String,
  info: String,
  stackGreen: String,
  trace: String,
  warn: String,
  error: String,
  fatal: String,
  bgWarn: String,
};

/** Returns ANSI color helpers, or identity functions when color is disabled. */
export function createColors({
  useColor = isColorSupported(),
}: {
  useColor?: boolean;
} = {}): Colors {
  return useColor ? ENABLED_COLORS : DISABLED_COLORS;
}

/** Cached colors for the current support detection result. */
export function getColors(): Colors {
  return createColors({ useColor: isColorSupported() });
}
