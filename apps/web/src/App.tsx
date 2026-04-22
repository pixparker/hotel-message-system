import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/auth.js";
import { AppShell } from "./components/AppShell.js";
import { DemoBanner } from "./components/DemoBanner.js";
import { BrandSync } from "./components/BrandSync.js";
import { LoginPage } from "./routes/login.js";
import { SignupPage } from "./routes/signup.js";
import { ForgotPassword } from "./routes/forgot-password.js";
import { ResetPassword } from "./routes/reset-password.js";
import { VerifyEmail } from "./routes/verify-email.js";
import { DashboardPage } from "./routes/dashboard.js";
import { ContactsPage } from "./routes/contacts.js";
import { AudiencesPage } from "./routes/audiences.js";
import { AudienceDetailPage } from "./routes/audience-detail.js";
import { SendWizardPage } from "./routes/send/index.js";
import { LivePage } from "./routes/live.js";
import { ReportsPage } from "./routes/reports.js";
import { CampaignDetailPage } from "./routes/campaign-detail.js";
import { SettingsPage } from "./routes/settings.js";
import { WhatsAppConnectPage } from "./routes/whatsapp-connect.js";
import { WhatsAppBaileysPage } from "./routes/whatsapp-baileys.js";
import { TemplatesPage } from "./routes/templates.js";
import { TemplateEditPage } from "./routes/template-edit.js";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth((s) => s.user);
  if (!auth) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <div className="flex flex-col h-full">
      <BrandSync />
      <DemoBanner />
      <div className="flex-1 min-h-0 flex flex-col">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            {/* Legacy redirect — /guests links, bookmarks, and old emails still land on the right page. */}
            <Route path="/guests" element={<Navigate to="/contacts" replace />} />
            <Route path="/audiences" element={<AudiencesPage />} />
            <Route path="/audiences/:id" element={<AudienceDetailPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/templates/:id" element={<TemplateEditPage />} />
            <Route path="/send/*" element={<SendWizardPage />} />
            <Route path="/campaigns/:id/live" element={<LivePage />} />
            <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/whatsapp" element={<WhatsAppConnectPage />} />
            <Route path="/settings/whatsapp-baileys" element={<WhatsAppBaileysPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
