import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

const MAX_SIDE = 1280;

/**
 * Normalise a picked photo before upload: upright, ≤1280px, JPEG.
 * iPhones shoot HEIC, and full-size photos are 3–8 MB — too slow on 3G.
 */
export async function preparePhoto(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  try {
    const ctx = ImageManipulator.manipulate(asset.uri);
    const longest = Math.max(asset.width || 0, asset.height || 0);
    if (longest > MAX_SIDE) {
      ctx.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const image = await ctx.renderAsync();
    const saved = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
    return saved.uri;
  } catch {
    return asset.uri; // fall back to the original; the server re-encodes anyway
  }
}

function openSettingsPrompt(what: string) {
  Alert.alert(
    `${what} access is off`,
    `Allow ${what.toLowerCase()} access for AgroSense in your phone settings to continue.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open settings', onPress: () => Linking.openSettings() },
    ],
  );
}

export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    openSettingsPrompt('Camera');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
  if (result.canceled || !result.assets?.[0]) return null;
  return preparePhoto(result.assets[0]);
}

export async function pickPhoto(): Promise<string | null> {
  // Android 13+ and iOS 14+ use a system picker that needs no permission.
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
  if (result.canceled || !result.assets?.[0]) return null;
  return preparePhoto(result.assets[0]);
}
