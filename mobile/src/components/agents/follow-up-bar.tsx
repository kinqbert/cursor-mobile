import { ArrowUp, Mic, Square } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VoicePill } from '@/components/composer/voice-pill';
import { Text } from '@/components/ui/text';
import { useDictation } from '@/lib/voice';
import { fonts, radius, space, useColors, useIsDark } from '@/theme';

type Props = {
  working: boolean;
  onSend: (text: string) => Promise<void>;
  onStop: () => void;
};

/** Bottom follow-up input. While the agent works, sending steers the running turn. */
export function FollowUpBar({ working, onSend, onStop }: Props) {
  const colors = useColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = useRef('');
  const dictation = useDictation((t) => setText(base.current ? `${base.current.trimEnd()} ${t}` : t));

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    dictation.stop();
    setSending(true);
    setError(null);
    try {
      await onSend(value);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const hasText = !!text.trim();

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + space.sm }]}>
      {error || dictation.error ? (
        <Text variant="caption" color="danger" style={{ marginBottom: space.xs, paddingHorizontal: space.sm }}>
          {error ?? dictation.error}
        </Text>
      ) : null}
      <View
        style={[
          styles.bar,
          { backgroundColor: dark ? colors.surfaceMuted : colors.surface, shadowColor: colors.shadow },
        ]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={working ? 'Steer the agent…' : 'Add a follow-up…'}
          placeholderTextColor={colors.textTertiary}
          multiline
          style={[styles.input, { color: colors.text }]}
        />
        {dictation.listening && dictation.startedAt ? (
          <VoicePill startedAt={dictation.startedAt} level={dictation.level} onStop={dictation.stop} />
        ) : !hasText ? (
          <Pressable
            hitSlop={6}
            onPress={() => {
              base.current = text;
              dictation.start();
            }}
            style={[styles.circle, { backgroundColor: colors.surfacePressed }]}>
            <Mic size={18} color={colors.text} strokeWidth={1.75} />
          </Pressable>
        ) : null}
        {working && !hasText ? (
          <Pressable
            hitSlop={6}
            onPress={onStop}
            accessibilityLabel="Stop agent"
            style={[styles.circle, { backgroundColor: colors.primary }]}>
            <Square size={13} color={colors.onPrimary} fill={colors.onPrimary} />
          </Pressable>
        ) : (
          <Pressable
            hitSlop={6}
            disabled={!hasText || sending}
            onPress={send}
            style={[styles.circle, { backgroundColor: colors.primary, opacity: hasText ? 1 : 0.3 }]}>
            {sending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <ArrowUp size={20} color={colors.onPrimary} strokeWidth={2} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.md, paddingTop: space.sm },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    minHeight: 54,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.xl + 4,
    elevation: 6,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  input: {
    flex: 1,
    maxHeight: 140,
    minHeight: 38,
    paddingTop: 8,
    paddingBottom: 8,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
