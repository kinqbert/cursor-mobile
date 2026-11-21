import { Redirect, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Archive,
  ExternalLink,
  ListFilter,
  Pin,
  PinOff,
  Search,
  Settings as SettingsIcon,
  X,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgentRow } from '@/components/agents/agent-row';
import { SwipeableRow } from '@/components/agents/swipeable-row';
import { ComposerBar } from '@/components/composer/composer-bar';
import { ActionMenu, type MenuItem } from '@/components/ui/action-menu';
import { PillButton } from '@/components/ui/pill-button';
import { RoundButton } from '@/components/ui/round-button';
import { Text } from '@/components/ui/text';
import type { AgentV0 } from '@/lib/api/types';
import { useAuth } from '@/lib/auth';
import { agentPhase, isSameDay, repoName, resultFingerprint } from '@/lib/format';
import { prefetchAgent, useAgents, useArchiveAgent } from '@/lib/hooks';
import { unreadBaseline, usePins, useSeen } from '@/lib/local-state';
import { fonts, radius, space, useColors } from '@/theme';

type Filter = 'all' | 'working' | 'done' | 'failed';
const FILTER_LABEL: Record<Filter, string> = {
  all: 'All agents',
  working: 'Working',
  done: 'Finished',
  failed: 'Failed',
};

export default function Home() {
  const { signedIn } = useAuth();
  if (!signedIn) return <Redirect href="/welcome" />;
  return <AgentsHome />;
}

function AgentsHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const agents = useAgents();
  const archive = useArchiveAgent();
  const { pinned, isPinned, toggle } = usePins();
  const { seen } = useSeen();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuAgent, setMenuAgent] = useState<AgentV0 | null>(null);

  const qc = useQueryClient();
  // Agents whose last activity predates the app install count as already seen.
  const isUnread = useCallback(
    (a: AgentV0) =>
      agentPhase(a.status) !== 'working' &&
      (a.updatedAt ?? a.createdAt) > unreadBaseline() &&
      seen[a.id] !== resultFingerprint(a),
    [seen],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (agents.data ?? []).filter((a) => {
      if (q && !`${a.name} ${a.source?.repository ?? ''}`.toLowerCase().includes(q)) return false;
      const phase = agentPhase(a.status);
      if (filter === 'working') return phase === 'working';
      if (filter === 'done') return phase === 'finished';
      if (filter === 'failed') return phase === 'error' || phase === 'expired';
      return true;
    });
    return flatten(groupAgents(list, pinned));
  }, [agents.data, query, filter, pinned]);

  const menuItems: MenuItem[] = menuAgent
    ? [
        {
          label: isPinned(menuAgent.id) ? 'Unpin' : 'Pin',
          icon: isPinned(menuAgent.id) ? PinOff : Pin,
          onPress: () => toggle(menuAgent.id),
        },
        {
          label: 'Open on web',
          icon: ExternalLink,
          onPress: () =>
            WebBrowser.openBrowserAsync(
              menuAgent.target?.url ?? `https://cursor.com/agents/${menuAgent.id}`,
            ),
        },
        {
          label: 'Archive',
          icon: Archive,
          destructive: true,
          onPress: () => archive.mutate(menuAgent.id),
        },
      ]
    : [];

  const openAgent = useCallback((a: AgentV0) => router.push(`/agent/${a.id}`), []);
  // Start loading the conversation on touch-down, ~100–200 ms before the tap completes.
  const warmAgent = useCallback((a: AgentV0) => prefetchAgent(qc, a.id), [qc]);

  const header = (
    <View>
      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
        <RoundButton
          icon={SettingsIcon}
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
        />
        <View style={styles.topRight}>
          <RoundButton
            icon={searching ? X : Search}
            accessibilityLabel="Search"
            onPress={() => {
              setSearching((s) => !s);
              setQuery('');
            }}
          />
          <RoundButton icon={ListFilter} accessibilityLabel="Filter" onPress={() => setFilterOpen(true)} />
        </View>
      </View>
      <View style={styles.titleWrap}>
        <Text variant="largeTitle">{filter === 'all' ? 'All Workspaces' : FILTER_LABEL[filter]}</Text>
      </View>
      {searching ? (
        <View style={[styles.search, { backgroundColor: colors.surfaceMuted }]}>
          <Search size={16} color={colors.textSecondary} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search agents"
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlashList
        data={rows}
        keyExtractor={(r) => r.key}
        getItemType={(r) => r.kind}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={agents.isRefetching && !agents.isLoading}
            onRefresh={() => void agents.refetch()}
            tintColor={colors.textSecondary}
            progressViewOffset={insets.top}
          />
        }
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <Text variant="section" color="textSecondary" style={styles.sectionHeader}>
              {item.title}
            </Text>
          ) : (
            <SwipeableRow
              pinned={isPinned(item.agent.id)}
              onPin={() => toggle(item.agent.id)}
              onArchive={() => archive.mutate(item.agent.id)}>
              <View style={{ backgroundColor: colors.background }}>
                <AgentRow
                  agent={item.agent}
                  unread={isUnread(item.agent)}
                  last={item.last}
                  onPress={openAgent}
                  onPressIn={warmAgent}
                  onLongPress={setMenuAgent}
                />
              </View>
            </SwipeableRow>
          )
        }
        ListEmptyComponent={
          agents.isLoading ? (
            <ActivityIndicator style={{ marginTop: 64 }} color={colors.textSecondary} />
          ) : agents.isError ? (
            <View style={styles.empty}>
              <Text variant="callout" color="textSecondary" style={{ textAlign: 'center' }}>
                {(agents.error as Error).message}
              </Text>
              <PillButton title="Retry" variant="secondary" onPress={() => agents.refetch()} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text variant="callout" color="textSecondary" style={{ textAlign: 'center' }}>
                {query || filter !== 'all'
                  ? 'No agents match.'
                  : 'No agents yet. Describe a task below to launch one.'}
              </Text>
            </View>
          )
        }
      />

      <ComposerBar
        onPress={() => router.push('/new')}
        onAttach={() => router.push({ pathname: '/new', params: { attach: '1' } })}
        onMic={() => router.push({ pathname: '/new', params: { voice: '1' } })}
      />

      <ActionMenu
        visible={!!menuAgent}
        title={menuAgent?.name}
        items={menuItems}
        onClose={() => setMenuAgent(null)}
      />
      <ActionMenu
        visible={filterOpen}
        title="Show"
        onClose={() => setFilterOpen(false)}
        items={(Object.keys(FILTER_LABEL) as Filter[]).map((f) => ({
          label: FILTER_LABEL[f],
          selected: filter === f,
          onPress: () => setFilter(f),
        }))}
      />
    </View>
  );
}

type Section = { title: string; data: AgentV0[] };
type Row =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'agent'; key: string; agent: AgentV0; last: boolean };

function flatten(sections: Section[]): Row[] {
  const rows: Row[] = [];
  for (const sec of sections) {
    rows.push({ kind: 'header', key: `h:${sec.title}`, title: sec.title });
    sec.data.forEach((agent, i) =>
      rows.push({ kind: 'agent', key: agent.id, agent, last: i === sec.data.length - 1 }),
    );
  }
  return rows;
}

/** Pinned → Today → one section per repo (most recent first), like the iOS app. */
function groupAgents(list: AgentV0[], pinned: string[]): Section[] {
  const now = new Date();
  const pinnedSet = new Set(pinned);
  const pinnedItems = pinned
    .map((id) => list.find((a) => a.id === id))
    .filter((a): a is AgentV0 => !!a);
  const today: AgentV0[] = [];
  const byRepo = new Map<string, AgentV0[]>();

  for (const a of list) {
    if (pinnedSet.has(a.id)) continue;
    if (isSameDay(new Date(a.updatedAt ?? a.createdAt), now) || agentPhase(a.status) === 'working') {
      today.push(a);
      continue;
    }
    const key = repoName(a.source?.repository);
    byRepo.set(key, [...(byRepo.get(key) ?? []), a]);
  }

  const sections: Section[] = [];
  if (pinnedItems.length) sections.push({ title: 'Pinned', data: pinnedItems });
  if (today.length) sections.push({ title: 'Today', data: today });
  for (const [title, data] of byRepo) sections.push({ title, data });
  return sections;
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  topRight: { flexDirection: 'row', gap: space.sm },
  titleWrap: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.xl,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  searchInput: { flex: 1, height: 42, fontFamily: fonts.regular, fontSize: 16 },
  sectionHeader: { paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.xs },
  empty: { alignItems: 'center', gap: space.lg, paddingTop: 64, paddingHorizontal: space.xxxl },
});
