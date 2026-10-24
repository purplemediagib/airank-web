import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {track} from './analytics';
import {getStoredLocale} from '@/i18n';
import {
  getGetAppSessionQueryKey,
  getGetPreferencesQueryKey,
  updatePreferences,
  useGetAppSession,
  useGetPreferences,
  type AppSession,
  type AppUser,
  type PreferenceUpdate,
  type Preferences,
} from '@workspace/api-client-react';
import { readApiError } from './api-errors';

type PrefChanges = Omit<PreferenceUpdate, 'expectedVersion'>;

interface AccountValue {
  session: AppSession | undefined;
  sessionPending: boolean;
  sessionError: unknown;
  refetchSession: () => void;
  authenticated: boolean;
  user: AppUser | null;
  csrfToken: string | null;
  /** Request options carrying the session-bound CSRF token for generated mutations. */
  writeRequest: { headers: Record<string, string> };
  prefs: Preferences | undefined;
  prefsPending: boolean;
  /** Patches preferences with the current version. Rejects on failure; never retries automatically. */
  savePrefs: (changes: PrefChanges) => Promise<Preferences>;
  resetAccountCache: () => void;
}

const AccountContext = createContext<AccountValue | null>(null);
const SESSION_KEY = getGetAppSessionQueryKey();

export function AccountProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const sessionQ = useGetAppSession({
    query: {
      queryKey: SESSION_KEY,
      staleTime: 30_000,
      refetchInterval: (q) => q.state.data?.authenticated ? 60_000 : false,
      refetchOnWindowFocus: (q) => q.state.data?.authenticated !== false,
      refetchOnMount: true,
      retry: (count, err) => readApiError(err).status !== 401 && count < 1,
    },
  });
  const session = sessionQ.data;
  const authenticated = !!session?.authenticated && !!session.user;
  const user = authenticated ? session?.user ?? null : null;
  useEffect(() => {
    if (session?.accountCreated && user) track('account_signup', getStoredLocale() || 'fi', user.id);
  }, [session?.accountCreated, user?.id]);
  const csrfToken = authenticated ? session?.csrfToken ?? null : null;

  const resetAccountCache = useCallback(() => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== SESSION_KEY[0] });
  }, [qc]);

  // Identity change (logout, expiry, different account) drops all account-scoped cache.
  const lastUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (sessionQ.isPending) return;
    const id = user?.id ?? null;
    if (lastUser.current !== undefined && lastUser.current !== id) resetAccountCache();
    lastUser.current = id;
  }, [user?.id, sessionQ.isPending, resetAccountCache]);

  const prefsQ = useGetPreferences({
    query: { queryKey: [...getGetPreferencesQueryKey(), user?.id ?? 'anon'], enabled: authenticated, staleTime: 30_000, refetchOnWindowFocus: true },
  });
  const prefsKey = useMemo(() => [...getGetPreferencesQueryKey(), user?.id ?? 'anon'], [user?.id]);

  const writeRequest = useMemo((): { headers: Record<string, string> } => ({ headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {} }), [csrfToken]);

  const prefsRef = useRef(prefsQ.data);
  prefsRef.current = prefsQ.data;
  const csrfRef = useRef(writeRequest);
  csrfRef.current = writeRequest;

  // Preference writes are serialised so concurrent locale/project/timezone changes never race on the same version.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const userRef = useRef(user?.id);
  userRef.current = user?.id;

  const savePrefs = useCallback(
    (changes: PrefChanges) => {
      const owner = userRef.current;
      const run = () => writePrefs(changes, owner);
      const next = queue.current.then(run, run);
      queue.current = next.catch(() => undefined);
      return next;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, prefsKey],
  );

  const writePrefs = useCallback(
    async (changes: PrefChanges, owner: string | undefined) => {
      if (!owner || owner !== userRef.current) throw new Error('IDENTITY_CHANGED');
      const current = prefsRef.current;
      if (!current) throw new Error('PREFS_NOT_LOADED');
      try {
        const next = await updatePreferences({ expectedVersion: current.version, ...changes }, { headers: csrfRef.current.headers });
        if (owner !== userRef.current) throw new Error('IDENTITY_CHANGED');
        prefsRef.current = next;
        qc.setQueryData(prefsKey, next);
        return next;
      } catch (err) {
        if (readApiError(err).status === 409) await qc.invalidateQueries({ queryKey: prefsKey });
        throw err;
      }
    },
    [qc, prefsKey],
  );

  const value = useMemo(
    () => ({
      session,
      sessionPending: sessionQ.isPending,
      sessionError: sessionQ.isError && !session ? sessionQ.error : null,
      refetchSession: () => void sessionQ.refetch(),
      authenticated,
      user,
      csrfToken,
      writeRequest,
      prefs: authenticated ? prefsQ.data : undefined,
      prefsPending: authenticated && prefsQ.isPending,
      savePrefs,
      resetAccountCache,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, sessionQ.isPending, sessionQ.isError, sessionQ.error, authenticated, user, csrfToken, writeRequest, prefsQ.data, prefsQ.isPending, savePrefs, resetAccountCache],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount outside AccountProvider');
  return ctx;
}

export { SESSION_KEY };
