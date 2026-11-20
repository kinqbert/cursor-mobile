import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { fonts, radius, space, useColors } from '@/theme';

export default function Welcome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(key);
      // The protected-route guard flips and routes to the home screen.
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? 'That key was rejected. Check that you copied the whole key.'
          : e instanceof Error
            ? e.message
            : 'Something went wrong',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 72, paddingBottom: insets.bottom + space.xxl },
      ]}
      keyboardShouldPersistTaps="handled">
      <Text variant="largeTitle">Build from anywhere</Text>
      <Text variant="largeTitle" color="textSecondary">
        Connect your Cursor account to launch and manage cloud agents.
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="meta" color="textSecondary">
          1. Sign in at cursor.com with your work email{'\n'}
          2. Dashboard → API Keys → create a key{'\n'}
          3. Paste it below. It is stored encrypted on this device.
        </Text>
        <Pressable onPress={() => WebBrowser.openBrowserAsync('https://cursor.com/dashboard/api')}>
          <Text variant="meta" color="accent" style={{ marginTop: space.sm }}>
            Open Cursor dashboard ↗
          </Text>
        </Pressable>
      </View>

      <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={key}
          onChangeText={setKey}
          placeholder="key_…"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={[styles.input, { color: colors.text }]}
          onSubmitEditing={submit}
        />
        <Pressable
          onPress={async () => setKey((await Clipboard.getStringAsync()).trim())}
          hitSlop={8}>
          <Text variant="meta" color="accent">
            Paste
          </Text>
        </Pressable>
      </View>

      {error ? (
        <Text variant="meta" color="danger">
          {error}
        </Text>
      ) : null}

      <PillButton title="Continue" onPress={submit} loading={loading} disabled={!key.trim()} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: space.xxl, gap: space.lg },
  card: {
    marginTop: space.xxl,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, height: 50, fontFamily: fonts.regular, fontSize: 16 },
});
