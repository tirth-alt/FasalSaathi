import type { Lang } from './i18n';

// Crops the backend has price + decision data for (keys = backend commodity ids).
// Keep keys in sync with backend COMMODITY_BASE (src/data/prices.ts).
export type Crop = { key: string; hi: string; en: string; emoji: string };

export const CROPS: Crop[] = [
  { key: 'soybean', hi: 'सोयाबीन', en: 'Soybean', emoji: '🫘' },
  { key: 'wheat', hi: 'गेहूँ', en: 'Wheat', emoji: '🌾' },
  { key: 'onion', hi: 'प्याज', en: 'Onion', emoji: '🧅' },
  { key: 'potato', hi: 'आलू', en: 'Potato', emoji: '🥔' },
  { key: 'maize', hi: 'मक्का', en: 'Maize', emoji: '🌽' },
  { key: 'cotton', hi: 'कपास', en: 'Cotton', emoji: '☁️' },
  { key: 'gram', hi: 'चना', en: 'Gram', emoji: '🫛' },
  { key: 'mustard', hi: 'सरसों', en: 'Mustard', emoji: '🌼' },
  { key: 'tomato', hi: 'टमाटर', en: 'Tomato', emoji: '🍅' },
  { key: 'paddy', hi: 'धान', en: 'Paddy', emoji: '🌾' },
];

export function cropLabel(key: string, lang: Lang): string {
  const c = CROPS.find((x) => x.key === key);
  if (!c) return key;
  return lang === 'hi' ? c.hi : c.en;
}

export function cropByLabel(label: string, lang: Lang): Crop | undefined {
  return CROPS.find((c) => (lang === 'hi' ? c.hi : c.en) === label);
}
