import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { PillButton } from '@/components/ui/pill-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { radius, space, useColors } from '@/theme';

export default function Settings() {
  const colors = useColors();
  const { account, signOut } = useAuth();
  const name = [account?.userFirstName, account?.userLastName].filter(Boolean).join(' ');

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="largeTitle">Settings</Text>

        <Text variant="section" color="textSecondary" style={styles.sectionLabel}>
          Cursor account
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Row label="Name" value={name || '—'} />
          <Row label="Email" value={account?.userEmail ?? '—'} />
          <Row label="API key" value={account?.apiKeyName ?? '—'} last />
        </View>

        <PillButton
          title="Sign out"
          variant="secondary"
          style={{ marginTop: space.xxl }}
          onPress={() =>
            Alert.alert('Sign out?', 'The API key will be removed from this device.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: signOut },
            ])
          }
        />
      </ScrollView>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
      ]}>
      <Text variant="callout">{label}</Text>
      <Text variant="callout" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingBottom: 48 },
  sectionLabel: { marginTop: space.xxl, marginBottom: space.sm },
  card: { borderRadius: radius.lg, paddingHorizontal: space.lg },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.md + 2,
  },
});
