import type { SoilReport, SoilSample } from './types';

const num = (re: RegExp, s: string): number | undefined => {
  const m = s.match(re);
  return m ? Number(m[1]) : undefined;
};

/** Best-effort single-sample parse from a flat OCR string. Multi-sample tables
 *  are out of scope for the demo; the pre-staged SAMPLE_REPORT covers that. */
export function parseReportText(text: string): SoilReport {
  const id = text.match(/Sample\s*(?:ID)?[:\s]+([A-Z]\d+)/i)?.[1];
  const pH = num(/\bpH\s*[:\s]\s*([\d.]+)/i, text);
  const cec = num(/CEC\s*[:\s]\s*([\d.]+)/i, text);
  const N = num(/\bN\s*[:\s]\s*([\d.]+)/i, text);
  const P2O5 = num(/P2O5\s*[:\s]\s*([\d.]+)/i, text);
  const K2O = num(/K2O\s*[:\s]\s*([\d.]+)/i, text);
  const limeTonsAcre = num(/Lime\s*[:\s]\s*([\d.]+)/i, text);

  if (id == null && pH == null) return { samples: [], units: 'US', source: 'OCR' };
  const sample: SoilSample = {
    id: id ?? 'S1', pH, cec,
    recommendations: { N, P2O5, K2O, limeTonsAcre },
  };
  return { samples: [sample], units: 'US', source: 'OCR' };
}
