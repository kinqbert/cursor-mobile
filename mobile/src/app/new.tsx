import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowUp, Camera, ChevronDown, ImageIcon, Mic, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Attachments } from '@/components/composer/attachments';
import { RepoPicker } from '@/components/composer/repo-picker';
import { VoicePill } from '@/components/composer/voice-pill';
import { ActionMenu } from '@/components/ui/action-menu';
import { Text } from '@/components/ui/text';
import { cursor } from '@/lib/api/endpoints';
import { repoName } from '@/lib/format';
import { useModels } from '@/lib/hooks';
import { MAX_IMAGES, pickImages, type PickedImage } from '@/lib/images';
import { useComposerPrefs } from '@/lib/local-state';
import { watchAgent } from '@/lib/notifications';
import { qk } from '@/lib/query';
import { useDictation } from '@/lib/voice';
import { fonts, radius, space, useColors } from '@/theme';

export default function NewAgent() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ voice?: string; attach?: string }>();
  const { prefs, update } = useComposerPrefs();
  const models = useModels();

  const [text, setText] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [repoOpen, setRepoOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(!!params.attach);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseText = useRef('');
  const dictation = useDictation((t) => setText(joinText(baseText.current, t)));

  const mode = prefs.mode ?? 'agent';
  const model = models.data?.find((m) => m.id === prefs.modelId);

  const startVoice = () => {
    baseText.current = text;
    dictation.start();
  };

  // Mic shortcut from the home composer bar.
  useEffect(() => {
    if (params.voice) dictation.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addImages = async (source: 'library' | 'camera') => {
    const picked = await pickImages(MAX_IMAGES - images.length, source);
    setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
  };

  const canSend = !!text.trim() && !!prefs.repo && !sending;

  const send = async () => {
    if (!canSend || !prefs.repo) {
      if (!prefs.repo) setRepoOpen(true);
      return;
    }
    dictation.stop();
    setSending(true);
    setError(null);
    try {
      const res = await cursor.createAgent({
        prompt: {
          text: text.trim(),
          images: images.length
            ? images.map((i) => ({ data: i.base64, mimeType: i.mimeType }))
            : undefined,
        },
        model: prefs.modelId ? { id: prefs.modelId } : undefined,
        repos: [{ url: prefs.repo, startingRef: prefs.branch || undefined }],
        mode,
        autoCreatePR: mode === 'agent',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      watchAgent(res.agent.id);
      qc.invalidateQueries({ queryKey: qk.agents });
      router.dismiss();
      router.push({ pathname: '/agent/[id]', params: { id: res.agent.id, prompt: text.trim() } });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : 'Failed to launch agent');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + space.sm }]}>
      <Pressable style={styles.repoRow} onPress={() => setRepoOpen(true)} hitSlop={8}>
        <Text variant="meta" color={prefs.repo ? 'text' : 'textSecondary'}>
          {prefs.repo ? repoName(prefs.repo) : 'Choose repository'}
        </Text>
        {prefs.repo ? (
          <Text variant="meta" color="textSecondary">
            {prefs.branch || 'main'}
          </Text>
        ) : null}
        <ChevronDown size={14} color={colors.textSecondary} />
        <View style={{ flex: 1 }} />
        <Pressable
          hitSlop={8}
          onPress={() => update({ mode: mode === 'agent' ? 'plan' : 'agent' })}
          style={[styles.modeChip, { backgroundColor: colors.surfaceMuted }]}>
          <Text variant="caption" color={mode === 'plan' ? 'accent' : 'textSecondary'}>
            {mode === 'plan' ? 'Plan' : 'Agent'}
          </Text>
        </Pressable>
      </Pressable>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Plan, ask, build…"
        placeholderTextColor={colors.textTertiary}
        multiline
        autoFocus={!params.voice && !params.attach}
        style={[styles.input, { color: colors.text }]}
        textAlignVertical="top"
      />

      <Attachments images={images} onRemove={(i) => setImages((p) => p.filter((_, j) => j !== i))} />

      {error || dictation.error ? (
        <Text variant="caption" color="danger" style={{ marginBottom: space.sm }}>
          {error ?? dictation.error}
        </Text>
      ) : null}

      <View style={styles.toolbar}>
        <Pressable
          hitSlop={6}
          onPress={() => setAttachOpen(true)}
          style={[styles.circle, { backgroundColor: colors.surfaceMuted }]}>
          <Plus size={20} color={colors.text} strokeWidth={1.75} />
        </Pressable>
        <Pressable style={styles.modelBtn} onPress={() => setModelOpen(true)} hitSlop={6}>
          <Text variant="meta" color="textSecondary" numberOfLines={1}>
            {model?.displayName ?? 'Auto'}
          </Text>
          <ChevronDown size={14} color={colors.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {dictation.listening && dictation.startedAt ? (
          <VoicePill startedAt={dictation.startedAt} level={dictation.level} onStop={dictation.stop} />
        ) : (
          <Pressable
            hitSlop={6}
            onPress={startVoice}
            style={[styles.circle, { backgroundColor: colors.surfaceMuted }]}>
            <Mic size={18} color={colors.text} strokeWidth={1.75} />
          </Pressable>
        )}
        <Pressable
          disabled={!canSend}
          onPress={send}
          style={[
            styles.circle,
            { backgroundColor: colors.primary, opacity: canSend || sending ? 1 : 0.3 },
          ]}>
          {sending ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <ArrowUp size={20} color={colors.onPrimary} strokeWidth={2} />
          )}
        </Pressable>
      </View>

      <RepoPicker
        visible={repoOpen}
        repo={prefs.repo}
        branch={prefs.branch}
        onClose={() => setRepoOpen(false)}
        onSelect={(repo, branch) => {
          update({ repo, branch });
          setRepoOpen(false);
        }}
      />
      <ActionMenu
        visible={modelOpen}
        title="Model"
        onClose={() => setModelOpen(false)}
        items={[
          { label: 'Auto (your default)', selected: !prefs.modelId, onPress: () => update({ modelId: undefined }) },
          ...(models.data ?? []).map((m) => ({
            label: m.displayName,
            selected: prefs.modelId === m.id,
            onPress: () => update({ modelId: m.id }),
          })),
        ]}
      />
      <ActionMenu
        visible={attachOpen}
        title={`Attach images (${images.length}/${MAX_IMAGES})`}
        onClose={() => setAttachOpen(false)}
        items={[
          { label: 'Photo library', icon: ImageIcon, onPress: () => addImages('library') },
          { label: 'Take photo', icon: Camera, onPress: () => addImages('camera') },
        ]}
      />
    </View>
  );
}

function joinText(base: string, addition: string) {
  if (!base.trim()) return addition;
  return `${base.replace(/\s+$/, '')} ${addition}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.xl },
  repoRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  modeChip: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  input: {
    flex: 1,
    minHeight: 90,
    marginTop: space.md,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
  },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  modelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.xs, maxWidth: 170 },
});
