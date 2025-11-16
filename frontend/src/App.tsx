import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import LabHome from "./pages/LabHome";
import { ConfigProvider } from "./config/ConfigContext";

// New pages
import LabPage from "./pages/LabPage";
import CandidatesPage from "./pages/CandidatesPage";
import TestStandPage from "./pages/TestStandPage";
import DataHubPage from "./pages/DataHubPage";
import SettingsPage from "./pages/SettingsPage";

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ConfigProvider>
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <LabHome />
                </ProtectedRoute>
              }
            />

            <Route
              path="/lab"
              element={
                <ProtectedRoute>
                  <LabPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/candidates"
              element={
                <ProtectedRoute>
                  <CandidatesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/test-stand"
              element={
                <ProtectedRoute>
                  <TestStandPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/datahub"
              element={
                <ProtectedRoute>
                  <DataHubPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
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