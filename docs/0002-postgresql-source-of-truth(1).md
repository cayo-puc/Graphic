# ADR 0002: PostgreSQL como fonte oficial

- **Status:** Proposto
- **Contexto:** relações investigativas precisam de integridade transacional, histórico, filtros e rastreabilidade; o volume real é desconhecido.
- **Decisão:** persistir entidades e fatos investigativos no PostgreSQL; grafo é projeção calculada. Não introduzir banco de grafos até benchmark e consultas reais demonstrarem necessidade.
- **Consequências:** modelo relacional e índices precisam suportar consulta de adjacência; análise trabalha com snapshots. Migração para outra tecnologia seria decisão explícita e não altera fonte oficial por omissão.
- **Alternativas consideradas:** Neo4j como fonte primária (duplicação/consistência e benefício ainda não comprovados); armazenar tudo como JSON (fraca integridade e consultas).
