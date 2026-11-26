/**
 * La caza de errores de aplicaciones ajenas.
 *
 * Un Sprite es un servidor: la gente corre apps dentro todo el tiempo. Los
 * logs de esas apps no viven en `/.sprite/logs` (eso es de los servicios del
 * runtime). Viven donde la app los ponga. El gato mira los lugares de siempre:
 *
 *   ~/logs, ~/app/logs, <dir>/(app|api|web)/logs, y los nombres clásicos
 *   (<dir>/app.log, <dir>/error.log, ~/error.log).
 *
 * Solo le interesan errores frescos: un log que dejó de crecer hace dos horas
 * no es una criatura viva, es una calavera.
 */
import path from "node:path";
import { preyKey, type Prey } from "../prey.js";

export interface AppLogFile {
  path: string;
  size: number;
  mtimeMs: number;
  lines: string[];
}

const LOG_NAME = /\.log$|\.err$|\.out$/i;
const ERROR_WORD = /\b(error|fatal|panic|traceback|exception|critical|segfault|killed|EADDRINUSE|unhandled)\b/i;

export function scoreErrorLine(line: string): number {
  if (!ERROR_WORD.test(line)) return 0;
  let score = 1;
  if (/fatal|panic|segfault|unhandled/i.test(line)) score += 2;
  if (/traceback|exception/i.test(line)) score += 1;
  return score;
}

export interface AppLogScan {
  fresh: boolean;
  errorLines: string[];
  score: number;
}

export function scanAppLog(file: AppLogFile, nowMs: number, freshSec: number): AppLogScan {
  const ageSec = (nowMs - file.mtimeMs) / 1000;
  const fresh = ageSec <= freshSec;
  const errorLines = file.lines.filter((l) => scoreErrorLine(l) > 0);
  const score = errorLines.reduce((acc, l) => acc + scoreErrorLine(l), 0);
  return { fresh, errorLines, score };
}

/** Los lugares donde un gato busca logs de apps. */
export function logCandidates(homeDir: string, appDirs: string[] = []): string[] {
  const dirs = new Set<string>([
    homeDir,
    path.join(homeDir, "logs"),
    ...appDirs.flatMap((d) => [d, path.join(d, "logs"), path.join(d, "log")]),
    "/var/log",
  ]);
  return [...dirs];
}

export function toPrey(
  file: AppLogFile,
  scan: AppLogScan,
  host: string,
  nowMs: number,
): Prey {
  const at = new Date(nowMs).toISOString();
  const title = `errores frescos en ${path.basename(file.path)}`;
  return {
    key: preyKey("log", host, `${title}:${file.path}`),
    category: "log",
    title,
    evidence: scan.errorLines.slice(-10).join("\n").slice(0, 4000),
    host,
    sightings: 1,
    firstSeenAt: at,
    lastSeenAt: at,
  };
}

export { LOG_NAME };
