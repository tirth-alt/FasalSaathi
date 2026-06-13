import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Home as HomeIcon, BarChart3, Scale, GraduationCap, Sprout } from 'lucide-react-native';
import { colors } from './src/theme';
import type { TabKey } from './src/theme';
import { clearProfile, loadProfile, saveProfile } from './src/profile';
import type { FarmerProfile } from './src/profile';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import PricesScreen from './src/screens/PricesScreen';
import SellOrStoreScreen from './src/screens/SellOrStoreScreen';
import LearnScreen from './src/screens/LearnScreen';
import SoilScreen from './src/screens/SoilScreen';

const TABS = [
  { id: 'home' as TabKey, label: 'Home', Icon: HomeIcon },
  { id: 'prices' as TabKey, label: 'Prices', Icon: BarChart3 },
  { id: 'sell' as TabKey, label: 'Sell/Store', Icon: Scale },
  { id: 'learn' as TabKey, label: 'Learn', Icon: GraduationCap },
  { id: 'soil' as TabKey, label: 'मिट्टी', Icon: Sprout },
];

export default function App() {
  // undefined = loading from storage, null = needs onboarding, object = signed in
  const [profile, setProfile] = useState<FarmerProfile | null | undefined>(undefined);
  const [tab, setTab] = useState<TabKey>('home');

  useEffect(() => {
    loadProfile().then(setProfile);
  }, []);

  if (profile === undefined) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar style="dark" />
        <Text style={{ fontSize: 30, fontWeight: '900', color: colors.accentDark }}>🌾 FasalSaathi</Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (profile === null) {
    return (
      <OnboardingScreen
        onDone={(p) => {
          saveProfile(p);
          setTab('home');
          setProfile(p);
        }}
      />
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
              clearProfile();
              setProfile(null);
            }}
          />
        )}
        {tab === 'prices' && <PricesScreen />}
        {tab === 'sell' && <SellOrStoreScreen />}
        {tab === 'learn' && <LearnScreen />}
        {tab === 'soil' && <SoilScreen />}
      </ScrollView>

      <View style={styles.tabbar}>
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.Icon;
          return (
            <Pressable key={t.id} style={styles.tab} onPress={() => setTab(t.id)}>
              <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
                <Icon size={22} color={active ? colors.accent : colors.muted} strokeWidth={active ? 2.6 : 2.2} />
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
  tab: { flex: 1, alignItems: 'center', minHeight: 56, justifyContent: 'center', gap: 4 },
  tabIconWrap: { width: 44, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabIconWrapActive: { backgroundColor: colors.soft },
  tabLabel: { fontSize: 11, fontWeight: '500', color: colors.muted },
  tabLabelActive: { fontWeight: '700', color: colors.accent },
});
