import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Field, PrimaryButton } from '../ui';
import { colors } from '../theme';
import { useT } from '../i18n';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { LangToggle } from '../LangToggle';

export default function SignupScreen({ onGoLogin }: { onGoLogin: () => void }) {
  const { t } = useT();
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const digits = phone.replace(/\D/g, '');
    if (!name.trim()) {
      setError(t('errName'));
      return;
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError(t('errPhone'));
      return;
    }
    if (password.length < 8) {
      setError(t('errPassword'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signup({ phone: digits, password, full_name: name.trim() });
      // success → status becomes 'onboarding'; this screen unmounts.
    } catch (e) {
      if (e instanceof ApiError && e.code === 'email_taken') setError(t('errPhoneTaken'));
      else if (e instanceof ApiError && e.status > 0) setError(e.message);
      else setError(t('somethingWrong'));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40, gap: 22 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LangToggle />

        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 44 }}>🌾</Text>
          <Text style={{ fontSize: 30, fontWeight: '900', color: colors.accentDark }}>{t('appName')}</Text>
          <Text style={{ fontSize: 15, color: colors.muted }}>{t('tagline')}</Text>
        </View>

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
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink }}>{t('signup')}</Text>
            <Text style={{ fontSize: 15, color: colors.muted }}>{t('signupSubtitle')}</Text>
          </View>
          <Field label={t('fullName')} value={name} onChangeText={(v) => { setName(v); setError(''); }} placeholder={t('namePlaceholder')} />
          <Field
            label={t('phone')}
            value={phone}
            onChangeText={(v) => { setPhone(v); setError(''); }}
            placeholder={t('phonePlaceholder')}
            keyboardType="number-pad"
            maxLength={10}
          />
          <Field
            label={t('password')}
            value={password}
            onChangeText={(v) => { setPassword(v); setError(''); }}
            placeholder={t('passwordPlaceholder')}
            secureTextEntry
            error={error}
          />
          {busy ? (
            <View style={{ paddingVertical: 18, alignItems: 'center' }}>
              <ActivityIndicator color={colors.accentBold} />
            </View>
          ) : (
            <PrimaryButton label={t('signup')} onPress={submit} />
          )}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 15, color: colors.muted }}>{t('haveAccount')}</Text>
          <Pressable onPress={onGoLogin} hitSlop={8}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.accentBold }}>{t('login')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
