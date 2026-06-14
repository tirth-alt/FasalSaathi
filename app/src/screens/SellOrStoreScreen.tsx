import { useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, Text, TextInput, View } from 'react-native';
import { Card, PrimaryButton, Select, StatPill } from '../ui';
import { LineChart } from '../components/LineChart';
import { colors, inr } from '../theme';
import { useT } from '../i18n';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { CROPS, cropLabel } from '../crops';
import { farmerCoords } from '../config';
import * as api from '../api';
import type { DecisionCard, SafeFarmer } from '../api/types';

function YesNo({ value, onChange, yes, no }: { value: boolean | null; onChange: (v: boolean) => void; yes: string; no: string }) {
  const opt = (v: boolean, label: string) => {
    const active = value === v;
    return (
      <Pressable
        onPress={() => onChange(v)}
        style={{
          flex: 1,
          alignItems: 'center',
          paddingVertical: 13,
          borderRadius: 12,
          backgroundColor: active ? colors.accentBold : colors.surface,
          borderWidth: 1.5,
          borderColor: active ? colors.accentBold : colors.hairline,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '800', color: active ? '#fff' : colors.ink }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {opt(true, yes)}
      {opt(false, no)}
    </View>
  );
}

export default function SellOrStoreScreen({ farmer }: { farmer: SafeFarmer }) {
  const { t, lang } = useT();
  const { token } = useAuth();
  const screenW = Dimensions.get('window').width;
  const chartW = Math.max(220, screenW - 80);

  const [cropKey, setCropKey] = useState(farmer.primary_crops?.[0] ?? 'soybean');
  const [harvested, setHarvested] = useState<boolean | null>(null);
  const [cashNeed, setCashNeed] = useState<boolean | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [quantity, setQuantity] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cards, setCards] = useState<DecisionCard[] | null>(null);

  const qtyNum = parseFloat(quantity);

  const submit = async () => {
    if (!(qtyNum > 0)) {
      setError(lang === 'hi' ? 'कितना माल है, वो डालें (क्विंटल)' : 'Enter your quantity (quintal)');
      return;
    }
    if (!token) {
      setError(t('somethingWrong'));
      return;
    }
    setBusy(true);
    setError('');
    setCards(null);
    try {
      const { lat, lng } = farmerCoords(farmer);
      const { mandis } = await api.nearbyMandis(lat, lng, 5);
      const res = await api.decisionPerMandi(token, {
        commodity: cropKey,
        quantity_quintal: qtyNum,
        mandi_ids: mandis.map((m) => m.mandi_id),
        ...(cashNeed && parseFloat(cashAmount) > 0 ? { cash_need_inr: parseFloat(cashAmount) } : {}),
        horizon_weeks: 8,
      });
      setCards(res.cards);
      if (res.cards.length === 0) {
        setError(lang === 'hi' ? 'इस फसल के लिए डेटा नहीं मिला।' : 'No data for this crop.');
      }
    } catch (e) {
      setError(e instanceof ApiError && e.status > 0 ? e.message : t('somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 20, paddingBottom: 24 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: colors.ink }}>{t('sellTitle')}</Text>
        <Text style={{ fontSize: 15, color: colors.muted, lineHeight: 21 }}>{t('sellIntro')}</Text>
      </View>

      {/* Form */}
      <Card>
        <View style={{ gap: 16 }}>
          <Select
            label={t('chooseCrop')}
            value={`${CROPS.find((c) => c.key === cropKey)?.emoji ?? ''} ${cropLabel(cropKey, lang)}`}
            options={CROPS.map((c) => `${c.emoji} ${lang === 'hi' ? c.hi : c.en}`)}
            onChange={(label) => {
              const idx = CROPS.map((c) => `${c.emoji} ${lang === 'hi' ? c.hi : c.en}`).indexOf(label);
              if (idx >= 0) setCropKey(CROPS[idx].key);
            }}
          />

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>{t('qHarvested')}</Text>
            <YesNo value={harvested} onChange={setHarvested} yes={t('yes')} no={t('no')} />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>{t('quantityQ')}</Text>
            <TextInput
              value={quantity}
              onChangeText={(v) => { setQuantity(v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')); setError(''); }}
              placeholder="50"
              placeholderTextColor={colors.faint}
              keyboardType="decimal-pad"
              style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: colors.hairline, paddingHorizontal: 14, paddingVertical: 14, fontSize: 17, color: colors.ink }}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>{t('qCashNeed')}</Text>
            <YesNo value={cashNeed} onChange={setCashNeed} yes={t('yes')} no={t('no')} />
            {cashNeed ? (
              <TextInput
                value={cashAmount}
                onChangeText={(v) => setCashAmount(v.replace(/[^0-9]/g, ''))}
                placeholder={t('cashAmount')}
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: colors.hairline, paddingHorizontal: 14, paddingVertical: 14, fontSize: 17, color: colors.ink, marginTop: 4 }}
              />
            ) : null}
          </View>

          {error ? <Text style={{ fontSize: 14, color: colors.neg, fontWeight: '700' }}>{error}</Text> : null}
          {busy ? <ActivityIndicator color={colors.accentBold} style={{ paddingVertical: 8 }} /> : <PrimaryButton label={t('jaanie')} onPress={submit} />}
        </View>
      </Card>

      {/* Per-mandi decision flashcards */}
      {cards && cards.length > 0 ? (
        <View style={{ gap: 14 }}>
          {cards.map((card) => (
            <DecisionFlashcard key={card.mandi_id} card={card} chartW={chartW} lang={lang} t={t} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DecisionFlashcard({
  card,
  chartW,
  lang,
  t,
}: {
  card: DecisionCard;
  chartW: number;
  lang: 'hi' | 'en';
  t: (k: 'hold' | 'sell' | 'waitDays' | 'expectedPrice' | 'sellNowLabel' | 'total' | 'perQuintal' | 'km') => string;
}) {
  const hold = card.decision === 'HOLD';
  return (
    <Card tone={hold ? 'soft' : 'white'}>
      <View style={{ gap: 12 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ fontSize: 17, fontWeight: '900', color: colors.ink }}>{card.mandi_name}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {card.district}{card.distance_km !== null ? ` · ${card.distance_km} ${t('km')}` : ''}
            </Text>
          </View>
          <StatPill tone={hold ? 'warn' : 'up'}>{hold ? `🟡 ${t('hold')}` : `🟢 ${t('sell')}`}</StatPill>
        </View>

        {/* 45-day forecast curve with confidence band */}
        <LineChart
          values={card.curve.map((p) => p.price)}
          low={card.curve.map((p) => p.low)}
          high={card.curve.map((p) => p.high)}
          width={chartW}
          height={150}
        />

        {/* Decision detail */}
        {hold ? (
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '700' }}>{lang === 'hi' ? 'कितने दिन रुकें' : 'Wait'}</Text>
              <Text style={{ fontSize: 24, fontWeight: '900', color: colors.accentDark }}>
                {card.wait_days.best} {lang === 'hi' ? 'दिन' : 'days'}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '700' }}>{t('expectedPrice')}</Text>
              <Text style={{ fontSize: 24, fontWeight: '900', color: colors.up }}>₹{inr(card.per_quintal.expected_at_D.mid)}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>{t('perQuintal')}</Text>
            </View>
          </View>
        ) : (
          <Text style={{ fontSize: 15, color: colors.ink, fontWeight: '700' }}>
            {lang === 'hi' ? 'अभी बेचना बेहतर है।' : 'Selling now is the better call.'}
          </Text>
        )}

        {/* Sell-now line */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 12, gap: 2 }}>
          <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '700' }}>{t('sellNowLabel')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink }}>₹{inr(card.per_quintal.sell_now)}</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>{t('perQuintal')}</Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.muted }}>
            {t('total')}: ₹{inr(card.total.sell_now)} ({card.quantity_qtl} {lang === 'hi' ? 'क्विंटल' : 'qtl'})
          </Text>
        </View>
      </View>
    </Card>
  );
}
