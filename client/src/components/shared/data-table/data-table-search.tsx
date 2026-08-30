import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableSearchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  containerClassName?: string;
}

export const DataTableSearch = React.forwardRef<HTMLInputElement, DataTableSearchProps>(
  ({ value, onChange, placeholder, id = "table-search", ariaLabel, className, containerClassName, ...props }, ref) => {
    return (
      <div className={cn("relative w-72 sm:w-80 max-w-full shrink-0", containerClassName)}>
        <label htmlFor={id} className="block w-full">
          <span className="sr-only">{ariaLabel ?? placeholder ?? "Search"}</span>
          <div className="relative w-full">
            <Search
              className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70"
              strokeWidth={2}
              aria-hidden="true"
            />
            <input
              ref={ref}
              id={id}
              className={cn(
                "input h-8.5 w-full ps-8 text-xs rounded-lg bg-surface/50 border-input-border placeholder:text-muted-foreground/70",
                className
              )}
              type="search"
              dir="auto"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              {...props}
            />
          </div>
        </label>
      </div>
    );
  }
);
DataTableSearch.displayName = "DataTableSearch";
