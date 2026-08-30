import type { InputHTMLAttributes, Ref } from "react";
import type { CountryIso2, ParsedCountry } from "react-international-phone";

export interface PhoneInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size"> {
  value?: string | null;
  onChange?: (value: string) => void;
  defaultCountry?: CountryIso2;
  preferredCountries?: CountryIso2[];
  error?: string | boolean;
  inputRef?: Ref<HTMLInputElement>;
  containerClassName?: string;
  onCountryChange?: (country: ParsedCountry) => void;
}
