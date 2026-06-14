import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, LogOut, MapPin, Phone, Ruler, Sprout, Globe } from 'lucide-react-native';
import { colors } from '../theme';
import { useT } from '../i18n';
import { useAuth } from '../auth/AuthContext';
import { cropLabel } from '../crops';
import { loadExtras } from '../profileExtras';
import type { ProfileExtras } from '../profileExtras';

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '700' }}>{label}</Text>
        <Text style={{ fontSize: 16, color: colors.ink, fontWeight: '700' }}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { t, lang } = useT();
  const { farmer, logout } = useAuth();
  const [extras, setExtras] = useState<ProfileExtras>({});

  useEffect(() => {
    loadExtras().then(setExtras);
  }, []);

  if (!farmer) return null;

  const initial = (farmer.full_name ?? 'K').trim().charAt(0).toUpperCase();
  const location = [farmer.farm_village, farmer.farm_district, farmer.farm_state].filter(Boolean).join(', ') || '—';
  const size = extras.displaySize
    ? `${extras.displaySize} ${extras.displayUnit}`
    : farmer.farm_area_value
      ? `${farmer.farm_area_value} ${farmer.farm_area_unit}`
      : '—';
  const crop = farmer.primary_crops?.[0] ? cropLabel(farmer.primary_crops[0], lang) : '—';

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView contentContainerStyle={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 40, gap: 20 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={onBack} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={22} color={colors.ink} strokeWidth={2.6} />
          </Pressable>
          <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink }}>{t('profileTitle')}</Text>
        </View>

        {/* Identity */}
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
          <View style={{ width: 88, height: 88, borderRadius: 999, backgroundColor: colors.accentBold, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 40, fontWeight: '900', color: '#fff' }}>{initial}</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.ink }}>{farmer.full_name ?? '—'}</Text>
        </View>

        {/* Details */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: 16 }}>
          <Row icon={<Phone size={20} color={colors.accentDark} strokeWidth={2.4} />} label={t('phone')} value={farmer.phone ?? '—'} />
          <Row icon={<MapPin size={20} color={colors.accentDark} strokeWidth={2.4} />} label={t('locationLabel')} value={location} />
          <Row icon={<Ruler size={20} color={colors.accentDark} strokeWidth={2.4} />} label={t('farmSize')} value={size} />
          <Row icon={<Sprout size={20} color={colors.accentDark} strokeWidth={2.4} />} label={t('mainCrop')} value={crop} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={20} color={colors.accentDark} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '700' }}>{t('language')}</Text>
              <Text style={{ fontSize: 16, color: colors.ink, fontWeight: '700' }}>{lang === 'hi' ? 'हिंदी' : 'English'}</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <Pressable
          onPress={logout}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.negBg, borderRadius: 16, paddingVertical: 16, borderWidth: 1, borderColor: '#F5C2C2' }}
        >
          <LogOut size={20} color={colors.neg} strokeWidth={2.6} />
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.neg }}>{t('logout')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
