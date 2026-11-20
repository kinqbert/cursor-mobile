import * as Haptics from 'expo-haptics';
import { Archive, Pin, PinOff } from 'lucide-react-native';
import { type ReactNode, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { useColors } from '@/theme';

type Props = {
  children: ReactNode;
  pinned: boolean;
  onPin: () => void;
  onArchive: () => void;
};

/** Swipe right → pin/unpin, swipe left → archive. */
export function SwipeableRow({ children, pinned, onPin, onArchive }: Props) {
  const colors = useColors();
  const ref = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      leftThreshold={72}
      rightThreshold={72}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={(progress) => (
        <Action progress={progress} color={colors.accent} align="left">
          {pinned ? <PinOff size={20} color="#fff" /> : <Pin size={20} color="#fff" />}
        </Action>
      )}
      renderRightActions={(progress) => (
        <Action progress={progress} color={colors.danger} align="right">
          <Archive size={20} color="#fff" />
        </Action>
      )}
      onSwipeableOpen={(direction) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Swiping right reveals the left actions.
        if (direction === SwipeDirection.RIGHT) onPin();
        else onArchive();
        ref.current?.close();
      }}>
      {children}
    </ReanimatedSwipeable>
  );
}

function Action({
  progress,
  color,
  align,
  children,
}: {
  progress: SharedValue<number>;
  color: string;
  align: 'left' | 'right';
  children: ReactNode;
}) {
  const iconStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.5),
    transform: [{ scale: 0.6 + Math.min(1, progress.value) * 0.4 }],
  }));
  return (
    <View style={[styles.action, { backgroundColor: color, alignItems: align === 'left' ? 'flex-start' : 'flex-end' }]}>
      <Animated.View style={[styles.icon, iconStyle]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: { width: 96, justifyContent: 'center' },
  icon: { paddingHorizontal: 28 },
});
