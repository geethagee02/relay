import type { CreateHandoffInput } from './handoff';

/**
 * Same limits and character classes as server/src/validate.ts.
 * The server repeats them because it cannot trust this check.
 */
const HANDLE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,31}$/;
const SERVICE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const UNSUPPORTED = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

export type FieldName = 'title' | 'notes' | 'service' | 'author';
export type FieldErrors = Partial<Record<FieldName, string>>;

export function validateDraft(input: CreateHandoffInput): FieldErrors {
  const errors: FieldErrors = {};
  const title = input.title.trim();
  const notes = input.notes.trim();
  const service = input.service.trim();
  const author = input.author.trim();

  if (!title) errors.title = 'Give the next person a headline.';
  else if (title.length > 120) errors.title = 'Keep the headline to 120 characters.';
  else if (UNSUPPORTED.test(title)) errors.title = 'The headline has an unsupported character.';

  if (!notes) errors.notes = 'Write what they must not rediscover.';
  else if (notes.length > 4000) errors.notes = 'Notes must be 4000 characters or fewer.';
  else if (UNSUPPORTED.test(notes)) errors.notes = 'Notes contain an unsupported character.';

  if (!service) errors.service = 'Name the service.';
  else if (!SERVICE.test(service)) {
    errors.service = 'Use letters, numbers, dots, hyphens, or underscores.';
  }

  if (!author) errors.author = 'Sign it with your handle.';
  else if (!HANDLE.test(author)) errors.author = 'Use a handle of at most 32 characters.';

  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
