import {
  Building2,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";

export default function Sidebar() {
  const { user, logout } = useAuth();
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Building2 size={32} />
        <div>
          <strong>CONDOTEL</strong>
          <span>NFC SYSTEM WITH PAYMENT</span>
        </div>
      </div>
      <div className="sidebar-user">
        <div className="sidebar-avatar">
          {user.firstName.charAt(0).toUpperCase()}
        </div>
        <div>
          <strong>{user.firstName}</strong>
          <span>{user.role}</span>
        </div>
      </div>
      <nav className="sidebar-navigation" aria-label="Main navigation">
        <NavLink
          to="/dashboard"
          title="Dashboard"
          className={({ isActive }) =>
            isActive ? "sidebar-link active" : "sidebar-link"
          }
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>
        <Link
          to="/dashboard#security"
          title="Security Demo"
          className="sidebar-link"
        >
          <ShieldCheck size={18} />
          <span>Security Demo</span>
        </Link>
        <Link to="/dashboard#account" title="Account" className="sidebar-link">
          <UserRound size={18} />
          <span>Account</span>
        </Link>
      </nav>
      <button
        type="button"
        className="sidebar-logout"
        onClick={logout}
        title="Sign out"
      >
        <LogOut size={18} />
        <span>Sign Out</span>
      </button>
    </aside>
  );
}
