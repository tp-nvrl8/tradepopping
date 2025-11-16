import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import LabHome from "./pages/LabHome";
import { ConfigProvider } from "./config/ConfigContext";

import LabPage from "./pages/LabPage";
import CandidatesPage from "./pages/CandidatesPage";
import TestStandPage from "./pages/TestStandPage";
import DataHubPage from "./pages/DataHubPage";
import SettingsPage from "./pages/SettingsPage";
import AppShell from "./layout/AppShell";

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ConfigProvider>
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes with shared shell */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <LabHome />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/lab"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <LabPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/candidates"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <CandidatesPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/test-stand"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <TestStandPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/datahub"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <DataHubPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <SettingsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </AuthProvider>
  );
};

export default App;