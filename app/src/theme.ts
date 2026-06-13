export type TabKey = 'home' | 'prices' | 'sell' | 'learn' | 'soil';

export const colors = {
  canvas: '#FAF6F0',
  surface: '#FFFFFF',
  soft: '#FFE9D5',
  accent: '#E2915C',
  accentDark: '#BC6A36',
  ink: '#23201C',
  muted: '#6F6A63',
  faint: '#A8A29E',
  hairline: '#EFE6DA',
  up: '#15803D',
  upBg: '#DCFCE7',
  warn: '#B45309',
  warnBg: '#FEF3C7',
  neg: '#DC2626',
  negBg: '#FEE2E2',
  neutralPill: '#F3ECE0',
};

// Indian-grouped number formatting (sufficient for our <1,00,000 demo values).
export function inr(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
