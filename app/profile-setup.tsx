import { AvatarRing, IconButton, InputField, PrimaryButton } from '@/components/ui/draft';
import {
  avatarSignedUrl,
  isDirectUri,
  uploadAvatar,
  useProfile,
  type BikeType,
  type SkillLevel,
} from '@/lib/profile';
import { toast } from '@/lib/toast';
import { colors, radius, spacing, typography } from '@/theme';
import { ArrowLeft, Bicycling, Camera } from '@solar-icons/react-native/Linear';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const SKILL_LEVELS: readonly SkillLevel[] = ['Novice', 'Pro', 'Elite'];
const BIKE_TYPES: readonly BikeType[] = ['Road', 'Gravel', 'MTB', 'Hybrid'];

// Validation bounds — silently clamp on save and surface a toast if the
// user typed something out of range.
const PACE_MIN = 5;
const PACE_MAX = 60;
const BIKE_WEIGHT_MIN = 3;
const BIKE_WEIGHT_MAX = 20;

/**
 * Profile setup screen — reused for both first-time onboarding and
 * editing an existing profile from the Profile tab.
 *
 * Pass `?mode=edit` when linking from a settings flow to swap the CTA
 * label to "SAVE CHANGES". The default mode is `create` (initial
 * onboarding).
 */
export default function ProfileSetupScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEdit = params.mode === 'edit';

  const { profile, update } = useProfile();

  const [name, setName] = useState(profile.name);
  const [skill, setSkill] = useState<SkillLevel>(profile.skillLevel);
  const [pace, setPace] = useState(String(profile.avgPaceKmh));
  const [avatarUri, setAvatarUri] = useState<string | null>(
    profile.avatarUri,
  );
  const [bikeName, setBikeName] = useState(profile.bike?.name ?? '');
  const [bikeType, setBikeType] = useState<BikeType>(
    profile.bike?.type ?? 'Road',
  );
  const [bikeWeight, setBikeWeight] = useState(
    String(profile.bike?.weightKg ?? 7.2),
  );

  const trimmedName = name.trim();
  const nameValid = trimmedName.length > 0;
  const paceNumber = Number(pace);
  const paceValid =
    Number.isFinite(paceNumber) && paceNumber >= PACE_MIN && paceNumber <= PACE_MAX;
  const weightNumber = Number(bikeWeight);
  const weightValid =
    Number.isFinite(weightNumber) &&
    weightNumber >= BIKE_WEIGHT_MIN &&
    weightNumber <= BIKE_WEIGHT_MAX;
  const canSubmit = nameValid && paceValid && weightValid;

  const cta = isEdit ? 'SAVE CHANGES' : 'CREATE PROFILE';
  const subtitle = isEdit
    ? 'Tune your profile to keep matches accurate.'
    : 'Define your profile to match the perfect draft.';

  const initials = useMemo(() => {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [trimmedName]);

  // Resolve the avatar to a renderable URI. A fresh `file://` pick or an
  // `http(s)` URL renders directly; a Storage object path is resolved to a
  // short-lived signed URL.
  const [displayUri, setDisplayUri] = useState<string | null>(
    avatarUri && isDirectUri(avatarUri) ? avatarUri : null,
  );

  useEffect(() => {
    if (!avatarUri) {
      setDisplayUri(null);
      return;
    }
    if (isDirectUri(avatarUri)) {
      setDisplayUri(avatarUri);
      return;
    }
    // Storage path — resolve to a signed URL, ignoring stale results.
    let active = true;
    setDisplayUri(null);
    avatarSignedUrl(avatarUri).then((url) => {
      if (active) setDisplayUri(url);
    });
    return () => {
      active = false;
    };
  }, [avatarUri]);

  const handleSubmit = async () => {
    if (!nameValid) {
      toast.error('Name is required');
      return;
    }
    if (!paceValid) {
      toast.error('Pace looks off', {
        text2: `Enter a value between ${PACE_MIN} and ${PACE_MAX} km/h.`,
      });
      return;
    }
    if (!weightValid) {
      toast.error('Bike weight looks off', {
        text2: `Enter a value between ${BIKE_WEIGHT_MIN} and ${BIKE_WEIGHT_MAX} kg.`,
      });
      return;
    }

    // If the user picked a NEW local image, upload it and persist the
    // returned storage path instead of the transient file:// URI. On
    // failure, warn but don't block the save — keep the previously
    // persisted avatar value untouched.
    let avatarToSave = avatarUri;
    if (
      avatarUri &&
      avatarUri.startsWith('file://') &&
      avatarUri !== profile.avatarUri
    ) {
      const path = await uploadAvatar(avatarUri);
      if (path) {
        avatarToSave = path;
      } else {
        toast.error('Avatar upload failed', {
          text2: 'Saved your profile; photo unchanged.',
        });
        avatarToSave = profile.avatarUri;
      }
    }

    await update({
      name: trimmedName,
      skillLevel: skill,
      avgPaceKmh: Math.round(paceNumber),
      avatarUri: avatarToSave,
      bike: {
        name: bikeName.trim() || 'My bike',
        type: bikeType,
        weightKg: Math.round(weightNumber * 10) / 10,
      },
    });

    toast.success(isEdit ? 'Profile saved' : 'Profile created', {
      text2: isEdit ? 'Your changes are in.' : 'Welcome to the slipstream.',
    });

    if (isEdit) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  // Shared picker options — square crop to match the circular avatar.
  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast.error('Camera access denied', {
        text2: 'Enable camera access in Settings to take a photo.',
      });
      return;
    }

    // The camera is unavailable on the iOS Simulator (and can throw on
    // devices without one) — `launchCameraAsync` rejects instead of
    // returning, so guard it and surface a toast rather than a redbox.
    try {
      const result = await ImagePicker.launchCameraAsync(pickerOptions);
      if (!result.canceled) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch {
      toast.error('Camera unavailable', {
        text2: 'No camera here — choose a photo from your library instead.',
      });
    }
  };

  const pickFromLibrary = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Photo access denied', {
        text2: 'Enable photo access in Settings to choose a picture.',
      });
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (!result.canceled) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch {
      toast.error('Could not open library', {
        text2: 'Something went wrong picking a photo. Try again.',
      });
    }
  };

  const removePhoto = () => setAvatarUri(null);

  const handleChooseAvatar = () => {
    // Offer "Remove photo" only when there's an avatar to clear.
    const options = [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickFromLibrary },
      ...(avatarUri
        ? [{
            text: 'Remove Photo',
            style: 'destructive' as const,
            onPress: removePhoto,
          }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ];
    Alert.alert('Change photo', 'Choose a source for your profile picture.', options);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <IconButton
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          icon={<ArrowLeft size={22} color={colors.textOnDark} />}
        />

        <Text style={styles.title}>RIDER DNA</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Avatar — tappable, shows current photo or initials. */}
        <View style={styles.avatarSection}>
          <Pressable
            onPress={handleChooseAvatar}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={({ pressed }) => [
              styles.avatarWrap,
              pressed && styles.avatarWrapPressed,
            ]}
          >
            <AvatarRing
              uri={displayUri}
              initials={initials}
              size={AVATAR_SIZE}
              ringColor={colors.hairlineStrong}
              ringWidth={2}
              initialsFontSize={typography.size['2xl']}
            />
            <View style={styles.avatarEditBadge}>
              <Camera size={14} color={colors.textOnPrimary} />
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </View>

        <InputField
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="Alex Rider"
          containerStyle={styles.input}
        />

        <Text style={styles.label}>SKILL LEVEL</Text>
        <View style={styles.chipsRow}>
          {SKILL_LEVELS.map((level) => {
            const active = skill === level;
            return (
              <Pressable
                key={level}
                onPress={() => setSkill(level)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {level}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <InputField
          label="Average pace (km/h)"
          value={pace}
          onChangeText={setPace}
          keyboardType="numeric"
          containerStyle={styles.input}
        />

        {/* BIKE SETUP — separated visually so it reads as its own block. */}
        <View style={styles.sectionDivider} />

        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Bicycling size={18} color={colors.textOnDark} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>BIKE SETUP</Text>
            <Text style={styles.sectionSubtitle}>
              Used to estimate aero savings
            </Text>
          </View>
        </View>

        <InputField
          label="Bike name"
          value={bikeName}
          onChangeText={setBikeName}
          placeholder="My bike"
          containerStyle={styles.input}
        />

        <Text style={styles.label}>BIKE TYPE</Text>
        <View style={styles.chipsRow}>
          {BIKE_TYPES.map((type) => {
            const active = bikeType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setBikeType(type)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <InputField
          label="Bike weight (kg)"
          value={bikeWeight}
          onChangeText={setBikeWeight}
          keyboardType="decimal-pad"
          containerStyle={styles.input}
        />
      </ScrollView>

      <PrimaryButton
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={styles.primaryButton}
      >
        {cta}
      </PrimaryButton>
    </View>
  );
}

const AVATAR_SIZE = 96;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['4xl'],
    paddingBottom: spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    marginBottom: spacing['2xl'],
  },
  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    position: 'relative',
  },
  avatarWrapPressed: {
    opacity: 0.85,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  avatarHint: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginTop: spacing.sm,
  },
  // Form
  label: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexGrow: 1,
    flexBasis: '22%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.sm,
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
  // Bike section
  sectionDivider: {
    height: 1,
    backgroundColor: colors.inactiveOnDark,
    opacity: 0.4,
    marginVertical: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.base,
    letterSpacing: typography.letterSpacing.wide,
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginTop: spacing['3xs'],
  },
  primaryButton: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
});
