import { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Image,
  StyleSheet,
  ViewToken,
  useWindowDimensions,
} from 'react-native';
import { router, Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { G, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme';

type SlideTheme = {
  background: string;
  textColor: string;
  skipColor: string;
  buttonBg: string;
  buttonChevronColor: string;
  activeDotColor: string;
  inactiveDotColor: string;
};

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  theme: SlideTheme;
  decoration: 'left' | 'right' | 'bike';
  decorationFill?: string;
};

const slides: Slide[] = [
  {
    id: '1',
    title: 'Ride the Slipstream',
    subtitle: 'Save up to 30% energy by riding in the draft of others.',
    decoration: 'left',
    decorationFill: colors.black,
    theme: {
      background: colors.primary,
      textColor: colors.textOnLight,
      skipColor: colors.textOnLight,
      buttonBg: colors.black,
      buttonChevronColor: colors.white,
      activeDotColor: colors.textOnLight,
      inactiveDotColor: colors.inactiveOnPrimary,
    },
  },
  {
    id: '2',
    title: 'Safety in Numbers',
    subtitle: 'Our smart routing prioritizes high-density paths for a safer experience.',
    decoration: 'right',
    decorationFill: colors.primary,
    theme: {
      background: colors.white,
      textColor: colors.textOnLight,
      skipColor: colors.textOnLight,
      buttonBg: colors.primary,
      buttonChevronColor: colors.textOnPrimary,
      activeDotColor: colors.textOnLight,
      inactiveDotColor: colors.inactiveOnLight,
    },
  },
  {
    id: '3',
    title: 'Smart Companion',
    subtitle: 'Real-time feedback on your aerodynamic efficiency.',
    decoration: 'bike',
    theme: {
      background: colors.background,
      textColor: colors.textOnDark,
      skipColor: colors.textOnLight,
      buttonBg: colors.white,
      buttonChevronColor: colors.textOnPrimary,
      activeDotColor: colors.primary,
      inactiveDotColor: colors.inactiveOnDark,
    },
  },
];

// Height of the bottom controls row (the 60pt Next button); text blocks
// clear this so they never overlap the dots / button on any screen size.
const CONTROLS_HEIGHT = 60;

const DECORATION_PATHS = [
  'M532.205 587.897H563L522.729 509.214C465.087 396.385 385.335 332.548 301.635 332.548H261.365C178.454 332.548 98.7027 396.385 40.2707 509.214L0 587.897H30.7952C113.705 587.897 193.457 524.06 251.889 411.231L281.895 353.332C264.523 552.267 113.705 867 113.705 867H451.663C451.663 867 302.425 556.721 283.474 357.786L311.111 412.716C368.753 524.06 448.505 587.897 532.205 587.897Z',
  'M256.627 216.75L281.105 169.243L305.584 216.75C352.961 310.279 419.289 362.24 487.986 362.24H513.254L480.09 296.918C432.713 203.389 366.384 151.428 297.687 151.428H264.523C195.826 151.428 130.288 203.389 82.1207 296.918L48.9566 363.724H74.2245C142.922 363.724 209.25 310.279 256.627 216.75Z',
  'M261.365 53.4452L281.105 14.8459L300.846 53.4452C339.537 129.159 393.232 172.212 449.295 172.212H469.825L442.978 118.767C404.286 43.0531 350.592 0 294.529 0H267.682C211.619 0 157.924 43.0531 119.233 118.767L92.3858 172.212H112.916C168.979 172.212 222.673 129.159 261.365 53.4452Z',
];

function ChevronDecoration({ fill }: { fill: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 867 563">
      <G transform="rotate(90 433.5 433.5)">
        {DECORATION_PATHS.map((d, i) => (
          <Path key={i} d={d} fill={fill} />
        ))}
      </G>
    </Svg>
  );
}

function ChevronRightIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.25 4.5l7.5 7.5-7.5 7.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SlideContent({
  slide,
  width,
  topInset,
  bottomInset,
}: {
  slide: Slide;
  width: number;
  topInset: number;
  bottomInset: number;
}) {
  // Text sits above the bottom controls row (dots + Next button), anchored
  // to the safe area so it never collides with the home indicator or floats
  // mid-screen on taller / shorter devices.
  const textBottom = bottomInset + CONTROLS_HEIGHT + spacing['3xl'];
  return (
    <View style={[styles.slide, { width, backgroundColor: slide.theme.background }]}>
      {slide.decoration === 'left' && (
        <View
          style={[styles.decorationLeft, { top: topInset + spacing.lg }]}
          pointerEvents="none"
        >
          <ChevronDecoration fill={slide.decorationFill ?? colors.black} />
        </View>
      )}

      {slide.decoration === 'right' && (
        <View
          style={[styles.decorationRight, { top: topInset + spacing.lg }]}
          pointerEvents="none"
        >
          <ChevronDecoration fill={slide.decorationFill ?? colors.primary} />
        </View>
      )}

      {slide.decoration === 'bike' && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image
            source={require('../../assets/images/onboarding/bike-bg.jpg')}
            style={styles.bikeImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={[colors.transparent, colors.transparent, colors.black]}
            locations={[0, 0.36266, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <View style={[styles.textBlock, { bottom: textBottom }]}>
        <Text style={[styles.title, { color: slide.theme.textColor }]} allowFontScaling={false}>
          {slide.title}
        </Text>
        <Text style={[styles.subtitle, { color: slide.theme.textColor }]} allowFontScaling={false}>
          {slide.subtitle}
        </Text>
      </View>
    </View>
  );
}

function PageDots({
  count,
  activeIndex,
  activeColor,
  inactiveColor,
}: {
  count: number;
  activeIndex: number;
  activeColor: string;
  inactiveColor: string;
}) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === activeIndex;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              isActive
                ? { width: 17, backgroundColor: activeColor }
                : { width: 7, backgroundColor: inactiveColor },
            ]}
          />
        );
      })}
    </View>
  );
}

export default function OnboardingSlidesScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      router.replace('/auth/choose' as Href);
    }
  };

  const currentSlide = slides[currentIndex];
  const theme = currentSlide.theme;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <SlideContent
            slide={item}
            width={width}
            topInset={insets.top}
            bottomInset={insets.bottom}
          />
        )}
      />

      <View
        style={[
          styles.controlsRow,
          { bottom: insets.bottom + spacing.lg },
        ]}
        pointerEvents="box-none"
      >
        <PageDots
          count={slides.length}
          activeIndex={currentIndex}
          activeColor={theme.activeDotColor}
          inactiveColor={theme.inactiveDotColor}
        />

        <Pressable
          onPress={handleNext}
          style={[styles.nextButton, { backgroundColor: theme.buttonBg }]}
        >
          <ChevronRightIcon color={theme.buttonChevronColor} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    overflow: 'hidden',
  },
  bikeImage: {
    width: '100%',
    height: '100%',
  },
  decorationLeft: {
    position: 'absolute',
    left: 23,
    width: 867,
    height: 563,
  },
  decorationRight: {
    position: 'absolute',
    right: 20,
    width: 867,
    height: 563,
  },
  textBlock: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.display,
    lineHeight: Math.round(typography.size.display * typography.lineHeight.tight),
  },
  subtitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xl,
    lineHeight: Math.round(typography.size.xl * typography.lineHeight.normal),
  },
  controlsRow: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    height: 7,
    borderRadius: radius.pill,
  },
  nextButton: {
    width: 60,
    height: 60,
    borderRadius: radius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
