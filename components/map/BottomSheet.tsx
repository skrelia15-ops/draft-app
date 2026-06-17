import {
  ArrowRight,
  DangerCircle,
  TransferVertical,
} from '@solar-icons/react-native/Linear';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { PlacePrediction } from '@/lib/maps';
import { colors, radius, spacing, typography } from '@/theme';

import { InputRow } from './InputRow';
import { PredictionsList } from './PredictionsList';
import { RouteSummary } from './RouteSummary';
import type { Endpoint, Field, RouteState } from './types';

export type BottomSheetProps = {
  insetBottom: number;
  origin: Endpoint;
  destination: Endpoint;
  activeField: Field | null;
  predictions: PlacePrediction[];
  searching: boolean;
  showPredictions: boolean;
  showRouteSummary: boolean;
  routeState: RouteState;
  navigating: boolean;
  trafficVisible: boolean;
  originInputRef: React.RefObject<TextInput | null>;
  destInputRef: React.RefObject<TextInput | null>;
  onFocusField: (which: Field | null) => void;
  onChangeQuery: (which: Field, query: string) => void;
  onClearField: (which: Field) => void;
  onSelectPrediction: (which: Field, prediction: PlacePrediction) => void;
  onPickOnMap: (which: Field) => void;
  onSwap: () => void;
  onStart: () => void;
  onRetryRoute: () => void;
  onLayout: (height: number) => void;
};

export function BottomSheet(props: BottomSheetProps) {
  const {
    insetBottom,
    origin,
    destination,
    activeField,
    predictions,
    searching,
    showPredictions,
    showRouteSummary,
    routeState,
    navigating,
    trafficVisible,
    originInputRef,
    destInputRef,
    onFocusField,
    onChangeQuery,
    onClearField,
    onSelectPrediction,
    onPickOnMap,
    onSwap,
    onStart,
    onRetryRoute,
    onLayout,
  } = props;

  const wrapStyle = [
    styles.sheetWrap,
    {
      paddingHorizontal: spacing.lg,
      paddingBottom: Math.max(insetBottom, spacing.sm),
    },
  ];

  const startEnabled = routeState.kind === 'ready' && !navigating;

  return (
    <View style={wrapStyle} pointerEvents="box-none">
      <View
        style={styles.sheet}
        onLayout={(e) => onLayout(e.nativeEvent.layout.height)}
      >
        <View style={styles.sheetHandle} />

        {/* FROM input */}
        <InputRow
          which="origin"
          inputRef={originInputRef}
          value={origin.query}
          placeholder="Choose origin"
          dot={<View style={styles.inputDotOrigin} />}
          active={activeField === 'origin'}
          onFocus={() => onFocusField('origin')}
          onBlur={() => {
            // Defer so prediction taps still register.
            setTimeout(() => {
              onFocusField(null);
            }, 100);
          }}
          onChangeText={(t) => onChangeQuery('origin', t)}
          onClear={() => onClearField('origin')}
          onPickOnMap={() => onPickOnMap('origin')}
          showClear={origin.query.length > 0}
        />

        {showPredictions && activeField === 'origin' && (
          <PredictionsList
            predictions={predictions}
            searching={searching}
            onSelect={(p) => onSelectPrediction('origin', p)}
          />
        )}

        {/* Swap */}
        <View style={styles.swapRow}>
          <View style={styles.swapDivider} />
          <Pressable
            onPress={onSwap}
            hitSlop={spacing.xs}
            style={styles.swapButton}
          >
            <TransferVertical size={16} color={colors.textMuted} />
          </Pressable>
          <View style={styles.swapDivider} />
        </View>

        {/* TO input */}
        <InputRow
          which="destination"
          inputRef={destInputRef}
          value={destination.query}
          placeholder="Where to?"
          dot={<View style={styles.inputDotDest} />}
          active={activeField === 'destination'}
          onFocus={() => onFocusField('destination')}
          onBlur={() => {
            setTimeout(() => {
              onFocusField(null);
            }, 100);
          }}
          onChangeText={(t) => onChangeQuery('destination', t)}
          onClear={() => onClearField('destination')}
          onPickOnMap={() => onPickOnMap('destination')}
          showClear={destination.query.length > 0}
        />

        {showPredictions && activeField === 'destination' && (
          <PredictionsList
            predictions={predictions}
            searching={searching}
            onSelect={(p) => onSelectPrediction('destination', p)}
          />
        )}

        {showRouteSummary && (
          <>
            <View style={styles.summarySpacer} />
            <RouteSummary routeState={routeState} trafficVisible={trafficVisible} />
            {routeState.kind === 'error' && (
              <View style={styles.errorRow}>
                <DangerCircle size={16} color={colors.primary} />
                <Text style={styles.errorText} numberOfLines={3}>
                  {routeState.message}
                </Text>
                <Pressable onPress={onRetryRoute} hitSlop={spacing.xs}>
                  <Text style={styles.errorRetry}>RETRY</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.startButton,
            pressed && startEnabled && styles.startButtonPressed,
            !startEnabled && styles.startButtonDisabled,
          ]}
          disabled={!startEnabled}
          onPress={onStart}
        >
          <Text
            style={[
              styles.startButtonText,
              !startEnabled && styles.startButtonTextDisabled,
            ]}
          >
            {navigating ? 'STARTING…' : 'START RIDE'}
          </Text>
          <ArrowRight
            size={20}
            color={startEnabled ? colors.textOnPrimary : colors.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    shadowColor: colors.black,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.inactiveOnDark,
    marginBottom: spacing.sm,
  },
  inputDotOrigin: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
    borderWidth: 2,
    borderColor: colors.inactiveOnDark,
  },
  inputDotDest: {
    width: 10,
    height: 10,
    borderRadius: radius.xs,
    backgroundColor: colors.primary,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  swapDivider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.inactiveOnDark,
    opacity: 0.6,
  },
  swapButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summarySpacer: {
    height: spacing.md,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.inactiveOnDark,
  },
  errorText: {
    flex: 1,
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
  },
  errorRetry: {
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  startButtonPressed: {
    opacity: 0.9,
  },
  startButtonDisabled: {
    backgroundColor: colors.inactiveOnDark,
  },
  startButtonText: {
    color: colors.textOnPrimary,
    fontFamily: typography.fontFamily.extrabold,
    fontSize: typography.size.base,
    letterSpacing: typography.letterSpacing.wide,
  },
  startButtonTextDisabled: {
    color: colors.textMuted,
  },
});
