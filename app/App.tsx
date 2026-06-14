import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Home as HomeIcon, Coins, Warehouse, Sprout } from 'lucide-react-native';
import { colors } from './src/theme';
import type { TabKey } from './src/theme';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { LangContext, loadLang, saveLang } from './src/i18n';
import type { Lang } from './src/i18n';
import { useT } from './src/i18n';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import PricesScreen from './src/screens/PricesScreen';
import SellOrStoreScreen from './src/screens/SellOrStoreScreen';
import JaaniyeScreen from './src/screens/JaaniyeScreen';

function Splash() {
  return (
    <View style={[styles.root, styles.center]}>
      <StatusBar style="dark" />
      <Text style={{ fontSize: 32, fontWeight: '900', color: colors.accentDark }}>🌾 FasalSaathi</Text>
      <ActivityIndicator color={colors.accentBold} style={{ marginTop: 16 }} />
    </View>
  );
}

/** The authed app shell: bottom-tab navigation across the 4 main screens. */
function MainTabs() {
  const { t } = useT();
  const { farmer, logout } = useAuth();
  const [tab, setTab] = useState<TabKey>('home');

  const TABS = [
    { id: 'home' as TabKey, label: t('tabHome'), Icon: HomeIcon },
    { id: 'prices' as TabKey, label: t('tabPrices'), Icon: Coins },
    { id: 'sell' as TabKey, label: t('tabSell'), Icon: Warehouse },
    { id: 'jaaniye' as TabKey, label: t('tabJaaniye'), Icon: Sprout },
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {tab === 'home' && farmer && <HomeScreen go={setTab} farmer={farmer} onProfile={logout} />}
          {tab === 'prices' && farmer && <PricesScreen farmer={farmer} />}
          {tab === 'sell' && farmer && <SellOrStoreScreen farmer={farmer} />}
          {tab === 'jaaniye' && <JaaniyeScreen />}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.tabbar}>
        {TABS.map((tb) => {
          const active = tab === tb.id;
          const Icon = tb.Icon;
          return (
            <Pressable key={tb.id} style={styles.tab} onPress={() => setTab(tb.id)}>
              <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
                <Icon size={26} color={active ? colors.accentBold : colors.muted} strokeWidth={active ? 2.8 : 2.4} />
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tb.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Routes between auth / onboarding / app based on the auth status. */
function Gate() {
  const { status } = useAuth();
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login');

  if (status === 'loading') return <Splash />;

  if (status === 'unauthed') {
    return authScreen === 'signup' ? (
      <SignupScreen onGoLogin={() => setAuthScreen('login')} />
    ) : (
      <LoginScreen onGoSignup={() => setAuthScreen('signup')} />
    );
  }

  if (status === 'onboarding') return <OnboardingScreen />;

  return <MainTabs />;
}

export default function App() {
  const [lang, setLangState] = useState<Lang>('hi');

  useEffect(() => {
    loadLang().then(setLangState);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    saveLang(l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </LangContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 48 },
  tabbar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 8,
  },
  tab: { flex: 1, alignItems: 'center', minHeight: 58, justifyContent: 'center', gap: 4 },
  tabIconWrap: { width: 52, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabIconWrapActive: { backgroundColor: colors.soft },
  tabLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tabLabelActive: { fontWeight: '800', color: colors.accentBold },
});
