// Presents the Condotel sign-in form and enters the shared dashboard after authentication.
import { useState } from "react";

import { Building2, Eye, EyeOff, KeyRound, Mail, Waves } from "lucide-react";

import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "./useAuth";

import "./auth.css";

export default function LoginPage() {
  const navigate = useNavigate();

  const { login, user, isLoading, isAuthenticated } = useAuth();

  const [identifier, setIdentifier] = useState("");

  const [password, setPassword] = useState("");

  const [rememberMe, setRememberMe] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Wait for session restoration before redirecting an already authenticated visitor.
  if (!isLoading && isAuthenticated && user) {
    return <Navigate to="/dashboard" replace />;
  }

  // The backend verifies credentials with Argon2id; AuthContext stores the resulting JWT.
  // Submitting disables the sign-in button until the request settles.
  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      await login({
        identifier,
        password,
        rememberMe,
      });

      navigate("/dashboard", {
        replace: true,
      });
    } catch (requestError) {
      // Backend validation may return several messages; network failures use the fallback.
      const message =
        requestError.response?.data?.message ||
        "Unable to sign in. Please try again.";

      setError(Array.isArray(message) ? message.join(" ") : message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleIdentifierChange(event) {
    setIdentifier(event.target.value);

    if (error) {
      setError("");
    }
  }

  function handlePasswordChange(event) {
    setPassword(event.target.value);

    if (error) {
      setError("");
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-overlay" />

        <div className="login-brand">
          <div className="brand-icon-large">
            <Building2 size={58} />
          </div>

          <h1>CONDOTEL</h1>

          <p>NFC SYSTEM WITH PAYMENT</p>
        </div>

        <div className="login-tagline">
          <h2>Secure Access. Trusted Protection.</h2>

          <p>
            A Condotel prototype demonstrating authentication and encryption.
          </p>

          <div className="login-feature">
            <Waves size={18} />
            Condotel security demonstration
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-container">
          <div className="login-heading">
            <h2>Welcome Back!</h2>

            <p>Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="input-group">
              <span>Email or Username</span>

              <div className="input-wrapper">
                <Mail size={18} />

                <input
                  type="text"
                  value={identifier}
                  onChange={handleIdentifierChange}
                  placeholder="Email or Username"
                  autoComplete="username"
                  required
                />
              </div>
            </label>

            <label className="input-group">
              <span>Password</span>

              <div className="input-wrapper">
                <KeyRound size={18} />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <div className="login-options">
              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />

                <span>Remember me</span>
              </label>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="sign-in-button"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="login-footer">Condotel NFC System with Payment</div>
        </div>
      </section>
    </main>
  );
}
