import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Mic, Square } from 'lucide-react-native';
import { Touchable } from './primitives';

export function MicButton({ listening, onToggle }: { listening: boolean; onToggle: () => void }) {
  const bg = listening ? '#DC2626' : '#E07B3A';
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!listening) return;
    const make = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 1600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
    const a = make(ring1, 0);
    const b = make(ring2, 500);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
      ring1.setValue(0);
      ring2.setValue(0);
    };
  }, [listening, ring1, ring2]);

  const ringStyle = (v: Animated.Value) => ({
    position: 'absolute' as const,
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 999,
    backgroundColor: '#DC2626',
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
  });

  return (
    <View style={{ width: 168, height: 168, alignItems: 'center', justifyContent: 'center' }}>
      {listening ? (
        <>
          <Animated.View style={ringStyle(ring1)} />
          <Animated.View style={ringStyle(ring2)} />
        </>
      ) : (
        <View
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            right: 4,
            bottom: 4,
            borderRadius: 999,
            backgroundColor: '#E07B3A',
            opacity: 0.18,
          }}
        />
      )}

      <Touchable
        onPress={onToggle}
        accessibilityLabel={listening ? 'Stop listening' : 'Start listening'}
        pressScale={0.94}
        style={{
          width: 132,
          height: 132,
          borderRadius: 999,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#E07B3A',
          shadowOpacity: 0.5,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 10,
        }}
      >
        {listening ? <Waveform /> : <Mic size={56} color="#FFFFFF" strokeWidth={2.2} />}
      </Touchable>

      {listening ? (
        <View
          style={{
            position: 'absolute',
            bottom: -2,
            right: 6,
            width: 32,
            height: 32,
            borderRadius: 999,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          }}
        >
          <Square size={14} color="#DC2626" fill="#DC2626" strokeWidth={2} />
        </View>
      ) : null}
    </View>
  );
}

function Waveform() {
  const heights = [22, 38, 56, 38, 22];
  const delays = [0, 120, 240, 120, 0];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {heights.map((h, i) => (
        <Bar key={i} height={h} delay={delays[i]} />
      ))}
    </View>
  );
}

function Bar({ height, delay }: { height: number; delay: number }) {
  const v = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.3, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return (
    <Animated.View
      style={{ width: 6, height, borderRadius: 999, backgroundColor: '#FFFFFF', transform: [{ scaleY: v }] }}
    />
  );
}

// Numbers count up on mount.
export function useCountUp(target: number, durationMs = 900): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return val;
}
