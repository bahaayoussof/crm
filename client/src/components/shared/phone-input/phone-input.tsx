import { forwardRef, useCallback } from "react";
import {
  PhoneInput as BasePhoneInput,
  type ParsedCountry,
} from "react-international-phone";
import "react-international-phone/style.css";
import { cn } from "@/lib/utils";
import type { PhoneInputProps } from "./phone-input.types";

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
    const isInvalid = Boolean(error || ariaInvalidProp);

    const handleChange = useCallback(
      (phone: string, meta: { country: ParsedCountry; inputValue: string }) => {
        onCountryChange?.(meta.country);
        if (!onChange) return;

        // If the user hasn't typed anything beyond the dial code (e.g. "+20" or "+"), emit empty string
        const dialCodeWithPlus = `+${meta.country.dialCode}`;
        const rawDigitsOnly = phone.replace(/\D/g, "");
        const dialCodeDigitsOnly = meta.country.dialCode.replace(/\D/g, "");

        if (!phone || phone === "+" || phone === dialCodeWithPlus || rawDigitsOnly === dialCodeDigitsOnly) {
          onChange("");
          return;
        }

        // Return the canonical phone string with + prefix and digits
        const canonicalPhone = phone.startsWith("+") ? phone.replace(/[^\d+]/g, "") : `+${phone.replace(/\D/g, "")}`;
        onChange(canonicalPhone);
      },
      [onChange, onCountryChange],
    );

    return (
      <div
        className={cn(
          "relative flex w-full items-center",
          disabled && "cursor-not-allowed opacity-75",
          containerClassName,
        )}
      >
        <BasePhoneInput
          defaultCountry={defaultCountry}
          preferredCountries={preferredCountries}
          value={value ?? ""}
          onChange={handleChange}
          disabled={disabled}
          inputRef={ref as React.MutableRefObject<HTMLInputElement | null>}
          className="w-full !flex"
          inputClassName={cn(
            "input !h-10 !min-h-10 !w-full !rounded-s-none !rounded-e-md !border !border-border !bg-surface !px-3 !py-2 !text-sm !text-foreground !outline-none transition-colors",
            "placeholder:!text-muted-foreground/70 hover:!border-border-strong focus:!border-ring focus:!ring-2 focus:!ring-ring/15",
            "disabled:!cursor-not-allowed disabled:!bg-muted disabled:!text-disabled-foreground",
            isInvalid && "!border-danger focus:!ring-danger/15",
            className,
          )}
          countrySelectorStyleProps={{
            buttonClassName: cn(
              "!h-10 !min-h-10 !px-2.5 !flex !items-center !justify-center !gap-1 !bg-surface !border !border-border !border-e-0 !rounded-s-md !rounded-e-none transition-colors hover:!bg-surface-hover",
              "focus-visible:!ring-2 focus-visible:!ring-ring focus-visible:!outline-none",
              "disabled:!cursor-not-allowed disabled:!bg-muted disabled:!opacity-60",
              isInvalid && "!border-danger",
            ),
            dropdownStyleProps: {
              className:
                "!z-50 !max-h-60 !w-72 !overflow-y-auto !rounded-lg !border !border-border !bg-card !p-1 !shadow-elevated !text-card-foreground",
              listItemClassName:
                "!flex !items-center !gap-2 !rounded-md !px-2.5 !py-1.5 !text-sm !cursor-pointer hover:!bg-surface-hover !text-foreground transition-colors",
              listItemSelectedClassName: "!bg-surface-selected !font-medium",
              listItemFocusedClassName: "!bg-surface-hover",
              listItemCountryNameClassName: "!truncate !text-foreground !text-sm !flex-1",
              listItemDialCodeClassName: "!text-xs !text-muted-foreground !font-mono",
            },
          }}
          inputProps={{
            id,
            name,
            placeholder,
            dir: "ltr",
            autoComplete: "tel",
            autoFocus,
            required,
            onBlur,
            onFocus,
            "aria-invalid": isInvalid,
            "aria-describedby": ariaDescribedBy,
            "aria-label": ariaLabel,
            "aria-labelledby": ariaLabelledBy,
            ...restProps,
          }}
        />
      </div>
    );
  },
);

PhoneInput.displayName = "PhoneInput";
