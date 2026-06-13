import { Text, View } from 'react-native';
import { Camera } from 'lucide-react-native';
import { Card, SchemeRow } from '../ui';
import { Touchable } from '../primitives';
import { colors } from '../theme';

export default function LearnScreen() {
  return (
    <View style={{ gap: 18, paddingBottom: 24 }}>
      <View style={{ gap: 4, paddingTop: 4 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>Learn</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>Your soil card & schemes, in plain words</Text>
      </View>

      {/* Primary CTA */}
      <Touchable style={{ width: '100%' }} pressScale={0.97}>
        <View
          style={{
            backgroundColor: colors.accent,
            borderRadius: 20,
            padding: 22,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            minHeight: 96,
            shadowColor: colors.accent,
            shadowOpacity: 0.45,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            elevation: 8,
          }}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Camera size={32} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <View style={{ gap: 4, flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF', lineHeight: 23 }}>
              Photograph your Soil Health Card
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.92)' }}>
              We'll explain it in plain language
            </Text>
          </View>
        </View>
      </Touchable>

      {/* NPK from card */}
      <Card>
        <View style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>From your card</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>Example reading</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <NPKTile letter="N" name="Nitrogen" status="Low" tone="neg" />
            <NPKTile letter="P" name="Phosphorus" status="OK" tone="up" />
            <NPKTile letter="K" name="Potassium" status="High" tone="warn" />
          </View>

          <View
            style={{
              backgroundColor: colors.soft,
              borderRadius: 14,
              padding: 14,
              borderLeftWidth: 3,
              borderLeftColor: colors.accent,
            }}
          >
            <Text style={{ fontSize: 13, color: colors.accentDark, fontWeight: '700', paddingBottom: 4 }}>This time</Text>
            <Text style={{ fontSize: 14, color: colors.ink, lineHeight: 21 }}>
              Use 1 bag less urea, add DAP. No potash needed.
            </Text>
          </View>
        </View>
      </Card>

      {/* Schemes */}
      <Card>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink, paddingBottom: 4 }}>Government schemes</Text>
        <SchemeRow emoji="🏷️" title="MSP — Minimum Support Price" desc="The government's guaranteed floor price" />
        <SchemeRow emoji="🏦" title="eNWR Pledge Loan" desc="Borrow up to 70% against stored crop" />
        <SchemeRow emoji="🌱" title="Soil Health Card" desc="Your soil report — which fertilizer, how much" last />
      </Card>
    </View>
  );
}

function NPKTile({
  letter,
  name,
  status,
  tone,
}: {
  letter: string;
  name: string;
  status: string;
  tone: 'up' | 'warn' | 'neg';
}) {
  const map: Record<'up' | 'warn' | 'neg', { bg: string; fg: string; ring: string }> = {
    up: { bg: colors.upBg, fg: colors.up, ring: '#86EFAC' },
    warn: { bg: colors.warnBg, fg: colors.warn, ring: '#FCD888' },
    neg: { bg: colors.negBg, fg: colors.neg, ring: '#FCA5A5' },
  };
  const c = map[tone];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          backgroundColor: '#FFFFFF',
          borderWidth: 2,
          borderColor: c.ring,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '900', color: c.fg }}>{letter}</Text>
      </View>
      <Text style={{ fontSize: 12, color: colors.muted }}>{name}</Text>
      <Text style={{ fontSize: 14, fontWeight: '800', color: c.fg }}>{status}</Text>
    </View>
  );
}
