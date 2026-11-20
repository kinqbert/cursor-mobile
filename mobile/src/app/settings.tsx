import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { PillButton } from '@/components/ui/pill-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { NotificationsSection } from '@/components/settings/notifications-section';
import { SecretField } from '@/components/ui/secret-field';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { github, setGithubToken, useHasGithub } from '@/lib/github';
import { radius, space, useColors } from '@/theme';

export default function Settings() {
  const { account, signOut } = useAuth();
  const hasGithub = useHasGithub();
  const ghUser = useQuery({ queryKey: ['gh-me'], queryFn: () => github.me(), enabled: hasGithub });
  const name = [account?.userFirstName, account?.userLastName].filter(Boolean).join(' ');

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="largeTitle">Settings</Text>

        <Section title="Cursor account">
          <Card>
            <Row label="Name" value={name || '—'} />
            <Row label="Email" value={account?.userEmail ?? '—'} />
            <Row label="API key" value={account?.apiKeyName ?? '—'} last />
          </Card>
        </Section>

        <Section
          title="GitHub"
          hint="Used for the PR screen: checks, diffs, deployments and Squash & Merge. Create a fine-grained token with Pull requests (read & write), Contents (read & write), Commit statuses, Checks and Deployments (read).">
          {hasGithub ? (
            <Card>
              <Row label="Signed in as" value={ghUser.data?.login ?? (ghUser.isError ? 'Token invalid' : '…')} />
              <Row
                label="Token"
                value="Remove"
                valueColor="danger"
                last
                onPress={() => setGithubToken(null)}
              />
            </Card>
          ) : (
            <SecretField
              placeholder="github_pat_…"
              submitLabel="Save GitHub token"
              onSubmit={async (v) => {
                await github.me(v); // validate before storing
                await setGithubToken(v);
              }}
            />
          )}
        </Section>

        <Section
          title="Notifications"
          hint="Instant alerts when agents finish or fail, plus a silent “N Active” summary. Paste the URL of your deployed worker and the APP_SECRET you set on it.">
          <NotificationsSection />
        </Section>

        <PillButton
          title="Sign out"
          variant="secondary"
          style={{ marginTop: space.xxxl }}
          onPress={() =>
            Alert.alert('Sign out?', 'The Cursor API key will be removed from this device.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: signOut },
            ])
          }
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: space.xxl, gap: space.sm }}>
      <Text variant="section" color="textSecondary">
        {title}
      </Text>
      {children}
      {hint ? (
        <Text variant="caption" color="textTertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.surface }]}>{children}</View>;
}

function Row({
  label,
  value,
  last,
  onPress,
  valueColor = 'textSecondary',
}: {
  label: string;
  value: string;
  last?: boolean;
  onPress?: () => void;
  valueColor?: 'textSecondary' | 'danger' | 'accent' | 'success';
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
      ]}>
      <Text variant="callout">{label}</Text>
      <Text variant="callout" color={valueColor} numberOfLines={1} style={{ flexShrink: 1 }} onPress={onPress}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingBottom: 64 },
  card: { borderRadius: radius.lg, paddingHorizontal: space.lg },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.md + 2,
  },
});
