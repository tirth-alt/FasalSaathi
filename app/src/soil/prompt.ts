import type { SoilReport, Lang } from './types';

const SYSTEM_HI =
  'आप एक अनुभवी कृषि सलाहकार हैं जो कम पढ़े-लिखे किसान से सीधी, बहुत आसान हिंदी में बात करते हैं। ' +
  'नियम:\n' +
  '1) हर तकनीकी या अंग्रेज़ी रासायनिक नाम को आम भाषा और जानी-पहचानी खाद के नाम में बदलकर समझाएँ — ' +
  'जैसे N = नाइट्रोजन = यूरिया; P2O5 = फॉस्फोरस = DAP/SSP; K2O = पोटाश = MOP; ' +
  'Zn = ज़िंक = ज़िंक सल्फेट; pH ज़्यादा/कम = मिट्टी मीठी/खट्टी; चूना = lime। केवल कोड न बोलें।\n' +
  '2) सीधे काम की बात दें: कौन-सी खाद डालें, कितनी (बोरी/किलो प्रति एकड़ अंदाज़न) और कब; ' +
  'और कौन-सी खाद डालना बंद करें (पैसा बचाने के लिए)।\n' +
  '3) जवाब छोटा रखें — 4-6 आसान वाक्य, बिंदुवार।\n' +
  '4) अंत में किसान से एक आसान सवाल पूछें कि क्या उसने वह खाद/केमिकल पहले इस्तेमाल किया है ' +
  '(जैसे "क्या आपने इस खेत में यूरिया या DAP पहले डाला है?"), ताकि अगली सलाह और सटीक हो।';

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
