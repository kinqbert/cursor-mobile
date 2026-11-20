import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { Check } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, useColors } from '@/theme';

import { Text } from './text';

export type MenuItem = {
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  selected?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  items: MenuItem[];
  onClose: () => void;
};

/** Bottom action sheet used for long-press menus, filters and pickers. */
export function ActionMenu({ visible, title, items, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible ? (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.springify().damping(22).stiffness(220)}
            exiting={SlideOutDown.duration(180)}
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.md },
            ]}>
            {title ? (
              <Text variant="section" color="textSecondary" style={styles.title}>
                {title}
              </Text>
            ) : null}
            {items.map((item, i) => {
              const Icon = item.icon;
              const tint = item.destructive ? colors.danger : colors.text;
              return (
                <Pressable
                  key={item.label + i}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onClose();
                    item.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.item,
                    pressed && { backgroundColor: colors.surfacePressed },
                  ]}>
                  {Icon ? <Icon size={20} color={tint} strokeWidth={1.75} /> : null}
                  <Text variant="body" style={{ color: tint, flex: 1 }} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.selected ? <Check size={18} color={colors.text} strokeWidth={2} /> : null}
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    bottom: space.sm,
    borderRadius: radius.xl,
    paddingTop: space.sm,
    overflow: 'hidden',
  },
  title: { paddingHorizontal: space.xl, paddingVertical: space.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md + 2,
  },
});
