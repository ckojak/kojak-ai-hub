import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isNative, nativeBridge } from "./nativeBridge";

const GOOGLE_TOKEN_KEY = "kojak_google_token";
const LAST_SENT_KEY = "kojak_native_session_sent_at";
// gmail.modify = ler + marcar como lido + mandar para a lixeira; gmail.send = responder/enviar.
export const GOOGLE_SCOPES =
  "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events";
const NATIVE_REDIRECT = "com.kojak.ia://auth-callback";

const listeners = new Set<() => void>();
export const onGoogleTokenChange = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export const getGoogleToken = () => localStorage.getItem(GOOGLE_TOKEN_KEY) || "";
export function setGoogleToken(token: string) {
  if (token) localStorage.setItem(GOOGLE_TOKEN_KEY, token);
  else localStorage.removeItem(GOOGLE_TOKEN_KEY);
  listeners.forEach((l) => l());
}

/** Guarda o token (e o refresh token) do Google no servidor, para a conexão não cair sozinha. */
export async function saveGoogleTokens(t: { accessToken?: string | null; refreshToken?: string | null }) {
  if (!t.accessToken && !t.refreshToken) return;
  try {
    await supabase.functions.invoke("kojak-assistant", {
      body: {
        action: "save_google",
        ...(t.accessToken ? { google_access_token: t.accessToken } : {}),
        ...(t.refreshToken ? { google_refresh_token: t.refreshToken } : {}),
      },
    });
  } catch { /* tenta de novo no próximo login */ }
}

export async function googleStatus(): Promise<boolean> {
  try {
    const { data } = await supabase.functions.invoke("kojak-assistant", { body: { action: "google_status" } });
    return !!(data as any)?.connected;
  } catch { return false; }
}

export async function disconnectGoogle() {
  try { await supabase.functions.invoke("kojak-assistant", { body: { action: "google_disconnect" } }); } catch { /* noop */ }
  setGoogleToken("");
}

async function pushSession(session: Session | null) {
  if (!isNative()) return;
  await nativeBridge.saveSession({
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    accessToken: session?.access_token || "",
    refreshToken: session?.refresh_token || "",
    googleAccessToken: session ? getGoogleToken() || undefined : undefined,
  });
  localStorage.setItem(LAST_SENT_KEY, String(Date.now()));
}

/** Login com Google. scopes opcionais (Gmail/Agenda no assistente). */
export async function signInWithGoogle(opts: { scopes?: string; webRedirect: string }) {
  const native = isNative();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      ...(opts.scopes
        ? { scopes: opts.scopes, queryParams: { access_type: "offline", prompt: "consent" } }
        : {}),
      redirectTo: native ? NATIVE_REDIRECT : opts.webRedirect,
      skipBrowserRedirect: native,
    },
  });
  if (error) throw error;
  if (native && data?.url) await Browser.open({ url: data.url });
}

let initialized = false;
export function initSessionSync() {
  if (initialized) return;
  initialized = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.provider_token) setGoogleToken(session.provider_token);
    // O refresh token só vem no momento do login com Google: salva no servidor.
    // (setTimeout evita chamar o Supabase de dentro do callback do auth.)
    if (event === "SIGNED_IN" && (session?.provider_refresh_token || session?.provider_token)) {
      const accessToken = session.provider_token;
      const refreshToken = session.provider_refresh_token;
      setTimeout(() => { saveGoogleTokens({ accessToken, refreshToken }); }, 0);
    }
    if (event === "SIGNED_OUT") {
      setGoogleToken("");
      pushSession(null);
    } else if (session) {
      pushSession(session);
    }
  });

  if (!isNative()) return;

  App.addListener("appUrlOpen", async ({ url }) => {
    if (!url.startsWith("com.kojak.ia://")) return;
    const hash = url.split("#")[1] || url.split("?")[1] || "";
    const p = new URLSearchParams(hash);
    const access_token = p.get("access_token");
    const refresh_token = p.get("refresh_token");
    const provider_token = p.get("provider_token");
    const provider_refresh_token = p.get("provider_refresh_token");
    if (provider_token) setGoogleToken(provider_token);
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
    if (provider_token || provider_refresh_token) {
      await saveGoogleTokens({ accessToken: provider_token, refreshToken: provider_refresh_token });
    }
    try { await Browser.close(); } catch { /* noop */ }
  }).catch(() => undefined);

  App.addListener("appStateChange", async ({ isActive }) => {
    if (!isActive) return;
    const res: any = await nativeBridge.getSession();
    const lastSent = Number(localStorage.getItem(LAST_SENT_KEY) || 0);
    if (res?.accessToken && res?.refreshToken && Number(res.updatedAt) > lastSent) {
      if (res.googleAccessToken) setGoogleToken(res.googleAccessToken);
      await supabase.auth.setSession({ access_token: res.accessToken, refresh_token: res.refreshToken });
    }
  }).catch(() => undefined);
}