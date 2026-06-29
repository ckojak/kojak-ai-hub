import { toast } from "@/hooks/use-toast";

/**
 * Padroniza tratamento de erros assíncronos.
 * - Loga no console (preservado em produção para Sentry/etc).
 * - Exibe toast amigável ao usuário.
 * - Nunca relança — falha silenciosa para não travar a UI.
 */
export function handleError(error: unknown, userMessage = "Algo deu errado. Tente novamente.") {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error("[handleError]", message, error);
  toast({
    title: "Erro",
    description: userMessage,
    variant: "destructive",
  });
}

/** Wrapper para promises Supabase: retorna data ou null sem propagar exceção. */
export async function safeAwait<T>(
  promise: Promise<{ data: T | null; error: unknown }>,
  userMessage?: string
): Promise<T | null> {
  try {
    const { data, error } = await promise;
    if (error) {
      handleError(error, userMessage);
      return null;
    }
    return data;
  } catch (err) {
    handleError(err, userMessage);
    return null;
  }
}
