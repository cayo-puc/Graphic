# ADR 0004: Serviço de análise isolado

- **Status:** Não adotado no MVP; proposta futura superada pela análise Node síncrona atual.
- **Contexto:** uma versão anterior sugeria serviço Python/FastAPI com NetworkX.
- **Decisão vigente:** métricas e BFS ficam na API Node, sobre snapshots JSON da investigação; Cytoscape.js consome a projeção da API.
- **Consequências:** menos serviços e dependências para executar a demonstração. Se escala ou perfil de carga mostrar gargalo, medir alternativas antes de extrair processamento.
- **Nota:** Python, FastAPI e NetworkX não são requisitos nem componentes atuais.
