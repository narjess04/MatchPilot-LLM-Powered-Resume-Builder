import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { ToastProvider } from "./components/Toast";
import { GenerateView } from "./features/generate/GenerateView";
import { OfferView } from "./features/offer/OfferView";
import { ProfileView } from "./features/profile/ProfileView";
import { StartView } from "./features/profile/StartView";
import { TemplateView } from "./features/template/TemplateView";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Workspace from "./pages/Workspace";
import { AuthProvider } from "./state/auth";
import { useWorkspace } from "./state/workspace";

function ProfileRoute() {
  const { ws } = useWorkspace();
  return ws.profile ? <ProfileView /> : <StartView />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/app" element={<RequireAuth><Workspace /></RequireAuth>}>
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<ProfileRoute />} />
              <Route path="offer" element={<OfferView />} />
              <Route path="template" element={<TemplateView />} />
              <Route path="generate" element={<GenerateView />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
