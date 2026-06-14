import { View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

type Props = {
  values: number[];
  width: number;
  height?: number;
  labels?: string[]; // x-axis labels (same length as values, or sparse with '')
  low?: number[]; // optional lower band (same length)
  high?: number[]; // optional upper band
  showPointValues?: boolean; // draw the ₹ value above each point (good for ≤8 points)
  highlightLast?: boolean; // emphasize the final point
};

/**
 * Lightweight line chart built on react-native-svg (no chart dependency).
 * Used by F1 (7-day mandi trend, with per-point ₹ labels) and F2 (45-day forecast
 * curve, with a low/high confidence band).
 */
export function LineChart({
  values,
  width,
  height = 180,
  labels,
  low,
  high,
  showPointValues = false,
  highlightLast = false,
}: Props) {
  if (values.length === 0) return <View style={{ height }} />;

  const padX = 14;
  const padTop = showPointValues ? 26 : 14;
  const padBottom = labels ? 24 : 12;
  const innerW = Math.max(1, width - padX * 2);
  const innerH = Math.max(1, height - padTop - padBottom);

  const allVals = [...values, ...(low ?? []), ...(high ?? [])];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const span = max - min || 1;

  const x = (i: number) => padX + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
  const y = (v: number) => padTop + innerH - ((v - min) / span) * innerH;

  const pointStr = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  // Confidence band polygon (high across, then low back).
  let bandPath: string | null = null;
  if (low && high && low.length === values.length && high.length === values.length) {
    const top = high.map((v, i) => `${x(i)},${y(v)}`).join(' L ');
    const bot = low
      .map((v, i) => `${x(i)},${y(v)}`)
      .reverse()
      .join(' L ');
    bandPath = `M ${top} L ${bot} Z`;
  }

  return (
    <Svg width={width} height={height}>
      {/* baseline */}
      <Line x1={padX} y1={padTop + innerH} x2={padX + innerW} y2={padTop + innerH} stroke={colors.hairline} strokeWidth={1} />
      {bandPath ? <Path d={bandPath} fill={colors.soft} opacity={0.6} /> : null}
      <Polyline points={pointStr} fill="none" stroke={colors.accentBold} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => {
        const last = i === values.length - 1;
        const emphasized = highlightLast && last;
        return (
          <Circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r={emphasized ? 6 : 3.5}
            fill={emphasized ? colors.accentDark : colors.surface}
            stroke={colors.accentBold}
            strokeWidth={emphasized ? 3 : 2}
          />
        );
      })}
      {showPointValues
        ? values.map((v, i) => (
            <SvgText
              key={`v${i}`}
              x={x(i)}
              y={y(v) - 10}
              fontSize={i === values.length - 1 ? 12 : 10}
              fontWeight={i === values.length - 1 ? '800' : '600'}
              fill={i === values.length - 1 ? colors.accentDark : colors.muted}
              textAnchor="middle"
            >
              {`₹${v}`}
            </SvgText>
          ))
        : null}
      {labels
        ? labels.map((lab, i) =>
            lab ? (
              <SvgText key={`l${i}`} x={x(i)} y={height - 6} fontSize={10} fill={colors.faint} textAnchor="middle">
                {lab}
              </SvgText>
            ) : null,
          )
        : null}
    </Svg>
  );
}
