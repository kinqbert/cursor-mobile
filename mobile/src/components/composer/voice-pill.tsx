import { Square } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { radius, space, useColors } from '@/theme';

/** "■ 0:02 ▮▮▮▮" recording pill shown while dictating. Tap to stop. */
export function VoicePill({ startedAt, level, onStop }: { startedAt: number; level: number; onStop: () => void }) {
  const colors = useColors();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <Pressable onPress={onStop} style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}>
      <View style={[styles.stop, { backgroundColor: colors.text }]}>
        <Square size={9} color={colors.surface} fill={colors.surface} />
      </View>
      <Text variant="callout" style={{ fontVariant: ['tabular-nums'] }}>
        {time}
      </Text>
      <View style={styles.bars}>
        {[0.6, 1, 0.75, 0.9, 0.5].map((w, i) => (
          <Bar key={i} weight={w} level={level} color={colors.textSecondary} />
        ))}
      </View>
    </Pressable>
  );
}

function Bar({ weight, level, color }: { weight: number; level: number; color: string }) {
  const style = useAnimatedStyle(() => ({
    height: withSpring(4 + 12 * Math.min(1, level * weight + 0.15), { damping: 14 }),
  }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 36,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
  },
  stop: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 18, paddingRight: 4 },
  bar: { width: 3, borderRadius: 1.5 },
});
