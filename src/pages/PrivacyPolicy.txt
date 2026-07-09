export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Política de Privacidade — Kojak.AI</h1>
      <p className="text-sm text-muted-foreground mb-8">Última atualização: julho de 2026</p>

      <section className="space-y-6 leading-relaxed">
        <p>
          Esta Política de Privacidade descreve como o Kojak.AI ("nós", "aplicativo") coleta,
          usa e protege as informações dos usuários ("você") que utilizam nosso aplicativo e site.
        </p>

        <div>
          <h2 className="text-xl font-semibold mb-2">1. Dados que coletamos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Dados de login:</strong> quando você entra com sua conta Google, coletamos
              seu nome, e-mail e foto de perfil públicos, fornecidos diretamente pelo Google.
            </li>
            <li>
              <strong>Histórico de conversas:</strong> as mensagens trocadas com a IA são
              armazenadas para que você possa consultar seu histórico dentro do aplicativo.
            </li>
            <li>
              <strong>Imagens e vídeos enviados:</strong> arquivos que você envia para edição ou
              análise são processados e podem ser armazenados temporariamente para exibição do
              resultado.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">2. Como usamos esses dados</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Para autenticar sua conta e manter sua sessão ativa.</li>
            <li>Para exibir seu histórico de conversas quando você retornar ao aplicativo.</li>
            <li>Para processar suas solicitações de texto, imagem e vídeo através de serviços de IA.</li>
            <li>Não vendemos nem compartilhamos seus dados pessoais com terceiros para fins de publicidade.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">3. Serviços de terceiros</h2>
          <p>
            Utilizamos provedores de infraestrutura para processar suas solicitações, incluindo
            Google (autenticação e modelos de IA Gemini) e Supabase (armazenamento de dados e
            autenticação). Esses provedores processam dados em nosso nome, seguindo suas próprias
            políticas de segurança.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">4. Armazenamento e segurança</h2>
          <p>
            Seus dados são armazenados em servidores do Supabase com controle de acesso restrito
            por conta. Empregamos práticas razoáveis de segurança, mas nenhum sistema é
            completamente livre de risco.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">5. Seus direitos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Você pode solicitar a exclusão da sua conta e dos dados associados a qualquer momento.</li>
            <li>Você pode revogar o acesso do aplicativo à sua conta Google a qualquer momento em myaccount.google.com/permissions.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">6. Menores de idade</h2>
          <p>
            O aplicativo não é direcionado a menores de 13 anos e não coletamos intencionalmente
            dados de crianças.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">7. Contato</h2>
          <p>
            Dúvidas sobre esta política ou solicitações relacionadas aos seus dados podem ser
            enviadas para: <strong>bmw.kojak@gmail.com</strong>
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">8. Alterações nesta política</h2>
          <p>
            Podemos atualizar esta política periodicamente. Mudanças significativas serão
            comunicadas dentro do aplicativo.
          </p>
        </div>
      </section>
    </div>
  );
}