import * as ImagePicker from 'expo-image-picker';

export type PickedImage = { uri: string; base64: string; mimeType: string };

export const MAX_IMAGES = 5;

/** Pick up to `remaining` images from the gallery (or camera), returned as base64 for the API. */
export async function pickImages(remaining: number, source: 'library' | 'camera' = 'library') {
  if (remaining <= 0) return [];
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    base64: true,
    quality: 0.7,
    allowsMultipleSelection: source === 'library',
    selectionLimit: remaining,
  };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return [];
  }
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return [];
  return res.assets
    .filter((a) => a.base64)
    .slice(0, remaining)
    .map<PickedImage>((a) => ({
      uri: a.uri,
      base64: a.base64!,
      mimeType: a.mimeType && a.mimeType !== 'image/heic' ? a.mimeType : 'image/jpeg',
    }));
}
