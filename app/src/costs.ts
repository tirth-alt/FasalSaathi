// Client-side estimate of the cost to take produce to a mandi. The backend has no
// transport/labour source, so we use national-average agriculture constants
// (documented in INTEGRATION-GAPS.md). Clearly labelled as estimates in the UI.

export const TRANSPORT_PER_QTL_KM = 8; // ₹ per quintal per km (hired vehicle, small farmer)
export const LABOUR_PER_QTL = 20; // ₹ per quintal (loading + unloading)
export const COMMISSION_PCT = 2; // arhtiya commission, % of sale value

export type CostBreakdown = {
  transport: number;
  labour: number;
  commission: number;
  totalCost: number;
  netInHand: number; // gross sale − transport − labour − commission
};

export function estimateCost(
  pricePerQtl: number,
  quintals: number,
  distanceKm: number | null,
): CostBreakdown {
  const dist = distanceKm ?? 0;
  const transport = Math.round(TRANSPORT_PER_QTL_KM * dist * quintals);
  const labour = Math.round(LABOUR_PER_QTL * quintals);
  const gross = pricePerQtl * quintals;
  const commission = Math.round((COMMISSION_PCT / 100) * gross);
  const totalCost = transport + labour + commission;
  return { transport, labour, commission, totalCost, netInHand: Math.round(gross - totalCost) };
}
