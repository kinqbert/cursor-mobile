import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import {
  connectWorker,
  disconnectWorker,
  getWorkerConfig,
  pushSupported,
  sendTestNotification,
} from '@/lib/notifications';
import { fonts, radius, space, useColors } from '@/theme';

/** Connect the Cloudflare push worker: URL + shared secret → registers this device. */
export function NotificationsSection() {
  const colors = useColors();
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: ['worker-config'], queryFn: getWorkerConfig });
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (done) Alert.alert(done);
      qc.invalidateQueries({ queryKey: ['worker-config'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!pushSupported()) {
    return (
      <Text variant="callout" color="textSecondary">
        Push notifications need the installed app build (they don&apos;t work in Expo Go).
      </Text>
    );
  }

  if (cfg.data) {
    return (
      <View style={{ gap: space.sm }}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text variant="callout">Connected</Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {cfg.data.url}
          </Text>
        </View>
        {error ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}
        <PillButton
          title="Send test notification"
          variant="secondary"
          loading={busy}
          onPress={() => run(sendTestNotification)}
        />
        <PillButton title="Disconnect" variant="secondary" onPress={() => run(disconnectWorker)} />
      </View>
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="https://cursor-mobile-push.<you>.workers.dev"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
      />
      <TextInput
        value={secret}
        onChangeText={setSecret}
        placeholder="APP_SECRET"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
      />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
      <PillButton
        title="Enable notifications"
        variant="secondary"
        loading={busy}
        disabled={!url.trim() || !secret.trim()}
        onPress={() => run(() => connectWorker({ url: url.trim(), secret: secret.trim() }), 'Notifications enabled')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.lg, gap: 2 },
  input: {
    height: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});
