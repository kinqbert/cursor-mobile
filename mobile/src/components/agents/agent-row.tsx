import { Check, CircleDashed, GitMerge, GitPullRequest, X } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusDot, type DotState } from '@/components/ui/status-dot';
import { Text } from '@/components/ui/text';
import type { AgentV0 } from '@/lib/api/types';
import { agentPhase, relativeTime, repoName, statusLabel } from '@/lib/format';
import { usePr } from '@/lib/pr-hooks';
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
          {label === 'PR open' && agent.target?.prUrl ? (
            <PrMeta prUrl={agent.target.prUrl} />
          ) : (
            <Text variant="meta" color={phase === 'error' ? 'danger' : 'textSecondary'} numberOfLines={1}>
              {label}
            </Text>
          )}
          <Text variant="meta" color="textTertiary" numberOfLines={1}>
            {' · '}
            {relativeTime(agent.createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

/** "✓ Passed · +8 -23" / "Merged" from GitHub; falls back to "PR open" without a token. */
function PrMeta({ prUrl }: { prUrl: string }) {
  const colors = useColors();
  const { pr, checks } = usePr(prUrl);
  if (!pr.data) {
    return (
      <>
        <GitPullRequest size={13} color={colors.success} strokeWidth={2} style={{ marginRight: 4 }} />
        <Text variant="meta" color="success">
          PR open
        </Text>
      </>
    );
  }
  if (pr.data.merged || pr.data.state === 'closed') {
    return (
      <>
        <GitMerge size={13} color={colors.textSecondary} strokeWidth={2} style={{ marginRight: 4 }} />
        <Text variant="meta" color="textSecondary">
          {pr.data.merged ? 'Merged' : 'Closed'}
        </Text>
      </>
    );
  }
  const sum = checks.data?.summary;
  const state = !sum || !sum.total ? null : sum.failed ? 'failed' : sum.running ? 'running' : 'passed';
  return (
    <>
      {state === 'passed' ? (
        <>
          <Check size={14} color={colors.success} strokeWidth={2.25} style={{ marginRight: 4 }} />
          <Text variant="meta" color="textSecondary">
            Passed ·{' '}
          </Text>
        </>
      ) : state === 'failed' ? (
        <>
          <X size={14} color={colors.danger} strokeWidth={2.25} style={{ marginRight: 4 }} />
          <Text variant="meta" color="danger">
            Failed ·{' '}
          </Text>
        </>
      ) : state === 'running' ? (
        <>
          <CircleDashed size={13} color={colors.warning} style={{ marginRight: 4 }} />
          <Text variant="meta" color="textSecondary">
            Checks ·{' '}
          </Text>
        </>
      ) : null}
      <Text variant="meta" color="textSecondary">
        +{pr.data.additions} -{pr.data.deletions}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingLeft: space.xl },
  dot: { width: 28, paddingTop: 17 },
  body: { flex: 1, paddingVertical: space.md, paddingRight: space.xl, gap: 3 },
  title: { fontSize: 16 },
  meta: { flexDirection: 'row', alignItems: 'center' },
});
