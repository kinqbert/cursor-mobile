import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  ExternalLink,
  Eye,
  GitMerge,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Artifacts } from '@/components/agents/artifacts';
import { CheckRing } from '@/components/pr/check-ring';
import { FileDiff } from '@/components/pr/file-diff';
import { PillButton } from '@/components/ui/pill-button';
import { RoundButton } from '@/components/ui/round-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import type { CheckRun, CheckSummary, PullRequest, Review } from '@/lib/github';
import { relativeTime } from '@/lib/format';
import { summarizeChecks } from '@/lib/github';
import { useMergePr, usePrDetails } from '@/lib/pr-hooks';
import { radius, space, useColors } from '@/theme';

export default function PrScreen() {
  const { url, agentId } = useLocalSearchParams<{ url: string; agentId?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const d = usePrDetails(url);
  const merge = useMergePr(url);

  if (!d.enabled) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader />
        <View style={styles.empty}>
          <Text variant="callout" color="textSecondary" style={{ textAlign: 'center' }}>
            Add a GitHub token in Settings to review and merge pull requests here.
          </Text>
          <PillButton title="Open Settings" variant="secondary" onPress={() => router.push('/settings')} />
          <PillButton title="Open on GitHub" variant="secondary" onPress={() => WebBrowser.openBrowserAsync(url)} />
        </View>
      </View>
    );
  }

  const pr = d.pr.data;
  const refreshing = d.pr.isRefetching || d.checks.isRefetching;

  const doMerge = () => {
    if (!pr) return;
    Alert.alert('Squash and merge?', `${pr.title}\n\ninto ${pr.base.ref}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Merge',
        onPress: () =>
          merge.mutate(pr.head.sha, {
            onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
            onError: (e) => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Merge failed', e instanceof Error ? e.message : String(e));
            },
          }),
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        right={
          <RoundButton icon={ExternalLink} accessibilityLabel="Open on GitHub" onPress={() => WebBrowser.openBrowserAsync(url)} />
        }
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              d.pr.refetch();
              d.checks.refetch();
              d.files.refetch();
              d.deployments.refetch();
              d.reviews.refetch();
            }}
            tintColor={colors.textSecondary}
          />
        }>
        {!pr ? (
          d.pr.isError ? (
            <Text variant="callout" color="danger">
              {(d.pr.error as Error).message}
            </Text>
          ) : (
            <ActivityIndicator color={colors.textSecondary} style={{ marginTop: 64 }} />
          )
        ) : (
          <>
            <Text variant="title">{pr.title}</Text>
            <View style={styles.metaRow}>
              <StatePill pr={pr} />
              <Text variant="meta" color="success">
                +{pr.additions}
              </Text>
              <Text variant="meta" color="danger">
                -{pr.deletions}
              </Text>
              <Text variant="meta" color="textSecondary">
                · {pr.changed_files} {pr.changed_files === 1 ? 'File' : 'Files'}
              </Text>
              <View style={[styles.vr, { backgroundColor: colors.divider }]} />
              <Text variant="meta" color="textSecondary">
                {pr.commits} {pr.commits === 1 ? 'Commit' : 'Commits'}
              </Text>
            </View>

            <MergeCard
              pr={pr}
              runs={d.checks.data?.runs ?? []}
              summary={d.checks.data?.summary ?? summarizeChecks([])}
              reviews={d.reviews.data ?? []}
              merging={merge.isPending}
              onMerge={doMerge}
            />

            {d.deployments.data?.length ? (
              <View style={styles.section}>
                <Text variant="section" color="textSecondary">
                  Deployments
                </Text>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                  {d.deployments.data.map((dep, i) => {
                    const link = dep.latest?.environment_url || dep.latest?.target_url;
                    const ok = dep.latest?.state === 'success';
                    return (
                      <Pressable
                        key={dep.id}
                        disabled={!link}
                        onPress={() => link && WebBrowser.openBrowserAsync(link)}
                        style={[
                          styles.depRow,
                          i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
                        ]}>
                        <View style={[styles.depIcon, { backgroundColor: colors.surfaceMuted }]}>
                          {ok ? (
                            <Check size={14} color={colors.success} strokeWidth={2.5} />
                          ) : (
                            <CircleDashed size={14} color={colors.textSecondary} />
                          )}
                        </View>
                        <Text variant="callout" numberOfLines={1} style={{ flex: 1 }}>
                          {dep.environment}
                        </Text>
                        <Text variant="meta" color="textTertiary">
                          {relativeTime(dep.latest?.created_at ?? dep.created_at)}
                        </Text>
                        <ArrowUpRight size={16} color={colors.textTertiary} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {agentId ? (
              <View style={styles.section}>
                <Artifacts agentId={agentId} />
              </View>
            ) : null}

            <View style={styles.section}>
              <Text variant="section" color="textSecondary">
                {pr.changed_files} {pr.changed_files === 1 ? 'File' : 'Files'}
              </Text>
              {d.files.isLoading ? <ActivityIndicator color={colors.textSecondary} /> : null}
              {d.files.data?.map((f) => <FileDiff key={f.filename} file={f} />)}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatePill({ pr }: { pr: PullRequest }) {
  const colors = useColors();
  const [label, bg, fg] = pr.merged
    ? ['Merged', colors.surfaceMuted, colors.accent]
    : pr.state === 'closed'
      ? ['Closed', colors.dangerSoft, colors.danger]
      : pr.draft
        ? ['Draft', colors.surfaceMuted, colors.textSecondary]
        : ['Open', colors.successSoft, colors.success];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text variant="meta" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

function MergeCard({
  pr,
  runs,
  summary,
  reviews,
  merging,
  onMerge,
}: {
  pr: PullRequest;
  runs: CheckRun[];
  summary: CheckSummary;
  reviews: Review[];
  merging: boolean;
  onMerge: () => void;
}) {
  const colors = useColors();
  const [showChecks, setShowChecks] = useState(false);

  if (pr.merged || pr.state === 'closed') {
    return (
      <View style={[styles.card, styles.mergeCard, { backgroundColor: colors.surface }]}>
        <View style={styles.cardRow}>
          <GitMerge size={18} color={pr.merged ? colors.accent : colors.danger} />
          <Text variant="bodyMedium">{pr.merged ? 'Merged' : 'Closed without merging'}</Text>
        </View>
      </View>
    );
  }

  const approved = latestReviews(reviews).filter((r) => r.state === 'APPROVED');
  const changesRequested = latestReviews(reviews).some((r) => r.state === 'CHANGES_REQUESTED');
  const conflicts = pr.mergeable_state === 'dirty';
  const waitingChecks = summary.running > 0;
  const failing = summary.failed > 0;
  const needsReview = pr.mergeable_state === 'blocked' && !failing && !waitingChecks;

  const title = pr.draft
    ? 'Draft'
    : conflicts
      ? 'Merge Conflicts'
      : failing
        ? 'Checks Failing'
        : waitingChecks
          ? 'Waiting for Checks'
          : changesRequested
            ? 'Changes Requested'
            : needsReview
              ? 'Waiting for Review'
              : 'Ready to Merge';

  const checksLine =
    summary.total === 0
      ? 'No checks'
      : failing
        ? `${summary.failed} of ${summary.total} Checks Failing`
        : waitingChecks
          ? `${summary.passed}/${summary.total} Checks Passing`
          : 'All Required Checks Passed';

  const avatars = [...approved.map((r) => r.user), ...pr.requested_reviewers].slice(0, 3);
  const canMerge = !pr.draft && !conflicts;

  return (
    <View style={[styles.card, styles.mergeCard, { backgroundColor: colors.surface }]}>
      <Text variant="bodyMedium">{title}</Text>
      <Pressable style={styles.cardRow} onPress={() => setShowChecks((s) => !s)}>
        <CheckRing summary={summary} />
        {avatars.map((u, i) => (
          <Image
            key={u.login}
            source={{ uri: u.avatar_url }}
            style={[styles.avatar, { marginLeft: i === 0 ? -10 : -12, borderColor: colors.surface }]}
          />
        ))}
        <View style={{ flex: 1 }}>
          <Text variant="callout">{checksLine}</Text>
          {waitingChecks ? (
            <Text variant="caption" color="textSecondary">
              {summary.running} Running
            </Text>
          ) : null}
        </View>
        {summary.total ? (
          showChecks ? (
            <ChevronDown size={16} color={colors.textTertiary} />
          ) : (
            <ChevronRight size={16} color={colors.textTertiary} />
          )
        ) : null}
      </Pressable>

      {showChecks ? (
        <View style={{ gap: 2 }}>
          {runs.map((r) => (
            <Pressable key={`${r.name}-${r.id}`} style={styles.checkRow} onPress={() => r.html_url && WebBrowser.openBrowserAsync(r.html_url)}>
              {r.status !== 'completed' ? (
                <CircleDashed size={14} color={colors.warning} />
              ) : ['success', 'neutral', 'skipped'].includes(r.conclusion ?? '') ? (
                <Check size={14} color={colors.success} strokeWidth={2.5} />
              ) : (
                <X size={14} color={colors.danger} strokeWidth={2.5} />
              )}
              <Text variant="meta" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
                {r.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {needsReview || changesRequested ? (
        <View style={[styles.cardRow, { opacity: 0.6 }]}>
          <Eye size={18} color={colors.textSecondary} />
          <Text variant="callout" color="textSecondary">
            {changesRequested ? 'Changes requested' : 'Waiting for Review'}
          </Text>
        </View>
      ) : null}

      <PillButton title="Squash & Merge" onPress={onMerge} loading={merging} disabled={!canMerge} />
    </View>
  );
}

function latestReviews(reviews: Review[]) {
  const map = new Map<string, Review>();
  for (const r of reviews) if (r.state !== 'COMMENTED') map.set(r.user.login, r);
  return [...map.values()];
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingTop: space.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, marginTop: space.md, flexWrap: 'wrap' },
  pill: { paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill, marginRight: space.xs },
  vr: { width: StyleSheet.hairlineWidth, height: 14, marginHorizontal: space.xs },
  card: { borderRadius: radius.lg, paddingHorizontal: space.lg },
  mergeCard: { marginTop: space.xxl, paddingVertical: space.lg, gap: space.md },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 3, paddingLeft: 8 },
  section: { marginTop: space.xxl, gap: space.sm },
  depRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  depIcon: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xxxl },
});
