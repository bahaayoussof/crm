import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export type AppSelectOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  disabled?: boolean;
  description?: string;
};

export type AppSelectProps<TValue extends string = string> = {
  id?: string;
  value?: TValue;
  defaultValue?: TValue;
  onValueChange?: (value: TValue) => void;
  options: AppSelectOption<TValue>[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  ariaLabel?: string;
  ariaDescribedby?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  invalid?: boolean;
};

export type AppSelectFieldProps<TValue extends string = string> = AppSelectProps<TValue> & {
  id: string;
  label: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  labelClassName?: string;
  hideLabel?: boolean;
};

const EMPTY_SENTINEL = "__empty_select_value__";

function toInternalValue<TValue extends string>(val?: TValue): string | undefined {
  if (val === undefined) return undefined;
  return val === "" ? EMPTY_SENTINEL : val;
}

function fromInternalValue<TValue extends string>(val: string): TValue {
  return (val === EMPTY_SENTINEL ? "" : val) as TValue;
}

export function AppSelect<TValue extends string = string>({
  id,
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  disabled,
  required,
  name,
  ariaLabel,
  ariaDescribedby,
  className = "",
  triggerClassName = "",
  contentClassName = "",
  invalid,
}: AppSelectProps<TValue>) {
  const internalValue = toInternalValue(value);
  const internalDefaultValue = toInternalValue(defaultValue);

  const handleValueChange = React.useCallback(
    (nextVal: string) => {
      onValueChange?.(fromInternalValue<TValue>(nextVal));
    },
    [onValueChange]
  );

  const selectedOption = options.find((opt) =>
    value !== undefined ? opt.value === value : opt.value === defaultValue
  );

  return (
    <div className={`relative w-full ${className}`}>
      <Select
        value={internalValue}
        defaultValue={internalDefaultValue}
        onValueChange={handleValueChange}
        disabled={disabled}
        required={required}
        name={name}
      >
        <SelectTrigger
          id={id}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedby}
          invalid={invalid}
          className={triggerClassName}
        >
          {selectedOption ? (
            <span className="block truncate text-foreground">
              {selectedOption.label}
            </span>
          ) : (
            <span className="block truncate text-muted-foreground/75">
              {placeholder ?? ""}
            </span>
          )}
        </SelectTrigger>
        <SelectContent className={contentClassName}>
          {options.map((option) => {
            const optVal = toInternalValue(option.value) ?? EMPTY_SENTINEL;
            return (
              <SelectItem
                key={option.value || "__empty__"}
                value={optVal}
                disabled={option.disabled}
              >
                <div className="flex flex-col text-start">
                  <span>{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AppSelectField<TValue extends string = string>({
  id,
  label,
  error,
  helperText,
  containerClassName = "space-y-1.5",
  labelClassName = "block text-xs font-semibold uppercase tracking-wider text-muted-foreground",
  hideLabel = false,
  required,
  ariaDescribedby,
  ...selectProps
}: AppSelectFieldProps<TValue>) {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  const describedBy = [
    error ? errorId : null,
    helperText ? helperId : null,
    ariaDescribedby ?? null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className={containerClassName}>
      <label
        htmlFor={id}
        className={hideLabel ? "sr-only" : labelClassName}
      >
        {label}
        {required && !hideLabel && (
          <span className="ms-1 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <AppSelect
        id={id}
        required={required}
        invalid={Boolean(error)}
        ariaDescribedby={describedBy}
        {...selectProps}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
