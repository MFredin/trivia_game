import { useCallback, useEffect, useState } from 'react';
import { getMe, updateTheme } from '../../api/auth.js';
import { DEFAULT_HOUSE } from '../../constants/houses.js';

const TOKEN_STORAGE_KEY = 'trivia_auth_token';

/**
 * Who is logged in, and the house binding that follows them around.
 *
 * `checked` is what the shell waits on: until the stored token has been verified we do not
 * know whether to show the auth screen or the start screen, and flashing one before the other
 * is worse than a blank frame.
 */
export function useAuth({ onAuthenticated, onLoggedOut }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      setChecked(true);
      return;
    }
    getMe(stored)
      .then((data) => {
        setToken(stored);
        setUser(data.user);
        onAuthenticated(data.user);
      })
      .catch(() => localStorage.removeItem(TOKEN_STORAGE_KEY))
      .finally(() => setChecked(true));
    // Once, on mount: a stored token is checked when the app opens and never again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The binding is applied to the document, not to a React tree, because it rebinds the role
  // tokens every stylesheet reads from.
  useEffect(() => {
    document.documentElement.setAttribute('data-house', user?.theme ?? DEFAULT_HOUSE);
  }, [user?.theme]);

  const authenticate = useCallback((newToken, newUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    onAuthenticated(newUser);
  }, [onAuthenticated]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    onLoggedOut();
  }, [onLoggedOut]);

  const selectTheme = useCallback(async (theme) => {
    setUser((prev) => ({ ...prev, theme }));
    try {
      await updateTheme(theme, token);
    } catch {
      // the DOM already reflects the pick; a failed save just means it won't stick next login
    }
  }, [token]);

  return { token, user, checked, authenticate, logout, selectTheme };
}
