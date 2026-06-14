import { createElement } from 'react';
import { Image, Platform, View } from 'react-native';
import { colors } from '../theme';

/**
 * A location map. On web we embed a real Google Map (keyless embed) so it looks
 * legit; on native we fall back to a static OpenStreetMap image (no native maps
 * dependency / dev build needed for the demo).
 */
export function MapView({
  lat,
  lng,
  label,
  height = 170,
}: {
  lat: number;
  lng: number;
  label?: string;
  height?: number;
}) {
  if (Platform.OS === 'web') {
    const q = `${lat},${lng}${label ? `(${encodeURIComponent(label)})` : ''}`;
    const src = `https://www.google.com/maps?q=${q}&z=13&output=embed`;
    // Raw DOM iframe — valid in react-native-web.
    return createElement('iframe', {
      src,
      title: 'map',
      loading: 'lazy',
      style: { border: 0, width: '100%', height, borderRadius: 14, display: 'block' },
    });
  }

  const osm = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=13&size=600x320&markers=${lat},${lng},red-pushpin`;
  return (
    <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.hairline }}>
      <Image source={{ uri: osm }} style={{ width: '100%', height }} resizeMode="cover" />
    </View>
  );
}
