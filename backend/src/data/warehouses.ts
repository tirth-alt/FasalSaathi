/**
 * Curated WDRA/PACS warehouse list for the demo region (Indore/Dewas/Ujjain
 * cluster). No public WDRA API exists, so this is a hand-curated FIXTURE served
 * behind the repository pattern (see lib/repositories.ts).
 *
 * cost_per_quintal_month is kept consistent with the eNWR storage constant family
 * (~₹20/quintal/month — see lib/decision.ts STORAGE_PER_QUINTAL_MONTH), varying
 * a little per warehouse.
 */

export interface Warehouse {
  warehouse_id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  /** Storage capacity in metric tonnes. */
  capacity: number;
  /** Storage cost in ₹ per quintal per month. */
  cost_per_quintal_month: number;
}

const STATE = 'Madhya Pradesh';

export const WAREHOUSES: readonly Warehouse[] = [
  { warehouse_id: 'WH-IND-01', name: 'CWC Warehouse Indore', district: 'Indore', state: STATE, lat: 22.7044, lng: 75.8741, capacity: 12000, cost_per_quintal_month: 20 },
  { warehouse_id: 'WH-IND-02', name: 'PACS Storage Mhow', district: 'Indore', state: STATE, lat: 22.5601, lng: 75.7689, capacity: 4000, cost_per_quintal_month: 18 },
  { warehouse_id: 'WH-DEW-01', name: 'WDRA Warehouse Dewas', district: 'Dewas', state: STATE, lat: 22.9560, lng: 76.0610, capacity: 9000, cost_per_quintal_month: 22 },
  { warehouse_id: 'WH-DEW-02', name: 'PACS Godown Sonkatch', district: 'Dewas', state: STATE, lat: 22.9790, lng: 76.3380, capacity: 3500, cost_per_quintal_month: 17 },
  { warehouse_id: 'WH-UJJ-01', name: 'SWC Warehouse Ujjain', district: 'Ujjain', state: STATE, lat: 23.1720, lng: 75.7990, capacity: 8000, cost_per_quintal_month: 21 },
  { warehouse_id: 'WH-UJJ-02', name: 'PACS Storage Tarana', district: 'Ujjain', state: STATE, lat: 23.3300, lng: 76.0380, capacity: 3000, cost_per_quintal_month: 19 },
  { warehouse_id: 'WH-IND-03', name: 'Adani Agri Logistics Indore', district: 'Indore', state: STATE, lat: 22.8010, lng: 75.9120, capacity: 15000, cost_per_quintal_month: 24 },
];
