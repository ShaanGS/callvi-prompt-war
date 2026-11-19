/**
 * The address per-client rate limits are keyed on.
 *
 * The left-most X-Forwarded-For entry is whatever the client chose to send, so
 * keying on it lets anyone dodge a limit by inventing a new address per
 * request. Instead this trusts, in order:
 *
 * 1. x-vercel-forwarded-for, which Vercel's edge sets and clients cannot
 *    override.
 * 2. The right-most X-Forwarded-For entry, which the nearest proxy appended
 *    (Cloud Run's front end, or Next's own dev server). Behind an extra proxy
 *    this is that proxy's address, which errs towards limiting too much rather
 *    than too little.
 */
export function clientIp(headers: Pick<Headers, "get">): string {
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const hops = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return hops.at(-1) ?? "local";
}
