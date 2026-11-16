import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { OptionGrid, PrimaryButton, TextField } from '../components/Controls';
import { PhotoCard } from '../components/PhotoCard';
import { hasErrors, validateDraft, type FieldErrors } from '../domain/validate';
import type { PhotoKind, Severity } from '../domain/handoff';
import { PHOTO_OPTIONS, SERVICE_SUGGESTIONS, SEVERITY_OPTIONS } from '../domain/labels';
import type { RootStackParamList } from '../navigation';
import { useRelay } from '../services/relay';
import { colors, space } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Create'>;

export function CreateHandoffScreen({ navigation }: Props) {
  const relay = useRelay();
  const [title, setTitle] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [notes, setNotes] = useState('');
  const [photoKind, setPhotoKind] = useState<PhotoKind | null>(null);
  const [author, setAuthor] = useState(relay.handle);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    Keyboard.dismiss();
    const nextErrors = validateDraft({
      title,
      notes,
      severity,
      service: serviceName,
      author,
      photoKind,
    });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await relay.setHandle(author.trim());
      await relay.create({
        title,
        notes,
        severity,
        service: serviceName,
        author,
        photoKind,
      });
      navigation.goBack();
    } catch {
      setFormError('Could not save this on the device.');
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.intro}>
            Write it as if you will not be awake when it pages again. If the API is down, this stays on the device.
          </Text>
          <TextField
            label="Headline"
            value={title}
            onChangeText={setTitle}
            placeholder="What changed, in one line"
            error={errors.title}
            maxLength={120}
            autoCorrect
          />
          <View style={styles.block}>
            <TextField
              label="Service"
              value={serviceName}
              onChangeText={setServiceName}
              placeholder="payments-api"
              error={errors.service}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={64}
            />
            <View style={styles.chips}>
              {SERVICE_SUGGESTIONS.map((suggestion) => {
                const selected = serviceName.trim() === suggestion;
                return (
                  <Pressable
                    key={suggestion}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setServiceName(suggestion)}
                    style={[styles.chip, selected && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextOn]}>{suggestion}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Severity</Text>
            <OptionGrid options={SEVERITY_OPTIONS} value={severity} onChange={(value) => value && setSeverity(value)} />
          </View>
          <TextField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="What you tried, what you would do at 3am, and what not to undo."
            error={errors.notes}
            multiline
            maxLength={4000}
            hint={`${notes.trim().length}/4000`}
          />
          <View style={styles.block}>
            <Text style={styles.label}>Snapshot</Text>
            <Text style={styles.hint}>A stand-in for a screenshot. Nothing is uploaded.</Text>
            <OptionGrid options={PHOTO_OPTIONS} value={photoKind} onChange={setPhotoKind} allowClear />
            {photoKind ? <PhotoCard kind={photoKind} /> : null}
          </View>
          <TextField
            label="Signing as"
            value={author}
            onChangeText={setAuthor}
            placeholder="your handle"
            error={errors.author}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={32}
            hint="Saved on this device for the next handoff."
          />
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          <PrimaryButton label={submitting ? 'Saving…' : 'Hand off'} disabled={submitting} onPress={() => void submit()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: space.xl,
    gap: 18,
    paddingBottom: 32,
  },
  intro: {
    color: colors.textDim,
    fontSize: 15,
    lineHeight: 22,
  },
  block: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: {
    borderColor: colors.amber,
    backgroundColor: colors.amberInk,
  },
  chipText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextOn: {
    color: colors.amber,
  },
  formError: {
    color: colors.critical,
    fontSize: 14,
  },
});
