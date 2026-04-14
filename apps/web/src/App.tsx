import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/auth.js";
import { AppShell } from "./components/AppShell.js";
import { DemoBanner } from "./components/DemoBanner.js";
import { LoginPage } from "./routes/login.js";
import { DashboardPage } from "./routes/dashboard.js";
import { GuestsPage } from "./routes/guests.js";
import { SendWizardPage } from "./routes/send/index.js";
import { LivePage } from "./routes/live.js";
import { ReportsPage } from "./routes/reports.js";
import { CampaignDetailPage } from "./routes/campaign-detail.js";
import { SettingsPage } from "./routes/settings.js";
import { TemplatesPage } from "./routes/templates.js";
import { TemplateEditPage } from "./routes/template-edit.js";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth((s) => s.user);
  if (!auth) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <div className="flex flex-col min-h-full">
      <DemoBanner />
      <div className="flex-1">
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/guests" element={<GuestsPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/templates/:id" element={<TemplateEditPage />} />
        <Route path="/send/*" element={<SendWizardPage />} />
        <Route path="/campaigns/:id/live" element={<LivePage />} />
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
      </div>
    </div>
  );
}
