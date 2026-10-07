import { useState } from "react";
import { Bell, ChevronDown, KeyRound, LogOut, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";

// The profile menu uses session state; search and notifications are visual controls only.
export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  function go(path) {
    setProfileOpen(false);
    navigate(path);
  }
  const [profileOpen, setProfileOpen] = useState(false);
  return (
    <header className="topbar">
      <div className="topbar-search">
        <Search size={18} />
        <input
          placeholder="Search..."
          aria-label="Search (display only)"
          disabled
        />
      </div>
      <div className="topbar-actions">
        <div className="topbar-notifications">
          <button
            className="topbar-icon-button"
            type="button"
            title="Notifications (display only)"
            aria-label="Notifications (display only)"
            disabled
          >
            <Bell size={20} />
          </button>
        </div>
        <div
          className="topbar-profile-menu"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setProfileOpen(false);
          }}
        >
          <button
            type="button"
            className="topbar-profile"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen(!profileOpen)}
          >
            <div className="topbar-avatar">
              {user.firstName.charAt(0).toUpperCase()}
            </div>
            <span>{user.firstName}</span>
            <ChevronDown size={15} />
          </button>
          {profileOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-user">
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                <span>{user.email}</span>
                <small>{user.role}</small>
              </div>
              <div className="profile-dropdown-actions">
                <button type="button" onClick={() => go("/change-password")}>
                  <KeyRound size={16} />
                  Change Password
                </button>
                <button
                  type="button"
                  className="profile-dropdown-signout"
                  onClick={logout}
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
