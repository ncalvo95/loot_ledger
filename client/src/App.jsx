import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import UpdateBanner from "./components/UpdateBanner.jsx";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import InvitePage from "./pages/InvitePage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ProjectPage from "./pages/ProjectPage.jsx";
import QuestsPage from "./pages/QuestsPage.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<InvitePage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/invite" element={<InvitePage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute>
              <ProjectPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quests"
          element={
            <ProtectedRoute>
              <QuestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPanel />
            </AdminRoute>
          }
        />
      </Routes>
      <UpdateBanner />
    </>
  );
}
