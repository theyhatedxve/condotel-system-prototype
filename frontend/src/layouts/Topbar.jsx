import { useState } from "react";
import { Bell, ChevronDown, KeyRound, LogOut, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";
import { apiError } from "../features/shared/useResource";
import { WorkflowDialog } from "../features/shared/WorkflowForm";
import apiClient from "../services/apiClient";

// The profile menu uses session state. Notifications are scoped to the signed-in account.
export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  function go(path) {
    setProfileOpen(false);
    navigate(path);
  }
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState(null);
  const [notificationError, setNotificationError] = useState("");
  async function showNotifications() {
    try {
      const { data } = await apiClient.get("/notifications");
      setNotifications(data);
      setNotificationError("");
    } catch (error) {
      setNotifications([]);
      setNotificationError(apiError(error));
    }
  }
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
            title="Notifications"
            aria-label="Notifications"
            onClick={showNotifications}
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
                <button type="button" onClick={() => go("/admin/profile")}>
                  My Profile
                </button>
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
      {notifications && (
        <WorkflowDialog
          title="Notifications"
          onClose={() => setNotifications(null)}
        >
          {notificationError && <p role="alert">{notificationError}</p>}
          {notifications.length === 0 && <p>No notifications yet.</p>}
          <ul className="notification-list">
            {notifications.map((item) => (
              <li key={item.id}>
                <span>{item.message}</span>
                {!item.isRead && (
                  <button
                    onClick={async () => {
                      try {
                        await apiClient.patch(
                          "/notifications/" + item.id + "/read",
                        );
                        await showNotifications();
                      } catch (error) {
                        setNotificationError(apiError(error));
                      }
                    }}
                  >
                    Mark as read
                  </button>
                )}
              </li>
            ))}
          </ul>
        </WorkflowDialog>
      )}
    </header>
  );
}
