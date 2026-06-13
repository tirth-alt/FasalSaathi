import type { SoilReport, Lang } from './types';

const SYSTEM_HI =
  'आप एक अनुभवी कृषि सलाहकार हैं जो किसान से सीधी, आसान हिंदी में बात करते हैं। ' +
  'तकनीकी शब्द कम से कम रखें। जवाब छोटा और साफ़ हो: (1) रिपोर्ट का मतलब, ' +
  '(2) कौन-सी खाद डालें, (3) कौन-सी खाद बंद करें। ज़रूरत न हो तो खाद न सुझाएँ।';

const LANG_LABEL: Record<Lang, string> = { hi: 'हिंदी', en: 'English' };

export function composeExplain(report: SoilReport, lang: Lang): string {
  return [
    SYSTEM_HI,
    `भाषा: सिर्फ़ ${LANG_LABEL[lang]} में जवाब दें।`,
    'नीचे मिट्टी रिपोर्ट JSON में है:',
    '```json',
    JSON.stringify(report, null, 2),
    '```',
    'इस रिपोर्ट को किसान को समझाइए: मतलब, कौन-सी खाद डालें, कौन-सी बंद करें।',
  ].join('\n');
}

export function composeAnswer(
  question: string,
  report: SoilReport,
  kbChunks: string[],
  lang: Lang,
): string {
  const grounding = kbChunks.length
    ? ['भरोसेमंद जानकारी (इसी के आधार पर जवाब दें):', ...kbChunks.map((c) => `- ${c}`)].join('\n')
    : 'कोई संग्रहित जानकारी नहीं मिली — अपनी कृषि समझ से जवाब दें।';
  return [
    SYSTEM_HI,
    `भाषा: सिर्फ़ ${LANG_LABEL[lang]} में जवाब दें।`,
    grounding,
    'रिपोर्ट:',
    '```json',
    JSON.stringify(report, null, 2),
    '```',
    `किसान का सवाल: ${question}`,
  ].join('\n');
}
