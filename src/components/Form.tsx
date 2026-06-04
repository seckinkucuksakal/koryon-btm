import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  hint?: string;
  required?: boolean;
};

type InputProps = FieldProps & InputHTMLAttributes<HTMLInputElement>;
type TextProps = FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

const inputClass =
  "w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-4 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900";

export function TextField({ label, hint, required, className, ...rest }: InputProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      <input className={`${inputClass} ${className ?? ""}`} {...rest} />
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, hint, required, className, ...rest }: TextProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      <textarea
        className={`${inputClass} min-h-[120px] resize-y ${className ?? ""}`}
        {...rest}
      />
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

type SelectProps = FieldProps & {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  name?: string;
};

export function SelectField({
  label,
  hint,
  required,
  value,
  onChange,
  options,
  name,
}: SelectProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} appearance-none bg-[length:18px] bg-[right_1rem_center] bg-no-repeat pr-12`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>\")",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}
