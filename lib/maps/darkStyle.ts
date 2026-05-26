import { colors } from '@/theme';

/**
 * Custom Google Maps style — dark theme tuned to the DRAFT app palette.
 *
 * Background sits flush with `colors.background` (#111111). Roads and
 * landmarks are de-emphasized so the route polyline and traffic layer
 * remain the visual focus during ride planning.
 *
 * Source: derived from Google's "Night" reference style with brand-specific
 * overrides. Pass via the `customMapStyle` prop on `<MapView />`.
 */
export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: colors.background }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: colors.background }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d9d9d9' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9aa0a6' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1f2a1a' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b9a4a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2b2b2b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a1a1a' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9aa0a6' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3d3d3d' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d9d9d9' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2c2c2c' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0e1a24' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3d6f8f' }],
  },
];
