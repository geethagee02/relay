import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius } from '../theme/tokens';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary';
};

export function PrimaryButton({ label, onPress, disabled = false, tone = 'primary' }: ButtonProps) {
  const secondary = tone === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  multiline?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  maxLength?: number;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  multiline = false,
  autoCapitalize = 'sentences',
  autoCorrect = true,
  maxLength,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multiline, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  allowClear = false,
}: {
  options: readonly { value: T; label: string; hint: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  allowClear?: boolean;
}) {
  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(selected && allowClear ? null : option.value)}
            style={[styles.option, selected && styles.optionOn]}
          >
            <Text style={[styles.optionLabel, selected && styles.optionLabelOn]}>{option.label}</Text>
            <Text style={styles.optionHint}>{option.hint}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.amber,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  buttonText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryText: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.4,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgInset,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multiline: {
    minHeight: 140,
  },
  inputError: {
    borderColor: colors.critical,
  },
  error: {
    color: colors.critical,
    fontSize: 13,
    lineHeight: 18,
  },
  hint: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 64,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgInset,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  optionOn: {
    borderColor: colors.amber,
    backgroundColor: colors.amberInk,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  optionLabelOn: {
    color: colors.amber,
  },
  optionHint: {
    color: colors.textFaint,
    fontSize: 12,
  },
});
