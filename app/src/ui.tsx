import { useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Touchable, lowShadow, softShadow } from './primitives';
import { colors } from './theme';

export function Card({
  children,
  tone = 'white',
  style,
}: {
  children: ReactNode;
  tone?: 'white' | 'soft';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: tone === 'soft' ? colors.soft : colors.surface,
          borderRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: tone === 'soft' ? colors.softBorder : colors.hairline,
        },
        softShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

type PillTone = 'neutral' | 'up' | 'warn' | 'neg' | 'accent';

export function StatPill({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode;
  tone?: PillTone;
  icon?: ReactNode;
}) {
  const map: Record<PillTone, { bg: string; fg: string }> = {
    neutral: { bg: colors.neutralPill, fg: colors.ink },
    up: { bg: colors.upBg, fg: colors.up },
    warn: { bg: colors.warnBg, fg: colors.warn },
    neg: { bg: colors.negBg, fg: colors.neg },
    accent: { bg: colors.soft, fg: colors.accentDark },
  };
  const c = map[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: c.bg,
        paddingVertical: 7,
        paddingHorizontal: 13,
        borderRadius: 999,
        alignSelf: 'flex-start',
      }}
    >
      {icon}
      <Text style={{ color: c.fg, fontSize: 14, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

export function DeltaPill({ value, period }: { value: number; period: string }) {
  const up = value >= 0;
  return (
    <StatPill
      tone={up ? 'up' : 'neg'}
      icon={
        up ? (
          <TrendingUp size={15} color={colors.up} strokeWidth={2.8} />
        ) : (
          <TrendingDown size={15} color={colors.neg} strokeWidth={2.8} />
        )
      }
    >
      {`${up ? '↑' : '↓'} ${Math.abs(value)}% ${period}`}
    </StatPill>
  );
}

export function BreakdownRow({
  label,
  value,
  sub,
  emphasis,
  sign,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
  sign?: '+' | '−';
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: emphasis ? 16 : 11,
        borderTopWidth: emphasis ? 1 : 0,
        borderTopColor: colors.hairline,
        marginTop: emphasis ? 8 : 0,
      }}
    >
      <View style={{ gap: 2, flex: 1, paddingRight: 8 }}>
        <Text
          style={{
            fontSize: emphasis ? 16 : 15,
            color: emphasis ? colors.ink : colors.muted,
            fontWeight: emphasis ? '800' : '600',
          }}
        >
          {label}
        </Text>
        {sub ? <Text style={{ fontSize: 13, color: colors.muted }}>{sub}</Text> : null}
      </View>
      <Text
        style={{
          fontSize: emphasis ? 22 : 16,
          fontWeight: emphasis ? '900' : '700',
          color: emphasis ? colors.accentDark : colors.ink,
        }}
      >
        {sign ? `${sign} ` : ''}
        {value}
      </Text>
    </View>
  );
}

export function NavCard({
  Icon,
  title,
  subtitle,
  onPress,
  tint,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress?: () => void;
  tint?: string;
}) {
  return (
    <Touchable onPress={onPress} style={{ width: '100%' }}>
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 18,
            minHeight: 88,
            borderWidth: 1,
            borderColor: colors.hairline,
          },
          lowShadow,
        ]}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 16,
            backgroundColor: colors.soft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={28} color={tint ?? colors.accentDark} strokeWidth={2.4} />
        </View>
        <View style={{ gap: 3, flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>{title}</Text>
          <Text style={{ fontSize: 15, color: colors.muted }}>{subtitle}</Text>
        </View>
        <ChevronRight size={24} color={colors.accentDark} strokeWidth={2.6} />
      </View>
    </Touchable>
  );
}

export function RiskCallout({ title, body }: { title: string; body: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        backgroundColor: colors.warnBg,
        borderRadius: 16,
        padding: 16,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#F0E0B0',
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: '#FCD888',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AlertTriangle size={22} color="#92400E" strokeWidth={2.6} />
      </View>
      <View style={{ gap: 4, flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#92400E' }}>{title}</Text>
        <Text style={{ fontSize: 15, color: '#78350F', lineHeight: 21 }}>{body}</Text>
      </View>
    </View>
  );
}

export function SchemeRow({
  emoji,
  title,
  desc,
  last,
}: {
  emoji: string;
  title: string;
  desc: string;
  last?: boolean;
}) {
  return (
    <Touchable style={{ width: '100%' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingVertical: 15,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: colors.hairline,
        }}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            backgroundColor: colors.soft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 24 }}>{emoji}</Text>
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>{title}</Text>
          <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 19 }}>{desc}</Text>
        </View>
        <ChevronRight size={22} color={colors.accentDark} strokeWidth={2.6} />
      </View>
    </Touchable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
  error,
  note,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  maxLength?: number;
  error?: string;
  note?: string;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChangeText(keyboardType === 'number-pad' ? t.replace(/[^0-9]/g, '') : t)}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: error ? colors.neg : colors.hairline,
          paddingHorizontal: 14,
          paddingVertical: 14,
          fontSize: 17,
          color: colors.ink,
        }}
      />
      {error ? (
        <Text style={{ fontSize: 13, color: colors.neg, fontWeight: '700' }}>{error}</Text>
      ) : note ? (
        <Text style={{ fontSize: 13, color: colors.muted }}>{note}</Text>
      ) : null}
    </View>
  );
}

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Touchable onPress={onPress} pressScale={0.98} style={{ width: '100%' }}>
      <View
        style={{
          backgroundColor: colors.accentBold,
          borderRadius: 16,
          paddingVertical: 18,
          alignItems: 'center',
          shadowColor: colors.accentBold,
          shadowOpacity: 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>{label}</Text>
      </View>
    </Touchable>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: colors.hairline,
          paddingHorizontal: 14,
          paddingVertical: 14,
        }}
      >
        <Text style={{ fontSize: 17, color: value ? colors.ink : colors.faint }}>
          {value || placeholder || 'Select'}
        </Text>
        <ChevronDown size={22} color={colors.muted} strokeWidth={2.4} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(35,32,28,0.4)', justifyContent: 'flex-end' }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: 24,
              maxHeight: '70%',
            }}
            onPress={() => {}}
          >
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ width: 40, height: 5, borderRadius: 999, backgroundColor: colors.hairline }} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink, paddingHorizontal: 20, paddingBottom: 6 }}>
              {label}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((opt) => {
                const sel = opt === value;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 20,
                      paddingVertical: 15,
                      backgroundColor: sel ? colors.soft : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 17,
                        color: sel ? colors.accentDark : colors.ink,
                        fontWeight: sel ? '800' : '500',
                      }}
                    >
                      {opt}
                    </Text>
                    {sel ? <Check size={20} color={colors.accentBold} strokeWidth={2.8} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
