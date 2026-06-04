import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import HomePage from "./pages/Home";
import NewRoomPage from "./pages/NewRoom";
import RoomListPage from "./pages/RoomList";
import RoomDetailPage from "./pages/RoomDetail";
import NewPanelPage from "./pages/NewPanel";
import PanelDetailPage from "./pages/PanelDetail";
import NewDrawingPage from "./pages/NewDrawing";

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/rooms" element={<RoomListPage />} />
            <Route path="/rooms/new" element={<NewRoomPage />} />
            <Route path="/rooms/:id" element={<RoomDetailPage />} />
            <Route path="/rooms/:id/panels/new" element={<NewPanelPage />} />
            <Route
              path="/rooms/:id/drawings/new"
              element={<NewDrawingPage />}
            />
            <Route path="/panels/:id" element={<PanelDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthGate>
    </AuthProvider>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, error, userId } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
          <p className="mt-3 text-sm text-zinc-500">Hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  if (error || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-zinc-900">
            Oturum başlatılamadı
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            {error ?? "Beklenmeyen bir hata oluştu."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-white active:bg-zinc-800"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="mt-2 text-zinc-500">Sayfa bulunamadı.</p>
      <a
        href="/"
        className="mt-4 rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-white"
      >
        Ana sayfaya dön
      </a>
    </div>
  );
}
