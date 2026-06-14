import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Field, PrimaryButton } from '../ui';
import { colors } from '../theme';

export default function LoginScreen({
  onLogin,
  onSignup,
}: {
  onLogin: (phone: string) => boolean;
  onSignup: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Enter a 10-digit mobile number');
      return;
    }
    const ok = onLogin(digits);
    if (!ok) setError('No account found with this number. Tap “Sign up” below to create one.');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40, gap: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 44 }}>🌾</Text>
          <Text style={{ fontSize: 30, fontWeight: '900', color: colors.accentDark }}>FasalSaathi</Text>
          <Text style={{ fontSize: 15, color: colors.muted }}>The farmer's companion</Text>
        </View>

        {/* Login card (modal-style) */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.hairline,
            padding: 22,
            gap: 16,
            shadowColor: '#23201C',
            shadowOpacity: 0.1,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 5,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink }}>Log in</Text>
            <Text style={{ fontSize: 15, color: colors.muted }}>Enter your mobile number to continue</Text>
          </View>
          <Field
            label="Mobile number"
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              setError('');
            }}
            placeholder="10-digit mobile number"
            keyboardType="number-pad"
            maxLength={10}
            error={error}
          />
          <PrimaryButton label="Log in" onPress={submit} />
        </View>

        {/* Sign up */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 15, color: colors.muted }}>New to FasalSaathi?</Text>
          <Pressable onPress={onSignup} hitSlop={8}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.accentBold }}>Sign up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
