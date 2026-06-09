// app/groups/[id]/schedule-ride.tsx
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { InputField, PrimaryButton, SecondaryButton } from '@/components/ui/draft';
import { colors, radius, spacing, typography } from '@/theme';
import { scheduleRide, useGroups } from '@/lib/groups';
import { useRoutes } from '@/lib/routes';
import { toast } from '@/lib/toast';

export default function ScheduleRideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useGroups();
  const { routes } = useRoutes();
  const [title, setTitle] = useState('');
  // Default to tomorrow 07:00 local; the user can adjust the day offset.
  const [daysAhead, setDaysAhead] = useState('1');
  const [routeId, setRouteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const days = Number.parseInt(daysAhead, 10);
  const canSave = title.trim().length > 0 && Number.isFinite(days) && days >= 0 && !!id && !saving;

  const onSubmit = async () => {
    if (!canSave || !id) return;
    const when = new Date();
    when.setDate(when.getDate() + days);
    when.setHours(7, 0, 0, 0);
    setSaving(true);
    const ok = await scheduleRide({
      groupId: id,
      title: title.trim(),
      scheduledAt: when.getTime(),
      routeId,
    });
    setSaving(false);
    if (!ok) {
      toast.error('Could not schedule ride', { text2: 'Please try again.' });
      return;
    }
    await refresh();
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>SCHEDULE RIDE</Text>

      <InputField
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="Sunday spin"
        autoFocus
      />
      <InputField
        label="Days from today"
        value={daysAhead}
        onChangeText={(t) => setDaysAhead(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
      />
      <Text style={styles.fieldHint}>Rides default to 07:00 on the chosen day.</Text>

      <Text style={styles.fieldLabel}>ROUTE (OPTIONAL)</Text>
      <View>
        <Pressable
          onPress={() => setRouteId(null)}
          style={({ pressed }) => [
            styles.routeChip,
            routeId === null && styles.routeChipActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.routeChipText}>No route</Text>
        </Pressable>
        {routes.map((route) => (
          <Pressable
            key={route.id}
            onPress={() => setRouteId(route.id)}
            style={({ pressed }) => [
              styles.routeChip,
              routeId === route.id && styles.routeChipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.routeChipText}>{route.name}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <PrimaryButton onPress={onSubmit} disabled={!canSave}>
          {saving ? 'Scheduling…' : 'Schedule ride'}
        </PrimaryButton>
        <SecondaryButton onPress={() => router.back()}>Cancel</SecondaryButton>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing['4xl'], gap: spacing.md },
  header: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
  },
  fieldHint: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size['2xs'],
    opacity: 0.7,
  },
  routeChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.xs,
  },
  routeChipActive: { borderWidth: 1, borderColor: colors.textOnDark },
  routeChipText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
  },
  pressed: { opacity: 0.85 },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
