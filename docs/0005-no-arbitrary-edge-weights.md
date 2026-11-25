# ADR 0005: Pesos de aresta exigem semântica

- **Status:** Implementado no MVP
- **Contexto:** algoritmos ponderados podem distorcer caminhos se relações qualitativas forem mapeadas a números arbitrários.
- **Decisão:** sem peso implícito. O schema v2 permite `metric_value` e `metric_unit` para grandezas objetivas documentadas, sem usá-las como peso nas métricas atuais. Degree, Brandes betweenness, harmonic closeness e BFS continuam não ponderados.
- **Consequências:** menos algoritmos disponíveis inicialmente, mas resultados são interpretáveis e reproduzíveis.
- **Alternativas consideradas:** score subjetivo por tipo de relação (rejeitado por falsa precisão); assumir que maior valor sempre significa menor custo (sem base comum).
