/**
 * Configuración de Gatanás The Michi.
 *
 * Todo lo que el gato necesita saber de su entorno vive aquí. Nada de esto es
 * secreto: el token de OpenRouter NUNCA toca el Sprite. Las llamadas al modelo
 * pasan por el conector de Sprites usando la identidad del propio Sprite.
 */
import os from "node:os";
import path from "node:path";

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : fallback;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export type ModelTask = "diet" | "meow" | "chat" | "digest";

export interface GatanasConfig {
  /** Nombre del gato. Se puede rebautizar sin tocar código. */
  name: string;
  /** Puerto HTTP. El proxy del Sprite enruta su URL pública aquí. */
  port: number;
  /** Nombre del Sprite en el plano de control (checkpoints, servicios). */
  spriteName: string;
  /** Raíz de la casa del gato (su disco persistente). */
  home: string;
  /** Dirección base del Sprite para alcanzar el gateway de Sprites. */
  spriteBaseUrl: string;
  /** URL del gateway. Cambia solo si Fly cambia el formato. */
  gatewayBase: string;
  /** Conexión de OpenRouter en el gateway. */
  openrouterConnection: string;
  /** Modelos por tarea: barato para cazar, un poco mejor para charlar. */
  models: Record<ModelTask, string>;
  /** Frecuencia de las rondas de cacería, en segundos. 0 desactiva. */
  huntIntervalSec: number;
  /** Hosts que el gato vigila (además de los seriales del host). */
  watchHosts: string[];
  /** Hosts que el gato se permite gimotear para que los reinicien. */
  restartableHosts: string[];
  /** Número de vidas: cuántos checkpoints puede gastar. */
  lives: number;
  /** Cuántos regalos se guardan en el altar. */
  altarCapacity: number;
  /** Presupuesto diario de tokens de OpenRouter (0 = sin límite). */
  dailyTokenBudget: number;
  /** Y un tope de gasto más honesto: cuidamos los 6.66 USD de la API. */
  dailyBudgetUsd: number;
  /** Pushover (opcional): user key y app token se configuran en el conector. */
  pushover: boolean;
  /** Modo demo: acelera el filtro de novedad para que el video sea ensayable. */
  demoMode: boolean;
  /** Timeout de las llamadas al modelo, en ms. */
  modelTimeoutMs: number;
}

export const ROOT = path.resolve(import.meta.dirname ?? ".", "..");

export function loadConfig(overrides: Partial<GatanasConfig> = {}): GatanasConfig {
  const demoMode = env("GATANAS_DEMO", "0") === "1";
  const cfg: GatanasConfig = {
    name: env("GATANAS_NAME", "Gatanás The Michi"),
    port: num("PORT", 8080),
    spriteName: env("SPRITE_NAME", "gatanas-the-michi"),
    home: env("GATANAS_HOME", path.join(os.homedir(), ".gatanas")),
    spriteBaseUrl: env("SPRITES_BASE_URL", "https://api.sprites.dev"),
    gatewayBase: env("SPRITES_GATEWAY", "https://api.sprites.dev/v1/gateway"),
    openrouterConnection: env("OPENROUTER_CONNECTION", "BQCIyKoHE5fYfVaZy5gDbg"),
    models: {
      diet: env("GATANAS_MODEL_DIET", "z-ai/glm-5.3-flash"),
      meow: env("GATANAS_MODEL_MEOW", "z-ai/glm-5.3-flash"),
      chat: env("GATANAS_MODEL_CHAT", "z-ai/glm-5.3-flash"),
      digest: env("GATANAS_MODEL_DIGEST", "z-ai/glm-5.3-flash"),
    },
    huntIntervalSec: num("GATANAS_HUNT_INTERVAL_SEC", 900),
    watchHosts: env("GATANAS_WATCH_HOSTS", "gatanas-the-michi localhost 127.0.0.1")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    restartableHosts: env("GATANAS_RESTARTABLE_HOSTS", "gatanas-the-michi localhost 127.0.0.1")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    lives: num("GATANAS_LIVES", 9),
    altarCapacity: num("GATANAS_ALTAR_CAPACITY", 200),
    dailyTokenBudget: num("GATANAS_DAILY_TOKEN_BUDGET", 40_000),
    dailyBudgetUsd: num("GATANAS_DAILY_BUDGET_USD", 0.5),
    pushover: env("GATANAS_PUSHOVER", "0") === "1",
    demoMode,
    modelTimeoutMs: num("GATANAS_MODEL_TIMEOUT_MS", 30_000),
  };
  return { ...cfg, ...overrides };
}

/** Margen de tiempo (s) para decidir que un evento es "fresco" en una ronda. */
export function freshnessWindowSec(cfg: GatanasConfig): number {
  if (cfg.demoMode) return 120;
  return Math.max(180, cfg.huntIntervalSec + 90);
}
