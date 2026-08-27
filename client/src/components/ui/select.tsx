import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    invalid?: boolean;
  }
>(function SelectTrigger({ className = "", children, invalid, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      aria-invalid={invalid ? "true" : props["aria-invalid"]}
      className={`group flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-white px-3 py-2 text-start text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/75 hover:border-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground data-[placeholder]:text-muted-foreground/75 aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-100 ${className}`}
      {...props}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <SelectPrimitive.Icon asChild>
        <span
          data-slot="select-chevron"
          className="pointer-events-none shrink-0 text-muted-foreground transition-transform duration-200 ease-in-out group-data-[state=open]:rotate-180"
        >
          <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectScrollUpButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(function SelectScrollUpButton({ className = "", ...props }, ref) {
  return (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={`flex cursor-default items-center justify-center py-1 text-muted-foreground ${className}`}
      {...props}
    >
      <ChevronUp className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </SelectPrimitive.ScrollUpButton>
  );
});

export const SelectScrollDownButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(function SelectScrollDownButton({ className = "", ...props }, ref) {
  return (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={`flex cursor-default items-center justify-center py-1 text-muted-foreground ${className}`}
      {...props}
    >
      <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </SelectPrimitive.ScrollDownButton>
  );
});

export const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className = "", children, position = "popper", sideOffset = 4, ...props }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={sideOffset}
        className={`relative z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-md border border-border bg-white text-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 ${
          position === "popper"
            ? "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1"
            : ""
        } ${className}`}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={`p-1.5 ${
            position === "popper"
              ? "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]"
              : ""
          }`}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(function SelectLabel({ className = "", ...props }, ref) {
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={`px-2 py-1.5 text-xs font-semibold text-muted-foreground ${className}`}
      {...props}
    />
  );
});

export const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className = "", children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pe-8 ps-2 text-start text-sm outline-none transition-colors hover:bg-muted focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[state=checked]:bg-primary/10 data-[state=checked]:font-medium data-[state=checked]:text-primary ${className}`}
      {...props}
    >
      <span className="absolute end-2 flex size-4 items-center justify-center text-primary">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});

export const SelectSeparator = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(function SelectSeparator({ className = "", ...props }, ref) {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={`-mx-1 my-1 h-px bg-border ${className}`}
      {...props}
    />
  );
});
