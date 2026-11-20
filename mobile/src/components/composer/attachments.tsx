import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { PickedImage } from '@/lib/images';
import { radius, space, useColors } from '@/theme';

export function Attachments({ images, onRemove }: { images: PickedImage[]; onRemove: (i: number) => void }) {
  const colors = useColors();
  if (!images.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {images.map((img, i) => (
        <View key={img.uri} style={styles.thumbWrap}>
          <Image source={{ uri: img.uri }} style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]} />
          <Pressable
            hitSlop={8}
            onPress={() => onRemove(i)}
            style={[styles.remove, { backgroundColor: colors.text }]}>
            <X size={11} color={colors.surface} strokeWidth={3} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.sm },
  thumbWrap: { paddingTop: 6, paddingRight: 6 },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
  remove: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
