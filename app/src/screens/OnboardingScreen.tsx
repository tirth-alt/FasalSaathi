import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, ChevronDown, MapPin } from 'lucide-react-native';
import { Field, PrimaryButton, Select } from '../ui';
import { colors } from '../theme';
import { useT } from '../i18n';
import { useAuth } from '../auth/AuthContext';
import { errText } from '../errors';
import { LangToggle } from '../LangToggle';
import { CROPS } from '../crops';
import { MapView } from '../components/MapView';
import { toBackendArea, saveExtras } from '../profileExtras';
import type { DisplayUnit } from '../profileExtras';
import { states, districts, villages, findLocation, DEFAULT_LOCATION } from '../locations';

const UNITS: DisplayUnit[] = ['Acre', 'Hectare', 'Bigha', 'Gaj'];

export default function OnboardingScreen() {
  const { t, lang } = useT();
  const { farmer, completeProfile } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — details (prefilled from signup)
  const [name, setName] = useState(farmer?.full_name ?? '');
  const [phone, setPhone] = useState(farmer?.phone ?? '');
  const [aadhaar, setAadhaar] = useState('');

  // Step 2 — farm location (controlled dropdowns → always a valid coordinate)
  const [stateName, setStateName] = useState(DEFAULT_LOCATION.state);
  const [district, setDistrict] = useState(DEFAULT_LOCATION.district);
  const [village, setVillage] = useState(DEFAULT_LOCATION.village);
  const [farmSize, setFarmSize] = useState('');
  const [farmSizeUnit, setFarmSizeUnit] = useState<DisplayUnit>('Acre');
  const [unitOpen, setUnitOpen] = useState(false);
  const [cropLabelSel, setCropLabelSel] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');

  const loc = findLocation(stateName, district, village) ?? DEFAULT_LOCATION;
  const cropOptions = CROPS.map((c) => `${c.emoji} ${lang === 'hi' ? c.hi : c.en}`);

  const onState = (s: string) => {
    const d = districts(s)[0];
    const v = villages(s, d)[0];
    setStateName(s);
    setDistrict(d);
    setVillage(v);
  };
  const onDistrict = (d: string) => {
    setDistrict(d);
    setVillage(villages(stateName, d)[0]);
  };

  // --- Step 1 validation ---
  const phoneDigits = phone.replace(/\D/g, '');
  const step1Errors = {
    name: !name.trim() ? t('errName') : '',
    phone: !/^[6-9]\d{9}$/.test(phoneDigits) ? t('errPhone') : '',
  };
  const goStep2 = () => {
    setSubmitted(true);
    if (step1Errors.name || step1Errors.phone) return;
    setSubmitted(false);
    setStep(2);
  };

  // --- Step 2 validation ---
  const sizeNum = parseFloat(farmSize);
  const aadhaarDigits = aadhaar.replace(/\D/g, '');
  const step2Errors = {
    farmSize: !(sizeNum > 0) ? t('errFarmSize') : '',
    crop: !cropLabelSel ? t('errCrop') : '',
  };
  const step2Valid = !step2Errors.farmSize && !step2Errors.crop;

  const submit = async () => {
    setSubmitted(true);
    if (!step2Valid) return;
    const cropIdx = cropOptions.indexOf(cropLabelSel);
    const cropKey = CROPS[cropIdx]?.key ?? 'onion';
    const area = toBackendArea(sizeNum, farmSizeUnit);

    setBusy(true);
    setServerError('');
    try {
      await saveExtras({ displaySize: String(sizeNum), displayUnit: farmSizeUnit });
      await completeProfile({
        full_name: name.trim(),
        phone: phoneDigits,
        preferred_language: lang,
        ...(aadhaarDigits.length === 12 ? { aadhaar: aadhaarDigits } : {}),
        farm_lat: loc.lat,
        farm_lng: loc.lng,
        farm_village: village,
        farm_district: district,
        farm_state: stateName,
        farm_area_value: area.value,
        farm_area_unit: area.unit,
        primary_crops: [cropKey],
      });
      // success → status flips to 'ready'; screen unmounts.
    } catch (e) {
      setServerError(errText(e, lang));
      setBusy(false);
    }
  };

  const inputBox = {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 14,
  } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 48, gap: 18 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LangToggle />

        {/* Step indicator */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.accentDark }}>{t('step')} {step}/2</Text>
          <View style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: colors.hairline, overflow: 'hidden' }}>
            <View style={{ width: step === 1 ? '50%' : '100%', height: '100%', backgroundColor: colors.accentBold }} />
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: colors.ink }}>
            {step === 1 ? `🌾 ${t('welcome')}` : t('farmDetails')}
          </Text>
          <Text style={{ fontSize: 15, color: colors.muted, lineHeight: 22 }}>
            {step === 1 ? t('onbIntro') : t('farmLocation')}
          </Text>
        </View>

        {step === 1 ? (
          <View style={{ gap: 14 }}>
            <Field label={t('fullName')} value={name} onChangeText={setName} placeholder={t('namePlaceholder')} error={submitted ? step1Errors.name : ''} />
            <Field label={t('phone')} value={phone} onChangeText={setPhone} placeholder={t('phonePlaceholder')} keyboardType="number-pad" maxLength={10} error={submitted ? step1Errors.phone : ''} />
            <Field label={t('aadhaar')} value={aadhaar} onChangeText={setAadhaar} placeholder="XXXX XXXX XXXX" keyboardType="number-pad" maxLength={12} note={t('aadhaarNote')} />
            <PrimaryButton label={t('continue')} onPress={goStep2} />
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <Select label={t('stateLabel')} value={stateName} onChange={onState} options={states()} />
            <Select label={t('district')} value={district} onChange={onDistrict} options={districts(stateName)} />
            <Select label={t('village')} value={village} onChange={setVillage} options={villages(stateName, district)} />

            {/* Google map of the chosen location */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MapPin size={16} color={colors.accentDark} strokeWidth={2.6} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>{village}, {district}, {stateName}</Text>
            </View>
            <MapView lat={loc.lat} lng={loc.lng} label={village} />

            {/* Farm size + unit */}
            <View style={{ gap: 7 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>{t('farmSize')}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  value={farmSize}
                  onChangeText={(v) => setFarmSize(v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                  placeholder="2.5"
                  placeholderTextColor={colors.faint}
                  keyboardType="decimal-pad"
                  style={[inputBox, { flex: 1.6, fontSize: 17, color: colors.ink, borderColor: submitted && step2Errors.farmSize ? colors.neg : colors.hairline }]}
                />
                <Pressable onPress={() => setUnitOpen(true)} style={[inputBox, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: 17, color: colors.ink, fontWeight: '700' }}>{farmSizeUnit}</Text>
                  <ChevronDown size={20} color={colors.muted} strokeWidth={2.4} />
                </Pressable>
              </View>
              {submitted && step2Errors.farmSize ? <Text style={{ fontSize: 13, color: colors.neg, fontWeight: '700' }}>{step2Errors.farmSize}</Text> : null}
            </View>

            {/* Main crop */}
            <Select label={t('mainCrop')} value={cropLabelSel} onChange={setCropLabelSel} options={cropOptions} placeholder={t('cropPlaceholder')} />
            {submitted && step2Errors.crop ? <Text style={{ fontSize: 13, color: colors.neg, fontWeight: '700' }}>{step2Errors.crop}</Text> : null}

            {serverError ? <Text style={{ fontSize: 14, color: colors.neg, fontWeight: '700' }}>{serverError}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setStep(1)} style={{ paddingVertical: 18, paddingHorizontal: 22, borderRadius: 16, borderWidth: 1.5, borderColor: colors.hairline }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.muted }}>{t('back')}</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                {busy ? (
                  <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                    <ActivityIndicator color={colors.accentBold} />
                  </View>
                ) : (
                  <PrimaryButton label={t('getStarted')} onPress={submit} />
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Land-measure picker */}
      <Modal visible={unitOpen} transparent animationType="fade" onRequestClose={() => setUnitOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(35,32,28,0.45)', justifyContent: 'flex-end' }} onPress={() => setUnitOpen(false)}>
          <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 28 }} onPress={() => {}}>
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ width: 40, height: 5, borderRadius: 999, backgroundColor: colors.hairline }} />
            </View>
            {UNITS.map((u) => {
              const sel = u === farmSizeUnit;
              return (
                <Pressable
                  key={u}
                  onPress={() => { setFarmSizeUnit(u); setUnitOpen(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: sel ? colors.soft : 'transparent' }}
                >
                  <Text style={{ fontSize: 17, color: sel ? colors.accentDark : colors.ink, fontWeight: sel ? '800' : '500' }}>{u}</Text>
                  {sel ? <Check size={20} color={colors.accentBold} strokeWidth={2.8} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
