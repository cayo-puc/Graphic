# GRAPH

MVP local para curar e explorar redes de investigação com entidades, relações, fontes e evidências rastreáveis.

## Executar

Requer Node.js 20+.

```sh
npm install
npm run build:db # compila data/curadoria/*.csv em data/graph.json
npm run api      # terminal 1
npm run dev      # terminal 2; abra o endereço mostrado pelo Vite
```

`npm test` executa testes de contrato e API. `npm run build` gera o frontend em `dist/`. A API escuta em `127.0.0.1:3101`; `API_PORT` e `GRAPH_DATA_FILE` são opcionais. O proxy do Vite usa a mesma variável `API_PORT`.

## Arquitetura

- React/Vite e Cytoscape.js no frontend.
- API única em Node.js nativo, dividida por responsabilidades.
- JSON local para persistência de runtime; CSV como curadoria reprodutível.
- `scripts/build-db.mjs` valida FKs, enumerações e a regra de uma ou mais evidências por relação.
- `src/api/cytoscapeMapper.js` gera os elementos Cytoscape com filtros e evidências hidratadas.

## Base v2.0.0

`data/curadoria/` contém investigações, fontes, catálogo global de entidades, vínculos contextuais, relacionamentos e evidências. Uma fonte pode sustentar muitas evidências. Relações distinguem `epistemic_status` de `legal_outcome`. Valores objetivos podem ter unidade (por exemplo, multas em `BRL`); as métricas de rede não usam esses valores como pesos.

A curadoria empírica fornecida organiza o PAS CVM nº 19957.007976/2020-94 a partir do voto oficial de 08/09/2026. Sua presença na rede não implica responsabilidade criminal; a imputação e o desfecho administrativo ficam associados às relações processuais. A base anterior “Horizonte” permanece em investigação separada e é explicitamente sintética.

## API principal

- `GET /api` — workspace normalizado e `schemaVersion`.
- `GET /api/investigations/:id/graph` — entidades, relações, evidências e `elements` Cytoscape; filtros por `entityTypes`, `relationTypes`, `epistemicStatuses`, `legalOutcomes`, `startDate`, `endDate`.
- `GET /api/investigations/:id/metrics` — degree, Brandes betweenness, harmonic closeness e componentes na projeção não direcionada sem pesos.
- `GET /api/investigations/:id/path?from=&to=` — caminho BFS no grafo original, respeitando direção.
- CRUD de investigações, entidades, relações e fontes; `POST /api/evidences` anexa evidência.

## Limites

Sem autenticação, concorrência multiusuário, banco transacional, importador CSV genérico na interface, versionamento/histórico ou deploy de produção. A curadoria CSV é o artefato reproduzível; CRUD altera o JSON runtime e essas alterações precisam ser copiadas à curadoria antes do próximo `build:db`.
