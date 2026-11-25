# ADR 0001: Limites modulares sem microserviços prematuros

- **Status:** Vigente no MVP GRAPH (Node.js, React/Vite, JSON local).
- **Contexto:** o MVP precisa de fluxo integrado com custo operacional local baixo.
- **Decisão:** API HTTP única Node.js organizada por responsabilidades de investigação, catálogo/contexto de entidades, relacionamentos/evidências/fontes e análise.
- **Consequências:** integração e execução local simples; módulos podem ser extraídos se escala, isolamento ou ritmo de mudança justificarem.
- **Histórico:** a versão anterior deste ADR propunha Spring Boot para o NEXUS. Essa tecnologia não foi adotada no GRAPH.
