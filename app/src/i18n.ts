import { createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'hi' | 'en';

// Bilingual strings. Hindi is the primary language (voice-first farmer app);
// English is the toggle. Keep copy SHORT — many users are low-literacy.
const STRINGS = {
  // common
  appName: { hi: 'FasalSaathi', en: 'FasalSaathi' },
  tagline: { hi: 'किसान का साथी', en: "The farmer's companion" },
  continue: { hi: 'आगे बढ़ें', en: 'Continue' },
  back: { hi: 'पीछे', en: 'Back' },
  save: { hi: 'सेव करें', en: 'Save' },
  edit: { hi: 'बदलें', en: 'Edit' },
  loading: { hi: 'लोड हो रहा है…', en: 'Loading…' },
  somethingWrong: { hi: 'कुछ गड़बड़ हुई। फिर कोशिश करें।', en: 'Something went wrong. Please try again.' },
  cantReachServer: { hi: 'सर्वर से संपर्क नहीं हो पाया। जांचें कि बैकएंड चालू है।', en: "Can't reach the server. Make sure the backend is running." },
  quintal: { hi: 'क्विंटल', en: 'quintal' },
  perQuintal: { hi: '/क्विंटल', en: '/quintal' },

  // tabs
  tabHome: { hi: 'होम', en: 'Home' },
  tabPrices: { hi: 'भाव', en: 'Prices' },
  tabSell: { hi: 'बेचें/रखें', en: 'Sell/Store' },
  tabJaaniye: { hi: 'जानिए', en: 'Jaaniye' },

  // auth
  login: { hi: 'लॉग इन', en: 'Log in' },
  signup: { hi: 'साइन अप', en: 'Sign up' },
  phone: { hi: 'मोबाइल नंबर', en: 'Mobile number' },
  phonePlaceholder: { hi: '10 अंकों का मोबाइल नंबर', en: '10-digit mobile number' },
  password: { hi: 'पासवर्ड', en: 'Password' },
  passwordPlaceholder: { hi: 'कम से कम 8 अक्षर', en: 'At least 8 characters' },
  fullName: { hi: 'पूरा नाम', en: 'Full name' },
  namePlaceholder: { hi: 'जैसे रमेश पाटीदार', en: 'e.g. Ramesh Patidar' },
  loginSubtitle: { hi: 'जारी रखने के लिए लॉग इन करें', en: 'Log in to continue' },
  signupSubtitle: { hi: 'नया खाता बनाएं', en: 'Create a new account' },
  newHere: { hi: 'नए हैं?', en: 'New to FasalSaathi?' },
  haveAccount: { hi: 'पहले से खाता है?', en: 'Already have an account?' },
  errPhone: { hi: '10 अंकों का सही मोबाइल नंबर डालें', en: 'Enter a valid 10-digit mobile number' },
  errPassword: { hi: 'पासवर्ड कम से कम 8 अक्षर का हो', en: 'Password must be at least 8 characters' },
  errBadLogin: { hi: 'मोबाइल नंबर या पासवर्ड गलत है', en: 'Wrong mobile number or password' },
  errPhoneTaken: { hi: 'इस नंबर से खाता पहले से है। लॉग इन करें।', en: 'An account with this number exists. Please log in.' },

  // onboarding
  welcome: { hi: 'स्वागत है 🙏', en: 'Welcome 🙏' },
  onbIntro: {
    hi: 'कुछ जानकारी दें ताकि हम आपके लिए सही भाव और सलाह दिखा सकें।',
    en: 'Tell us a few details so we can show prices and advice made for you.',
  },
  step: { hi: 'चरण', en: 'Step' },
  yourDetails: { hi: 'आपकी जानकारी', en: 'Your details' },
  farmDetails: { hi: 'खेत की जानकारी', en: 'Farm details' },
  aadhaar: { hi: 'आधार नंबर (वैकल्पिक)', en: 'Aadhaar number (optional)' },
  aadhaarNote: { hi: 'सिर्फ योजना पात्रता के लिए। सुरक्षित रखा जाता है।', en: 'Only for scheme eligibility. Stored securely.' },
  farmLocation: { hi: 'खेत का स्थान', en: 'Farm location' },
  useMyLocation: { hi: 'मेरा स्थान इस्तेमाल करें', en: 'Use my current location' },
  detecting: { hi: 'पता लगा रहे हैं…', en: 'Detecting…' },
  village: { hi: 'गाँव / क्षेत्र', en: 'Village / area' },
  district: { hi: 'जिला', en: 'District' },
  stateLabel: { hi: 'राज्य', en: 'State' },
  pincode: { hi: 'पिन कोड', en: 'PIN code' },
  farmSize: { hi: 'खेत का आकार', en: 'Farm size' },
  mainCrop: { hi: 'मुख्य फसल', en: 'Main crop' },
  cropPlaceholder: { hi: 'जैसे सोयाबीन', en: 'e.g. Soybean' },
  getStarted: { hi: 'शुरू करें', en: 'Get started' },
  errName: { hi: 'अपना नाम डालें', en: 'Please enter your name' },
  errDistrict: { hi: 'जिला डालें', en: 'Please enter your district' },
  errVillage: { hi: 'गाँव / क्षेत्र डालें', en: 'Please enter your village / area' },
  errFarmSize: { hi: 'खेत का आकार डालें', en: 'Enter your farm size' },
  errCrop: { hi: 'मुख्य फसल चुनें', en: 'Choose your main crop' },

  // home
  namaste: { hi: 'नमस्ते', en: 'Namaste' },
  profile: { hi: 'प्रोफ़ाइल', en: 'Profile' },
  todaysPrice: { hi: 'आज का भाव', en: "Today's price" },
  whatDoYouNeed: { hi: 'आपको क्या चाहिए?', en: 'What do you need?' },
  navPricesTitle: { hi: 'भाव देखें', en: 'Check Prices' },
  navPricesSub: { hi: 'आज के मंडी भाव', en: "Today's mandi rates" },
  navSellTitle: { hi: 'बेचें या रखें?', en: 'Sell or Store?' },
  navSellSub: { hi: 'मुनाफे का हिसाब', en: 'The profit math' },
  navJaaniyeTitle: { hi: 'जानिए', en: 'Jaaniye' },
  navJaaniyeSub: { hi: 'सवाल पूछें · मिट्टी जांच', en: 'Ask anything · soil report' },
  tapToSpeak: { hi: 'बोलने के लिए दबाएं', en: 'Tap to speak' },
  listening: { hi: 'सुन रहे हैं… रोकने के लिए दबाएं', en: 'Listening… tap to stop' },
  voiceComingSoon: { hi: 'आवाज़ सुविधा जल्द आ रही है — अभी सूची से चुनें', en: 'Voice coming soon — pick from the list for now' },

  // prices (F1)
  pricesTitle: { hi: 'मंडी भाव', en: 'Mandi prices' },
  pricesSub: { hi: 'पिछले 7 दिन · पास की मंडियाँ', en: 'Last 7 days · nearby mandis' },
  pricesAsOf: { hi: 'भाव दिनांक', en: 'Prices as of' },
  marketClosedSunday: { hi: 'आज रविवार — मंडी बंद। नीचे कल (शनिवार) के भाव हैं।', en: "Today is Sunday — mandis closed. Showing Saturday's rates." },
  dataSource: { hi: 'स्रोत: Agmarknet', en: 'Source: Agmarknet' },
  chooseCrop: { hi: 'फसल चुनें', en: 'Choose crop' },
  yesterday: { hi: 'कल', en: 'Yesterday' },
  today: { hi: 'आज', en: 'Today' },
  nearbyMandis: { hi: 'पास की मंडियाँ', en: 'Nearby mandis' },
  distance: { hi: 'दूरी', en: 'Distance' },
  costToReach: { hi: 'मंडी तक पहुँचने का खर्च', en: 'Cost to reach this mandi' },
  transport: { hi: 'भाड़ा', en: 'Transport' },
  labour: { hi: 'मज़दूरी', en: 'Loading labour' },
  netInHand: { hi: 'हाथ में आएगा', en: 'Net in hand' },
  km: { hi: 'किमी', en: 'km' },

  // sell (F2)
  sellTitle: { hi: 'बेचें या रखें?', en: 'Sell or Store?' },
  sellIntro: { hi: 'पूछिए — कौन सी फसल के बारे में जानना चाहते हैं, अभी रखें या बेचें?', en: 'Tell us about your crop — should you hold or sell?' },
  qHarvested: { hi: 'क्या फसल कट चुकी है?', en: 'Is the crop harvested?' },
  yes: { hi: 'हाँ', en: 'Yes' },
  no: { hi: 'नहीं', en: 'No' },
  qCashNeed: { hi: 'क्या अभी पैसों की जरूरत है?', en: 'Need cash urgently right now?' },
  cashAmount: { hi: 'कितने रुपये चाहिए?', en: 'How much do you need? (₹)' },
  quantityQ: { hi: 'कितना माल है? (क्विंटल)', en: 'How much produce? (quintal)' },
  jaanie: { hi: 'जानिए', en: 'Get advice' },
  hold: { hi: 'रखें', en: 'HOLD' },
  sell: { hi: 'बेचें', en: 'SELL' },
  waitDays: { hi: 'दिन रुकें', en: 'wait days' },
  expectedPrice: { hi: 'अनुमानित भाव', en: 'Expected price' },
  sellNowLabel: { hi: 'अभी बेचा तो', en: 'If you sell now' },
  total: { hi: 'कुल', en: 'Total' },

  // jaaniye (F3)
  jaaniyeTitle: { hi: 'जानिए', en: 'Jaaniye' },
  jaaniyeSub: { hi: 'कोई भी खेती का सवाल पूछें', en: 'Ask any farming question' },
  askPlaceholder: { hi: 'जैसे: सोयाबीन में पीला मोज़ेक रोग कैसे रोकें?', en: 'e.g. How do I stop yellow mosaic in soybean?' },
  askButton: { hi: 'पूछें', en: 'Ask' },
  uploadLabReport: { hi: 'मिट्टी जांच रिपोर्ट की फोटो डालें', en: 'Upload Soil Health Card photo' },
  photoAdded: { hi: 'फोटो जुड़ी ✓', en: 'Photo added ✓' },
  thinking: { hi: 'सोच रहे हैं…', en: 'Thinking…' },
} as const;

export type StringKey = keyof typeof STRINGS;

export function translate(key: StringKey, lang: Lang): string {
  return STRINGS[key][lang];
}

export const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'hi',
  setLang: () => {},
});

/** Hook: returns a t() function bound to the current language + the setter. */
export function useT() {
  const { lang, setLang } = useContext(LangContext);
  const t = (key: StringKey) => translate(key, lang);
  return { t, lang, setLang };
}

const LANG_KEY = 'fasalsaathi.lang';

export async function loadLang(): Promise<Lang> {
  try {
    const v = await AsyncStorage.getItem(LANG_KEY);
    return v === 'en' ? 'en' : 'hi';
  } catch {
    return 'hi';
  }
}

export async function saveLang(l: Lang): Promise<void> {
  try {
    await AsyncStorage.setItem(LANG_KEY, l);
  } catch {
    // ignore
  }
}
