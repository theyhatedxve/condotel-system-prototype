import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import { changeMyPassword } from "./authApi";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  async function handleSubmit(event) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      window.alert("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      window.alert("New password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      await refreshUser();
      window.alert("Password changed successfully.");
      navigate("/admin/dashboard", { replace: true });
    } catch (error) {
      const message =
        error.response?.data?.message || "Unable to change password.";
      window.alert(Array.isArray(message) ? message.join(" ") : message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="change-password-page">
      <form className="change-password-card" onSubmit={handleSubmit}>
        <div className="change-password-icon">
          <KeyRound size={28} />
        </div>
        <h1>Change Password</h1>
        <p>
          {user?.mustChangePassword
            ? "You must choose a new password before continuing."
            : "Update your account password."}
        </p>
        <label>
          Current Password
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </label>
        <label>
          New Password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          Confirm New Password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? "Changing..." : "Change Password"}
        </button>
      </form>
    </main>
  );
}
