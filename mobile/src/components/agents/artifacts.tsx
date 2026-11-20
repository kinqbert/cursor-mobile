import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { FileText, Play, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoundButton } from '@/components/ui/round-button';
import { Text } from '@/components/ui/text';
import { cursor } from '@/lib/api/endpoints';
import type { Artifact } from '@/lib/api/types';
import { qk } from '@/lib/query';
import { radius, space, useColors } from '@/theme';

const IMAGE = /\.(png|jpe?g|gif|webp)$/i;
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;

/** "Demos" carousel: screenshots and videos the agent saved under artifacts/. */
export function Artifacts({ agentId }: { agentId: string }) {
  const artifacts = useQuery({
    queryKey: qk.artifacts(agentId),
    queryFn: () => cursor.artifacts(agentId),
    staleTime: 60_000,
  });
  const [viewing, setViewing] = useState<string | null>(null);
  const media = (artifacts.data ?? []).filter((a) => IMAGE.test(a.path) || VIDEO.test(a.path));
  const files = (artifacts.data ?? []).filter((a) => !IMAGE.test(a.path) && !VIDEO.test(a.path));
  if (!media.length && !files.length) return null;

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="section" color="textSecondary">
        Demos
      </Text>
      {media.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {media.map((a) => (
            <ArtifactTile key={a.path} agentId={agentId} artifact={a} onOpenImage={setViewing} />
          ))}
        </ScrollView>
      ) : null}
      {files.map((a) => (
        <FileLink key={a.path} agentId={agentId} artifact={a} />
      ))}
      <ImageViewer url={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}

function useArtifactUrl(agentId: string, path: string) {
  return useQuery({
    queryKey: ['artifact-url', agentId, path],
    queryFn: () => cursor.artifactUrl(agentId, path).then((r) => r.url),
    staleTime: 10 * 60_000, // presigned URLs live 15 minutes
    gcTime: 12 * 60_000,
  });
}

function ArtifactTile({
  agentId,
  artifact,
  onOpenImage,
}: {
  agentId: string;
  artifact: Artifact;
  onOpenImage: (url: string) => void;
}) {
  const colors = useColors();
  const url = useArtifactUrl(agentId, artifact.path);
  const video = VIDEO.test(artifact.path);
  return (
    <Pressable
      onPress={() => {
        if (!url.data) return;
        if (video) WebBrowser.openBrowserAsync(url.data);
        else onOpenImage(url.data);
      }}
      style={[styles.tile, { backgroundColor: colors.surfaceMuted }]}>
      {url.data && !video ? (
        <Image source={{ uri: url.data }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : null}
      {video ? (
        <View style={styles.center}>
          <View style={[styles.play, { backgroundColor: 'rgba(255,255,255,0.85)' }]}>
            <Play size={20} color="#111" fill="#111" />
          </View>
          <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ marginTop: space.sm }}>
            {artifact.path.split('/').pop()}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function FileLink({ agentId, artifact }: { agentId: string; artifact: Artifact }) {
  const colors = useColors();
  const url = useArtifactUrl(agentId, artifact.path);
  return (
    <Pressable
      onPress={() => url.data && WebBrowser.openBrowserAsync(url.data)}
      style={[styles.file, { backgroundColor: colors.surface }]}>
      <FileText size={16} color={colors.textSecondary} />
      <Text variant="callout" numberOfLines={1} style={{ flex: 1 }}>
        {artifact.path.replace(/^artifacts\//, '')}
      </Text>
      <Text variant="caption" color="textTertiary">
        {Math.max(1, Math.round(artifact.sizeBytes / 1024))} KB
      </Text>
    </Pressable>
  );
}

function ImageViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
        {url ? <Image source={{ uri: url }} style={{ width, height }} contentFit="contain" /> : null}
        <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg }}>
          <RoundButton icon={X} accessibilityLabel="Close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tile: { width: 240, height: 150, borderRadius: radius.md, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.md },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
});
