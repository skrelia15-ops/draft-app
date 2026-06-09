// app/groups/create.tsx
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Href, router } from 'expo-router';
import {
  InputField,
  PrimaryButton,
  SecondaryButton,
  SegmentedTabs,
} from '@/components/ui/draft';
import { colors, spacing, typography } from '@/theme';
import { createGroup, trainTypeLabel, useGroups, type TrainType } from '@/lib/groups';
import { toast } from '@/lib/toast';

const TRAIN_TYPES = ['ROTATING', 'STEADY', 'TEMPO'] as const satisfies readonly TrainType[];

export default function CreateGroupScreen() {
  const { refresh } = useGroups();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pace, setPace] = useState('30');
  const [trainType, setTrainType] = useState<TrainType>('ROTATING');
  const [saving, setSaving] = useState(false);

  const paceNum = Number.parseInt(pace, 10);
  const canSave = name.trim().length > 0 && Number.isFinite(paceNum) && paceNum > 0 && !saving;

  const onSubmit = async () => {
    if (!canSave) return;
    setSaving(true);
    const group = await createGroup({
      name: name.trim(),
      description: description.trim() || null,
      paceKmh: paceNum,
      trainType,
    });
    setSaving(false);
    if (!group) {
      toast.error('Could not create group', { text2: 'Please try again.' });
      return;
    }
    await refresh();
    router.replace(`/groups/${group.id}` as Href);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>NEW GROUP</Text>

      <InputField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Dawn Patrol"
        autoFocus
      />
      <InputField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Early morning rotating paceline"
      />
      <InputField
        label="Pace (km/h)"
        value={pace}
        onChangeText={(t) => setPace(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
      />

      <Text style={styles.fieldLabel}>TRAIN TYPE</Text>
      <SegmentedTabs
        options={TRAIN_TYPES}
        value={trainType}
        onChange={setTrainType}
        labelFor={trainTypeLabel}
        variant="pill"
      />

      <View style={styles.actions}>
        <PrimaryButton onPress={onSubmit} disabled={!canSave}>
          {saving ? 'Creating…' : 'Create group'}
        </PrimaryButton>
        <SecondaryButton onPress={() => router.back()}>Cancel</SecondaryButton>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing['4xl'], gap: spacing.lg },
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
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
