import type { Lang } from './i18n';

// Crops the backend has price + decision data for (keys = backend commodity ids).
// Keep in sync with the saved dataset (backend src/data/prices.generated.json).
export type Crop = { key: string; hi: string; en: string; emoji: string };

export const CROPS: Crop[] = [
  { key: 'onion', hi: 'प्याज', en: 'Onion', emoji: '🧅' },
  { key: 'tomato', hi: 'टमाटर', en: 'Tomato', emoji: '🍅' },
  { key: 'soybean', hi: 'सोयाबीन', en: 'Soybean', emoji: '🫘' },
  { key: 'maize', hi: 'मक्का', en: 'Maize', emoji: '🌽' },
  { key: 'wheat', hi: 'गेहूँ', en: 'Wheat', emoji: '🌾' },
  { key: 'bajra', hi: 'बाजरा', en: 'Bajra', emoji: '🟤' },
  { key: 'gram', hi: 'चना', en: 'Gram', emoji: '🫛' },
  { key: 'pomegranate', hi: 'अनार', en: 'Pomegranate', emoji: '🍎' },
];

export function cropLabel(key: string, lang: Lang): string {
  const c = CROPS.find((x) => x.key === key);
  if (!c) return key;
  return lang === 'hi' ? c.hi : c.en;
}
