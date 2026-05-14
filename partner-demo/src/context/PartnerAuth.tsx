import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { clearSession, loadSession, saveSession, type PartnerSession } from "@/lib/session";

type PartnerAuthContextValue = {
  session: PartnerSession | null;
  setSession: (s: PartnerSession | null) => void;
  refresh: () => void;
};

const PartnerAuthContext = createContext<PartnerAuthContextValue | null>(null);

export function PartnerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<PartnerSession | null>(() => loadSession());

  const setSession = useCallback((s: PartnerSession | null) => {
    setSessionState(s);
    if (s) saveSession(s);
    else clearSession();
  }, []);

  const refresh = useCallback(() => {
    setSessionState(loadSession());
  }, []);

  const value = useMemo(
    () => ({ session, setSession, refresh }),
    [session, setSession, refresh]
  );

  return <PartnerAuthContext.Provider value={value}>{children}</PartnerAuthContext.Provider>;
}

export function usePartnerAuth() {
  const v = useContext(PartnerAuthContext);
  if (!v) throw new Error("usePartnerAuth outside PartnerAuthProvider");
  return v;
}
