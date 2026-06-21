import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Dismiss any lingering auth browser session on warm starts (web no-op'ish
// on native, but recommended by the expo-auth docs).
WebBrowser.maybeCompleteAuthSession();

// Deep link Supabase redirects back to after Google OAuth. Hardcoded (not
// Linking.createURL) so it's deterministic across dev/prod and matches the
// exact value allow-listed in Supabase → Auth → URL Configuration.
const OAUTH_REDIRECT = 'draftapp://auth-callback';

/**
 * Pull the OAuth result params out of the redirect URL. Supabase's implicit
 * flow returns the session tokens in the URL fragment
 * (`...#access_token=...&refresh_token=...`); some error cases use the query
 * string — we read whichever is present.
 */
function parseAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const marker = url.includes('#') ? '#' : url.includes('?') ? '?' : '';
  if (!marker) return out;
  const blob = url.slice(url.indexOf(marker) + 1);
  for (const pair of blob.split('&')) {
    if (!pair) continue;
    const [k, v] = pair.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
  }
  return out;
}

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  /** Resolves with whether the user must confirm their email before they
   *  have a session (true when "Confirm email" is on in Supabase). */
  signUpWithEmail: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Permanently delete the signed-in user and their data, then sign out. */
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // With email confirmation enabled, signing up an already-registered
    // address returns no error and a user with an empty `identities` array
    // (Supabase obfuscates existence). Surface it instead of sending the
    // user to a "check your inbox" dead end.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Please sign in.');
    }
    // No session means email confirmation is required before sign-in.
    return { needsConfirmation: !data.session };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signInWithApple = useCallback(async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('No Apple identity token');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;
  }, []);

  // Google via Supabase web OAuth. We avoid the native id_token flow because
  // @react-native-google-signin embeds a nonce we can't control, which
  // Supabase rejects. The browser flow lets Supabase manage the nonce itself.
  const signInWithGoogle = useCallback(async () => {
    const redirectTo = OAUTH_REDIRECT;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        // Always show the Google account chooser instead of silently reusing
        // the browser's existing session (SSO), so the user picks who to log
        // in as every time.
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Could not start Google sign-in.');
    if (__DEV__) console.warn('[auth][google] oauth url →', data.url);

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      const cancelled: any = new Error('Sign in cancelled');
      cancelled.code = 'SIGN_IN_CANCELLED';
      throw cancelled;
    }
    if (result.type !== 'success' || !result.url) {
      throw new Error('Google sign-in did not complete.');
    }

    const params = parseAuthParams(result.url);
    if (params.error_description || params.error) {
      throw new Error(params.error_description || params.error);
    }
    const { access_token, refresh_token } = params;
    if (!access_token || !refresh_token) {
      throw new Error('Google sign-in returned no session.');
    }
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (sessionError) throw sessionError;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // A client can't delete its own auth user (that needs the service-role
  // key), so this calls a SECURITY DEFINER Postgres function `delete_account`
  // that removes the user (cascading to their profile/data). See the SQL in
  // the project setup. We sign out afterwards so the gate returns to slides.
  const deleteAccount = useCallback(async () => {
    const { error } = await (supabase.rpc as any)('delete_account');
    if (error) throw error;
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    isLoading,
    signUpWithEmail,
    signInWithEmail,
    signInWithApple: Platform.OS === 'ios' ? signInWithApple : async () => { throw new Error('Apple Sign In is iOS-only'); },
    signInWithGoogle,
    signOut,
    deleteAccount,
  }), [session, isLoading, signUpWithEmail, signInWithEmail, signInWithApple, signInWithGoogle, signOut, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
