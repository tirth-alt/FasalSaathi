import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Home as HomeIcon, Coins, Warehouse, Sprout } from 'lucide-react-native';
import { colors } from './src/theme';
import type { TabKey } from './src/theme';
import { loadProfile, saveProfile } from './src/profile';
import type { FarmerProfile } from './src/profile';
import LoginScreen from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import PricesScreen from './src/screens/PricesScreen';
import SellOrStoreScreen from './src/screens/SellOrStoreScreen';
import LearnScreen from './src/screens/LearnScreen';

const TABS = [
  { id: 'home' as TabKey, label: 'Home', Icon: HomeIcon },
  { id: 'prices' as TabKey, label: 'Prices', Icon: Coins },
  { id: 'sell' as TabKey, label: 'Sell/Store', Icon: Warehouse },
  { id: 'learn' as TabKey, label: 'Learn', Icon: Sprout },
];

export default function App() {
  const [profile, setProfile] = useState<FarmerProfile | null | undefined>(undefined);
  const [authed, setAuthed] = useState(false);
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login');
  const [tab, setTab] = useState<TabKey>('home');

  useEffect(() => {
    loadProfile().then(setProfile);
  }, []);

  // Loading the saved profile from storage
  if (profile === undefined) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar style="dark" />
        <Text style={{ fontSize: 32, fontWeight: '900', color: colors.accentDark }}>🌾 FasalSaathi</Text>
        <ActivityIndicator color={colors.accentBold} style={{ marginTop: 16 }} />
      </View>
    );
  }

  // Not logged in → login (default) or sign-up flow
  if (!authed) {
    if (authScreen === 'signup') {
      return (
        <OnboardingScreen
          onBack={() => setAuthScreen('login')}
          onDone={(p) => {
            saveProfile(p);
            setProfile(p);
            setTab('home');
            setAuthed(true);
          }}
        />
      );
    }
    return (
      <LoginScreen
        onSignup={() => setAuthScreen('signup')}
        onLogin={(phone) => {
          if (profile && profile.phone === phone) {
            setTab('home');
            setAuthed(true);
            return true;
          }
          return false;
        }}
      />
    );
  }

  // Authed but somehow no profile — guard
  if (!profile) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.accentBold} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {tab === 'home' && (
          <HomeScreen
            go={setTab}
            profile={profile}
            onEditProfile={() => {
              // Log out (keeps the saved account so you can log back in)
              setAuthed(false);
              setAuthScreen('login');
            }}
          />
        )}
        {tab === 'prices' && <PricesScreen />}
        {tab === 'sell' && <SellOrStoreScreen />}
        {tab === 'learn' && <LearnScreen />}
      </ScrollView>

      <View style={styles.tabbar}>
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.Icon;
          return (
            <Pressable key={t.id} style={styles.tab} onPress={() => setTab(t.id)}>
              <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
                <Icon size={26} color={active ? colors.accentBold : colors.muted} strokeWidth={active ? 2.8 : 2.4} />
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 24 },
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
