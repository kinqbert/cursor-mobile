import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { radius, useColors } from '@/theme';

import { Text } from './text';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

/** Black (or light, in dark mode) full-width pill, as used for "Squash & Merge". */
export function PillButton({ title, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const colors = useColors();
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: primary ? colors.primary : colors.surfaceMuted,
          opacity: inactive ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? colors.onPrimary : colors.text} />
      ) : (
        <Text variant="bodyMedium" style={{ color: primary ? colors.onPrimary : colors.text }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
