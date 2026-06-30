import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: boolean;
  right?: ReactNode;
};

export default function PageHeader({ title, subtitle, back, right }: Props) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-start gap-2 px-4 py-3">
        {back && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Geri"
            className="-ml-2 flex h-12 w-12 items-center justify-center rounded-xl text-zinc-700 active:bg-zinc-100"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          {typeof title === "string" ? (
            <h1 className="break-words text-lg font-semibold leading-snug text-zinc-900">
              {title}
            </h1>
          ) : (
            <div className="min-w-0">{title}</div>
          )}
          {subtitle &&
            (typeof subtitle === "string" ? (
              <p className="break-words text-sm text-zinc-500">{subtitle}</p>
            ) : (
              <div className="text-sm text-zinc-500">{subtitle}</div>
            ))}
        </div>
        {right}
      </div>
    </header>
  );
}
