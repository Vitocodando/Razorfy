import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  PressableProps,
  ScrollViewProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, shadow } from '../theme';
import { BrandLogo } from './BrandLogo';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  scroll = true,
  withTopInset = true,
  contentStyle,
  ...scrollProps
}: PropsWithChildren<
  ScrollViewProps & {
    scroll?: boolean;
    withTopInset?: boolean;
    contentStyle?: StyleProp<ViewStyle>;
  }
>) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.screenContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      edges={
        withTopInset
          ? ['top', 'left', 'right', 'bottom']
          : ['left', 'right', 'bottom']
      }
      style={styles.safeArea}
    >
      {content}
    </SafeAreaView>
  );
}

export function AppHeader({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerBrand}>
        <BrandLogo compact />
        <View style={styles.headerCopy}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        {right}
      </View>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  icon,
  loading,
  disabled,
  variant = 'red',
  ...props
}: PressableProps & {
  label: string;
  icon?: IconName;
  loading?: boolean;
  variant?: 'red' | 'blue' | 'outline';
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'blue' && styles.buttonBlue,
        variant === 'outline' && styles.buttonOutline,
        pressed && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.blue : colors.white} />
      ) : (
        <>
          <Text
            style={[
              styles.buttonText,
              variant === 'outline' && styles.buttonTextOutline,
            ]}
          >
            {label}
          </Text>
          {icon ? (
            <Ionicons
              name={icon}
              size={19}
              color={variant === 'outline' ? colors.blue : colors.white}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={styles.error}>
      <Ionicons name="alert-circle-outline" size={19} color={colors.redDark} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <Card style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.blue} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </Card>
  );
}

export function LoadingState() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.red} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  screenContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  flex: {
    flex: 1,
  },
  header: {
    marginBottom: 24,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.red,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    marginBottom: 3,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.extraBold,
    fontSize: 26,
    lineHeight: 31,
  },
  description: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  button: {
    minHeight: 54,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: colors.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonBlue: {
    backgroundColor: colors.blue,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderColor: colors.blue,
    borderWidth: 1.5,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  buttonTextOutline: {
    color: colors.blue,
  },
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    ...shadow,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 13,
    borderRadius: 14,
    backgroundColor: colors.redSoft,
    marginVertical: 12,
  },
  errorText: {
    flex: 1,
    color: colors.redDark,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.ink,
    marginBottom: 7,
  },
  emptyDescription: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  loading: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
