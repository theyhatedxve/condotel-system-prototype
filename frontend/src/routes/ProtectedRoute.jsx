import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";

export default function ProtectedRoute() {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading)
    return (
      <div className="loading-screen" role="status">
        <div className="loading-spinner" />
        Restoring your session...
      </div>
    );
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
