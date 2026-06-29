import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Rota pública usada como redirect_to no OAuth do Supabase.
 * Detecta a sessão recém-criada e encaminha para a rota desejada.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Em PKCE flow, exchangeCodeForSession é necessário se houver ?code=...
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(window.location.href);
        }

        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        const intended = sessionStorage.getItem("postAuthRedirect") || "/";
        sessionStorage.removeItem("postAuthRedirect");
        navigate(data.session ? intended : "/auth", { replace: true });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[AuthCallback]", err);
        if (!cancelled) navigate("/auth", { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
