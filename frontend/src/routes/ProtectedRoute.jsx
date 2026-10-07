import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";

// Restore the session before rendering protected pages.
export default function ProtectedRoute() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();
  if (isLoading)
    return (
      <div className="loading-screen" role="status">
        <div className="loading-spinner" />
        Restoring your session...
      </div>
    );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && location.pathname !== "/change-password")
    return <Navigate to="/change-password" replace />;
  return <Outlet />;
}
