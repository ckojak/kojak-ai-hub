import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type NativeState = "idle" | "wake" | "listening" | "thinking" | "speaking";

export interface SetupStatus {
  mic: boolean;
  notifications: boolean;
  contacts: boolean;
  overlay: boolean;
  battery: boolean;
  wakeWordReady: boolean;
}

export interface NativeSession {
  accessToken: string;
  refreshToken: string;
  googleAccessToken?: string;
  updatedAt: number;
}

interface KojakNativePlugin {
  runTool(o: { name: string; args: unknown }): Promise<{ ok: boolean; [k: string]: unknown }>;
  startBackgroundListening(): Promise<{ running: boolean }>;
  stopBackgroundListening(): Promise<{ running: boolean }>;
  isBackgroundListening(): Promise<{ running: boolean }>;
  saveSession(o: {
    supabaseUrl: string;
    anonKey: string;
    accessToken: string;
    refreshToken: string;
    googleAccessToken?: string;
  }): Promise<unknown>;
  getSession(): Promise<NativeSession>;
  requestSetup(): Promise<unknown>;
  checkSetup(): Promise<SetupStatus>;
  addListener(event: string, cb: (data: any) => void): Promise<PluginListenerHandle>;
}

const NOT_AVAILABLE = { ok: false, message: "Disponível só no app Android" };

export const isNative = (): boolean => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

const plugin = registerPlugin<KojakNativePlugin>("KojakNative");

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isNative()) return fallback;
  try { return await fn(); } catch (e) {
    console.warn("KojakNative:", e);
    return { ...(fallback as object), message: e instanceof Error ? e.message : String(e) } as T;
  }
}

export const nativeBridge = {
  runTool: (name: string, args: unknown) =>
    safe(() => plugin.runTool({ name, args }), { ...NOT_AVAILABLE } as { ok: boolean; [k: string]: unknown }),
  startBackgroundListening: () => safe(() => plugin.startBackgroundListening(), { running: false, ...NOT_AVAILABLE }),
  stopBackgroundListening: () => safe(() => plugin.stopBackgroundListening(), { running: false, ...NOT_AVAILABLE }),
  isBackgroundListening: () => safe(() => plugin.isBackgroundListening(), { running: false, ...NOT_AVAILABLE }),
  saveSession: (o: Parameters<KojakNativePlugin["saveSession"]>[0]) => safe(() => plugin.saveSession(o), { ...NOT_AVAILABLE }),
  getSession: () => safe<NativeSession | (typeof NOT_AVAILABLE)>(() => plugin.getSession(), { ...NOT_AVAILABLE }),
  requestSetup: () => safe(() => plugin.requestSetup(), { ...NOT_AVAILABLE }),
  checkSetup: () => safe<SetupStatus | (typeof NOT_AVAILABLE)>(() => plugin.checkSetup(), { ...NOT_AVAILABLE }),
  addListener(event: "wakeWord" | "assistantTurn" | "state", cb: (data: any) => void): () => void {
    if (!isNative()) return () => undefined;
    let handle: PluginListenerHandle | null = null;
    let removed = false;
    plugin.addListener(event, cb).then((h) => { if (removed) h.remove(); else handle = h; }).catch(() => undefined);
    return () => { removed = true; handle?.remove(); };
  },
};
