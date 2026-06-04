import PageHeader from "../components/PageHeader";
import { BigLink } from "../components/BigButton";

export default function HomePage() {
  return (
    <>
      <PageHeader title="Koryon" subtitle="Saha kayıt asistanı" />
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
        <BigLink
          to="/rooms/new"
          variant="primary"
          icon={<PlusIcon />}
          label="Yeni Oda Oluştur"
          hint="Pano odası, MCC, dağıtım panosu odası..."
        />
        <BigLink
          to="/rooms"
          variant="secondary"
          icon={<ListIcon />}
          label="Kayıtlı Odalar"
          hint="Daha önce oluşturduğun odalar"
        />
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
