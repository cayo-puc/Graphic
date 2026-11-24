# ADR 0004: Serviço de análise isolado em Python

- **Status:** Proposto para fase 3
- **Contexto:** domínio transacional em Java e algoritmos propostos com NetworkX em Python.
- **Decisão:** manter o worker FastAPI separado, stateless e privado, consumindo snapshots DTO autorizados do backend; não acessar diretamente banco ou arquivos. Adiar criação até a fase de grafos.
- **Consequências:** dependências e carga de CPU isoladas, possibilidade de escalar/reiniciar separadamente; adiciona operação, autenticação serviço-a-serviço e contrato versionado.
- **Alternativas consideradas:** chamar Python via subprocesso desde o início (acoplamento e isolamento operacional fracos); reimplementar análise em Java (desvia da stack proposta); misturar dados e análise no serviço principal.
