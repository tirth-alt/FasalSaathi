import { Text, View } from 'react-native';
import { BreakdownRow, Card, RiskCallout, StatPill } from '../ui';
import { useCountUp } from '../MicButton';
import { colors, inr } from '../theme';

export default function SellOrStoreScreen() {
  const gain = useCountUp(2615);

  return (
    <View style={{ gap: 18, paddingBottom: 24 }}>
      <View style={{ gap: 4, paddingTop: 4 }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: colors.ink }}>Sell or store?</Text>
        <Text style={{ fontSize: 15, color: colors.muted }}>The honest math, your decision</Text>
      </View>

      {/* Input chips */}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <StatPill>Crop: Soybean</StatPill>
        <StatPill>Qty: 5 quintal</StatPill>
        <StatPill>Need: ₹15,000</StatPill>
      </View>

      {/* Advice hero */}
      <Card tone="soft">
        <View style={{ gap: 10 }}>
          <StatPill tone="accent">Our advice</StatPill>
          <Text style={{ fontSize: 30, fontWeight: '900', color: colors.accentDark, lineHeight: 36, letterSpacing: -0.5 }}>
            Wait 3 weeks — store it.
          </Text>
          <Text style={{ fontSize: 15, color: '#78350F', lineHeight: 22 }}>
            Prices are climbing and a pledge loan can cover your cash need today — no need to sell low.
          </Text>
        </View>
      </Card>

      {/* The math */}
      <Card>
        <View style={{ gap: 4, paddingBottom: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink }}>The math</Text>
          <Text style={{ fontSize: 14, color: colors.muted }}>A calculation, not a prediction</Text>
        </View>

        <View style={{ backgroundColor: colors.canvas, borderRadius: 14, padding: 14, marginTop: 4, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            If you sell today
          </Text>
          <BreakdownRow label="5 quintal × net ₹4,437" value="₹22,185" emphasis />
        </View>

        <View style={{ backgroundColor: colors.soft, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.softBorder }}>
          <Text style={{ fontSize: 13, color: colors.accentDark, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            If you store 3 weeks
          </Text>
          <BreakdownRow label="Est. price 5,000 × 5q" value="₹25,000" />
          <BreakdownRow label="Storage" value="₹135" sign="−" />
          <BreakdownRow label="Interest" value="₹65" sign="−" />
          <BreakdownRow label="Estimated extra gain" value={`≈ ₹${inr(gain)}`} emphasis sign="+" />
        </View>
      </Card>

      {/* Pledge loan */}
      <Card>
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink }}>Need cash now?</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.upBg,
              borderRadius: 14,
              padding: 16,
            }}
          >
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 14, color: colors.up, fontWeight: '800' }}>Pledge loan (eNWR, 70%)</Text>
              <Text style={{ fontSize: 28, fontWeight: '900', color: colors.up }}>₹16,275</Text>
            </View>
          </View>
          <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 21 }}>
            Covers your ₹15,000 need — no need to sell.
          </Text>
        </View>
      </Card>

      {/* Risk */}
      <RiskCallout
        title="Rain expected · next 3 days"
        body="Stored in the open, moisture could cut your price. A warehouse keeps it safe."
      />
    </View>
  );
}
