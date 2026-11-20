import { GitPullRequest } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusDot, type DotState } from '@/components/ui/status-dot';
import { Text } from '@/components/ui/text';
import type { AgentV0 } from '@/lib/api/types';
import { agentPhase, relativeTime, repoName, statusLabel } from '@/lib/format';
import { space, useColors } from '@/theme';

type Props = {
  agent: AgentV0;
  unread: boolean;
  last?: boolean;
  onPress: (agent: AgentV0) => void;
  onLongPress: (agent: AgentV0) => void;
};

export const AgentRow = memo(function AgentRow({ agent, unread, last, onPress, onLongPress }: Props) {
  const colors = useColors();
  const phase = agentPhase(agent.status);
  const dot: DotState =
    phase === 'working' ? 'working' : phase === 'error' && unread ? 'error' : unread ? 'unread' : 'read';
  const label = statusLabel(agent);

  return (
    <Pressable
      onPress={() => onPress(agent)}
      onLongPress={() => onLongPress(agent)}
      delayLongPress={300}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}>
      <View style={styles.dot}>
        <StatusDot state={dot} />
      </View>
      <View
        style={[
          styles.body,
          !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
        ]}>
        <Text variant="bodyMedium" numberOfLines={1} style={styles.title}>
          {agent.name || 'Untitled agent'}
        </Text>
        <View style={styles.meta}>
          <Text variant="meta" color="textSecondary" numberOfLines={1}>
            {repoName(agent.source?.repository)}
            {' · '}
          </Text>
          {label === 'PR open' ? (
            <GitPullRequest size={13} color={colors.success} strokeWidth={2} style={{ marginRight: 4 }} />
          ) : null}
          <Text
            variant="meta"
            color={phase === 'error' ? 'danger' : label === 'PR open' ? 'success' : 'textSecondary'}
            numberOfLines={1}>
            {label}
          </Text>
          <Text variant="meta" color="textTertiary" numberOfLines={1}>
            {' · '}
            {relativeTime(agent.createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingLeft: space.xl },
  dot: { width: 28, paddingTop: 17 },
  body: { flex: 1, paddingVertical: space.md, paddingRight: space.xl, gap: 3 },
  title: { fontSize: 16 },
  meta: { flexDirection: 'row', alignItems: 'center' },
});
