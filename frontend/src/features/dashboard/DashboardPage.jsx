import { useEffect, useState } from "react";
import { Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { changeMyPassword } from "../auth/authApi";
import apiClient from "../../services/apiClient";
import "./dashboard.css";

const cards = [
  {
    title: "Encryption",
    value: "AES-256-GCM",
    detail: "Authenticated encryption",
    color: "blue",
    icon: LockKeyhole,
  },
  {
    title: "Password Hashing",
    value: "Argon2id",
    detail: "One-way password protection",
    color: "green",
    icon: Fingerprint,
  },
  {
    title: "Authentication",
    value: "JWT",
    detail: "Signed in to a protected session",
    color: "orange",
    icon: KeyRound,
  },
  {
    title: "Condotel",
    value: "Security Demo",
    detail: "Authentication and encryption prototype",
    color: "purple",
    icon: ShieldCheck,
  },
];

function errorMessage(error) {
  const message =
    error.response?.data?.message ||
    "Unable to reach the server. Please try again.";
  return Array.isArray(message) ? message.join(" ") : message;
}

export default function DashboardPage() {
  const { user, refreshUser, logout } = useAuth();
  const { hash } = useLocation();
  const [text, setText] = useState("Welcome to Condotel.");
  const [encrypted, setEncrypted] = useState(null);
  const [decrypted, setDecrypted] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    if (hash)
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  async function encrypt(event) {
    event.preventDefault();
    setBusy("encrypt");
    setError("");
    setEncrypted(null);
    setDecrypted(null);
    try {
      const response = await apiClient.post("/security/encrypt-demo", { text });
      setEncrypted(response.data);
    } catch (requestError) {
      if (requestError.response?.status === 401) logout();
      else setError(errorMessage(requestError));
    } finally {
      setBusy("");
    }
  }

  async function decrypt() {
    setBusy("decrypt");
    setError("");
    setDecrypted(null);
    try {
      const response = await apiClient.post(
        "/security/decrypt-demo",
        encrypted,
      );
      setDecrypted(response.data.text);
    } catch (requestError) {
      if (requestError.response?.status === 401) logout();
      else setError(errorMessage(requestError));
    } finally {
      setBusy("");
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordError("");
    setPasswordMessage("");
    try {
      const result = await changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      await refreshUser();
      setPasswordMessage(result.message);
    } catch (requestError) {
      setPasswordError(errorMessage(requestError));
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <>
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>
          Welcome back, {user.firstName}. Explore the Condotel security
          prototype.
        </p>
      </div>
      <div className="stat-grid">
        {cards.map(({ title, value, detail, color, icon: Icon }) => (
          <div className={"stat-card " + color} key={title}>
            <div>
              <span className="stat-title">{title}</span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </div>
            <Icon size={24} />
          </div>
        ))}
      </div>
      {user.mustChangePassword && (
        <p className="demo-notice" role="status">
          Please change your temporary password in Account below before using
          the security demo.
        </p>
      )}
      <section
        className="dashboard-panel"
        id="security"
        aria-labelledby="security-heading"
      >
        <div className="panel-heading">
          <h2 id="security-heading">AES-256-GCM Security Demo</h2>
          <LockKeyhole size={20} />
        </div>
        <p className="demo-description">
          Encrypt sample text, then decrypt it to recover the original. Each
          encryption uses a fresh IV. The master key stays on the server;
          samples are not saved.
        </p>
        <form className="demo-form" onSubmit={encrypt}>
          <label htmlFor="sample-text">
            Sample text <small>(up to 4,096 characters)</small>
          </label>
          <textarea
            id="sample-text"
            rows={3}
            maxLength={4096}
            value={text}
            disabled={Boolean(busy)}
            onChange={(event) => {
              setText(event.target.value);
              setEncrypted(null);
              setDecrypted(null);
              setError("");
            }}
          />
          <button
            className="demo-button"
            disabled={Boolean(busy) || user.mustChangePassword}
          >
            {busy === "encrypt" ? "Encrypting..." : "Encrypt text"}
          </button>
        </form>
        {encrypted && (
          <div className="demo-form demo-result">
            <p className="demo-description">
              These Base64 values can be edited to demonstrate tamper detection.
              Encrypt again to restore a valid set.
            </p>
            {["ciphertext", "iv", "authTag"].map((field) => (
              <label key={field} htmlFor={field}>
                {field === "authTag"
                  ? "Authentication tag"
                  : field === "iv"
                    ? "IV"
                    : "Ciphertext"}
                <textarea
                  id={field}
                  rows={field === "ciphertext" ? 3 : 2}
                  spellCheck={false}
                  value={encrypted[field]}
                  disabled={Boolean(busy)}
                  onChange={(event) => {
                    setEncrypted({ ...encrypted, [field]: event.target.value });
                    setDecrypted(null);
                    setError("");
                  }}
                />
              </label>
            ))}
            <button
              type="button"
              className="demo-button"
              onClick={decrypt}
              disabled={Boolean(busy) || user.mustChangePassword}
            >
              {busy === "decrypt" ? "Decrypting..." : "Decrypt text"}
            </button>
          </div>
        )}
        {error && (
          <p className="demo-error" role="alert">
            {error}
          </p>
        )}
        {decrypted !== null && (
          <div className="demo-success" role="status">
            <strong>Decrypted text</strong>
            <pre>{decrypted === "" ? "(empty string)" : decrypted}</pre>
          </div>
        )}
      </section>
      <section
        className="dashboard-panel"
        id="account"
        aria-labelledby="account-heading"
      >
        <div className="panel-heading">
          <h2 id="account-heading">Account</h2>
          <Fingerprint size={20} />
        </div>
        <p className="demo-description">
          {user.firstName} {user.lastName} &middot; {user.email}
        </p>
        <p className="demo-description">
          Your password is stored as an Argon2id hash. Changing it creates a new
          hash; the original password cannot be decrypted.
        </p>
        <form className="demo-form" onSubmit={changePassword}>
          <label htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <label htmlFor="new-password">
            New password <small>(8&ndash;128 characters)</small>
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <button className="demo-button" disabled={passwordBusy}>
            {passwordBusy ? "Changing password..." : "Change password"}
          </button>
        </form>
        {passwordError && (
          <p className="demo-error" role="alert">
            {passwordError}
          </p>
        )}
        {passwordMessage && (
          <p className="demo-success" role="status">
            {passwordMessage}
          </p>
        )}
      </section>
    </>
  );
}
