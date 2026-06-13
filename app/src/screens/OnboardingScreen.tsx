import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Field, PrimaryButton, Select } from '../ui';
import { colors } from '../theme';
import type { FarmerProfile } from '../profile';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
];

export default function OnboardingScreen({ onDone }: { onDone: (p: FarmerProfile) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [stateName, setStateName] = useState('Madhya Pradesh');
  const [crop, setCrop] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const phoneDigits = phone.replace(/\D/g, '');
  const aadhaarDigits = aadhaar.replace(/\D/g, '');

  const errors = {
    name: !name.trim() ? 'Please enter your name' : '',
    phone: phoneDigits.length !== 10 ? 'Enter a 10-digit mobile number' : '',
    aadhaar: aadhaarDigits.length !== 12 ? 'Enter a 12-digit Aadhaar number' : '',
    village: !village.trim() ? 'Please enter your village' : '',
    district: !district.trim() ? 'Please enter your district' : '',
  };
  const valid = !errors.name && !errors.phone && !errors.aadhaar && !errors.village && !errors.district;

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
      crop: crop.trim() || undefined,
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: 64, paddingHorizontal: 20, paddingBottom: 48, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.ink }}>🌾 Welcome</Text>
          <Text style={{ fontSize: 15, color: colors.muted, lineHeight: 22 }}>
            Tell us a few details so we can show prices, schemes and advice made for you.
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          <Field
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Ramesh Patidar"
            error={submitted ? errors.name : ''}
          />
          <Field
            label="Mobile number"
            value={phone}
            onChangeText={setPhone}
            placeholder="10-digit mobile number"
            keyboardType="number-pad"
            maxLength={10}
            error={submitted ? errors.phone : ''}
          />
          <Field
            label="Aadhaar number"
            value={aadhaar}
            onChangeText={setAadhaar}
            placeholder="12-digit Aadhaar number"
            keyboardType="number-pad"
            maxLength={12}
            error={submitted ? errors.aadhaar : ''}
            note="Used only to check your scheme eligibility. Stored on your phone."
          />
          <Field
            label="Village"
            value={village}
            onChangeText={setVillage}
            placeholder="Your village"
            error={submitted ? errors.village : ''}
          />
          <Field
            label="District"
            value={district}
            onChangeText={setDistrict}
            placeholder="e.g. Dewas"
            error={submitted ? errors.district : ''}
          />
          <Select
            label="State"
            value={stateName}
            onChange={setStateName}
            options={INDIAN_STATES}
            placeholder="Select your state"
          />
          <Field label="Main crop (optional)" value={crop} onChangeText={setCrop} placeholder="e.g. Soybean" />
        </View>

        <PrimaryButton label="Get started" onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
