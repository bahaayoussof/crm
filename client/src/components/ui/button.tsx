import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover active:scale-[0.98] focus-visible:ring-ring",
  primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover active:scale-[0.98] focus-visible:ring-ring",
  secondary: "border border-border bg-surface text-foreground shadow-xs hover:bg-surface-hover hover:border-border-strong active:scale-[0.98] focus-visible:ring-ring",
  outline: "border border-border bg-transparent text-foreground hover:bg-surface-hover hover:border-border-strong active:scale-[0.98] focus-visible:ring-ring",
  ghost: "bg-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground active:scale-[0.98] focus-visible:ring-ring",
  destructive: "border border-danger-soft bg-danger-soft/50 text-danger-foreground hover:bg-danger-soft hover:border-danger/30 active:scale-[0.98] focus-visible:ring-danger/30",
  link: "bg-transparent text-foreground underline-offset-4 hover:underline p-0 h-auto font-normal focus-visible:ring-ring",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-9 px-4 py-2 text-sm",
  sm: "h-8 px-3 text-xs rounded-md",
  lg: "h-11 px-6 text-base rounded-md",
  icon: "size-9 p-0 rounded-md",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all duration-150 select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <Loader2 className="size-4 animate-spin text-current" strokeWidth={2} aria-hidden="true" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
