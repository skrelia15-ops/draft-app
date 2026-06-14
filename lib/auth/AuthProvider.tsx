import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Google Sign-In is a native module that is NOT bundled in Expo Go. Even
 * `require()`-ing it there runs its top-level
 * `TurboModuleRegistry.getEnforcing('RNGoogleSignin')`, which throws in a
 * way the dev runtime surfaces as a fatal uncaught error — so we must not
 * touch the module at all in Expo Go. We detect Expo Go and only load the
 * module in a real/dev build.
 */
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin').GoogleSignin;

function loadGoogleSignin(): GoogleSigninModule {
  return require('@react-native-google-signin/google-signin').GoogleSignin;
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

  const signInWithGoogle = useCallback(async () => {
    if (isExpoGo) {
      throw new Error('Google Sign-In needs a development build (not available in Expo Go).');
    }
    const GoogleSignin = loadGoogleSignin();
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken;
    if (!idToken) throw new Error('No Google id token');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Configure Google client IDs once — but never in Expo Go, where the
  // native module is absent and touching it crashes the app. Also skip
  // (and never throw) when no client IDs are set: otherwise the native
  // `configure` aborts the whole app with "failed to determine clientID".
  // Email/Apple sign-in still work; the Google button just won't.
  useEffect(() => {
    if (isExpoGo) return;
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!iosClientId && !webClientId) return;
    try {
      loadGoogleSignin().configure({ iosClientId, webClientId });
    } catch (e) {
      if (__DEV__) console.warn('[auth] Google Sign-In not configured:', e);
    }
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
  }), [session, isLoading, signUpWithEmail, signInWithEmail, signInWithApple, signInWithGoogle, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
