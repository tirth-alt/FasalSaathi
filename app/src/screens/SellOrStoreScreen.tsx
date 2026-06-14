import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { BreakdownRow, Card, RiskCallout, StatPill } from '../ui';
import { colors, inr } from '../theme';
import { ForecastChart } from '../ForecastChart';
import forecast from '../data/forecast.json';

export default function SellOrStoreScreen() {
  // Brief loading screen while the (precomputed) model forecast is read.
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <View style={{ paddingTop: 140, alignItems: 'center', gap: 14 }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ fontSize: 15, color: colors.muted, fontWeight: '600' }}>Running the price model…</Text>
      </View>
    );
  }

  const hold = forecast.decision === 'HOLD';

  return (
    <View style={{ gap: 18, paddingBottom: 24 }}>
      <View style={{ gap: 4, paddingTop: 4 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>Sell or store?</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>Model-driven — {forecast.crop}, {forecast.quantity_qtl} quintal</Text>
      </View>

      {/* Input chips */}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <StatPill>Crop: {forecast.crop}</StatPill>
        <StatPill>Qty: {forecast.quantity_qtl} quintal</StatPill>
        <StatPill tone="accent">{forecast.confidence} confidence</StatPill>
      </View>

      {/* Advice hero */}
      <Card tone="soft">
        <View style={{ gap: 10 }}>
          <StatPill tone="accent">Our advice</StatPill>
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.accentDark, lineHeight: 34, letterSpacing: -0.5 }}>
            {hold ? `Wait ~${forecast.waitDays} days — store it.` : 'Sell now.'}
          </Text>
          <Text style={{ fontSize: 14, color: '#78350F', lineHeight: 21 }}>
            {hold
              ? `Prices dipped recently; the model expects a recovery of about ₹${inr(forecast.expectedGainPerQtl)}/quintal over the next ${forecast.waitDays} days.`
              : 'The model sees no meaningful upside beyond storage cost — selling now is the better math.'}
          </Text>
        </View>
      </Card>

      {/* Forecast chart */}
      <Card>
        <View style={{ gap: 4, paddingBottom: 10 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>Price forecast</Text>
          <Text style={{ fontSize: 13, color: colors.muted }}>LightGBM model · next 45 days</Text>
        </View>
        <ForecastChart history={forecast.history} curve={forecast.curve} />
      </Card>

      {/* The math */}
      <Card>
        <View style={{ gap: 4, paddingBottom: 8 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>The math</Text>
          <Text style={{ fontSize: 13, color: colors.muted }}>A calculation, not a guarantee</Text>
        </View>

        <View style={{ backgroundColor: colors.canvas, borderRadius: 14, padding: 14, marginTop: 4, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            If you sell today
          </Text>
          <BreakdownRow label={`${forecast.quantity_qtl} quintal × ₹${inr(forecast.sellNow)}`} value={`₹${inr(forecast.totalSellNow)}`} emphasis />
        </View>

        <View style={{ backgroundColor: colors.soft, borderRadius: 14, padding: 14 }}>
          <Text style={{ fontSize: 13, color: colors.accentDark, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            If you store {forecast.waitDays} days
          </Text>
          <BreakdownRow label={`Est. ₹${inr(forecast.expectedMid)} × ${forecast.quantity_qtl}q`} value={`₹${inr(forecast.totalExpected)}`} />
          <BreakdownRow label="Estimated extra gain" value={`≈ ₹${inr(forecast.totalGain)}`} emphasis sign="+" />
        </View>
      </Card>

      <RiskCallout
        title="Estimates, not guarantees"
        body="Forecasts use historical price patterns; actual mandi prices vary with weather and arrivals."
      />
    </View>
  );
}
