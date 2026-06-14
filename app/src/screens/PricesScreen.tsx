import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { BreakdownRow, Card, DeltaPill, Select, StatPill } from '../ui';
import { MicButton } from '../MicButton';
import { LineChart } from '../components/LineChart';
import { colors, inr } from '../theme';
import { useT } from '../i18n';
import { CROPS, cropLabel } from '../crops';
import { estimateCost } from '../costs';
import { farmerCoords } from '../config';
import * as api from '../api';
import type { Mandi, PriceSeries, SafeFarmer } from '../api/types';

type VoiceState = 'idle' | 'listening' | 'transcript';

export default function PricesScreen({ farmer }: { farmer: SafeFarmer }) {
  const { t, lang } = useT();
  const screenW = Dimensions.get('window').width;
  const chartW = Math.max(220, screenW - 80);

  const [cropKey, setCropKey] = useState(farmer.primary_crops?.[0] ?? 'soybean');
  const [mandis, setMandis] = useState<Mandi[]>([]);
  const [series, setSeries] = useState<PriceSeries[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Voice (stub): idle → listening → transcript → confirm.
  const [voice, setVoice] = useState<VoiceState>('idle');
  const voiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load nearby mandis once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { lat, lng } = farmerCoords(farmer);
        const { mandis } = await api.nearbyMandis(lat, lng, 10);
        if (!cancelled) setMandis(mandis);
      } catch {
        if (!cancelled) setError(t('somethingWrong'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [farmer]);

  // Load price history whenever crop or the mandi set changes.
  useEffect(() => {
    if (mandis.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { series } = await api.priceHistory(cropKey, mandis.map((m) => m.mandi_id), 7);
        if (cancelled) return;
        setSeries(series);
        const firstWithData = series.find((s) => s.series.length > 0);
        setSelectedId(firstWithData?.mandi_id ?? null);
      } catch {
        if (!cancelled) setError(t('somethingWrong'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cropKey, mandis]);

  const startVoice = () => {
    if (voice !== 'idle') {
      setVoice('idle');
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
      return;
    }
    setVoice('listening');
    voiceTimer.current = setTimeout(() => setVoice('transcript'), 1300);
  };

  const selectedSeries = series.find((s) => s.mandi_id === selectedId);
  const selectedMandi = mandis.find((m) => m.mandi_id === selectedId);
  const pts = selectedSeries?.series ?? [];
  const today = pts.length ? pts[pts.length - 1] : null;
  const yest = pts.length > 1 ? pts[pts.length - 2] : null;
  const weekAgo = pts.length ? pts[0] : null;
  const deltaPct = today && weekAgo ? Math.round(((today.modal_price - weekAgo.modal_price) / weekAgo.modal_price) * 100) : null;

  const labels = pts.map((p, i) => (i === 0 || i === pts.length - 1 || i === Math.floor(pts.length / 2) ? p.date.slice(5) : ''));

  const cost = today && selectedMandi ? estimateCost(today.modal_price, 1, selectedMandi.distance_km) : null;

  const latestFor = (mandiId: string) => {
    const s = series.find((x) => x.mandi_id === mandiId)?.series ?? [];
    return s.length ? s[s.length - 1].modal_price : null;
  };

  const transcript = lang === 'hi' ? `"${cropLabel(cropKey, lang)} का भाव क्या है?"` : `"What is the ${cropLabel(cropKey, lang)} price?"`;

  return (
    <View style={{ gap: 20, paddingBottom: 24 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: colors.ink }}>{t('pricesTitle')}</Text>
        <Text style={{ fontSize: 15, color: colors.muted }}>{t('pricesSub')}</Text>
      </View>

      {/* Voice-first input */}
      <Card>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <MicButton listening={voice !== 'idle'} onToggle={startVoice} />
          {voice === 'idle' ? (
            <Text style={{ fontSize: 14, color: colors.muted, fontWeight: '700', textAlign: 'center' }}>{t('voiceComingSoon')}</Text>
          ) : voice === 'listening' ? (
            <Text style={{ fontSize: 15, color: colors.neg, fontWeight: '800' }}>{t('listening')}</Text>
          ) : (
            <View style={{ alignItems: 'center', gap: 10, width: '100%' }}>
              <Text style={{ fontSize: 17, color: colors.ink, fontWeight: '800', textAlign: 'center' }}>{transcript}</Text>
              <Pressable
                onPress={() => setVoice('idle')}
                style={{ backgroundColor: colors.up, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 22 }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{lang === 'hi' ? 'सही है ✓' : 'Correct ✓'}</Text>
              </Pressable>
            </View>
          )}
          <View style={{ width: '100%' }}>
            <Select
              label={t('chooseCrop')}
              value={`${CROPS.find((c) => c.key === cropKey)?.emoji ?? ''} ${cropLabel(cropKey, lang)}`}
              options={CROPS.map((c) => `${c.emoji} ${lang === 'hi' ? c.hi : c.en}`)}
              onChange={(label) => {
                const idx = CROPS.map((c) => `${c.emoji} ${lang === 'hi' ? c.hi : c.en}`).indexOf(label);
                if (idx >= 0) setCropKey(CROPS[idx].key);
              }}
            />
          </View>
        </View>
      </Card>

      {loading ? (
        <ActivityIndicator color={colors.accentBold} style={{ marginTop: 12 }} />
      ) : error ? (
        <Text style={{ color: colors.neg, fontWeight: '700' }}>{error}</Text>
      ) : !today ? (
        <Card><Text style={{ color: colors.muted, fontSize: 15 }}>{lang === 'hi' ? 'इस फसल का भाव अभी उपलब्ध नहीं है।' : 'No price data for this crop yet.'}</Text></Card>
      ) : (
        <>
          {/* Price hero + chart for the selected mandi */}
          <Card tone="soft">
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <StatPill tone="accent">{selectedMandi?.name ?? ''}</StatPill>
                {deltaPct !== null ? <DeltaPill value={deltaPct} period={lang === 'hi' ? '7 दिन' : '7 days'} /> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ fontSize: 46, fontWeight: '900', color: colors.accentDark, letterSpacing: -1 }}>₹{inr(today.modal_price)}</Text>
                <Text style={{ fontSize: 15, color: colors.accentDark, fontWeight: '700' }}>{t('perQuintal')}</Text>
              </View>
              <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '600' }}>
                {t('today')} · {yest ? `${t('yesterday')} ₹${inr(yest.modal_price)}` : ''}
              </Text>
              <LineChart values={pts.map((p) => p.modal_price)} width={chartW} labels={labels} showPointValues highlightLast />
            </View>
          </Card>

          {/* Cost-to-reach calculator */}
          {cost && selectedMandi ? (
            <Card>
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MapPin size={18} color={colors.accentDark} strokeWidth={2.6} />
                  <Text style={{ fontSize: 17, fontWeight: '900', color: colors.ink }}>{t('costToReach')}</Text>
                </View>
                <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6 }}>
                  {selectedMandi.distance_km} {t('km')} · {lang === 'hi' ? 'प्रति क्विंटल अनुमान' : 'per-quintal estimate'}
                </Text>
                <BreakdownRow label={`${t('transport')} (${selectedMandi.distance_km} ${t('km')})`} value={`₹${inr(cost.transport)}`} sign="−" />
                <BreakdownRow label={t('labour')} value={`₹${inr(cost.labour)}`} sign="−" />
                <BreakdownRow label={`${lang === 'hi' ? 'मंडी कमीशन' : 'Mandi commission'} (${2}%)`} value={`₹${inr(cost.commission)}`} sign="−" />
                <BreakdownRow label={t('netInHand')} value={`₹${inr(cost.netInHand)}`} emphasis />
              </View>
            </Card>
          ) : null}

          {/* Nearby mandis list */}
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {t('nearbyMandis')}
            </Text>
            {mandis.map((m) => {
              const price = latestFor(m.mandi_id);
              const active = m.mandi_id === selectedId;
              return (
                <Pressable
                  key={m.mandi_id}
                  onPress={() => setSelectedId(m.mandi_id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: active ? colors.soft : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.accent : colors.hairline,
                    borderRadius: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                  }}
                >
                  <View style={{ flex: 1, gap: 2, paddingRight: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>{m.name}</Text>
                    <Text style={{ fontSize: 13, color: colors.muted }}>{m.distance_km} {t('km')} · {m.district}</Text>
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: price !== null ? colors.accentDark : colors.faint }}>
                    {price !== null ? `₹${inr(price)}` : '—'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}
