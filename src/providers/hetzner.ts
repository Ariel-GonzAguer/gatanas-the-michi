/**
 * Hetzner: el proveedor que habita los otros Sprite.
 *
 * Gatanás no vive ahí. Gatanás los vigila. Cuando uno gime, lo convierte en
 * tofu fermentado; si el humano le dio permiso sobre ese nombre, lo reinicia.
 */
import type { Prey } from "../prey.js";

export interface HetznerServer {
  id: number;
  name: string;
  status: string;
  created: string;
}

export interface HetznerIssue {
  server: HetznerServer;
  summary: string;
  action: "none" | "restart" | "alert";
  evidence: string;
}

export interface HetznerClient {
  list(): Promise<HetznerServer[]>;
  restart(id: number): Promise<void>;
}

/** Cliente real: habla con la API de Hetzner usando el token guardado. */
export function hetznerClient(baseUrl: string, token: string): HetznerClient {
  const base = baseUrl.replace(/\/$/, "");
  return {
    async list() {
      const res = await fetch(`${base}/v1/servers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Hetzner list ${res.status}: ${text.slice(0, 200)}`);
      const json = JSON.parse(text) as { servers?: HetznerServer[] };
      return json.servers ?? [];
    },
    async restart(id: number) {
      const res = await fetch(`${base}/v1/servers/${id}/actions/reboot`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Hetzner reboot ${res.status}`);
    },
  };
}

/**
 * Reglas del ojo felino:
 *  - `off` u `unknown` (servidor detenido) desde hace más de `staleHours` →
 *    presa grave. Acción: reiniciar si el humano lo permitió para ese nombre.
 *  - `starting` o `initializing` → el gato espera, aunque ronronee de impaciencia.
 *  - `running` → sano. Un servidor corriendo no necesita que lo miren.
 */
export async function inspectServers(
  servers: HetznerServer[],
  opts: { restartable: (name: string) => boolean; nowMs: number; staleHours?: number },
): Promise<HetznerIssue[]> {
  const out: HetznerIssue[] = [];
  const staleHours = opts.staleHours ?? 72;

  for (const server of servers) {
    if (server.status === "running" || server.status === "starting" || server.status === "initializing") {
      continue;
    }
    const createdMs = Date.parse(server.created);
    const ageH = Number.isFinite(createdMs) ? (opts.nowMs - createdMs) / 3_600_000 : 0;
    const stale = ageH > staleHours;
    out.push({
      server,
      summary: `servidor ${server.name} apagado (${server.status})`,
      action: stale ? (opts.restartable(server.name) ? "restart" : "alert") : "alert",
      evidence:
        `id ${server.id}, estado ${server.status}, creado ${server.created}, ` +
        `${ageH.toFixed(1)} h de vida. ${stale ? "Podrido." : "Aún fresco."}`,
    });
  }
  return out;
}

export function toPrey(issue: HetznerIssue, now: number): Prey {
  const at = new Date(now).toISOString();
  return {
    key: `hetzner:${issue.summary}`.toLowerCase().replace(/\s+/g, " ").slice(0, 200),
    category: "certificate",
    title: issue.summary,
    evidence: issue.evidence,
    host: "hetzner",
    sightings: 1,
    firstSeenAt: at,
    lastSeenAt: at,
  };
}
