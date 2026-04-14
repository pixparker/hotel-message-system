import RPNInput, { type Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "../lib/cn.js";

export function PhoneInput({
  value,
  onChange,
  defaultCountry = "TR",
  placeholder = "Enter phone number",
  id,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  defaultCountry?: Country;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <RPNInput
      id={id}
      international
      defaultCountry={defaultCountry}
      value={value || undefined}
      onChange={(v) => onChange(v ?? "")}
      placeholder={placeholder}
      autoFocus={autoFocus}
      numberInputProps={{
        className:
          "flex-1 bg-transparent outline-none px-2 py-2 text-sm tabular-nums placeholder:text-slate-400",
      }}
      countrySelectProps={{
        className: "bg-transparent text-sm pr-1",
      }}
      className={cn(
        "flex items-center rounded-lg border border-slate-300 bg-white px-2 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200",
        className,
      )}
    />
  );
}
