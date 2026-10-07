// Centralizes the token key and the remember-me choice across login and API requests.
const TOKEN_KEY = 'condotel_access_token';

export function saveAccessToken(token, rememberMe = false) {
  // Remove the previous storage choice so an old persistent token cannot override this login.
  clearAccessToken();

  // Remembered sessions persist across browser restarts; other sessions use tab storage.
  if (rememberMe) {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  sessionStorage.setItem(TOKEN_KEY, token);
}

export function getAccessToken() {
  return (
    localStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(TOKEN_KEY)
  );
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}