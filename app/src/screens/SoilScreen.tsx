import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { Camera } from 'lucide-react-native';
import { Card } from '../ui';
import { Touchable } from '../primitives';
import { colors } from '../theme';
import { MicButton } from '../MicButton';
import { SAMPLE_REPORT } from '../soil/sample';
import { explainReport, answerQuestion } from '../soil/engine';
import { NativeLlm } from '../soil/llm/nativeLlm';

// The mic runs a fixed soil question through the on-device LLM. (Live STT via
// @react-native-voice/voice was removed — it doesn't build against RN 0.85; can be
// re-added later with expo-speech-recognition.)
const CANNED_QUESTION = 'मेरी रिपोर्ट में फॉस्फोरस ज़्यादा है, क्या करूँ?';

const llm = new NativeLlm();

export default function SoilScreen() {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string>('');
  const [listening, setListening] = useState(false);
  const [question, setQuestion] = useState('');

  const speak = (t: string) => Speech.speak(t, { language: 'hi-IN' });

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setAnswer('');
    try {
      const text = await fn();
      setAnswer(text);
      speak(text);
    } catch {
      setAnswer('माफ़ कीजिए, अभी जवाब नहीं बन पाया। कृपया दोबारा कोशिश करें।');
      speak('माफ़ कीजिए, अभी जवाब नहीं बन पाया। कृपया दोबारा कोशिश करें।');
    } finally {
      setBusy(false);
    }
  }

  const runCanned = () =>
    run(() => answerQuestion(CANNED_QUESTION, SAMPLE_REPORT, { llm, lang: 'hi' }).then((a) => a.text));

  async function ask() {
    const q = question.trim();
    if (busy || !q) return;
    await run(() => answerQuestion(q, SAMPLE_REPORT, { llm, lang: 'hi' }).then((a) => a.text));
  }

  async function pickAndExplain() {
    // Request permission then open picker; OCR is skipped — pre-staged report used.
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (result.canceled) return;
    await run(() => explainReport(SAMPLE_REPORT, { llm, lang: 'hi' }).then((a) => a.text));
  }

  async function toggleMic() {
    if (busy) return;
    setListening(true);
    await runCanned();
    setListening(false);
  }

  return (
    <View style={{ gap: 18, paddingBottom: 24 }}>
      <View style={{ gap: 4, paddingTop: 4 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>मिट्टी रिपोर्ट</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>रिपोर्ट की फोटो डालें या सवाल पूछें</Text>
      </View>

      {/* Primary CTA — Photo picker */}
      <Touchable onPress={pickAndExplain} pressScale={0.97}>
        <View
          style={{
            backgroundColor: colors.accent,
            borderRadius: 20,
            padding: 22,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            minHeight: 96,
            shadowColor: colors.accent,
            shadowOpacity: 0.45,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            elevation: 8,
          }}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Camera size={32} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <View style={{ gap: 4, flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF', lineHeight: 23 }}>
              रिपोर्ट की फोटो से समझें
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.92)' }}>
              फोटो चुनें — हम हिंदी में समझाएँगे
            </Text>
          </View>
        </View>
      </Touchable>

      {/* Ask any farming question (typed) — engine does RAG, else Gemma's own knowledge */}
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>
          खेती से जुड़ा कोई भी सवाल पूछें
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="जैसे: गेहूँ में यूरिया कब डालें?"
            placeholderTextColor={colors.muted}
            onSubmitEditing={ask}
            returnKeyType="send"
            multiline
            style={{
              flex: 1,
              minHeight: 48,
              maxHeight: 120,
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.hairline,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: colors.ink,
            }}
          />
          <Touchable onPress={ask} pressScale={0.95}>
            <View
              style={{
                backgroundColor: colors.accent,
                borderRadius: 14,
                paddingHorizontal: 20,
                paddingVertical: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>पूछें</Text>
            </View>
          </Touchable>
        </View>
      </View>

      {/* Mic button — speaks a sample report question (STT input pending a rebuild) */}
      <View style={{ alignItems: 'center' }}>
        <MicButton listening={listening} onToggle={toggleMic} />
      </View>

      {/* Busy indicator */}
      {busy && <ActivityIndicator color={colors.accent} size="large" />}

      {/* Answer card */}
      {!!answer && (
        <Card>
          <Text style={{ fontSize: 16, lineHeight: 26, color: colors.ink }}>{answer}</Text>
        </Card>
      )}
    </View>
  );
}
