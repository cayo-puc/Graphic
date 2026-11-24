# ADR 0005: Pesos de aresta exigem semântica

- **Status:** Proposto
- **Contexto:** algoritmos ponderados podem distorcer caminhos se relações qualitativas forem mapeadas a números arbitrários.
- **Decisão:** sem peso implícito. Modo ponderado só aceita medida tipada com unidade, direção de custo, origem e metodologia documentadas; análise não ponderada é padrão.
- **Consequências:** menos algoritmos disponíveis inicialmente, mas resultados são interpretáveis e reproduzíveis.
- **Alternativas consideradas:** score subjetivo por tipo de relação (rejeitado por falsa precisão); assumir que maior valor sempre significa menor custo (sem base comum).
