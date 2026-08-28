import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  selectTriggerClassName,
} from "./select";
import { useAnchoredPopover } from "@/components/shared/use-anchored-popover";

export type AppSelectOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  disabled?: boolean;
  description?: string;
  /**
   * Extra text the searchable variant matches against, in addition to `label`.
   * Domain-specific data (e.g. an assignee's email) is supplied here by the
   * consumer so `AppSelect` stays generic.
   */
  searchText?: string;
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
  /** Opt in to the searchable combobox surface. Off = unchanged Radix select. */
  searchable?: boolean;
  /** Placeholder for the in-dropdown search field. */
  searchPlaceholder?: string;
  /** Message shown when no option matches the current query. */
  emptySearchMessage?: string;
  /**
   * Overrides the text a given option is matched against. Defaults to
   * `label` (plus `searchText` when present).
   */
  getSearchText?: (option: AppSelectOption<TValue>) => string;
  /**
   * Controlled search value. Omit for the built-in uncontrolled behavior.
   * Present so a future async autocomplete can drive the query from outside.
   */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Shows a loading row instead of the empty state (future async search). */
  loading?: boolean;
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

function normalizeSearch(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function defaultSearchText<TValue extends string>(option: AppSelectOption<TValue>): string {
  return option.searchText ? `${option.label} ${option.searchText}` : option.label;
}

export function AppSelect<TValue extends string = string>(props: AppSelectProps<TValue>) {
  if (props.searchable) {
    return <SearchableSelect {...props} />;
  }
  return <RadixSelect {...props} />;
}

function RadixSelect<TValue extends string = string>({
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

function SearchableSelect<TValue extends string = string>({
  id,
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  disabled,
  required,
  ariaLabel,
  ariaDescribedby,
  className = "",
  triggerClassName = "",
  contentClassName = "",
  invalid,
  searchPlaceholder,
  emptySearchMessage,
  getSearchText,
  searchValue,
  onSearchChange,
  loading,
}: AppSelectProps<TValue>) {
  const { t } = useTranslation();

  const reactId = React.useId();
  const listboxId = `${id ?? reactId}-listbox`;

  const [open, setOpen] = React.useState(false);
  const [uncontrolledQuery, setUncontrolledQuery] = React.useState("");
  const [uncontrolledValue, setUncontrolledValue] = React.useState<TValue | undefined>(defaultValue);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [triggerWidth, setTriggerWidth] = React.useState(320);

  const query = searchValue ?? uncontrolledQuery;
  const setQuery = React.useCallback(
    (next: string) => {
      if (onSearchChange) onSearchChange(next);
      else setUncontrolledQuery(next);
    },
    [onSearchChange]
  );

  const currentValue = value !== undefined ? value : uncontrolledValue;
  const selectedOption = options.find((opt) => opt.value === currentValue);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const optionRefs = React.useRef<Array<HTMLLIElement | null>>([]);

  const { triggerRef, panelRef, position, style } = useAnchoredPopover<HTMLButtonElement, HTMLDivElement>({
    open,
    onDismiss: (reason) => {
      setOpen(false);
      if (reason === "escape") triggerRef.current?.focus();
    },
    align: "start",
    width: triggerWidth,
    minWidth: Math.min(triggerWidth, 220),
    maxWidth: Math.max(triggerWidth, 220),
    gap: 4,
    maxHeight: 320,
    minHeight: 120,
  });

  const normalizedQuery = React.useMemo(() => normalizeSearch(query), [query]);

  const filteredOptions = React.useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((opt) => {
      const haystack = getSearchText ? getSearchText(opt) : defaultSearchText(opt);
      return normalizeSearch(haystack).includes(normalizedQuery);
    });
  }, [options, normalizedQuery, getSearchText]);

  const firstEnabledIndex = React.useCallback(
    (from: number, dir: 1 | -1) => {
      if (filteredOptions.length === 0) return -1;
      let i = from;
      for (let step = 0; step < filteredOptions.length; step += 1) {
        if (i < 0) i = filteredOptions.length - 1;
        if (i >= filteredOptions.length) i = 0;
        if (!filteredOptions[i]?.disabled) return i;
        i += dir;
      }
      return -1;
    },
    [filteredOptions]
  );

  // Reset transient state whenever the dropdown closes.
  React.useEffect(() => {
    if (open) return;
    if (searchValue === undefined) setUncontrolledQuery("");
    else if (searchValue !== "") onSearchChange?.("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // On open: focus the search field and highlight the selected option.
  React.useEffect(() => {
    if (!open) return;
    setTriggerWidth(triggerRef.current?.offsetWidth || 320);
    const selectedIdx = filteredOptions.findIndex((opt) => opt.value === currentValue);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : firstEnabledIndex(0, 1));
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlight valid as the filtered list shrinks/grows while typing.
  React.useEffect(() => {
    if (!open) return;
    setActiveIndex((prev) => {
      if (prev >= 0 && prev < filteredOptions.length && !filteredOptions[prev]?.disabled) return prev;
      return firstEnabledIndex(0, 1);
    });
  }, [open, filteredOptions, firstEnabledIndex]);

  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex]);

  const commitValue = React.useCallback(
    (next: TValue) => {
      if (value === undefined) setUncontrolledValue(next);
      onValueChange?.(next);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [value, onValueChange, triggerRef]
  );

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((prev) => firstEnabledIndex(prev + 1, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((prev) => firstEnabledIndex(prev - 1, -1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(firstEnabledIndex(0, 1));
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(firstEnabledIndex(filteredOptions.length - 1, -1));
        break;
      case "Enter": {
        event.preventDefault();
        const option = filteredOptions[activeIndex];
        if (option && !option.disabled) commitValue(option.value);
        break;
      }
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const showEmpty = !loading && filteredOptions.length === 0;
  const emptyText = emptySearchMessage ?? t("common.noResults");
  const searchLabel = searchPlaceholder ?? t("common.search");

  return (
    <div className={`relative w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-invalid={invalid ? "true" : undefined}
        aria-required={required ? "true" : undefined}
        disabled={disabled}
        data-state={open ? "open" : "closed"}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        className={`${selectTriggerClassName} ${triggerClassName}`}
      >
        <span
          className={`min-w-0 flex-1 truncate text-start ${
            selectedOption ? "text-foreground" : "text-muted-foreground/75"
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder ?? ""}
        </span>
        <span
          data-slot="select-chevron"
          className="pointer-events-none shrink-0 text-muted-foreground transition-transform duration-200 ease-in-out group-data-[state=open]:rotate-180"
        >
          <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            data-app-select-search
            style={style}
            className={`fixed z-[60] flex flex-col overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-flyout ${contentClassName}`}
          >
            <div className="shrink-0 border-b border-border p-1.5">
              <div className="relative flex items-center">
                <Search
                  className="pointer-events-none absolute start-2.5 size-4 text-muted-foreground/70"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={searchLabel}
                  aria-label={searchLabel}
                  aria-controls={listboxId}
                  aria-activedescendant={
                    activeIndex >= 0 && filteredOptions[activeIndex]
                      ? `${listboxId}-opt-${activeIndex}`
                      : undefined
                  }
                  autoComplete="off"
                  className="h-9 w-full rounded-md border-0 bg-transparent ps-8 pe-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            <ul
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              className="min-h-0 flex-1 overflow-y-auto p-1.5"
            >
              {loading && (
                <li className="px-2 py-2 text-sm text-muted-foreground" role="presentation">
                  {t("common.loading")}
                </li>
              )}

              {showEmpty && (
                <li className="px-2 py-6 text-center text-sm text-muted-foreground" role="presentation">
                  {emptyText}
                </li>
              )}

              {!loading &&
                filteredOptions.map((option, index) => {
                  const isSelected = option.value === currentValue;
                  const isActive = index === activeIndex;
                  return (
                    <li
                      key={option.value || "__empty__"}
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      id={`${listboxId}-opt-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled || undefined}
                      data-state={isSelected ? "checked" : "unchecked"}
                      data-active={isActive || undefined}
                      onClick={() => !option.disabled && commitValue(option.value)}
                      onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                      className={`relative flex cursor-pointer select-none items-center rounded-sm py-2 pe-8 ps-2 text-start text-sm outline-none transition-colors data-[active]:bg-surface-hover aria-disabled:pointer-events-none aria-disabled:opacity-45 aria-selected:bg-surface-active aria-selected:font-medium aria-selected:text-foreground`}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{option.label}</span>
                        {option.description && (
                          <span className="truncate text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <span className="absolute end-2 flex size-4 items-center justify-center text-foreground">
                          <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />
                        </span>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>,
          document.body
        )}
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
          <span className="ms-1 text-danger" aria-hidden="true">
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
        <p id={errorId} role="alert" className="text-xs font-medium text-danger-foreground">
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
