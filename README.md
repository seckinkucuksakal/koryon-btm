# Koryon

Telefon ve bilgisayarda akıcı çalışan modern bir web uygulaması.

**Stack:** Vite · React 19 · TypeScript · Tailwind CSS · Supabase · Railway

---

## Hızlı Başlangıç

### 1. Bağımlılıkları kur

```bash
npm install
```

### 2. Ortam değişkenlerini ayarla

```powershell
# Windows (PowerShell)
Copy-Item .env.example .env.local
```

```bash
# macOS / Linux
cp .env.example .env.local
```

`.env.local` dosyasındaki değerleri Supabase projenden al
(Project Settings → API → Project URL ve anon / publishable key).

> Vite'ta tarayıcıya gönderilecek değişkenlerin `VITE_` ön ekiyle başlaması
> ZORUNDA. Bu nedenle `.env.example` zaten `VITE_SUPABASE_URL` ve
> `VITE_SUPABASE_ANON_KEY` kullanıyor.

### 3. Geliştirme sunucusunu çalıştır

```bash
npm run dev
```

Tarayıcıda [http://localhost:5173](http://localhost:5173) adresini aç.
Vite, aynı ağdaki telefondan da erişebilmen için LAN URL'i de yazar.

### 4. Production build (lokal)

```bash
npm run build       # dist/ klasörü üretir
npm run preview     # dist/'i lokalde sunar (varsayılan: 4173)
```

---

## Komutlar

| Komut              | Açıklama                                                |
| ------------------ | ------------------------------------------------------- |
| `npm run dev`      | Vite dev server (HMR, mobil için LAN host açık)         |
| `npm run build`    | TypeScript denetim + production build → `dist/`         |
| `npm run preview`  | Production build'i lokalde test eder                    |
| `npm run start`    | Railway'in çağırdığı komut — preview'u `$PORT` ile açar |
| `npm run typecheck`| Sadece TypeScript tip denetimi                          |
| `npm run lint`     | ESLint denetimi (henüz config yok, eklenince çalışır)   |

---

## Proje Yapısı

```
.
├── public/                 # Statik dosyalar (favicon, vs.)
├── src/
│   ├── lib/
│   │   └── supabase.ts     # Supabase istemcisi (browser)
│   ├── App.tsx             # Hello World ana bileşen
│   ├── index.css           # Tailwind & global stiller
│   ├── main.tsx            # React giriş noktası
│   └── vite-env.d.ts       # ImportMetaEnv tip tanımları
├── .env.example            # Ortam değişkeni şablonu
├── .gitignore
├── index.html              # Vite giriş HTML'i
├── nixpacks.toml           # Railway Node 22 build config
├── railway.json            # Railway deploy ayarları
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json           # Project references kökü
├── tsconfig.app.json       # src/* için
├── tsconfig.node.json      # vite.config.ts için
├── vite.config.ts
└── package.json
```

---

## Railway Deploy

1. Railway projesine bu repoyu bağla.
2. **Variables** sekmesine `.env.example`'daki tüm `VITE_*` değişkenlerini ekle.
3. Railway otomatik olarak `nixpacks.toml` ile Node 22 ortamı kurar,
   `npm ci && npm run build` çalıştırır ve `npm run start` ile servis eder.
4. `npm run start` arkada `vite preview --host --port $PORT` çağırır;
   Railway'in atadığı `PORT`'u kullanır, ekstra ayar gerekmez.
5. Public URL Railway tarafından otomatik atanır. Custom domain için
   **Settings → Networking → Custom Domain**.

> İleride statik hosting tarafında daha agresif optimizasyon istersen
> `serve -s dist -l $PORT` veya bir Caddy/Nginx konteynerine geçebilirsin;
> şimdilik `vite preview` Railway için yeterli.

---

## Supabase Notları

- Sadece `anon` / `publishable` anahtarı `VITE_` ön ekiyle bundle'a girer.
  `service_role` anahtarını **asla** frontend'e koyma.
- Tüm tablolarda **RLS** açık tut, politikaları gerçek erişim modeline göre yaz.
- Supabase istemcisi `src/lib/supabase.ts` dosyasında. Kullanım:

```ts
import { supabase } from "@/lib/supabase";

const { data, error } = await supabase.from("table_name").select("*");
```
