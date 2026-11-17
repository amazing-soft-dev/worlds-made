/**
 * Cost per call, straight from the spec's formula:
 *   (Tin x Pin + Tout x Pout) / 1,000,000
 * Prices are per million tokens. The repair-pass multiplier (1 + R) applies to a whole build, not to one call.
 */
export function callCostUsd(tokensIn: number, tokensOut: number, priceInPerM: number, priceOutPerM: number): number {
  return (tokensIn * priceInPerM + tokensOut * priceOutPerM) / 1_000_000;
}

/** Cost per build including the share R of builds that need a repair pass. */
export function buildCostUsd(tokensIn: number, tokensOut: number, priceInPerM: number, priceOutPerM: number, repairShare: number): number {
  return callCostUsd(tokensIn, tokensOut, priceInPerM, priceOutPerM) * (1 + repairShare);
}

export function monthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
