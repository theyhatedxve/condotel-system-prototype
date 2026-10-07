// Shares the authenticated user and session actions across the route tree.
import { useCallback, useEffect, useMemo, useState } from "react";

import { getCurrentUser, loginUser } from "./authApi";

import {
  clearAccessToken,
  getAccessToken,
  saveAccessToken,
} from "./authStorage";

import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // A stored token requires a server check; no token means initialization is already complete.
  const [isLoading, setIsLoading] = useState(() => Boolean(getAccessToken()));

  // Reload account flags after changes such as replacing a temporary password.
  const refreshUser = useCallback(async () => {
    const result = await getCurrentUser();

    setUser(result.user);

    return result.user;
  }, []);

  const login = useCallback(async ({ identifier, password, rememberMe }) => {
    const result = await loginUser({
      identifier,
      password,
    });

    // Store the issued token only after the backend accepts the credentials.
    saveAccessToken(result.accessToken, rememberMe);

    setUser(result.user);

    return result.user;
  }, []);

  const logout = useCallback(() => {
    // Clear storage before updating the UI so later requests cannot reuse this token.
    // This is local sign-out; it does not revoke the JWT on the server.
    clearAccessToken();

    setUser(null);
  }, []);

  // Validate a stored token with the backend before treating the session as authenticated.
  // ProtectedRoute waits for this initialization before deciding whether to redirect.
  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      return;
    }

    let cancelled = false;

    getCurrentUser()
      .then((result) => {
        if (!cancelled) {
          setUser(result.user);
        }
      })
      .catch(() => {
        // Any failed startup check discards the stored session, including network failures.
        clearAccessToken();

        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    // Ignore late user/loading updates after cleanup; the HTTP request itself continues.
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,

      isLoading,

      isAuthenticated: Boolean(user),

      login,

      logout,

      refreshUser,
    }),
    [user, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
