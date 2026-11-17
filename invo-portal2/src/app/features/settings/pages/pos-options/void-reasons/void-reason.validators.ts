import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** At most this many reasons can be defined. */
export const MAX_VOID_REASONS = 10;
/** A reason is a short sentence. */
export const MAX_VOID_REASON_LENGTH = 100;

/** One reason in the list. `id` is a client-side handle (the stored data is a plain string list). */
export interface VoidReasonItem {
  id: string;
  label: string;
}

export type VoidReasonError = 'required' | 'duplicate' | 'maxlength';

/** Normal form of a reason, used to compare two of them: trimmed and case-insensitive. */
export const normalizeReason = (value: string): string => value.trim().toLowerCase();

/**
 * The one rule used both when adding a reason and when editing one: it can't be empty, can't be too long, and can't repeat
 * another reason (case-insensitive). `taken` is the other reasons (for an edit: the list without the reason being edited).
 */
export function validateReason(value: string | null | undefined, taken: readonly string[]): VoidReasonError | null {
  const v = (value ?? '').trim();
  if (!v) return 'required';
  if (v.length > MAX_VOID_REASON_LENGTH) return 'maxlength';
  const n = normalizeReason(v);
  return taken.some(t => normalizeReason(t) === n) ? 'duplicate' : null;
}

/** `validateReason` as a reactive-forms validator. `taken` is read on every validation, so it always sees the current list. */
export function reasonValidator(taken: () => readonly string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const error = validateReason(control.value, taken());
    return error ? { [error]: true } : null;
  };
}

let seq = 0;
/** A fresh, unique id for a reason created on the client. */
export const newReasonId = (): string => `vr_${Date.now().toString(36)}_${(seq++).toString(36)}`;
