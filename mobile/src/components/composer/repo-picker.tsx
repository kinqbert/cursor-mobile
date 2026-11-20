import { useQueryClient } from '@tanstack/react-query';
import { Check, GitBranch, RefreshCw, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoundButton } from '@/components/ui/round-button';
import { Text } from '@/components/ui/text';
import { repoSlug } from '@/lib/format';
import { refreshRepositoriesCache, useAgents, useRepositories } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { fonts, radius, space, useColors } from '@/theme';

type Props = {
  visible: boolean;
  repo?: string;
  branch?: string;
  onClose: () => void;
  onSelect: (repo: string, branch: string) => void;
};

/** Full-screen repo + branch picker. Recent repos (from your agents) first, then all GitHub repos. */
export function RepoPicker({ visible, repo, branch, onClose, onSelect }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const repos = useRepositories();
  const agents = useAgents();
  const [query, setQuery] = useState('');
  const [branchText, setBranchText] = useState(branch ?? 'main');
  const [selected, setSelected] = useState(repo);

  const items = useMemo(() => {
    const recent: string[] = [];
    for (const a of agents.data ?? []) {
      const r = a.source?.repository;
      if (r && !recent.includes(normalize(r))) recent.push(normalize(r));
    }
    const all = (repos.data ?? []).map((r) => normalize(r.url)).filter((r) => !recent.includes(r));
    const q = query.trim().toLowerCase();
    const filter = (r: string) => !q || r.toLowerCase().includes(q);
    const rows: ({ kind: 'header'; title: string } | { kind: 'repo'; url: string })[] = [];
    const recentF = recent.filter(filter);
    const allF = all.filter(filter);
    if (recentF.length) {
      rows.push({ kind: 'header', title: 'Recent' });
      recentF.forEach((url) => rows.push({ kind: 'repo', url }));
    }
    if (allF.length) {
      rows.push({ kind: 'header', title: 'All repositories' });
      allF.forEach((url) => rows.push({ kind: 'repo', url }));
    }
    // Allow pasting a repo URL that is not in the list.
    if (q.startsWith('http') && !recent.includes(q) && !all.includes(q)) {
      rows.unshift({ kind: 'repo', url: q });
    }
    return rows;
  }, [agents.data, repos.data, query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + space.sm }}>
        <View style={styles.top}>
          <RoundButton icon={X} accessibilityLabel="Close" onPress={onClose} />
          <Text variant="headline">Repository</Text>
          <RoundButton
            icon={RefreshCw}
            accessibilityLabel="Refresh repositories"
            onPress={() => {
              refreshRepositoriesCache();
              qc.invalidateQueries({ queryKey: qk.repos });
            }}
          />
        </View>

        <View style={[styles.field, { backgroundColor: colors.surfaceMuted }]}>
          <Search size={16} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search or paste a repo URL"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: colors.text }]}
          />
        </View>
        <View style={[styles.field, { backgroundColor: colors.surfaceMuted }]}>
          <GitBranch size={16} color={colors.textSecondary} />
          <TextInput
            value={branchText}
            onChangeText={setBranchText}
            placeholder="Branch (main)"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: colors.text }]}
          />
        </View>

        {repos.isError ? (
          <Text variant="caption" color="textSecondary" style={{ paddingHorizontal: space.xl }}>
            Couldn&apos;t load all repositories ({(repos.error as Error).message}). Recent repos still work.
          </Text>
        ) : null}

        <FlatList
          data={items}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(it, i) => (it.kind === 'header' ? `h-${it.title}` : `${it.url}-${i}`)}
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <Text variant="section" color="textSecondary" style={styles.header}>
                {item.title}
              </Text>
            ) : (
              <Pressable
                onPress={() => {
                  setSelected(item.url);
                  onSelect(item.url, branchText.trim() || 'main');
                }}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}>
                <View style={{ flex: 1 }}>
                  <Text variant="body" numberOfLines={1}>
                    {repoSlug(item.url)}
                  </Text>
                </View>
                {selected === item.url ? <Check size={18} color={colors.text} /> : null}
              </Pressable>
            )
          }
          ListEmptyComponent={
            <Text variant="callout" color="textSecondary" style={{ padding: space.xl }}>
              {repos.isLoading ? 'Loading repositories…' : 'No repositories found.'}
            </Text>
          }
        />
      </View>
    </Modal>
  );
}

function normalize(url: string) {
  return url.replace(/\.git$/, '').replace(/\/+$/, '');
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.xl,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  input: { flex: 1, height: 44, fontFamily: fonts.regular, fontSize: 16 },
  header: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.md + 2,
  },
});
