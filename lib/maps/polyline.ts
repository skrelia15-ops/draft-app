/**
 * Decoder for Google's Encoded Polyline Algorithm Format.
 * Reference: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 *
 * Hand-rolled to avoid pulling in the `@mapbox/polyline` dep — the algorithm
 * is small and dependency-free. Returns `{ latitude, longitude }` shaped for
 * `react-native-maps` `<Polyline coordinates={...} />`.
 */
export type LatLng = { latitude: number; longitude: number };

export function decodePolyline(encoded: string): LatLng[] {
  if (!encoded) return [];

  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}
