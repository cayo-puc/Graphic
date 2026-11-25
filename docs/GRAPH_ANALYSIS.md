# Análise de grafos

## Implementado

- Degree: vizinhos distintos.
- Betweenness centrality: Brandes não ponderado e não direcionado, normalizado para `n > 2`.
- Harmonic closeness: soma dos inversos das distâncias para nós alcançáveis, normalizada por `n - 1`.
- Componentes conexos por busca em largura na projeção não direcionada.
- Caminho mínimo por BFS no grafo direcionado original: arestas direcionadas respeitam orientação; relações não direcionadas podem ser percorridas nos dois sentidos.

As métricas estruturais usam projeção simples não direcionada, sem pesos; relações paralelas contam como um vizinho. Caminhos usam a direção original. Valores como multas em BRL são informação documental e não pesos de aresta.

## Planejado, não implementado

Componentes fortemente conexos via Kosaraju devem operar no grafo direcionado original. Complexidade esperada `O(V + E)` em tempo e espaço. Um SCC representa alcançabilidade mútua, não coordenação, ilegalidade ou culpa. Não confundir SCC com componentes conexos não direcionados.

## Interpretação

Filtros de tipo, relação, status epistêmico, desfecho e período definem o recorte. O painel de análises mostra distribuição e ranking da investigação selecionada. Não se exibe série temporal com datas insuficientes. Indicadores descrevem apenas propriedades matemáticas dos dados e recortes escolhidos.
