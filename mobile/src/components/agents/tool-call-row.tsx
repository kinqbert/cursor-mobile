import {
  Check,
  ChevronRight,
  FileEdit,
  FileText,
  Globe,
  Loader,
  Search,
  SquareTerminal,
  Wrench,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { ToolCallEvent } from '@/lib/api/types';
import { radius, space, useColors } from '@/theme';

/** One compact line per tool call ("Read  src/app.tsx"), expandable to show args/result. */
export function ToolCallRow({ call }: { call: ToolCallEvent }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const { icon: Icon, verb } = describe(call.name);
  const detail = summarize(call.args);
  const running = call.status === 'running';

  return (
    <View>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.row} hitSlop={4}>
        <Icon size={14} color={colors.textSecondary} strokeWidth={1.75} />
        <Text variant="meta" color="textSecondary">
          {verb}
        </Text>
        <Text variant="meta" color="textTertiary" numberOfLines={1} style={{ flex: 1 }}>
          {detail}
        </Text>
        {running ? (
          <Loader size={13} color={colors.textTertiary} />
        ) : open ? null : (
          <ChevronRight size={13} color={colors.textTertiary} />
        )}
        {!running && open ? <Check size={13} color={colors.textTertiary} /> : null}
      </Pressable>
      {open ? (
        <View style={[styles.detail, { backgroundColor: colors.surfaceMuted }]}>
          <Text variant="mono" color="textSecondary" selectable numberOfLines={30}>
            {pretty(call.args)}
            {call.result !== undefined ? `\n\n→ ${pretty(call.result)}` : ''}
            {call.truncated ? '\n\n(truncated)' : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function describe(name: string) {
  const n = name.toLowerCase();
  if (n.includes('read')) return { icon: FileText, verb: 'Read' };
  if (n.includes('edit') || n.includes('write') || n.includes('replace') || n.includes('patch'))
    return { icon: FileEdit, verb: 'Edited' };
  if (n.includes('terminal') || n.includes('shell') || n.includes('command') || n === 'bash')
    return { icon: SquareTerminal, verb: 'Ran' };
  if (n.includes('search') || n.includes('grep') || n.includes('glob') || n.includes('list'))
    return { icon: Search, verb: 'Searched' };
  if (n.includes('web') || n.includes('fetch') || n.includes('browser')) return { icon: Globe, verb: 'Browsed' };
  return { icon: Wrench, verb: name.replace(/_/g, ' ') };
}

function summarize(args: unknown): string {
  if (!args || typeof args !== 'object') return typeof args === 'string' ? args : '';
  const a = args as Record<string, unknown>;
  for (const k of ['command', 'path', 'file_path', 'target_file', 'filePath', 'query', 'pattern', 'url', 'glob_pattern']) {
    if (typeof a[k] === 'string') return a[k] as string;
  }
  const first = Object.values(a).find((v) => typeof v === 'string');
  return typeof first === 'string' ? first : '';
}

function pretty(v: unknown): string {
  if (v === undefined) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 3 },
  detail: { borderRadius: radius.sm, padding: space.md, marginVertical: space.xs },
});
