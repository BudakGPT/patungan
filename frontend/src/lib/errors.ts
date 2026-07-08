import { Errors } from "@/contract/src";
import { strings } from "@/strings";

/**
 * Maps a write-tx failure to Bahasa copy. Contract rejections surface two
 * ways: an on-chain `result.isErr()` carries the bare variant name ("NotVerified"), but most
 * rejections fail at SIMULATION time and are thrown as raw SDK strings embedding
 * `Error(Contract, #N)` — extract the code and translate via the bindings' `Errors` map. Never
 * render raw internals: any variant a caller's `messages` omits falls back to the shared
 * `strings.errors` dictionary, and unknown failures to `.generic`.
 */
export function mapContractError(
  err: unknown,
  messages: Record<string, string> = {},
): string {
  const dict = { ...strings.errors, ...messages };
  const raw =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);
  if (/reject|declin|cancel/i.test(raw)) return dict.rejected ?? dict.generic;
  if (dict[raw]) return dict[raw];
  const code = raw.match(/Error\(Contract, #(\d+)\)/)?.[1];
  const variant = code
    ? (Errors as Record<number, { message: string }>)[Number(code)]?.message
    : undefined;
  if (variant && dict[variant]) {
    return dict[variant];
  }
  console.error("contract call failed:", raw);
  return dict.generic;
}
