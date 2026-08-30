import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCustomers } from "@/features/customers/customer-hooks";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { cn } from "@/lib/utils";

interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

interface CustomerComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  selectedCustomer?: CustomerSummary;
  invalid?: boolean;
  describedBy?: string;
}

export function CustomerCombobox({ id, value, onChange, selectedCustomer, invalid, describedBy }: CustomerComboboxProps) {
  const { t } = useTranslation();
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedCustomer?.name ?? "");
  const [selected, setSelected] = useState<CustomerSummary | undefined>(selectedCustomer);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebouncedValue(query);
  const customers = useCustomers({ search: debouncedQuery, page: 1, limit: 10 });
  const results = customers.data?.data ?? [];

  useEffect(() => {
    if (!selectedCustomer || open) return;
    setSelected(selectedCustomer);
    setQuery(selectedCustomer.name);
  }, [open, selectedCustomer]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery]);

  const chooseCustomer = (customer: CustomerSummary) => {
    setSelected(customer);
    setQuery(customer.name);
    onChange(customer.id);
    setOpen(false);
  };

  const handleInputChange = (nextQuery: string) => {
    setQuery(nextQuery);
    setOpen(true);
    if (value) {
      setSelected(undefined);
      onChange("");
    }
  };

  return (
    <div
      className="relative"
      ref={wrapperRef}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !wrapperRef.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <input
        id={id}
        className="input"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-activedescendant={open && results[activeIndex] ? `${listboxId}-${results[activeIndex].id}` : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        placeholder={t("tickets.customerComboboxPlaceholder")}
        value={query}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => handleInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            if (!results.length) return;
            const direction = event.key === "ArrowDown" ? 1 : -1;
            setActiveIndex((current) => current === -1 ? (direction === 1 ? 0 : results.length - 1) : (current + direction + results.length) % results.length);
            return;
          }
          if (event.key === "Enter" && open && results[activeIndex]) {
            event.preventDefault();
            chooseCustomer(results[activeIndex]);
          }
        }}
      />

      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-flyout">
          <div id={listboxId} className="max-h-60 overflow-y-auto p-1.5 space-y-0.5" role="listbox" aria-label={t("tickets.customerResults")}>
            {customers.isLoading ? (
              <p className="px-3 py-2.5 text-xs text-muted-foreground" role="status">
                {t("tickets.customerSearching")}
              </p>
            ) : customers.isError ? (
              <p className="px-3 py-2.5 text-xs text-destructive" role="status">
                {t("tickets.customerSearchError")}
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-muted-foreground" role="status">
                {t("tickets.noCustomerResults")}
              </p>
            ) : (
              results.map((customer, index) => (
                <button
                  id={`${listboxId}-${customer.id}`}
                  key={customer.id}
                  className={cn(
                    "block w-full rounded-md px-2.5 py-2 text-start text-xs transition-colors outline-none",
                    index === activeIndex || customer.id === value
                      ? "bg-muted text-foreground font-medium"
                      : "text-foreground hover:bg-muted/70 focus-visible:bg-muted/70"
                  )}
                  type="button"
                  role="option"
                  aria-selected={customer.id === value}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => chooseCustomer(customer)}
                >
                  <span className="block truncate text-xs font-medium text-foreground">{customer.name}</span>
                  <bdi className="mt-0.5 block truncate text-[11px] text-muted-foreground" dir="ltr">{customer.email}</bdi>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {selected && !open && (
        <p className="mt-1.5 truncate text-xs text-muted-foreground">
          <bdi dir="ltr">{selected.email}</bdi>
        </p>
      )}
    </div>
  );
}
