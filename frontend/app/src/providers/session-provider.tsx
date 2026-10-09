import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authService } from "../services/auth.service";
import { onUnauthorized } from "../services/session-events";

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
  const queryClient = useQueryClient();
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

  useEffect(() => onUnauthorized(() => {
    queryClient.clear();
    setUser(null);
  }), [queryClient]);

  const value = useMemo(
    () => ({
      ready,
      signedIn: Boolean(user),
      user,
      refresh,
      signIn: async () => {
        queryClient.clear();
        await refresh();
      },
      signOut: async () => {
        await authService.signOut();
        queryClient.clear();
        setUser(null);
      },
    }),
    [ready, user, refresh, queryClient],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
