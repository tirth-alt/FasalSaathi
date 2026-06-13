import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
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

// Lazy-require Voice so the bundle does not crash if the native module is absent
// (on a bare Expo managed build without a native rebuild, the module is missing).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Voice: any | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Voice = require('@react-native-voice/voice').default;
} catch {
  // Native module absent — mic falls back to the canned demo question.
}

const CANNED_QUESTION = 'मेरी रिपोर्ट में फॉस्फोरस ज़्यादा है, क्या करूँ?';

const llm = new NativeLlm();

export default function SoilScreen() {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string>('');
  const [listening, setListening] = useState(false);

  const speak = (t: string) => Speech.speak(t, { language: 'hi-IN' });

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setAnswer('');
    try {
      const text = await fn();
      setAnswer(text);
      speak(text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setAnswer('माफ़ कीजिए, अभी जवाब नहीं बन पाया। कृपया दोबारा कोशिश करें। (' + msg + ')');
    } finally {
      setBusy(false);
    }
  }

  async function pickAndExplain() {
    // Request permission then open picker; OCR is skipped — pre-staged report used.
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    await run(() => explainReport(SAMPLE_REPORT, { llm, lang: 'hi' }).then((a) => a.text));
  }

  async function toggleMic() {
    if (listening) {
      // Stop listening
      setListening(false);
      try {
        if (Voice) await Voice.stop();
      } catch {
        // ignore stop errors
      }
      return;
    }

    // Start listening
    setListening(true);

    if (!Voice) {
      // Voice module unavailable — run canned demo question immediately
      setListening(false);
      await run(() =>
        answerQuestion(CANNED_QUESTION, SAMPLE_REPORT, { llm, lang: 'hi' }).then((a) => a.text),
      );
      return;
    }

    try {
      Voice.onSpeechResults = (e: { value?: string[] }) => {
        const q = e.value?.[0];
        setListening(false);
        if (q) {
          run(() => answerQuestion(q, SAMPLE_REPORT, { llm, lang: 'hi' }).then((a) => a.text));
        }
      };
      Voice.onSpeechError = () => {
        // STT failed — fall back to canned demo question
        setListening(false);
        run(() =>
          answerQuestion(CANNED_QUESTION, SAMPLE_REPORT, { llm, lang: 'hi' }).then((a) => a.text),
        );
      };
      await Voice.start('hi-IN');
    } catch {
      // Voice.start threw (permissions denied, module issue, etc.)
      setListening(false);
      await run(() =>
        answerQuestion(CANNED_QUESTION, SAMPLE_REPORT, { llm, lang: 'hi' }).then((a) => a.text),
      );
    }
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

      {/* Mic button */}
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
