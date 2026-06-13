import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { Check, ChevronDown, MapPin } from 'lucide-react-native';
import { Field, PrimaryButton, Select } from '../ui';
import { colors } from '../theme';
import type { FarmerProfile, FarmSizeUnit } from '../profile';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
];

const UNITS: FarmSizeUnit[] = ['Acre', 'Hectare', 'Bigha', 'Gaj'];

export default function OnboardingScreen({
  onDone,
  onBack,
}: {
  onDone: (p: FarmerProfile) => void;
  onBack?: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [stateName, setStateName] = useState('Madhya Pradesh');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [locMsg, setLocMsg] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [farmSizeUnit, setFarmSizeUnit] = useState<FarmSizeUnit>('Acre');
  const [unitOpen, setUnitOpen] = useState(false);
  const [crop, setCrop] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const applyAddress = (area?: string, dist?: string, state?: string) => {
    if (area) setVillage(area);
    if (dist) setDistrict(dist);
    if (state) setStateName(state);
    const where = [dist, state].filter(Boolean).join(', ');
    setLocMsg(where ? `📍 Detected: ${where}` : '📍 Location captured');
    return Boolean(area || dist || state);
  };

  const detectLocation = async () => {
    setDetecting(true);
    setLocMsg('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocMsg('Location permission denied — please type it below.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCoords(c);

      let filled = false;

      // Reverse-geocode via BigDataCloud (free, no API key, works on web + device)
      try {
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${c.latitude}&longitude=${c.longitude}&localityLanguage=en`,
        );
        const d = await res.json();
        const admin: Array<{ name?: string; adminLevel?: number }> = d?.localityInfo?.administrative ?? [];
        const byLevel = (lvl: number) => admin.find((a) => a.adminLevel === lvl)?.name;
        const state = d?.principalSubdivision || byLevel(4);
        const dist = byLevel(5) || d?.city;
        const area = byLevel(7) || byLevel(6) || d?.locality || d?.city;
        filled = applyAddress(area, dist, state);
      } catch {
        // fall through to the device geocoder
      }

      // Native fallback (OS geocoder) if the HTTP lookup gave nothing
      if (!filled) {
        try {
          const g = (await Location.reverseGeocodeAsync(c))[0];
          if (g) filled = applyAddress(g.city || g.name || undefined, g.subregion || g.district || undefined, g.region || undefined);
        } catch {
          // ignore
        }
      }

      if (!filled) {
        setLocMsg(`📍 Location captured (${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}) — please fill the area below.`);
      }
    } catch {
      setLocMsg('Could not get location — please type it below.');
    } finally {
      setDetecting(false);
    }
  };

  const sizeNum = parseFloat(farmSize);
  const phoneDigits = phone.replace(/\D/g, '');
  const aadhaarDigits = aadhaar.replace(/\D/g, '');

  const errors = {
    name: !name.trim() ? 'Please enter your name' : '',
    phone: phoneDigits.length !== 10 ? 'Enter a 10-digit mobile number' : '',
    aadhaar: aadhaarDigits.length !== 12 ? 'Enter a 12-digit Aadhaar number' : '',
    village: !village.trim() ? 'Please enter your village / area' : '',
    district: !district.trim() ? 'Please enter your district' : '',
    farmSize: !(sizeNum > 0) ? 'Enter your farm size' : '',
  };
  const valid =
    !errors.name && !errors.phone && !errors.aadhaar && !errors.village && !errors.district && !errors.farmSize;

  const submit = () => {
    setSubmitted(true);
    if (!valid) return;
    onDone({
      name: name.trim(),
      phone: phoneDigits,
      aadhaar: aadhaarDigits,
      village: village.trim(),
      district: district.trim(),
      state: stateName.trim(),
      coords: coords ?? undefined,
      farmSize: String(sizeNum),
      farmSizeUnit,
      crop: crop.trim() || undefined,
    });
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 64, paddingHorizontal: 20, paddingBottom: 48, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.accentBold }}>← Log in instead</Text>
          </Pressable>
        ) : null}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.ink }}>🌾 Welcome</Text>
          <Text style={{ fontSize: 15, color: colors.muted, lineHeight: 22 }}>
            Tell us a few details so we can show prices, schemes and advice made for you.
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          <Field label="Full name" value={name} onChangeText={setName} placeholder="e.g. Ramesh Patidar" error={submitted ? errors.name : ''} />
          <Field label="Mobile number" value={phone} onChangeText={setPhone} placeholder="10-digit mobile number" keyboardType="number-pad" maxLength={10} error={submitted ? errors.phone : ''} />
          <Field
            label="Aadhaar number"
            value={aadhaar}
            onChangeText={setAadhaar}
            placeholder="12-digit Aadhaar number"
            keyboardType="number-pad"
            maxLength={12}
            error={submitted ? errors.aadhaar : ''}
            note="Used only to check scheme eligibility. Stored on your phone."
          />

          {/* Farm location */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>Farm location</Text>
            <Pressable
              onPress={detectLocation}
              disabled={detecting}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.soft, borderWidth: 1.5, borderColor: colors.accent, borderRadius: 14, paddingVertical: 14 }}
            >
              {detecting ? (
                <ActivityIndicator color={colors.accentDark} />
              ) : (
                <MapPin size={18} color={colors.accentDark} strokeWidth={2.6} />
              )}
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.accentDark }}>
                {detecting ? 'Detecting…' : 'Use my current location'}
              </Text>
            </Pressable>
            {locMsg ? (
              <Text style={{ fontSize: 13, fontWeight: '600', color: coords ? colors.up : colors.muted }}>{locMsg}</Text>
            ) : null}
            <Field label="Village / area" value={village} onChangeText={setVillage} placeholder="Your village or area" error={submitted ? errors.village : ''} />
            <Field label="District" value={district} onChangeText={setDistrict} placeholder="e.g. Dewas" error={submitted ? errors.district : ''} />
            <Select label="State" value={stateName} onChange={setStateName} options={INDIAN_STATES} placeholder="Select your state" />
          </View>

          {/* Farm size + unit */}
          <View style={{ gap: 7 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>Farm size</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                value={farmSize}
                onChangeText={(t) => setFarmSize(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                placeholder="e.g. 2.5"
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
                style={[inputBox, { flex: 1.6, fontSize: 17, color: colors.ink, borderColor: submitted && errors.farmSize ? colors.neg : colors.hairline }]}
              />
              <Pressable onPress={() => setUnitOpen(true)} style={[inputBox, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <Text style={{ fontSize: 17, color: colors.ink, fontWeight: '700' }}>{farmSizeUnit}</Text>
                <ChevronDown size={20} color={colors.muted} strokeWidth={2.4} />
              </Pressable>
            </View>
            {submitted && errors.farmSize ? (
              <Text style={{ fontSize: 13, color: colors.neg, fontWeight: '700' }}>{errors.farmSize}</Text>
            ) : null}
          </View>

          <Field label="Main crop (optional)" value={crop} onChangeText={setCrop} placeholder="e.g. Soybean" />
        </View>

        <PrimaryButton label="Get started" onPress={submit} />
      </ScrollView>

      {/* Land-measure picker */}
      <Modal visible={unitOpen} transparent animationType="fade" onRequestClose={() => setUnitOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(35,32,28,0.45)', justifyContent: 'flex-end' }} onPress={() => setUnitOpen(false)}>
          <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 28 }} onPress={() => {}}>
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ width: 40, height: 5, borderRadius: 999, backgroundColor: colors.hairline }} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink, paddingHorizontal: 20, paddingBottom: 6 }}>Land measure</Text>
            {UNITS.map((u) => {
              const sel = u === farmSizeUnit;
              return (
                <Pressable
                  key={u}
                  onPress={() => {
                    setFarmSizeUnit(u);
                    setUnitOpen(false);
                  }}
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
