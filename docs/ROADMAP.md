# Roadmap

As etapas abaixo são propostas. Nenhuma implementação ou teste é declarado concluído. A Fase 1 encerra com arquitetura validada; estrutura de código só deve ser criada depois dessa validação.

## Fase 1 — Arquitetura e base

1. **Validar decisões arquiteturais** — revisar monólito modular, entidades compartilhadas, identidade, vocabulário de status, histórico e arquivos. Saída: ADRs aceitos/alterados.
2. **Definir contratos de domínio mínimos** — tipos de entidades, relações, filiações, datas e evidências; documentar exemplos e invariantes.
3. **Criar esqueleto de repositório** — `apps/web`, `apps/api`, documentação e configuração; builds vazios reproduzíveis.
4. **Configurar ambiente local** — Compose com PostgreSQL e migração Flyway mínima; credenciais por ambiente e `.env.example` sem segredo.
5. **Adicionar CI inicial** — build/lint e testes existentes por projeto, sem falhar silenciosamente; pipeline não deve conter dados sensíveis.

## Fase 2 — Núcleo investigativo

6. Implementar investigação e membership com autorização no servidor.
7. Implementar Entity/Person/Organization e vínculo InvestigationEntity com proteção contra enumeração.
8. Implementar relações direcionadas/não direcionadas, temporalidade e status epistêmico.
9. Implementar fontes, evidências, filiação e versionamento/auditoria conforme política aprovada.
10. Documentar REST/OpenAPI e provar isolamento por investigação com testes de API/persistência.

## Fase 3 — Motor de grafos

11. Definir schema de snapshot e minimização/limites do grafo.
12. Implementar worker Python/NetworkX e comunicação autenticada privada.
13. Implementar algoritmos de escopo inicial com testes em grafos conhecidos e metadados reproduzíveis.
14. Benchmark sintético; avaliar fila, limites e igraph somente com evidência de gargalo.

## Fase 4 — Explorador visual

15. Criar fluxos web de investigação, entidades e relação com estados de carregamento/erro/vazio.
16. Integrar consulta de subgrafo paginada/limitada, filtros e expansão progressiva.
17. Adicionar painel de inspeção e fontes, temporalidade, caminho e métricas com contexto/metodologia.
18. Medir responsividade do Cytoscape.js em subgrafos representativos e ajustar estratégia de layout.

## Fase 5 — Segurança e confiabilidade

19. Integrar identidade aprovada, MFA/políticas aplicáveis e gestão de papéis.
20. Revisar autorização por objeto, isolamento, exportações, uploads e auditoria.
21. Ensaiar backup/restauração, limites de carga, observabilidade e revisão de dependências.

## Fase 6 — Estudo demonstrativo

22. Selecionar fontes públicas/permitidas, registrar proveniência e critérios de inclusão.
23. Cadastrar dados sem transformar alegação em fato; revisão humana independente.
24. Conferir resultados, visualizações, fontes e limites; publicar somente após revisão e autorização.

## Critério de conclusão por item

Cada item define comportamento observável, alterações documentadas, testes apropriados executados e resultado relatado com honestidade. Nenhum item passa só porque a tela renderiza. Não iniciar a fase demonstrativa sem validação de fonte, direitos, privacidade e qualificação das afirmações.
