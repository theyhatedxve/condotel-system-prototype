import { Navigate, Route, Routes } from "react-router-dom";
import ChangePasswordPage from "../features/auth/ChangePasswordPage";
import LoginPage from "../features/auth/LoginPage";
import DashboardPage from "../features/dashboard/DashboardPage";
import GuestsPage from "../features/guests/GuestsPage";
import RoomsPage from "../features/rooms/RoomsPage";
import ReservationsPage from "../features/reservations/ReservationsPage";
import PlaceholderPage from "../features/nfc/PlaceholderPage";
import AdminLayout from "../layouts/AdminLayout";
import ProtectedRoute from "./ProtectedRoute";
import RegisterPage from "../features/auth/RegisterPage";
import ProfilePage from "../features/users/ProfilePage";
import PaymentsPage from "../features/payments/PaymentsPage";

// Authentication guards the shared layout.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route
          path="/customer/home"
          element={<Navigate to="/admin/dashboard" replace />}
        />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="guests" element={<GuestsPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route
            path="transactions"
            element={<PlaceholderPage title="Transactions" />}
          />
          <Route path="reports" element={<PlaceholderPage title="Reports" />} />
          <Route
            path="settings"
            element={<PlaceholderPage title="Settings" />}
          />
          <Route path="users" element={<GuestsPage users />} />
          <Route
            path="nfc"
            element={<PlaceholderPage title="NFC Management" />}
          />
        </Route>
      </Route>
      <Route path="*" element={<PlaceholderPage title="Page not found" />} />
    </Routes>
  );
}
