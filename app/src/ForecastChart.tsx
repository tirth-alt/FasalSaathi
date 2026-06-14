import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors } from './theme';

type Pt = { day: number; price: number };

/** Line chart of the last-10-days history (muted) + the model's 45-day forecast
 *  (accent), split by a dashed "today" divider. Pure SVG, scales to width. */
export function ForecastChart({ history, curve }: { history: Pt[]; curve: Pt[] }) {
  const W = 320;
  const H = 150;
  const PAD = 10;
  const all = [...history, ...curve];
  const days = all.map((p) => p.day);
  const prices = all.map((p) => p.price);
  const minD = Math.min(...days);
  const maxD = Math.max(...days);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const spanD = maxD - minD || 1;
  const spanP = maxP - minP || 1;
  const x = (d: number) => PAD + ((d - minD) / spanD) * (W - 2 * PAD);
  const y = (p: number) => PAD + (1 - (p - minP) / spanP) * (H - 2 * PAD);
  const pts = (arr: Pt[]) => arr.map((p) => `${x(p.day).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ');

  const anchor = history[history.length - 1];
  const todayX = x(0);

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Line x1={todayX} y1={PAD} x2={todayX} y2={H - PAD} stroke={colors.hairline} strokeWidth={1} strokeDasharray="4 4" />
        <Polyline points={pts(history)} fill="none" stroke={colors.muted} strokeWidth={2} />
        <Polyline points={pts([anchor, ...curve])} fill="none" stroke={colors.accent} strokeWidth={2.5} />
        <Circle cx={todayX} cy={y(anchor.price)} r={3.5} fill={colors.accent} />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>last 10 days</Text>
        <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '700' }}>45-day forecast →</Text>
      </View>
    </View>
  );
}
