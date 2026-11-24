# ADR 0001: Monólito modular para o núcleo do produto

- **Status:** Supersedido pela proposta do ADR 0006 (ainda aguardando validação).
- **Contexto:** NEXUS começa sem código e precisa de limites de domínio claros sem custo operacional prematuro.
- **Decisão:** Spring Boot como aplicação modular única para IAM, investigações, entidades, relações, fontes/evidências, grafo de consulta e auditoria. Módulos não acessam repositórios alheios diretamente; APIs internas explícitas.
- **Consequências:** transações e desenvolvimento local simples; exige disciplina de dependências e testes arquiteturais. Extração futura só quando escala, isolamento operacional ou ritmo de mudança justificar.
- **Alternativas consideradas:** microserviços desde o início (custo e consistência distribuída sem necessidade demonstrada); aplicação sem modularização (acoplamento crescente).
