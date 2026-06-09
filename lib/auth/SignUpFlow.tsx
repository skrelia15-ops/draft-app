import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * In-memory store for the multi-step email sign-up wizard (email →
 * password → confirm). The draft credentials live here instead of being
 * passed as navigation route params, which would serialize the password
 * into the in-memory navigation state (and the URL/history on web) and
 * could surface in nav-state logging or crash reports.
 *
 * The provider is mounted by the sign-up stack layout, so the draft is
 * scoped to that flow and dropped when the user leaves it. `reset()` also
 * clears it explicitly once the account is created.
 */

type SignUpFlowValue = {
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  reset: () => void;
};

const SignUpFlowContext = createContext<SignUpFlowValue | null>(null);

export function SignUpFlowProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const reset = useCallback(() => {
    setEmail('');
    setPassword('');
  }, []);

  const value = useMemo<SignUpFlowValue>(
    () => ({ email, password, setEmail, setPassword, reset }),
    [email, password, reset],
  );

  return (
    <SignUpFlowContext.Provider value={value}>
      {children}
    </SignUpFlowContext.Provider>
  );
}

export function useSignUpFlow(): SignUpFlowValue {
  const ctx = useContext(SignUpFlowContext);
  if (!ctx) {
    throw new Error('useSignUpFlow must be used inside <SignUpFlowProvider>.');
  }
  return ctx;
}
