import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  defaultCountries,
  FlagImage,
  parseCountry,
  usePhoneInput,
  type ParsedCountry,
} from "react-international-phone";
import "react-international-phone/style.css";
import { ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { PhoneInputProps } from "./phone-input.types";

/**
 * Order the full country list so preferred countries float to the top,
 * mirroring react-international-phone's own dropdown ordering.
 */
function useOrderedCountries(preferred: string[] | undefined) {
  return useMemo(() => {
    const all = defaultCountries.map(parseCountry);
    if (!preferred || preferred.length === 0) return all;
    const rest = [...all];
    const head: ParsedCountry[] = [];
    for (const iso2 of preferred) {
      const idx = rest.findIndex((c) => c.iso2 === iso2);
      if (idx !== -1) head.push(rest.splice(idx, 1)[0]);
    }
    return [...head, ...rest];
  }, [preferred]);
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(
    {
      value,
      onChange,
      defaultCountry = "eg",
      preferredCountries = ["eg", "sa", "ae", "us", "gb"],
      disabled = false,
      error,
      id,
      name,
      placeholder,
      className,
      containerClassName,
      onCountryChange,
      onBlur,
      onFocus,
      autoFocus,
      required,
      "aria-invalid": ariaInvalidProp,
      "aria-describedby": ariaDescribedBy,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      ...restProps
    },
    ref,
  ) {
    const { t } = useTranslation();
    const isInvalid = Boolean(error || ariaInvalidProp);

    const handleChange = useCallback(
      ({ phone, country }: { phone: string; inputValue: string; country: ParsedCountry }) => {
        onCountryChange?.(country);
        if (!onChange) return;

        // If the user hasn't typed anything beyond the dial code (e.g. "+20" or "+"), emit empty string
        const dialCodeWithPlus = `+${country.dialCode}`;
        const rawDigitsOnly = phone.replace(/\D/g, "");
        const dialCodeDigitsOnly = country.dialCode.replace(/\D/g, "");

        if (!phone || phone === "+" || phone === dialCodeWithPlus || rawDigitsOnly === dialCodeDigitsOnly) {
          onChange("");
          return;
        }

        // Return the canonical phone string with + prefix and digits
        const canonicalPhone = phone.startsWith("+")
          ? phone.replace(/[^\d+]/g, "")
          : `+${phone.replace(/\D/g, "")}`;
        onChange(canonicalPhone);
      },
      [onChange, onCountryChange],
    );

    const localRef = useRef<HTMLInputElement | null>(null);
    const { inputValue, country, setCountry, handlePhoneValueChange } = usePhoneInput({
      defaultCountry,
      value: value ?? "",
      countries: defaultCountries,
      preferredCountries,
      onChange: handleChange,
      inputRef: localRef,
    });
    useImperativeHandle(ref, () => localRef.current as HTMLInputElement, []);

    // ---- Searchable country dropdown -------------------------------------------------
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);

    const orderedCountries = useOrderedCountries(preferredCountries);

    // Normalize so "+20", "20", "Egypt", "egypt", "EGYPT" all resolve.
    const normalizedQuery = query.trim().toLowerCase().replace(/^\+/, "");
    const filteredCountries = useMemo(() => {
      if (!normalizedQuery) return orderedCountries;
      return orderedCountries.filter(
        (c) =>
          c.name.toLowerCase().includes(normalizedQuery) ||
          c.dialCode.includes(normalizedQuery),
      );
    }, [orderedCountries, normalizedQuery]);

    // Reset transient state whenever the dropdown opens.
    useEffect(() => {
      if (!open) return;
      setQuery("");
      setActiveIndex(0);
      const raf = requestAnimationFrame(() => searchRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }, [open]);

    // Keep the highlight in range as the filtered list changes.
    useEffect(() => {
      setActiveIndex(0);
    }, [normalizedQuery]);

    // Dismiss on outside click.
    useEffect(() => {
      if (!open) return;
      const onDocMouseDown = (e: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener("mousedown", onDocMouseDown);
      return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, [open]);

    // Scroll the highlighted option into view during keyboard navigation.
    useEffect(() => {
      if (!open) return;
      const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, open]);

    const selectCountry = useCallback(
      (iso2: string) => {
        setCountry(iso2, { focusOnInput: true });
        setOpen(false);
        setQuery("");
      },
      [setCountry],
    );

    const onSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filteredCountries.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const c = filteredCountries[activeIndex];
        if (c) selectCountry(c.iso2);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    return (
      <div
        ref={rootRef}
        dir="ltr"
        className={cn(
          "relative flex w-full flex-row items-center",
          disabled && "cursor-not-allowed opacity-75",
          containerClassName,
        )}
      >
        <button
          ref={buttonRef}
          type="button"
          role="combobox"
          aria-label="Country selector"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            "flex h-10 min-h-10 items-center justify-center gap-1 rounded-s-md border border-e-0 border-border bg-surface px-2.5 transition-colors",
            "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
            isInvalid && "border-danger",
          )}
        >
          <FlagImage iso2={country.iso2} className="h-4 w-[1.35rem] shrink-0 rounded-[2px]" />
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>

        <input
          ref={localRef}
          id={id}
          name={name}
          value={inputValue}
          onChange={handlePhoneValueChange}
          type="tel"
          dir="ltr"
          autoComplete="tel"
          autoFocus={autoFocus}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          onBlur={onBlur}
          onFocus={onFocus}
          aria-invalid={isInvalid}
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            "input h-10 min-h-10 rounded-s-none rounded-e-md",
            isInvalid && "border-danger focus:ring-danger/15",
            className,
          )}
          {...restProps}
        />

        {open && (
          <div
            className="absolute start-0 top-full z-50 mt-1 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-elevated"
          >
            <div className="sticky top-0 z-10 border-b border-border bg-card p-1.5">
              <div className="relative w-full">
                <Search
                  className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <input
                  ref={searchRef}
                  type="search"
                  role="searchbox"
                  dir="auto"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder={t("phoneInput.searchPlaceholder")}
                  aria-label={t("phoneInput.searchPlaceholder")}
                  className="input h-8 min-h-8 w-full rounded-md ps-8 pe-2 text-xs"
                />
              </div>
            </div>

            <ul ref={listRef} role="listbox" aria-label="Country selector" className="max-h-56 overflow-y-auto p-1">
              {filteredCountries.length === 0 ? (
                <li
                  role="status"
                  className="px-2.5 py-6 text-center text-sm text-muted-foreground"
                >
                  {t("phoneInput.noResults")}
                </li>
              ) : (
                filteredCountries.map((c, idx) => {
                  const selected = c.iso2 === country.iso2;
                  return (
                    <li
                      key={c.iso2}
                      data-index={idx}
                      data-country={c.iso2}
                      role="option"
                      aria-selected={selected}
                      onClick={() => selectCountry(c.iso2)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground transition-colors",
                        idx === activeIndex && "bg-surface-hover",
                        selected && "bg-surface-selected font-medium",
                      )}
                    >
                      <FlagImage iso2={c.iso2} className="h-4 w-[1.35rem] shrink-0 rounded-[2px]" />
                      <span className="flex-1 truncate">{c.name}</span>
                      <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                        +{c.dialCode}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    );
  },
);

PhoneInput.displayName = "PhoneInput";
