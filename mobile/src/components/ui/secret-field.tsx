import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { fonts, radius, space, useColors } from '@/theme';

import { PillButton } from './pill-button';
import { Text } from './text';

type Props = {
  placeholder: string;
  secure?: boolean;
  submitLabel: string;
  onSubmit: (value: string) => Promise<void>;
};

/** Paste-friendly input + submit button with inline error, used for tokens and URLs in Settings. */
export function SecretField({ placeholder, secure = true, submitLabel, onSubmit }: Props) {
  const colors = useColors();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value.trim());
      setValue('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secure}
          style={[styles.input, { color: colors.text }]}
        />
        <Pressable hitSlop={8} onPress={async () => setValue((await Clipboard.getStringAsync()).trim())}>
          <Text variant="meta" color="accent">
            Paste
          </Text>
        </Pressable>
      </View>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
      <PillButton title={submitLabel} variant="secondary" loading={busy} disabled={!value.trim()} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, height: 48, fontFamily: fonts.regular, fontSize: 15 },
});
