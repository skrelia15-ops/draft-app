import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@/theme';
import { PrimaryButton } from '@/components/ui/draft';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Screen not found</Text>
      <PrimaryButton onPress={() => router.replace('/')}>Go Home</PrimaryButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.md,
    marginBottom: spacing.md,
  },
});
