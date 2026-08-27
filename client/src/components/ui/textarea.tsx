import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-xs transition-colors",
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
Textarea.displayName = "Textarea";
