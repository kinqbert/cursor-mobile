import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { PrFile } from '@/lib/github';
import { fonts, space, useColors, useIsDark } from '@/theme';

/** "› page.mdx  apps/docs/…   +98 -0", expandable to a coloured unified diff. */
export const FileDiff = memo(function FileDiff({ file }: { file: PrFile }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const name = file.filename.split('/').pop();
  const dir = file.filename.slice(0, file.filename.length - (name?.length ?? 0)).replace(/\/$/, '');
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.header}>
        <Chevron size={14} color={colors.textTertiary} />
        <Text variant="callout" numberOfLines={1} style={{ flexShrink: 0, maxWidth: '55%' }}>
          {name}
        </Text>
        <Text variant="meta" color="textTertiary" numberOfLines={1} style={{ flex: 1 }}>
          {dir}
        </Text>
        <Text variant="meta" color="success">
          +{file.additions}
        </Text>
        <Text variant="meta" color="danger">
          -{file.deletions}
        </Text>
      </Pressable>
      {open ? <Patch patch={file.patch} /> : null}
    </View>
  );
});

function Patch({ patch }: { patch?: string }) {
  const colors = useColors();
  const dark = useIsDark();
  if (!patch) {
    return (
      <Text variant="meta" color="textTertiary" style={{ paddingBottom: space.md, paddingLeft: 22 }}>
        Diff not available (binary or too large).
      </Text>
    );
  }
  const lines = patch.split('\n').slice(0, 400);
  const addBg = dark ? 'rgba(79,178,122,0.16)' : 'rgba(47,138,87,0.10)';
  const delBg = dark ? 'rgba(232,104,122,0.16)' : 'rgba(210,74,92,0.10)';
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
      <View>
        {lines.map((l, i) => {
          const bg = l.startsWith('+') ? addBg : l.startsWith('-') ? delBg : 'transparent';
          const color = l.startsWith('@@') ? colors.accent : colors.text;
          return (
            <RNText key={i} style={[styles.line, { backgroundColor: bg, color }]}>
              {l || ' '}
            </RNText>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  line: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 17, paddingHorizontal: space.sm },
});
