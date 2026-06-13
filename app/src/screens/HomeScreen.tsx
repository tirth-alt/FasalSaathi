import { useState } from 'react';
import { Text, View } from 'react-native';
import { Coins, Sprout, User, Warehouse } from 'lucide-react-native';
import { Card, DeltaPill, NavCard, StatPill } from '../ui';
import { Touchable } from '../primitives';
import { MicButton, useCountUp } from '../MicButton';
import { colors, inr } from '../theme';
import type { TabKey } from '../theme';
import type { FarmerProfile } from '../profile';

export default function HomeScreen({
  go,
  profile,
  onEditProfile,
}: {
  go: (t: TabKey) => void;
  profile: FarmerProfile;
  onEditProfile: () => void;
}) {
  const [listening, setListening] = useState(false);
  const price = useCountUp(4650);
  const firstName = profile.name.split(' ')[0] || 'Kisan';

  return (
    <View style={{ gap: 22, paddingBottom: 24 }}>
      {/* Brand + greeting + profile chip */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 4 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.ink, letterSpacing: -0.3 }}>
            🌾 FasalSaathi
          </Text>
          <Text style={{ fontSize: 16, color: colors.ink, fontWeight: '600' }}>Namaste, {firstName} 🙏</Text>
        </View>
        <Touchable onPress={onEditProfile} pressScale={0.95}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: colors.soft,
              paddingVertical: 8,
              paddingHorizontal: 13,
              borderRadius: 999,
            }}
          >
            <User size={15} color={colors.accentDark} strokeWidth={2.6} />
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accentDark }}>Profile</Text>
          </View>
        </Touchable>
      </View>

      {/* Today's price hero */}
      <Card tone="soft">
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StatPill tone="accent">Today's price</StatPill>
            <Text style={{ fontSize: 14, color: colors.accentDark, fontWeight: '700' }}>
              {profile.crop || 'Soybean'} · {profile.district}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ fontSize: 48, fontWeight: '900', color: colors.accentDark, letterSpacing: -1 }}>
              ₹{inr(price)}
            </Text>
            <Text style={{ fontSize: 16, color: colors.accentDark, fontWeight: '700' }}>/quintal</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <DeltaPill value={3} period="this week" />
          </View>
        </View>
      </Card>

      {/* Mic */}
      <View style={{ alignItems: 'center', gap: 14, paddingTop: 6 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, textAlign: 'center', maxWidth: 300 }}>
          Ask a price — or "sell or store?"
        </Text>
        <MicButton listening={listening} onToggle={() => setListening((l) => !l)} />
        <Text style={{ fontSize: 15, color: listening ? colors.neg : colors.muted, fontWeight: '700' }}>
          {listening ? 'Listening… tap again to stop' : 'Tap to speak'}
        </Text>
      </View>

      {/* What do you need */}
      <View style={{ gap: 10, paddingTop: 6 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          What do you need?
        </Text>
        <View style={{ gap: 10 }}>
          <NavCard Icon={Coins} title="Check Prices" subtitle="Today's mandi rates" onPress={() => go('prices')} />
          <NavCard Icon={Warehouse} title="Sell or Store?" subtitle="The profit math" onPress={() => go('sell')} />
          <NavCard Icon={Sprout} title="Learn" subtitle="Soil card & schemes" onPress={() => go('learn')} />
        </View>
      </View>
    </View>
  );
}
