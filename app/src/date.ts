import type { Lang } from './i18n';

const MONTHS: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  hi: ['जन', 'फ़र', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुल', 'अग', 'सित', 'अक्ट', 'नव', 'दिस'],
};

/** "2026-06-13" -> "13 Jun" / "13 जून". */
export function formatShort(iso: string, lang: Lang): string {
  const parts = iso.split('-').map(Number);
  const m = parts[1];
  const d = parts[2];
  if (!m || !d) return iso;
  return `${d} ${MONTHS[lang][m - 1]}`;
}
