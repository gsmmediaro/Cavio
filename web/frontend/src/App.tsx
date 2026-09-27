import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AppProviders } from "./components/providers/app-providers";
import AuthGate from "./components/AuthGate";
import Layout from "./components/Layout";
import { SettingsModal } from "./components/settings/settings-modal";
import { SettingsModalProvider } from "./hooks/use-settings-modal";
import AnalyzeScan from "./pages/AnalyzeScan";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

export default function App() {
  return (
    <AppProviders>
      <AuthProvider>
        <SettingsModalProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/analyze" replace />} />
              <Route path="/analyze" element={<AnalyzeScan />} />
              <Route path="/history" element={<History />} />
              {/* /settings opens SettingsModal over analyze shell (Notra-style) */}
              <Route path="/settings" element={<Settings />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<Navigate to="/analyze" replace />} />
            </Routes>
          </Layout>
          <SettingsModal />
          <AuthGate />
        </SettingsModalProvider>
      </AuthProvider>
    </AppProviders>
  );
}
