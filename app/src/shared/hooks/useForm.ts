import { useCallback, useMemo, useState } from 'react';

export type Validator<T, V = unknown> = (value: V, all: T) => string | undefined;
export type Validators<T> = { [K in keyof T]?: Validator<T, T[K]> };

interface UseFormOptions<T> {
  initial: T;
  validators?: Validators<T>;
  onSubmit?: (values: T) => void | Promise<void>;
}

interface UseFormResult<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isSubmitting: boolean;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  setTouched: <K extends keyof T>(key: K, touched?: boolean) => void;
  submit: () => Promise<void>;
  reset: (next?: Partial<T>) => void;
}

export function useForm<T extends Record<string, unknown>>({
  initial,
  validators,
  onSubmit,
}: UseFormOptions<T>): UseFormResult<T> {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouchedState] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errors = useMemo<Partial<Record<keyof T, string>>>(() => {
    const e: Partial<Record<keyof T, string>> = {};
    if (!validators) return e;
    for (const key of Object.keys(validators) as (keyof T)[]) {
      const v = validators[key];
      if (!v) continue;
      const err = v(values[key], values);
      if (err) e[key] = err;
    }
    return e;
  }, [values, validators]);

  const isValid = Object.keys(errors).length === 0;

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setTouched = useCallback(<K extends keyof T>(key: K, t: boolean = true) => {
    setTouchedState((prev) => ({ ...prev, [key]: t }));
  }, []);

  const submit = useCallback(async () => {
    // Touch all fields to surface any errors
    if (validators) {
      const all: Partial<Record<keyof T, boolean>> = {};
      for (const key of Object.keys(validators) as (keyof T)[]) all[key] = true;
      setTouchedState(all);
    }
    if (!isValid || !onSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }, [isValid, onSubmit, validators, values]);

  const reset = useCallback((next?: Partial<T>) => {
    setValues({ ...initial, ...next });
    setTouchedState({});
  }, [initial]);

  return { values, errors, touched, isValid, isSubmitting, setField, setTouched, submit, reset };
}
