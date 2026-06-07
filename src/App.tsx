import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ConfirmProvider } from "./components/ConfirmDialog";
import HomePage from "./pages/Home";
import UnitListPage from "./pages/UnitList";
import NewUnitPage from "./pages/NewUnit";
import UnitDetailPage from "./pages/UnitDetail";
import NewRoomPage from "./pages/NewRoom";
import RoomDetailPage from "./pages/RoomDetail";
import NewPanelPage from "./pages/NewPanel";
import PanelDetailPage from "./pages/PanelDetail";
import NewDrawingPage from "./pages/NewDrawing";
import TrashPage from "./pages/Trash";
import ReportsPage from "./pages/Reports";
import ReportDayPage from "./pages/ReportDay";

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />

            <Route path="/units" element={<UnitListPage />} />
            <Route path="/units/new" element={<NewUnitPage />} />
            <Route path="/units/:id" element={<UnitDetailPage />} />
            <Route path="/units/:id/rooms/new" element={<NewRoomPage />} />

            <Route path="/rooms/:id" element={<RoomDetailPage />} />
            <Route path="/rooms/:id/panels/new" element={<NewPanelPage />} />
            <Route
              path="/rooms/:id/drawings/new"
              element={<NewDrawingPage target="room" />}
            />

            <Route path="/panels/:id" element={<PanelDetailPage />} />
            <Route
              path="/panels/:id/drawings/new"
              element={<NewDrawingPage target="panel" />}
            />

            <Route path="/trash" element={<TrashPage />} />

            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/:date" element={<ReportDayPage />} />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </AuthProvider>
  );
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
