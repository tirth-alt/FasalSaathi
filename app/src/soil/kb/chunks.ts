import type { KbChunk } from '../types';

/** Agronomy facts written for a farmer, not an agronomist. One parameter and one
 *  clear "apply / stop" rule per chunk. */
export const KB_CHUNKS: KbChunk[] = [
  {
    id: 'ph-acidic',
    params: ['pH', 'lime'],
    keywords: ['ph', 'acidic', 'sour', 'lime', 'acid'],
    text: 'If soil pH is below 6.0 the soil is sour (acidic), so the plant cannot take up fertilizer fully. Add lime as per the recommended tons/acre. pH 6.0–7.0 is right for most crops.',
  },
  {
    id: 'ph-ok',
    params: ['pH'],
    keywords: ['ph', 'normal', 'balanced'],
    text: 'If pH is between 6.0 and 7.0 the soil is balanced — no lime needed. Stop adding unnecessary lime; too much can cause zinc and manganese deficiency.',
  },
  {
    id: 'lime-zero',
    params: ['lime'],
    keywords: ['lime', 'tons'],
    text: 'If the report recommends 0 lime, stop adding lime to this field — pH is already fine. It saves money.',
  },
  {
    id: 'p-high',
    params: ['P'],
    keywords: ['phosphorus', 'p-i', 'dap', 'p2o5'],
    text: 'If the phosphorus index (P-I) is above 50 the soil already has plenty of phosphorus. Stop applying phosphorus fertilizers like DAP/SSP — the report P2O5 will also be 0. Excess phosphorus causes zinc deficiency.',
  },
  {
    id: 'p-low',
    params: ['P'],
    keywords: ['phosphorus', 'low', 'dap', 'deficiency'],
    text: 'If the phosphorus index is low (about 25–50), phosphorus is needed for root growth. Apply DAP or SSP as per the P2O5 (lbs/acre) in the report.',
  },
  {
    id: 'k-low',
    params: ['K'],
    keywords: ['potassium', 'potash', 'k-i', 'mop', 'k2o'],
    text: 'If the potassium index (K-I) is low, add potash — MOP (muriate of potash) as per the K2O in the report. Potash helps grain filling and disease tolerance.',
  },
  {
    id: 'n-rec',
    params: ['N'],
    keywords: ['nitrogen', 'urea', 'n'],
    text: 'The nitrogen (N) recommendation is in lbs/acre — give it as urea, but not all at once; split into 2–3 doses so it does not wash away. Too much urea makes the crop lodge and wastes money.',
  },
  {
    id: 'mn-high',
    params: ['Mn'],
    keywords: ['manganese', 'mn-i', 'mn'],
    text: 'If the manganese index is very high, no extra manganese is needed — stop applying it. In very acidic soil manganese can become toxic, so keep pH right with lime.',
  },
  {
    id: 'zn-status',
    params: ['Zn'],
    keywords: ['zinc', 'zn-i', 'zn'],
    text: 'If the zinc index is fine (about 50 or above), no zinc sulphate is needed. If the index is low or phosphorus is very high, apply zinc sulphate about 10 kg/acre.',
  },
  {
    id: 'cec-meaning',
    params: ['cec'],
    keywords: ['cec', 'capacity', 'holding'],
    text: 'CEC is the soil’s capacity to hold nutrients. Low CEC (below 10) means sandy soil — give fertilizer in small, frequent doses or it washes away.',
  },
  {
    id: 'base-sat',
    params: ['baseSat'],
    keywords: ['base saturation', 'bs%', 'saturation'],
    text: 'Base saturation (BS%) shows how full the soil is with calcium, magnesium and potassium. Above 60% is good. If very low, lime or gypsum improves it.',
  },
];
