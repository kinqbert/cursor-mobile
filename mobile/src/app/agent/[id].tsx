import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Archive,
  Brain,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitPullRequest,
  Link2,
  MoreHorizontal,
  Square,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { Artifacts } from '@/components/agents/artifacts';
import { FollowUpBar } from '@/components/agents/follow-up-bar';
import { ToolCallRow } from '@/components/agents/tool-call-row';
import { Markdown } from '@/components/markdown';
import { ActionMenu, type MenuItem } from '@/components/ui/action-menu';
import { RoundButton } from '@/components/ui/round-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatusDot } from '@/components/ui/status-dot';
import { Text } from '@/components/ui/text';
import { cursor } from '@/lib/api/endpoints';
import type { ConversationMessage } from '@/lib/api/types';
import { agentPhase, duration, relativeTime, repoName, resultFingerprint } from '@/lib/format';
import { useHasGithub } from '@/lib/github';
import { useAgentSummary, useArchiveAgent } from '@/lib/hooks';
import { useSeen } from '@/lib/local-state';
import { watchAgent } from '@/lib/notifications';
import { qk } from '@/lib/query';
import { type LiveItem, useAgentStream } from '@/lib/use-agent-stream';
import { radius, space, useColors } from '@/theme';

export default function AgentScreen() {
  const { id, prompt } = useLocalSearchParams<{ id: string; prompt?: string }>();
  const colors = useColors();
  const qc = useQueryClient();
  const summary = useAgentSummary(id);
  const archive = useArchiveAgent();
  const { markSeen } = useSeen();
  const hasGithub = useHasGithub();

  const [pendingRun, setPendingRun] = useState(!!prompt);
  const [pendingMessages, setPendingMessages] = useState<string[]>(prompt ? [prompt] : []);
  const [menuOpen, setMenuOpen] = useState(false);

  const phase = summary.data ? agentPhase(summary.data.status) : null;
  const working = phase === 'working' || pendingRun;

  const conversation = useQuery({
    queryKey: qk.conversation(id),
    queryFn: () => cursor.conversation(id),
    refetchInterval: working ? 15_000 : false,
  });
  const agent = useQuery({
    queryKey: qk.agent(id),
    queryFn: () => cursor.agent(id),
    refetchInterval: working ? 10_000 : false,
  });
  const latestRunId = agent.data?.latestRunId;
  const run = useQuery({
    queryKey: ['run', id, latestRunId],
    queryFn: () => cursor.run(id, latestRunId!),
    enabled: !!latestRunId,
  });

  const live = useAgentStream(id, working, () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPendingRun(false);
    setPendingMessages([]);
    for (const key of [qk.conversation(id), qk.agentV0(id), qk.agents, qk.agent(id), qk.artifacts(id)]) {
      qc.invalidateQueries({ queryKey: key });
    }
    qc.invalidateQueries({ queryKey: ['run', id] });
  });

  // Mark the result as seen so the home list drops the blue dot.
  useEffect(() => {
    if (summary.data && agentPhase(summary.data.status) !== 'working') {
      markSeen(id, resultFingerprint(summary.data));
    }
  }, [id, summary.data, markSeen]);

  // While a run is live, the stream replays the whole current turn, so hide the
  // (possibly partial) assistant messages that follow the last user message.
  const history = useMemo(() => {
    const msgs = conversation.data ?? [];
    if (!working || !live.items.length) return msgs;
    const lastUser = msgs.map((m) => m.type).lastIndexOf('user_message');
    return lastUser >= 0 ? msgs.slice(0, lastUser + 1) : msgs;
  }, [conversation.data, working, live.items.length]);

  const lastHistoryUser = [...history].reverse().find((m) => m.type === 'user_message')?.text;
  const extraUser = pendingMessages.filter((p) => p.trim() !== lastHistoryUser?.trim());

  const scroller = useRef<ScrollViewInstance>(null);
  const atBottom = useRef(true);

  const prUrl = summary.data?.target?.prUrl ?? run.data?.git?.branches.find((b) => b.prUrl)?.prUrl;
  const webUrl = summary.data?.target?.url ?? agent.data?.url ?? `https://cursor.com/agents/${id}`;

  // With a GitHub token → in-app PR screen; without one → straight to the browser.
  const openPr = (url: string) =>
    hasGithub
      ? router.push({ pathname: '/pr', params: { url, agentId: id } })
      : WebBrowser.openBrowserAsync(url);

  const stop = async () => {
    const runId = latestRunId ?? (await cursor.agent(id)).latestRunId;
    if (!runId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await cursor.cancelRun(id, runId).catch(() => undefined);
    setPendingRun(false);
    qc.invalidateQueries({ queryKey: qk.agentV0(id) });
  };

  const sendFollowUp = async (text: string) => {
    if (working) {
      await cursor.steer(id, text);
    } else {
      await cursor.followUp(id, text);
      setPendingRun(true);
    }
    setPendingMessages((p) => [...p, text]);
    watchAgent(id);
    atBottom.current = true;
    qc.invalidateQueries({ queryKey: qk.agent(id) });
  };

  const menu: MenuItem[] = [
    ...(prUrl
      ? [{ label: 'Open pull request', icon: GitPullRequest, onPress: () => openPr(prUrl) }]
      : []),
    { label: 'Open on web', icon: ExternalLink, onPress: () => WebBrowser.openBrowserAsync(webUrl) },
    { label: 'Copy link', icon: Link2, onPress: () => Clipboard.setStringAsync(webUrl) },
    ...(working ? [{ label: 'Stop agent', icon: Square, onPress: stop }] : []),
    {
      label: 'Archive',
      icon: Archive,
      destructive: true,
      onPress: () => {
        archive.mutate(id);
        router.back();
      },
    },
  ];

  const s = summary.data;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScreenHeader
        right={
          <>
            {prUrl ? (
              <RoundButton
                icon={GitPullRequest}
                accessibilityLabel="Pull request"
                onPress={() => openPr(prUrl)}
              />
            ) : null}
            <RoundButton icon={MoreHorizontal} accessibilityLabel="More" onPress={() => setMenuOpen(true)} />
          </>
        }
      />

      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          atBottom.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;
        }}
        scrollEventThrottle={64}
        onContentSizeChange={() => {
          if (atBottom.current) scroller.current?.scrollToEnd({ animated: true });
        }}>
        <Text variant="title">{s?.name || 'Agent'}</Text>
        {s ? (
          <View style={styles.metaRow}>
            <Text variant="meta" color="textSecondary">
              {repoName(s.source?.repository)}
              {s.target?.branchName ? ` · ${s.target.branchName}` : ''}
            </Text>
            {prUrl ? (
              <Pressable
                onPress={() => openPr(prUrl)}
                style={[styles.pill, { backgroundColor: colors.successSoft }]}>
                <Text variant="caption" color="success">
                  PR #{prUrl.split('/').pop()}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.thread}>
          {conversation.isLoading && !pendingMessages.length ? (
            <ActivityIndicator color={colors.textSecondary} style={{ marginTop: space.xxl }} />
          ) : null}
          {!working && !pendingMessages.length && (conversation.isError || (conversation.isSuccess && !history.length)) ? (
            <Pressable onPress={() => conversation.refetch()}>
              <Text variant="caption" color="textTertiary">
                {conversation.isError
                  ? `Couldn't load the conversation: ${(conversation.error as Error).message}. Tap to retry.`
                  : 'Cursor no longer provides the transcript for this agent, so your prompt can’t be shown. The final result is below.'}
              </Text>
            </Pressable>
          ) : null}
          {history.map((m) => (
            <Message key={m.id} message={m} />
          ))}
          {extraUser.map((t, i) => (
            <UserBubble key={`pending-${i}`} text={t} />
          ))}

          {working ? (
            <LiveTurn items={live.items} error={live.error} />
          ) : s ? (
            <Text variant="meta" color={phase === 'error' ? 'danger' : 'textSecondary'}>
              {phaseLabel(phase)}
              {phase === 'finished' && run.data?.durationMs ? ` in ${duration(run.data.durationMs)}` : ''}
              {` · ${relativeTime(agent.data?.updatedAt ?? s.updatedAt ?? s.createdAt)}`}
            </Text>
          ) : null}

          {!working && !history.some((m) => m.type === 'assistant_message') && (run.data?.result || s?.summary) ? (
            <Markdown text={run.data?.result ?? s?.summary ?? ''} />
          ) : null}

          <Artifacts agentId={id} />
        </View>
      </ScrollView>

      <FollowUpBar working={working} onSend={sendFollowUp} onStop={stop} />

      <ActionMenu visible={menuOpen} items={menu} onClose={() => setMenuOpen(false)} />
    </KeyboardAvoidingView>
  );
}

function phaseLabel(phase: string | null) {
  switch (phase) {
    case 'error':
      return 'Failed';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Stopped';
    default:
      return 'Finished';
  }
}

function Message({ message }: { message: ConversationMessage }) {
  if (message.type === 'user_message') return <UserBubble text={message.text} />;
  return <Markdown text={message.text} />;
}

function UserBubble({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View style={[styles.bubble, { backgroundColor: colors.surfaceMuted }]}>
      <Text variant="body" selectable>
        {text}
      </Text>
    </View>
  );
}

function LiveTurn({ items, error }: { items: LiveItem[]; error: string | null }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.workingRow}>
        <StatusDot state="working" />
        <Text variant="meta" color="textSecondary">
          Working
        </Text>
      </View>
      {items.map((it, i) =>
        it.kind === 'text' ? (
          <Markdown key={i} text={it.text} />
        ) : it.kind === 'thinking' ? (
          <Thinking key={i} text={it.text} />
        ) : (
          <ToolCallRow key={it.call.callId} call={it.call} />
        ),
      )}
      {error ? (
        <Text variant="caption" color="textTertiary">
          Reconnecting… ({error})
        </Text>
      ) : null}
    </View>
  );
}

function Thinking({ text }: { text: string }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <View>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.workingRow} hitSlop={4}>
        <Brain size={14} color={colors.textSecondary} strokeWidth={1.75} />
        <Text variant="meta" color="textSecondary">
          Thought
        </Text>
        <Chevron size={13} color={colors.textTertiary} />
      </Pressable>
      {open ? (
        <Text variant="meta" color="textSecondary" style={{ marginTop: space.xs }}>
          {text.trim()}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xxxl },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
  pill: { paddingHorizontal: space.sm + 2, paddingVertical: 3, borderRadius: radius.pill },
  thread: { gap: space.lg, marginTop: space.xxl },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.xl,
  },
  workingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
