import { Text, View } from 'react-native';
import { BreakdownRow, Card, DeltaPill, StatPill } from '../ui';
import { useCountUp } from '../MicButton';
import { colors, inr } from '../theme';

const MANDIS = [
  { name: 'Indore', price: '₹4,710', distance: '42 km away', best: true },
  { name: 'Sehore', price: '₹4,690', distance: '38 km away' },
  { name: 'Ujjain', price: '₹4,580', distance: '55 km away' },
  { name: 'Khargone', price: '₹4,610', distance: '70 km away' },
];

export default function PricesScreen() {
  const net = useCountUp(4437);

  return (
    <View style={{ gap: 18, paddingBottom: 24 }}>
      <View style={{ gap: 4, paddingTop: 4 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>Price compass</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>Soybean · Dewas region</Text>
      </View>

      {/* Price card */}
      <Card tone="soft">
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.accentDark }}>Soybean</Text>
            <StatPill tone="accent">Today's rate</StatPill>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ fontSize: 44, fontWeight: '900', color: colors.accentDark, letterSpacing: -1 }}>₹4,650</Text>
            <Text style={{ fontSize: 15, color: colors.accentDark, fontWeight: '600' }}>/quintal</Text>
          </View>
          <Text style={{ fontSize: 14, color: colors.accentDark, fontWeight: '500' }}>Low ₹4,400 · High ₹4,800</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <DeltaPill value={3} period="(7d)" />
            <DeltaPill value={8} period="(30d)" />
          </View>
        </View>
      </Card>

      {/* Net in hand */}
      <Card>
        <View style={{ gap: 4, paddingBottom: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>What you actually get</Text>
          <Text style={{ fontSize: 13, color: colors.muted }}>Net in hand, per quintal</Text>
        </View>
        <BreakdownRow label="Mandi price" value="₹4,650" />
        <BreakdownRow label="Transport" value="₹120" sign="−" />
        <BreakdownRow label="Commission" sub="2% of mandi price" value="₹93" sign="−" />
        <BreakdownRow label="Net in hand" value={`₹${inr(net)}`} emphasis />
      </Card>

      {/* Nearby mandis */}
      <Card>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink, paddingBottom: 4 }}>Nearby mandis</Text>
        {MANDIS.map((r, i) => (
          <View
            key={r.name}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 14,
              borderBottomWidth: i === MANDIS.length - 1 ? 0 : 1,
              borderBottomColor: colors.hairline,
            }}
          >
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>{r.name}</Text>
                {r.best ? <StatPill tone="up">Best</StatPill> : null}
              </View>
              <Text style={{ fontSize: 13, color: colors.muted }}>{r.distance}</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>{r.price}</Text>
          </View>
        ))}
      </Card>

      {/* Negotiation help */}
      <Card tone="soft">
        <View style={{ gap: 10 }}>
          <StatPill tone="accent">Negotiation help</StatPill>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 14, color: colors.muted }}>Trader is offering</Text>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#DC2626' }}>₹4,200</Text>
            <Text style={{ fontSize: 13, color: colors.accentDark, fontWeight: '600' }}>
              That's 10% below today's rate.
            </Text>
          </View>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 14,
              borderLeftWidth: 3,
              borderLeftColor: colors.accent,
            }}
          >
            <Text style={{ fontSize: 14, color: colors.ink, lineHeight: 21, fontStyle: 'italic' }}>
              "Dewas is running at ₹4,650 — nothing under ₹4,600."
            </Text>
          </View>
        </View>
      </Card>
    </View>
  );
}
