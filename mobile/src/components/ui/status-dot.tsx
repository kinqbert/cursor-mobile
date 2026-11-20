import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@/theme';

export type DotState = 'unread' | 'read' | 'working' | 'error';

/** Leading indicator for agent rows: blue = new result, grey = seen, sparkle = working. */
export function StatusDot({ state }: { state: DotState }) {
  const colors = useColors();
  if (state === 'working') return <WorkingSparkle color={colors.accent} />;
  const color =
    state === 'unread' ? colors.accent : state === 'error' ? colors.danger : colors.textTertiary;
  return (
    <View style={styles.box}>
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

// Four small dots around a centre dot that breathe in sequence.
function WorkingSparkle({ color }: { color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [t]);

  const positions = [
    { top: 0, left: 6 },
    { top: 6, left: 12 },
    { top: 12, left: 6 },
    { top: 6, left: 0 },
  ];

  return (
    <View style={styles.box}>
      <View style={styles.sparkle}>
        <View style={[styles.tiny, { top: 6, left: 6, backgroundColor: color }]} />
        {positions.map((p, i) => (
          <SparkleDot key={i} index={i} t={t} color={color} pos={p} />
        ))}
      </View>
    </View>
  );
}

function SparkleDot({
  index,
  t,
  color,
  pos,
}: {
  index: number;
  t: { value: number };
  color: string;
  pos: { top: number; left: number };
}) {
  const style = useAnimatedStyle(() => {
    const phase = (t.value + index / 4) % 1;
    const v = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    return { opacity: 0.25 + v * 0.75, transform: [{ scale: 0.7 + v * 0.4 }] };
  });
  return <Animated.View style={[styles.tiny, pos, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  box: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sparkle: { width: 15, height: 15 },
  tiny: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5 },
});
