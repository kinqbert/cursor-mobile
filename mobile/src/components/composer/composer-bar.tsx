import * as Haptics from 'expo-haptics';
import { Mic, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { radius, space, useColors, useIsDark } from '@/theme';

type Props = {
  placeholder?: string;
  onPress: () => void;
  onAttach?: () => void;
  onMic?: () => void;
};

/** Collapsed floating composer pill pinned to the bottom: "+  Plan, ask, build…  🎙". */
export function ComposerBar({ placeholder = 'Plan, ask, build…', onPress, onAttach, onMic }: Props) {
  const colors = useColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom + space.sm }]}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onPress();
        }}
        style={[
          styles.bar,
          {
            backgroundColor: dark ? colors.surfaceMuted : colors.surface,
            shadowColor: colors.shadow,
          },
        ]}>
        <Pressable
          hitSlop={8}
          onPress={onAttach ?? onPress}
          style={[styles.circle, { backgroundColor: colors.surfacePressed }]}>
          <Plus size={20} color={colors.text} strokeWidth={1.75} />
        </Pressable>
        <Text variant="body" color="textTertiary" style={{ flex: 1 }} numberOfLines={1}>
          {placeholder}
        </Text>
        <Pressable
          hitSlop={8}
          onPress={onMic ?? onPress}
          style={[styles.circle, { backgroundColor: colors.surfacePressed }]}>
          <Mic size={18} color={colors.text} strokeWidth={1.75} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: 58,
    paddingHorizontal: space.sm + 2,
    borderRadius: radius.pill,
    elevation: 6,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
