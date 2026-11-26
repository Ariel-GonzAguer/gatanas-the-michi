/**
 * El oído de Gatanás: recoge presas del sistema operativo.
 *
 * Todo es filesystem nativo, sin dependencias. El gato corre en un Sprite,
 * que es un Linux normal y corriente, así que lee /proc y /.sprite como
 * cualquier mascota leería la nevera.
 *
 * `collectLocalPrey` es la única función impura: recibe un `deps` para poder
 * probarla con fixtures.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { preyKey, type Prey, type PreyCategory } from "./prey.js";

export interface CollectDeps {
  now: () => number;
  readFile: (p: string) => Promise<string>;
  listDir: (p: string) => Promise<{ name: string; isDir: boolean; size: number }[]>;
  stat: (p: string) => Promise<{ size: number; mtimeMs: number } | null>;
  /** Medidor de disco inyectable para las pruebas. */
  statfs?: () => Promise<{ total: number; free: number } | null>;
  procDir?: string;
  spriteDir?: string;
  tmpDir?: string;
  homeDir?: string;
}

export interface CollectOptions {
  host: string;
  /** Ventana de frescura, en segundos. Un log más viejo no es presa. */
  freshSec: number;
  /** Solo estos servicios (vacío = todos los de /.sprite/services). */
  watchServices?: string[];
  /** Tamaño (bytes) y conteo desde el que un log preocupa. */
  logBigBytes?: number;
  logBigLines?: number;
  /** Free disk %, por debajo del cual no hay hoja que traer. */
  diskFreePct?: number;
}

export const DEFAULT_OPTIONS: Required<Omit<CollectOptions, "host">> = {
  freshSec: 120,
  watchServices: [],
  logBigBytes: 50 * 1024 * 1024,
  logBigLines: 1_000_000,
  diskFreePct: 5,
};

function clampOptions(opts: CollectOptions): Required<Omit<CollectOptions, "host">> & { host: string } {
  return { host: opts.host, ...DEFAULT_OPTIONS, ...stripUndefined(opts) };
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const r: Partial<T> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) (r as Record<string, unknown>)[k] = v;
  return r;
}

function fresh(tsSeconds: number, now: number, windowSec: number): boolean {
  return tsSeconds > 0 && now / 1000 - tsSeconds <= windowSec && tsSeconds <= now / 1000 + 60;
}

function makePrey(
  now: number,
  category: PreyCategory,
  host: string,
  title: string,
  evidence: string,
): Prey {
  const at = new Date(now).toISOString();
  return {
    key: preyKey(category, host, title),
    category,
    title,
    evidence: evidence.slice(0, 4000),
    host,
    sightings: 1,
    firstSeenAt: at,
    lastSeenAt: at,
  };
}

export async function collectLocalPrey(deps: CollectDeps, options: CollectOptions): Promise<Prey[]> {
  const o = clampOptions(options);
  const now = deps.now();
  const procDir = deps.procDir ?? "/proc";
  const spriteDir = deps.spriteDir ?? "/.sprite";
  const tmpDir = deps.tmpDir ?? "/tmp";
  const homeDir = deps.homeDir ?? "/home/sprite";
  const out: Prey[] = [];

  // --- Procesos: zombis ---------------------------------------------------
  const procNames = await deps.listDir(procDir).catch(() => []);
  for (const entry of procNames) {
    if (!/^\d+$/.test(entry.name)) continue;
    const stat = await deps.readFile(path.join(procDir, entry.name, "stat")).catch(() => "");
    if (!stat) continue;
    const pid = Number(entry.name);
    // Formato: pid (comm) state ppid ...
    const rest = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    const state = rest[0];
    let comm = stat.slice(stat.indexOf("(") + 1, stat.lastIndexOf(")"));
    if (!comm) comm = "something";
    const commShort = comm.slice(0, 40);

    if (state === "Z") {
      out.push(
        makePrey(
          now,
          "process",
          o.host,
          `zombie process ${commShort}`,
          `pid ${pid} state Z (defunct) — neither dies nor breathes.`,
        ),
      );
    }
  }

  // --- Disco ---------------------------------------------------------------
  // Se mide solo /, que es donde vive todo en un Sprite.
  const disk = await deps.readFile(path.join(procDir, "self", "mounts")).catch(() => "");
  const rootLine = disk.split("\n").find((l) => l.split(" ")[1] === "/");
  if (rootLine) {
    const dev = rootLine.split(" ")[0];
    // statvfs no está en /proc: usamos fs.statfs vía el helper de abajo.
    const s = await statfsSafe(deps);
    if (s) {
      const usedPct = ((s.total - s.free) / s.total) * 100;
      const freePct = (s.free / s.total) * 100;
      if (freePct < o.diskFreePct) {
        out.push(
          makePrey(
            now,
            "disk",
            o.host,
            `disk at ${usedPct.toFixed(1)}%`,
            `${(s.free / 1e9).toFixed(2)} GB free of ${(s.total / 1e9).toFixed(2)} GB left on ${dev}.`,
          ),
        );
      }
    }
  }

  // --- Servicios y sus logs ------------------------------------------------
  const svcRoots = [path.join(spriteDir, "services"), path.join(spriteDir, "logs", "services")];
  for (const svcRoot of svcRoots) {
    const vs = await deps.listDir(svcRoot).catch(() => []);
    for (const svc of vs) {
      if (svc.isDir) continue;
      const svcName = svc.name.replace(/\.(json|log|yaml|yml)$/, "");
      if (o.watchServices.length > 0 && !o.watchServices.includes(svcName)) continue;
      const st = await deps.stat(path.join(svcRoot, svc.name)).catch(() => null);
      if (!st) continue;

      if (svcRoot.includes("services") && !svc.name.includes("logs")) {
        // Archivo de definición del servicio: si el estado dice stopped, gime.
        const raw = await deps.readFile(path.join(svcRoot, svc.name)).catch(() => "");
        if (/"status"\s*:\s*"stopped"/.test(raw)) {
          out.push(
            makePrey(now, "service", o.host, `service ${svcName} stopped`, raw.slice(0, 2000)),
          );
        }
        continue;
      }

      if (!svc.name.endsWith(".log")) continue;
      const isBig = st.size > o.logBigBytes;
      if (!isBig) continue;
      const stat = await deps.stat(path.join(svcRoot, svc.name)).catch(() => null);
      if (!stat) continue;
      out.push(
        makePrey(
          now,
          "log",
          o.host,
          `huge ${svcName} log (${(st.size / 1024 / 1024).toFixed(1)} MB)`,
          `File ${svc.name} weighs ${st.size} bytes and its last write was ${new Date(st.mtimeMs).toISOString()}.`,
        ),
      );
    }
  }

  // --- Logs con errores frescos (aplicaciones del humano) ----------------
  // Los logs del runtime no se pueden escribir, así que la presa real son las
  // apps: dónde ponga cada quien sus logs.
  const candidateDirs = [
    homeDir,
    path.join(homeDir, "logs"),
    path.join(homeDir, "gatanas-the-michi"),
    tmpDir,
  ];
  for (const dir of candidateDirs) {
    const entries = await deps.listDir(dir).catch(() => []);
    for (const e of entries) {
      if (e.isDir) continue;
      if (!/\.log$|\.err$/i.test(e.name)) continue;
      const full = path.join(dir, e.name);
      const st = await deps.stat(full).catch(() => null);
      if (!st) continue;
      if (!fresh(st.mtimeMs / 1000, now, o.freshSec)) continue;
      if (st.size > 2 * 1024 * 1024) continue;
      const raw = await deps.readFile(full).catch(() => "");
      if (!raw) continue;
      const lines = raw.split("\n");
      if (lines.length < 2) continue;
      const errors = lines.filter((l) => /\b(error|fatal|panic|traceback|exception)\b/i.test(l));
      if (errors.length < 2) continue;
      out.push(
        makePrey(
          now,
          "log",
          o.host,
          `fresh errors in ${e.name}`,
          errors.slice(-8).join("\n").slice(0, 4000),
        ),
      );
    }
  }

  // --- Logs de los servicios del runtime (si el gato puede leerlos) ------
  const logDir = path.join(spriteDir, "logs", "services");
  const logs = await deps.listDir(logDir).catch(() => []);
  for (const log of logs) {
    if (!log.name.endsWith(".log")) continue;
    const full = path.join(logDir, log.name);
    const st = await deps.stat(full).catch(() => null);
    if (!st) continue;
    if (!fresh(st.mtimeMs / 1000, now, o.freshSec)) continue;
    if (st.size > 8 * 1024 * 1024) continue;
    const raw = await deps.readFile(full).catch(() => "");
    if (!raw) continue;
    const lines = raw.split("\n");
    if (lines.length < 2) continue;
    const errors = lines.filter((l) => /\b(error|fatal|panic|traceback|exception)\b/i.test(l));
    if (errors.length >= 3) {
      out.push(
        makePrey(
          now,
          "log",
          o.host,
          `fresh errors in ${log.name}`,
          errors.slice(-8).join("\n").slice(0, 4000),
        ),
      );
    }
  }

  // --- Caja de arena llena: /tmp descontrolado ---------------------------
  const tmpEntries = await deps.listDir(tmpDir).catch(() => []);
  let tmpBytes = 0;
  let tmpCount = 0;
  for (const e of tmpEntries) {
    tmpCount += 1;
    if (!e.isDir) {
      tmpBytes += e.size;
    } else {
      // Un directorio en /tmp esconde lo que lleve dentro: el gato escarba un
      // nivel. Si no puede, al menos cuenta la carpeta.
      for (const inner of await deps.listDir(path.join(tmpDir, e.name)).catch(() => [])) {
        if (!inner.isDir) tmpBytes += inner.size;
      }
    }
  }
  if (tmpBytes > 512 * 1024 * 1024) {
    out.push(
      makePrey(
        now,
        "arena",
        o.host,
        `litter box (${tmpDir}) full`,
        `${(tmpBytes / 1024 / 1024).toFixed(0)} MB across loose files in ${tmpCount} entries.`,
      ),
    );
  }

  // --- Casa del gato: por si el acta se corrompió -----------------------
  const acta = path.join(homeDir, ".gatanas", "memory.json");
  const actaStat = await deps.stat(acta).catch(() => null);
  if (actaStat && actaStat.size > 4 * 1024 * 1024) {
    out.push(makePrey(now, "disk", o.host, "fat acta (memory.json)", `memory.json weighs ${actaStat.size} bytes.`));
  }

  return out;
}

/** Medidor de disco tolerante: en modo test no hay disco real que mirar. */
async function statfsSafe(deps: CollectDeps): Promise<{ total: number; free: number } | null> {
  if (deps.statfs) return deps.statfs();
  if (process.env.GATANAS_TEST_STATFS) {
    try {
      return JSON.parse(process.env.GATANAS_TEST_STATFS) as { total: number; free: number };
    } catch {
      return null;
    }
  }
  try {
    const { statfs } = await import("node:fs/promises");
    const s = await statfs("/");
    return { total: s.blocks * s.bsize, free: s.bavail * s.bsize };
  } catch {
    void deps;
    return null;
  }
}

/** Construye las dependencias reales de un Sprite. */
export function realDeps(): CollectDeps {
  return {
    now: () => Date.now(),
    readFile: (p) => fs.readFile(p, "utf8"),
    listDir: async (p) => {
      const entries = await fs.readdir(p, { withFileTypes: true });
      const out: { name: string; isDir: boolean; size: number }[] = [];
      for (const e of entries) {
        let size = 0;
        if (!e.isDirectory()) {
          size = await fs.stat(path.join(p, e.name)).then((s) => s.size).catch(() => 0);
        }
        out.push({ name: e.name, isDir: e.isDirectory(), size });
      }
      return out;
    },
    stat: async (p) => {
      try {
        const s = await fs.stat(p);
        return { size: s.size, mtimeMs: s.mtimeMs };
      } catch {
        return null;
      }
    },
  };
}
