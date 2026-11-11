import { getSupabase } from "./supabase/client";
import type { PinRarity } from "./pins/catalog";

// Client use only: getSupabase() is the browser client.
// Credits and pins are written only by the `award_credit` and `pull_pin` RPCs (SPEC 18).

export type PinsErrorKind =
  "insufficient" | "collection_complete" | "signin" | "network";

export class PinsError extends Error {
  readonly kind: PinsErrorKind;

  constructor(kind: PinsErrorKind) {
    super(kind);
    this.name = "PinsError";
    this.kind = kind;
  }
}

/** Maps a PostgREST error from an RPC to a PinsError kind. */
function toPinsError(error: { message?: string; code?: string }): PinsError {
  const message = error.message ?? "";
  if (message.includes("insufficient")) return new PinsError("insufficient");
  if (message.includes("collection_complete")) {
    return new PinsError("collection_complete");
  }
  // not_authenticated, or EXECUTE denied for anon (42501).
  if (message.includes("not_authenticated") || error.code === "42501") {
    return new PinsError("signin");
  }
  return new PinsError("network");
}

/** Own credit balance. 0 when the account has no row yet. */
export async function fetchCredits(): Promise<number> {
  const { data, error } = await getSupabase()
    .from("credits")
    .select("balance")
    .maybeSingle();
  if (error) throw error;
  return data?.balance ?? 0;
}

/** Ids of the pins the signed-in account owns. */
export async function fetchOwnedPins(): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("user_pins")
    .select("pin_id");
  if (error) throw error;
  return data.map((r) => r.pin_id);
}

export type AwardReason = "ok" | "zero_score" | "banned" | "too_short";

export interface AwardResult {
  awarded: boolean;
  /** Credits added by this call: 1 per 30 s played, at most 5 per game. */
  credits: number;
  balance: number;
  reason: AwardReason;
}

/**
 * Called once at Game Over with the active play seconds of the run (paused time excluded).
 * The server decides: score > 0, not banned, 1 credit per 30 s played, at most 5, and never
 * more time than really passed since the last award.
 */
export async function awardCredit(
  gameId: string,
  score: number,
  seconds: number,
): Promise<AwardResult> {
  const { data, error } = await getSupabase().rpc("award_credit", {
    p_game_id: gameId,
    p_score: Math.max(0, Math.min(10_000_000, Math.floor(score))),
    p_seconds: Math.max(0, Math.min(3600, Math.floor(seconds))),
  });
  if (error) throw toPinsError(error);
  return data as unknown as AwardResult;
}

export interface BossAwardResult {
  awarded: boolean;
  /** Credits added by this call (1 per boss defeated). */
  credits: number;
  balance: number;
  reason: "ok" | "banned" | "too_soon" | "daily_cap";
}

/**
 * Robo Vault: +1 credit for a boss defeated (`frostbyte`, `rematch:frostbyte`, `sam`, ...).
 * The server cannot verify a fight, so it rate-limits: at least 3 s between boss awards and
 * at most 30 per 24 hours per user; banned users get nothing.
 */
export async function awardBossCredit(
  gameId: string,
  boss: string,
): Promise<BossAwardResult> {
  const { data, error } = await getSupabase().rpc("award_boss_credit", {
    p_game_id: gameId,
    p_boss: boss,
  });
  if (error) throw toPinsError(error);
  return data as unknown as BossAwardResult;
}

export interface PullResult {
  pinId: string;
  rarity: PinRarity;
  isNew: boolean;
  refund: number;
  balance: number;
}

export async function pullPin(cost: 5 | 10 | 100): Promise<PullResult> {
  const { data, error } = await getSupabase().rpc("pull_pin", {
    p_cost: cost,
  });
  if (error) throw toPinsError(error);
  const r = data as unknown as {
    pin_id: string;
    rarity: PinRarity;
    is_new: boolean;
    refund: number;
    balance: number;
  };
  return {
    pinId: r.pin_id,
    rarity: r.rarity,
    isNew: r.is_new,
    refund: r.refund,
    balance: r.balance,
  };
}
