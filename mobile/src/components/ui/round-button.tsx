import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { useColors, useIsDark } from '@/theme';

type Props = {
  icon: LucideIcon;
  onPress?: () => void;
  size?: number;
  accessibilityLabel: string;
  style?: ViewStyle;
  disabled?: boolean;
};

/** Floating circular icon button, like the iOS app's frosted toolbar buttons. */
export function RoundButton({ icon: Icon, onPress, size = 42, accessibilityLabel, style, disabled }: Props) {
  const colors = useColors();
  const dark = useIsDark();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: pressed ? colors.surfacePressed : dark ? colors.surfaceMuted : colors.surface,
          shadowColor: colors.shadow,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}>
      <Icon size={size * 0.48} color={colors.text} strokeWidth={1.75} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});
