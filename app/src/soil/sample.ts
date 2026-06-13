import type { SoilReport } from './types';

/** Pre-staged transcription of the NCDA&CS demo report. Guarantees the live
 *  demo never depends on OCR/vision succeeding. */
export const SAMPLE_REPORT: SoilReport = {
  source: 'NCDA&CS Predictive Soil Report (demo sample)',
  units: 'US',
  samples: [
    {
      id: 'R1', pH: 6.5, cec: 6.5, baseSatPct: 61,
      indices: { P: 120, K: 30, Mn: 245, Zn: 76, Cu: 118 },
      recommendations: { limeTonsAcre: 0, N: 120, P2O5: 0, K2O: 200 },
    },
    {
      id: 'R2', pH: 5.8, cec: 5.3, baseSatPct: 78,
      indices: { P: 31, K: 41, Mn: 302, Zn: 58 },
      recommendations: { limeTonsAcre: 0.3, N: 120, P2O5: 60, K2O: 200 },
    },
    {
      id: 'B1', pH: 6.0, cec: 7.8, baseSatPct: 78,
      indices: { P: 31, K: 41, Mn: 565, Zn: 71 },
      recommendations: { limeTonsAcre: 0, N: 100, P2O5: 0, K2O: 120 },
    },
  ],
};
