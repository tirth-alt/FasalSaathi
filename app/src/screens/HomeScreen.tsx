import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Coins, Sprout, User, Warehouse } from 'lucide-react-native';
import { Card, DeltaPill, NavCard, StatPill } from '../ui';
import { Touchable } from '../primitives';
import { MicButton } from '../MicButton';
import { colors, inr } from '../theme';
import type { TabKey } from '../theme';
import { useT } from '../i18n';
import { cropLabel } from '../crops';
import { farmerCoords } from '../config';
import { formatShort } from '../date';
import { LangToggle } from '../LangToggle';
import * as api from '../api';
import type { SafeFarmer } from '../api/types';

export default function HomeScreen({
  go,
  farmer,
  onProfile,
}: {
  go: (t: TabKey) => void;
  farmer: SafeFarmer;
  onProfile: () => void;
}) {
  const { t, lang } = useT();
  const [listening, setListening] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [priceDate, setPriceDate] = useState<string | null>(null);
  const [deltaPct, setDeltaPct] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const firstName = (farmer.full_name ?? '').split(' ')[0] || (lang === 'hi' ? 'किसान' : 'Kisan');
  const cropKey = farmer.primary_crops?.[0] ?? 'soybean';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { lat, lng } = farmerCoords(farmer);
        const { mandis } = await api.nearbyMandis(lat, lng, 5);
        if (!mandis.length) return;
        const { series } = await api.priceHistory(cropKey, mandis.map((m) => m.mandi_id), 7);
        // Use the nearest mandi that has data.
        const first = series.find((s) => s.series.length > 0);
        if (!first || cancelled) return;
        const pts = first.series;
        const today = pts[pts.length - 1]?.modal_price ?? null;
        const weekAgo = pts[0]?.modal_price ?? null;
        if (cancelled) return;
        setPrice(today);
        setPriceDate(pts[pts.length - 1]?.date ?? null);
        if (today !== null && weekAgo) setDeltaPct(Math.round(((today - weekAgo) / weekAgo) * 100));
      } catch {
        // leave price null → shows a dash
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cropKey, farmer]);

  return (
    <View style={{ gap: 22, paddingBottom: 24 }}>
      <View style={{ alignItems: 'flex-end' }}>
        <LangToggle />
      </View>
      {/* Brand + greeting + profile chip */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 4 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.ink, letterSpacing: -0.3 }}>🌾 {t('appName')}</Text>
          <Text style={{ fontSize: 16, color: colors.ink, fontWeight: '600' }}>{t('namaste')}, {firstName} 🙏</Text>
        </View>
        <Touchable onPress={onProfile} pressScale={0.95}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.soft, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999 }}>
            <User size={15} color={colors.accentDark} strokeWidth={2.6} />
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accentDark }}>{t('profile')}</Text>
          </View>
        </Touchable>
      </View>

      {/* Today's price hero (recent search result) */}
      <Card tone="soft">
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StatPill tone="accent">{t('todaysPrice')}</StatPill>
            <Text style={{ fontSize: 14, color: colors.accentDark, fontWeight: '700' }}>
              {cropLabel(cropKey, lang)}{farmer.farm_district ? ` · ${farmer.farm_district}` : ''}
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.accentBold} style={{ alignSelf: 'flex-start', marginVertical: 12 }} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontSize: 48, fontWeight: '900', color: colors.accentDark, letterSpacing: -1 }}>
                {price !== null ? `₹${inr(price)}` : '₹—'}
              </Text>
              <Text style={{ fontSize: 16, color: colors.accentDark, fontWeight: '700' }}>{t('perQuintal')}</Text>
            </View>
          )}
          {deltaPct !== null && !loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <DeltaPill value={deltaPct} period={lang === 'hi' ? 'इस हफ्ते' : 'this week'} />
              {priceDate ? (
                <Text style={{ fontSize: 12, color: colors.accentDark, fontWeight: '700' }}>📅 {formatShort(priceDate, lang)}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </Card>

      {/* Mic (voice stub) */}
      <View style={{ alignItems: 'center', gap: 14, paddingTop: 6 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, textAlign: 'center', maxWidth: 300 }}>
          {lang === 'hi' ? 'भाव पूछें — या "बेचें या रखें?"' : 'Ask a price — or "sell or store?"'}
        </Text>
        <MicButton listening={listening} onToggle={() => setListening((l) => !l)} />
        <Text style={{ fontSize: 14, color: listening ? colors.neg : colors.muted, fontWeight: '700', textAlign: 'center', maxWidth: 300 }}>
          {listening ? t('voiceComingSoon') : t('tapToSpeak')}
        </Text>
      </View>

      {/* Nav cards */}
      <View style={{ gap: 10, paddingTop: 6 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {t('whatDoYouNeed')}
        </Text>
        <View style={{ gap: 10 }}>
          <NavCard Icon={Coins} title={t('navPricesTitle')} subtitle={t('navPricesSub')} onPress={() => go('prices')} />
          <NavCard Icon={Warehouse} title={t('navSellTitle')} subtitle={t('navSellSub')} onPress={() => go('sell')} />
          <NavCard Icon={Sprout} title={t('navJaaniyeTitle')} subtitle={t('navJaaniyeSub')} onPress={() => go('jaaniye')} />
        </View>
      </View>
    </View>
  );
}
