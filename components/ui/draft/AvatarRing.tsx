import { Image, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, radius, typography } from '@/theme';

type AvatarRingProps = {
  /** Renderable image URI, or null to show initials. */
  uri: string | null;
  /** Fallback initials shown when `uri` is null. */
  initials: string;
  /** Outer diameter in px. */
  size: number;
  /** Ring border colour. Defaults to the brand primary. */
  ringColor?: string;
  /** Ring border width. Defaults to 3. */
  ringWidth?: number;
  /** Initials font size. Defaults to 0.3 * size. */
  initialsFontSize?: number;
  /** Optional initials letter spacing. */
  initialsLetterSpacing?: number;
  style?: StyleProp<ViewStyle>;
};

/** Circular avatar: photo when available, capitalised initials otherwise. */
export function AvatarRing({
  uri,
  initials,
  size,
  ringColor = colors.primary,
  ringWidth = 3,
  initialsFontSize,
  initialsLetterSpacing,
  style,
}: AvatarRingProps) {
  const initialsStyle: StyleProp<TextStyle> = [
    styles.initials,
    { fontSize: initialsFontSize ?? size * 0.3 },
    initialsLetterSpacing != null && { letterSpacing: initialsLetterSpacing },
  ];
  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderColor: ringColor, borderWidth: ringWidth },
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <Text style={initialsStyle}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  initials: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
  },
});
