import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authService } from "../services/auth.service";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

type SessionContextValue = {
  ready: boolean;
  signedIn: boolean;
  user: SessionUser | null;
  refresh: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  const refresh = useCallback(async () => {
    const session = await authService.getSession();
    setUser(
      session?.user
        ? { id: session.user.id, name: session.user.name, email: session.user.email }
        : null,
    );
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } finally {
        setReady(true);
      }
    })();
  }, [refresh]);

  const value = useMemo(
    () => ({
      ready,
      signedIn: Boolean(user),
      user,
      refresh,
      signIn: refresh,
      signOut: async () => {
        await authService.signOut();
        setUser(null);
      },
    }),
    [ready, user, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
