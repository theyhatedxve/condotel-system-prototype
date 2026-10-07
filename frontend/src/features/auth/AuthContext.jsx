import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getCurrentUser,
  loginUser,
} from './authApi';

import {
  clearAccessToken,
  getAccessToken,
  saveAccessToken,
} from './authStorage';

import {
  AuthContext,
} from './useAuth';

export function AuthProvider({
  children,
}) {
  const [
    user,
    setUser,
  ] = useState(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(
    () =>
      Boolean(
        getAccessToken(),
      ),
  );

  const refreshUser = useCallback(async () => {
    const result = await getCurrentUser();
    setUser(result.user);
    return result.user;
  }, []);

  const login =
    useCallback(
      async ({
        identifier,
        password,
        rememberMe,
      }) => {
        const result =
          await loginUser({
            identifier,
            password,
          });

        saveAccessToken(
          result.accessToken,
          rememberMe,
        );

        setUser(
          result.user,
        );

        return result.user;
      },
      [],
    );

  const logout =
    useCallback(
      () => {
        clearAccessToken();

        setUser(null);
      },
      [],
    );

  // Validate a stored token with the backend before treating the session as authenticated.
  // ProtectedRoute waits for this initialization before deciding whether to redirect.
  useEffect(() => {
    const token =
      getAccessToken();

    if (!token) {
      return;
    }

    let cancelled =
      false;

    getCurrentUser()
      .then((result) => {
        if (!cancelled) {
          setUser(
            result.user,
          );
        }
      })
      .catch(() => {
        clearAccessToken();

        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(
            false,
          );
        }
      });

    return () => {
      cancelled =
        true;
    };
  }, []);

  const value =
    useMemo(
      () => ({
        user,

        isLoading,

        isAuthenticated:
          Boolean(user),

        login,

        logout,
        refreshUser,
      }),
      [
        user,
        isLoading,
        login,
        logout,
        refreshUser,
      ],
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}