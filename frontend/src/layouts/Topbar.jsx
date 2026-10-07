// Displays the current user, account link and sign-out action in the shared shell.
import { LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";

export default function Topbar() {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <strong className="topbar-title">Condotel Security Prototype</strong>
      <div className="topbar-actions">
        <Link
          to="/dashboard#account"
          className="topbar-profile"
          title="Your account"
        >
          <div className="topbar-avatar">
            {user.firstName.charAt(0).toUpperCase()}
          </div>
          <span>{user.firstName}</span>
        </Link>
        <button
          type="button"
          className="topbar-icon-button"
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
