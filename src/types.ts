/**
 * Tipos públicos de Gatanás. Reexporta lo que otros módulos y las pruebas
 * necesitan, para que nadie importe archivos internos por accidente.
 */
export type { Gift, GiftKind, Prey, PreyCategory, PatrolResult } from "./prey.js";
export type { GatanasConfig } from "./config.js";
export type { GatanasMemory, LifeEvent, CheckpointRef } from "./memory.js";
export type { Opinion } from "./opinion-types.js";
export type { WalletState } from "./wallet.js";
export type { AltarSnapshot } from "./altar.js";
export type { HuntOutcome } from "./hunt.js";
