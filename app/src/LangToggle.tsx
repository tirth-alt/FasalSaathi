import { Pressable, Text, View } from 'react-native';
import { colors } from './theme';
import { useT } from './i18n';
import type { Lang } from './i18n';

/** Small hi/en pill toggle. Used on the auth screens (top-right). */
export function LangToggle() {
  const { lang, setLang } = useT();
  const opts: { key: Lang; label: string }[] = [
    { key: 'hi', label: 'हिंदी' },
    { key: 'en', label: 'EN' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-end',
        backgroundColor: colors.neutralPill,
        borderRadius: 999,
        padding: 4,
        gap: 2,
      }}
    >
      {opts.map((o) => {
        const active = lang === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => setLang(o.key)}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: active ? colors.accentBold : 'transparent',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', color: active ? '#FFFFFF' : colors.muted }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
