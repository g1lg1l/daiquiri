import type { AuthError, Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DaiqError } from '@daiq/domain';
import { useDaiqClient } from './context';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | {
      status: 'signed-in';
      session: Session;
      userId: string;
      email: string | null;
      isAnonymous: boolean;
    };

const AuthContext = createContext<AuthState>({ status: 'loading' });

function toState(session: Session | null): AuthState {
  if (!session) return { status: 'signed-out' };
  return {
    status: 'signed-in',
    session,
    userId: session.user.id,
    email: session.user.email ?? null,
    isAnonymous: session.user.is_anonymous ?? false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useDaiqClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    client.auth
      .getSession()
      .then(({ data }) => active && setState(toState(data.session)))
      .catch(() => active && setState({ status: 'signed-out' }));
    const { data } = client.auth.onAuthStateChange((_event, session) => setState(toState(session)));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** The signed-in user's id; only valid below a route that requires authentication. */
export function useUserId(): string {
  const auth = useAuth();
  if (auth.status !== 'signed-in') throw new DaiqError('unauthenticated', 'Not signed in');
  return auth.userId;
}

function authError(error: AuthError): DaiqError {
  // Auth messages are written for end users ("Invalid login credentials").
  const code =
    error.status === 429 ? 'rate_limited' : error.status === 0 ? 'network' : 'validation';
  return new DaiqError(code, error.message, { cause: error });
}

export function useAuthActions() {
  const client = useDaiqClient();
  return useMemo(
    () => ({
      signInWithPassword: async (email: string, password: string) => {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw authError(error);
      },
      signUp: async (email: string, password: string, displayName: string, redirectTo: string) => {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName }, emailRedirectTo: redirectTo },
        });
        if (error) throw authError(error);
        return { needsConfirmation: !data.session };
      },
      sendMagicLink: async (email: string, redirectTo: string) => {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
        });
        if (error) throw authError(error);
      },
      signInAnonymously: async () => {
        const { error } = await client.auth.signInAnonymously();
        if (error) throw authError(error);
      },
      signOut: async () => {
        const { error } = await client.auth.signOut();
        if (error) throw authError(error);
      },
    }),
    [client],
  );
}
