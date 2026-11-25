# Roadmap GRAPH

## Entregue no MVP

- Workspace e investigação fictícia com dados demonstrativos.
- Cadastro, consulta, edição e exclusão de entidades e relacionamentos.
- Cadastro e associação de referências.
- Grafo interativo Cytoscape integrado à API e persistência, com layout automático, seleção, zoom e filtros por tipo, status e período.
- Grau, betweenness, closeness harmônica, componentes conexos e caminho mínimo.
- API Node local e persistência JSON.

## Fora do escopo atual

Autenticação e permissões multiusuário, banco transacional, auditoria/histórico, comunidades, importação em massa, paginação/expansão incremental, deploy e operação de produção.

## Evolução condicionada a requisitos

Adotar PostgreSQL quando houver colaboração ou concorrência. Separar análise ou outros serviços quando carga e latência justificarem escala independente. Preservar os contratos REST; evitar mensageria e infraestrutura distribuída sem necessidade observada.
