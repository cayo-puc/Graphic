# Segurança, auditoria e integridade

**Status:** requisitos iniciais para validação, não certificação nem implementação concluída.

## Modelo de acesso

Toda leitura ou escrita de dado investigativo exige autenticação e autorização no servidor para a investigação e a ação solicitada. A interface esconder controles não é controle de segurança. Backend deve derivar principal da sessão/token validado, verificar membership/role em cada operação e limitar buscas por ID para impedir IDOR e enumeração.

Separar papéis globais administrativos de papéis por investigação. Definir inicialmente permissões explícitas (visualizar, editar dados, gerir membros, exportar, administrar) antes de codificar papéis fixos. Usuários sem concessão não devem conseguir confirmar nem inferir presença de entidade em caso alheio.

## Identidade e segredos

Preferir OIDC com provedor aprovado e MFA conforme implantação. Se login local for necessário, senhas com algoritmo de hash adaptativo apropriado; nunca texto claro ou logs. Segredos fora do Git, `.env.example` apenas com nomes e placeholders, rotação e mínimo privilégio. Tokens não devem aparecer em URL, logs ou telemetria.

## Isolamento e arquivos

Consultas sempre escopadas por investigation ID autorizado e verificadas também por integridade relacional. Avaliar PostgreSQL Row-Level Security como defesa em profundidade após definir conexão/identidade transacional; não substitui autorização da aplicação. Fontes e evidências têm a mesma política de acesso do caso. Artefatos ficam em armazenamento privado com IDs opacos, validação de tipo/tamanho, antivírus conforme ambiente e URLs assinadas de curta duração ou proxy autenticado. Nunca servir uploads como conteúdo ativo do mesmo domínio.

## Auditoria e integridade

Registrar ator, investigação, ação, objeto, horário, trace ID e contexto mínimo de alterações sensíveis, exportações, mudanças de acesso e eventos de evidência. Não registrar conteúdo integral sensível, token ou segredo. AuditLog é append-only para a aplicação; acesso de leitura e retenção são restritos. Hash de artefato apoia detecção de alteração, mas não prova origem/autenticidade por si só. Preservar histórico de correções e vínculos de evidência conforme política.

## Aplicação e operação

Validar DTOs e limites de paginação/carga; consultas parametrizadas; proteção CSRF conforme estratégia de sessão, CORS restrito, TLS, cabeçalhos e rate limits; mensagens de erro sem detalhe interno. Logs estruturados com redaction e acesso controlado. Dependências e imagens devem ser atualizadas e verificadas em CI quando pipeline existir. Backups criptografados, restauração ensaiada e políticas de retenção/exportação precisam ser definidos antes de dados reais.

Desenvolvimento usa somente dados sintéticos ou públicos não sensíveis e autorizados. Não importar o caso demonstrativo até definir fontes e direitos de uso. Nenhuma métrica de rede classifica automaticamente indivíduos como suspeitos ou culpados.

## Decisões de segurança pendentes

Provedor de identidade/MFA; matriz de permissões e gestão de membros; sensibilidade e retenção; localização e armazenamento de documentos; política de exportação; estratégia de backup e recuperação; uso ou não de RLS; processo para correção, eliminação e preservação legal.
