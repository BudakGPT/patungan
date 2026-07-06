import { Errors } from "@/contract/src";

/**
 * Maps a write-tx failure to Bahasa copy (§7 B2/C edge cases). Contract rejections surface two
 * ways: an on-chain `result.isErr()` carries the bare variant name ("NotVerified"), but most
 * rejections fail at SIMULATION time and are thrown as raw SDK strings embedding
 * `Error(Contract, #N)` — extract the code and translate via the bindings' `Errors` map. Never
 * render raw internals: unknown failures fall back to `messages.generic`.
 */
export function mapContractError(err: unknown, messages: Record<string, string>): string {
  const raw =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);
  if (/reject|declin|cancel/i.test(raw)) return messages.rejected ?? messages.generic;
  if (messages[raw]) return messages[raw];
  const code = raw.match(/Error\(Contract, #(\d+)\)/)?.[1];
  const variant = code
    ? (Errors as Record<number, { message: string }>)[Number(code)]?.message
    : undefined;
  if (variant && messages[variant]) {
    return messages[variant];
  }
  console.error("contract call failed:", raw);
  return messages.generic;
}
