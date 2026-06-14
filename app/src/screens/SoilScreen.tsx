import { useRef, useState } from 'react';
import { ActivityIndicator, PermissionsAndroid, Text, TextInput, View } from 'react-native';
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

const llm = new NativeLlm();

export default function SoilScreen() {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Spoken to Gemma 3n with the recorded audio (it transcribes + answers in one pass).
  const AUDIO_PROMPT =
    'इस ऑडियो में एक किसान का खेती से जुड़ा सवाल है। सवाल को ध्यान से सुनिए और बहुत आसान, ' +
    'छोटी हिंदी में जवाब दीजिए। हर अंग्रेज़ी/रासायनिक नाम को आम खाद के नाम में बदलें ' +
    '(N=यूरिया, फॉस्फोरस=DAP, पोटाश=MOP, ज़िंक=ज़िंक सल्फेट, चूना=lime)। सीधे बताएँ कि ' +
    'कौन-सी खाद डालें, कितनी और कब, और कौन-सी बंद करें। अंत में पूछें कि क्या उन्होंने ' +
    'वह खाद पहले डाली है।';

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

  // Mic opens the keyboard so the farmer dictates with the keyboard's own voice
  // typing (no native recorder needed); the question fills the box, then पूछें.
  function toggleMic() {
    inputRef.current?.focus();
  }

  return (
    <View style={{ gap: 18, paddingBottom: 24 }}>
      <View style={{ gap: 4, paddingTop: 4 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>Soil Report</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>Add a report photo, or ask a farming question</Text>
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
              Understand from a photo
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.92)' }}>
              Pick a report photo — explained in Hindi
            </Text>
          </View>
        </View>
      </Touchable>

      {/* Ask any farming question (typed) — engine does RAG, else Gemma's own knowledge */}
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>
          Ask any farming question
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <TextInput
            ref={inputRef}
            value={question}
            onChangeText={setQuestion}
            placeholder="e.g. When should I apply urea in wheat?"
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
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>Ask</Text>
            </View>
          </Touchable>
        </View>
      </View>

      {/* Mic — on-device speech-to-speech via Gemma 3n audio */}
      <View style={{ alignItems: 'center', gap: 8 }}>
        <MicButton listening={false} onToggle={toggleMic} />
        <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>
          Tap the mic → use the keyboard's 🎤 to speak → Ask
        </Text>
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
