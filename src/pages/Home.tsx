import PageHeader from "../components/PageHeader";
import { BigLink } from "../components/BigButton";

export default function HomePage() {
  return (
    <>
      <PageHeader title="Koryon" subtitle="Saha kayıt asistanı" />
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
        <BigLink
          to="/units/new"
          variant="primary"
          icon={<PlusIcon />}
          label="Yeni Ünite Oluştur"
          hint="Şartnamedeki üniteyi tanımla"
        />
        <BigLink
          to="/units"
          variant="secondary"
          icon={<ListIcon />}
          label="Kayıtlı Üniteler"
          hint="Daha önce oluşturduğun üniteler"
        />
      </div>

      <div className="mx-auto mt-2 max-w-2xl px-4">
        <p className="text-center text-xs text-zinc-400">
          Ünite → Oda → Pano → Ekipman
        </p>
      </div>
    </>
  );
}

function PlusIcon() {
  return (
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
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ListIcon() {
  return (
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
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
