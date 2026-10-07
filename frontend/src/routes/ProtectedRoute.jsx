// Gates the frontend route tree using AuthContext; backend endpoints still enforce JWT access.
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";

export default function ProtectedRoute() {
  const { isLoading, isAuthenticated } = useAuth();
  // Avoid redirecting while the initial stored-token check is still pending.
  if (isLoading)
    return (
      <div className="loading-screen" role="status">
        <div className="loading-spinner" />
        Restoring your session...
      </div>
    );
  // Render the nested layout/page only for an authenticated session.
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
