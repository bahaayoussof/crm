import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm text-foreground shadow-xs transition-colors",
          "placeholder:text-muted-foreground/60",
          "hover:border-border-strong",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
          "aria-invalid:border-danger aria-invalid:ring-danger/15",
          error && "border-danger ring-2 ring-danger/15",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export interface SearchInputProps extends InputProps {
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onClear, value, ...props }, ref) => {
    const hasValue = value !== undefined && value !== "";
    return (
      <div className="relative flex w-full items-center">
        <Search
          className="pointer-events-none absolute start-3 size-4 text-muted-foreground/70"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <Input
          ref={ref}
          type="search"
          value={value}
          className={cn("ps-9", hasValue && onClear && "pe-8", className)}
          {...props}
        />
        {hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute end-2 inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground focus:outline-none"
            aria-label="Clear search"
          >
            <X className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";
