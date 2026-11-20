import * as WebBrowser from 'expo-web-browser';
import { type ReactNode, memo } from 'react';
import { ScrollView, StyleSheet, Text as RNText, View } from 'react-native';

import { fonts, radius, space, type as typeScale, useColors } from '@/theme';

/**
 * Small Markdown renderer covering what agents actually emit: headings, paragraphs,
 * bullet/numbered lists, fenced code, blockquotes, rules, and inline bold/italic/code/links.
 */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return <View style={{ gap: space.md }}>{blocks.map((b, i) => <BlockView key={i} block={b} />)}</View>;
});

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'list'; ordered: boolean; items: { text: string; indent: number; n: number }[] }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'quote'; text: string }
  | { kind: 'rule' };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^\s*```(\w*)/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push({ kind: 'code', lang: fence[1], code: code.join('\n') });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push({ kind: 'heading', level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      out.push({ kind: 'rule' });
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push({ kind: 'quote', text: q.join(' ') });
      continue;
    }
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[2]);
      const items: { text: string; indent: number; n: number }[] = [];
      let n = 1;
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (m) {
          items.push({ text: m[3], indent: Math.min(3, Math.floor(m[1].length / 2)), n: parseInt(m[2], 10) || n });
          n++;
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1].text += ' ' + lines[i].trim();
          i++;
        } else break;
      }
      out.push({ kind: 'list', ordered, items });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|\s*```|\s*>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i])
    ) {
      para.push(lines[i++].trim());
    }
    out.push({ kind: 'para', text: para.join(' ') });
  }
  return out;
}

function BlockView({ block }: { block: Block }) {
  const colors = useColors();
  const base = [typeScale.body, { color: colors.text }];
  switch (block.kind) {
    case 'heading':
      return (
        <RNText style={[block.level <= 2 ? typeScale.headline : typeScale.bodyMedium, { color: colors.text, marginTop: space.xs }]}>
          <Inline text={block.text} />
        </RNText>
      );
    case 'para':
      return (
        <RNText style={base}>
          <Inline text={block.text} />
        </RNText>
      );
    case 'quote':
      return (
        <View style={[styles.quote, { borderLeftColor: colors.border }]}>
          <RNText style={[typeScale.body, { color: colors.textSecondary }]}>
            <Inline text={block.text} />
          </RNText>
        </View>
      );
    case 'rule':
      return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider }} />;
    case 'code':
      return (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.code, { backgroundColor: colors.surfaceMuted }]}
          contentContainerStyle={{ padding: space.md }}>
          <RNText selectable style={[typeScale.mono, { color: colors.text }]}>
            {block.code}
          </RNText>
        </ScrollView>
      );
    case 'list':
      return (
        <View style={{ gap: space.xs }}>
          {block.items.map((it, i) => (
            <View key={i} style={[styles.li, { paddingLeft: it.indent * 16 }]}>
              <RNText style={[base, styles.bullet]}>{block.ordered ? `${it.n}.` : '•'}</RNText>
              <RNText style={[base, { flex: 1 }]}>
                <Inline text={it.text} />
              </RNText>
            </View>
          ))}
        </View>
      );
  }
}

/** Inline: `code`, **bold**, *italic*, [link](url). */
function Inline({ text }: { text: string }) {
  const colors = useColors();
  const nodes: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      nodes.push(
        <RNText key={k++} style={{ fontFamily: fonts.mono, fontSize: 14, backgroundColor: colors.surfaceMuted }}>
          {` ${tok.slice(1, -1)} `}
        </RNText>,
      );
    } else if (tok.startsWith('**') || tok.startsWith('__')) {
      nodes.push(
        <RNText key={k++} style={{ fontFamily: fonts.semibold }}>
          {tok.slice(2, -2)}
        </RNText>,
      );
    } else if (tok.startsWith('*')) {
      nodes.push(
        <RNText key={k++} style={{ fontStyle: 'italic' }}>
          {tok.slice(1, -1)}
        </RNText>,
      );
    } else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      nodes.push(
        <RNText key={k++} style={{ color: colors.accent }} onPress={() => WebBrowser.openBrowserAsync(lm[2])}>
          {lm[1]}
        </RNText>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

const styles = StyleSheet.create({
  quote: { borderLeftWidth: 3, paddingLeft: space.md },
  code: { borderRadius: radius.md },
  li: { flexDirection: 'row', gap: space.sm },
  bullet: { minWidth: 14 },
});
