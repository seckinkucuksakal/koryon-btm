export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16 sm:px-10">
      <section className="w-full max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200/60 bg-white/60 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Çalışıyor
        </span>

        <h1 className="mt-6 bg-gradient-to-br from-zinc-900 to-zinc-600 bg-clip-text text-4xl font-bold leading-tight tracking-tight text-transparent sm:text-5xl md:text-6xl dark:from-white dark:to-zinc-400">
          Hello, world.
        </h1>

        <p className="mx-auto mt-4 max-w-md text-base text-zinc-600 sm:text-lg dark:text-zinc-400">
          Koryon iskeleti hazır. Telefonda ve bilgisayarda akıcı çalışacak şekilde
          ayarlandı, Supabase bağlantısı için her şey kuruldu.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card title="Vite + React" subtitle="TypeScript" />
          <Card title="Tailwind" subtitle="Mobil öncelikli" />
          <Card title="Supabase" subtitle="Hazır" />
        </div>
      </section>
    </main>
  );
}

function Card({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-zinc-200/60 bg-white/60 p-4 text-left shadow-sm backdrop-blur transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </div>
      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</div>
    </div>
  );
}
