import { useNavigate } from "react-router-dom";

type Props = {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, back, right }: Props) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
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
          <h1 className="truncate text-lg font-semibold text-zinc-900">{title}</h1>
          {subtitle && (
            <p className="truncate text-sm text-zinc-500">{subtitle}</p>
          )}
        </div>
        {right}
      </div>
    </header>
  );
}
