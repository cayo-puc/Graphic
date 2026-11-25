# ADR 0002: CSV curado e JSON local no protótipo

- **Status:** Proposta de evolução, não vigente no MVP atual.
- **Contexto:** produção colaborativa exige integridade transacional e concorrência; o MVP atual prioriza execução local reproduzível.
- **Decisão vigente:** CSVs em `data/curadoria/` são a entrada curada; `npm run build:db` valida e compila `data/graph.json`, usado pela API Node.
- **Consequências:** distribuição simples e reprodutível; runtime JSON não é banco concorrente nem oferece transações multiusuário, histórico ou recuperação.
- **Alternativa futura:** avaliar banco transacional quando colaboração, concorrência, retenção/auditoria ou volume justificarem. PostgreSQL não é dependência atual.
