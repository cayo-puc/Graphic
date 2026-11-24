# Análise de grafos

**Status:** desenho para fases futuras; nenhum algoritmo foi implementado ou executado.

## Projeção de rede

O serviço recebe do backend um snapshot autorizado e limitado da investigação. Nós são `InvestigationEntity`; arestas são `Relationship` elegíveis conforme filtros temporais e de status solicitados. Uma aresta direcionada preserva origem/destino; não direcionada é modelada explicitamente. Várias relações entre o mesmo par são permitidas e não devem ser fundidas silenciosamente. A projeção precisa declarar como agregou paralelas se um algoritmo exigir grafo simples.

Cada snapshot registra `investigationId`, `snapshotAt`, filtro temporal, status incluídos, IDs/versões de registros e `schemaVersion`. Não enviar dados de outra investigação, credenciais, documentos nem campos pessoais que o algoritmo não necessita.

## Algoritmos e interpretação

- Degree: contagem de vizinhos ou arestas, explicitando qual medida e direção.
- Betweenness, closeness e clustering coefficient: informar definição, tratamento de direção/desconexão e normalização utilizada.
- Connected components: componentes fracos para dirigido e componentes fortes quando solicitado.
- Community detection: algoritmo, parâmetros, seed e limites de aplicabilidade registrados.
- Shortest paths: apenas não ponderado por padrão. Modo ponderado exige medida com unidade e interpretação de custo; peso qualitativo arbitrário é proibido.
- Temporal: executar em janelas ou snapshots com regra explícita de inclusão de relações e incerteza de datas.
- Comparação de sub-redes: mesma definição de nó/aresta, janela e metodologia ou ressalva explícita de incompatibilidade.

Centralidade, comunidade e proximidade são propriedades estruturais do recorte e dos dados disponíveis. Não indicam automaticamente suspeita, culpa, intenção ou causalidade. UI e relatórios devem mostrar recorte, data, filtros, versão e limitações junto do resultado.

## Execução e persistência

`POST /investigations/{id}/analyses` valida autorização e parâmetros no backend, registra a solicitação e congela um snapshot lógico. Análises pequenas podem ser síncronas somente após limite de tamanho medido; o padrão para carga não trivial é tarefa assíncrona e estado consultável (`QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`). O serviço Python é stateless em relação ao domínio; não consulta diretamente PostgreSQL.

Resultados devem registrar algoritmo, parâmetros normalizados, versão de metodologia/código, snapshot, hora, duração e avisos. Retenção de payloads e reexecução dependem de classificação dos dados e política de retenção. Um resultado não deve ser apresentado como atual se os dados mudaram sem indicar a versão do snapshot.

## Desempenho e escolha de biblioteca

Começar com NetworkX pela adequação e simplicidade para protótipos/análises de porte moderado, medir com grafos sintéticos representativos e estabelecer limites de memória e tempo. Avaliar igraph somente com benchmark reproduzível demonstrando gargalo relevante; comparar algoritmo equivalente, qualidade do resultado, custo de integração e facilidade de operação. Não fixar limiar universal antes de conhecer volumes reais.

O explorador usa busca de vizinhos, expansão sob demanda, filtros, cursor e limite de nós/arestas. Layout e renderização devem ser medidos no browser; acima do orçamento de interação, reduzir recorte/arestas ou solicitar expansão. Calcular layouts caros fora da thread de interface quando necessário.

## Validação futura

Testes com grafos pequenos conhecidos (caminho, estrela, ciclo, componentes desconexos e dirigido), casos de empate e datas de fronteira; comparar resultados matemáticos esperados e versões. Benchmarks em tamanhos crescentes medem tempo e memória para construção, algoritmo e serialização separadamente. Resultados precisam registrar seed em algoritmos estocásticos.
