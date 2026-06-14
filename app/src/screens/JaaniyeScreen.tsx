import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Camera, Send, Sprout } from 'lucide-react-native';
import { Card, PrimaryButton } from '../ui';
import { colors } from '../theme';
import { useT } from '../i18n';
import { ApiError } from '../api/client';
import * as api from '../api';

export default function JaaniyeScreen() {
  const { t, lang } = useT();
  const [question, setQuestion] = useState('');
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState('');
  const [error, setError] = useState('');

  // Lab-report photo. expo-image-picker is optional: if it's installed we attach a
  // real photo; otherwise we attach a demo marker so the flow still works. Enable
  // real picking with: npx expo install expo-image-picker
  const pickPhoto = async () => {
    setError('');
    try {
      // @ts-ignore optional dependency — enable via `npx expo install expo-image-picker`
      const ImagePicker = await import('expo-image-picker');
      const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5 });
      if (!res.canceled && res.assets?.[0]?.base64) {
        setImageB64(res.assets[0].base64);
        return;
      }
    } catch {
      // picker not installed / unavailable → attach a demo marker so the demo works
      setImageB64('demo-lab-report');
    }
  };

  const submit = async () => {
    if (!question.trim() && !imageB64) {
      setError(lang === 'hi' ? 'सवाल लिखें या फोटो डालें' : 'Type a question or add a photo');
      return;
    }
    setBusy(true);
    setError('');
    setAnswer(null);
    try {
      const res = await api.ask({
        question: question.trim() || (lang === 'hi' ? 'मेरी मिट्टी जांच रिपोर्ट देखें' : 'Please review my soil report'),
        lang,
        ...(imageB64 ? { image_base64: imageB64 } : {}),
      });
      setAnswer(res.answer);
      setDisclaimer(res.disclaimer);
    } catch (e) {
      setError(e instanceof ApiError && e.status > 0 ? e.message : t('somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 20, paddingBottom: 24 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: colors.ink }}>{t('jaaniyeTitle')}</Text>
        <Text style={{ fontSize: 15, color: colors.muted }}>{t('jaaniyeSub')}</Text>
      </View>

      <Card>
        <View style={{ gap: 14 }}>
          <TextInput
            value={question}
            onChangeText={(v) => { setQuestion(v); setError(''); }}
            placeholder={t('askPlaceholder')}
            placeholderTextColor={colors.faint}
            multiline
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: colors.hairline,
              paddingHorizontal: 14,
              paddingVertical: 14,
              fontSize: 17,
              color: colors.ink,
              minHeight: 90,
              textAlignVertical: 'top',
            }}
          />

          {/* Lab-report photo upload */}
          <Pressable
            onPress={pickPhoto}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: imageB64 ? colors.upBg : colors.soft,
              borderWidth: 1.5,
              borderColor: imageB64 ? colors.up : colors.accent,
              borderRadius: 14,
              paddingVertical: 14,
            }}
          >
            <Camera size={18} color={imageB64 ? colors.up : colors.accentDark} strokeWidth={2.6} />
            <Text style={{ fontSize: 15, fontWeight: '800', color: imageB64 ? colors.up : colors.accentDark }}>
              {imageB64 ? t('photoAdded') : t('uploadLabReport')}
            </Text>
          </Pressable>

          {error ? <Text style={{ fontSize: 14, color: colors.neg, fontWeight: '700' }}>{error}</Text> : null}
          {busy ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 }}>
              <ActivityIndicator color={colors.accentBold} />
              <Text style={{ color: colors.muted, fontWeight: '700' }}>{t('thinking')}</Text>
            </View>
          ) : (
            <PrimaryButton label={t('askButton')} onPress={submit} />
          )}
        </View>
      </Card>

      {/* Answer */}
      {answer ? (
        <Card tone="soft">
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Sprout size={20} color={colors.accentDark} strokeWidth={2.6} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink }}>{t('jaaniyeTitle')}</Text>
            </View>
            <Text style={{ fontSize: 16, color: colors.ink, lineHeight: 24 }}>{answer}</Text>
            {disclaimer ? <Text style={{ fontSize: 12, color: colors.muted, fontStyle: 'italic' }}>{disclaimer}</Text> : null}
          </View>
        </Card>
      ) : null}
    </View>
  );
}
