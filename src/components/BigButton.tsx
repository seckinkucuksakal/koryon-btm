import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary";

type CommonProps = {
  icon?: ReactNode;
  label: string;
  hint?: string;
  variant?: Variant;
};

const base =
  "flex w-full items-center gap-4 rounded-2xl px-5 py-5 text-left text-base font-semibold shadow-sm transition active:scale-[0.99] active:shadow-none";

const variants: Record<Variant, string> = {
  primary: "bg-zinc-900 text-white active:bg-zinc-800",
  secondary:
    "border-2 border-zinc-200 bg-white text-zinc-900 active:border-zinc-300 active:bg-zinc-50",
};

export function BigLink({
  to,
  icon,
  label,
  hint,
  variant = "secondary",
}: CommonProps & { to: string }) {
  return (
    <Link to={to} className={`${base} ${variants[variant]}`}>
      <Inner icon={icon} label={label} hint={hint} variant={variant} />
    </Link>
  );
}

export function BigButton({
  onClick,
  type = "button",
  disabled,
  icon,
  label,
  hint,
  variant = "primary",
}: CommonProps & {
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <Inner icon={icon} label={label} hint={hint} variant={variant} />
    </button>
  );
}

function Inner({
  icon,
  label,
  hint,
  variant,
}: CommonProps & { variant: Variant }) {
  return (
    <>
      {icon && (
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            variant === "primary" ? "bg-white/10" : "bg-zinc-100"
          }`}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {hint && (
          <span
            className={`mt-0.5 block text-sm font-normal ${
              variant === "primary" ? "text-zinc-300" : "text-zinc-500"
            }`}
          >
            {hint}
          </span>
        )}
      </span>
      <svg
        className={variant === "primary" ? "text-zinc-400" : "text-zinc-400"}
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </>
  );
}
