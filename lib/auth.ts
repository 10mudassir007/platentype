"use client";

import { useCallback, useEffect, useState } from "react";

export interface AuthUser {
  id: string;
  name: string;
  provider: string;
  avatar: string | null;
  guest: boolean;
}

interface AuthPayload {
  user: AuthUser | null;
  providers: { github: boolean; google: boolean };
}

const NAME_KEY = "platen:name";

export function readStoredName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function storeName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // Private mode can reject writes; the session still works.
  }
}

const AUTH_NOTICE: Record<string, string> = {
  ok: "signed in",
  unconfigured: "that provider is not configured on this server",
  state: "the sign-in attempt expired, try again",
  token: "the provider did not return a token",
  profile: "the provider did not return a profile",
  denied: "sign-in was cancelled",
  error: "sign-in failed",
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [providers, setProviders] = useState({ github: false, google: false });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const apply = useCallback((payload: AuthPayload) => {
    setUser(payload.user);
    setProviders(payload.providers ?? { github: false, google: false });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const payload = (await response.json()) as AuthPayload;
      apply(payload);
      return payload;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const result = params.get("auth");
      if (result) {
        setNotice(AUTH_NOTICE[result] ?? "sign-in finished");
        params.delete("auth");
        params.delete("provider");
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
        window.history.replaceState(null, "", next);
      }

      const payload = await refresh();
      if (cancelled || !payload) return;
      if (payload.user) {
        storeName(payload.user.name);
        return;
      }
      const stored = readStoredName();
      if (!stored) return;
      try {
        const response = await fetch("/api/auth/name", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: stored }),
        });
        if (!response.ok) return;
        const created = (await response.json()) as { user: AuthUser };
        if (!cancelled) setUser(created.user);
      } catch {
        // The guest can still play locally.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const setName = useCallback(async (name: string) => {
    const response = await fetch("/api/auth/name", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(payload.error ?? "could not save that name");
    }
    const payload = (await response.json()) as { user: AuthUser };
    setUser(payload.user);
    storeName(payload.user.name);
    return payload.user;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    try {
      window.localStorage.removeItem(NAME_KEY);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const signIn = useCallback((provider: "github" | "google") => {
    window.location.href = `/api/auth/${provider}`;
  }, []);

  const displayName = user?.name || readStoredName() || "fighter";

  return {
    user,
    providers,
    loading,
    notice,
    displayName,
    refresh,
    setName,
    logout,
    signIn,
    clearNotice: () => setNotice(""),
  };
}

export type Auth = ReturnType<typeof useAuth>;
