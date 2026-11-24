# GRAPH

Protótipo acadêmico para organizar investigações e explorar redes de entidades. O sistema é genérico: uma investigação pode representar qualquer tema e seus próprios dados.

> **Aviso sobre a demonstração:** “Rede demonstrativa — Horizonte” contém personagens, organizações, relações e referências inteiramente fictícias, criadas apenas para validar a aplicação. Não descreve o Banco Master nem qualquer pessoa, empresa ou fato real. Não cadastre dados pessoais sensíveis reais.

## Requisitos e execução

- Node.js 20 ou superior e npm.
- Instale dependências: `npm install`.
- Em um terminal, inicie a API: `npm run api` (local em `127.0.0.1:3001`). Em outro, inicie o frontend: `npm run dev` (abra o endereço mostrado pelo Vite).
- Ou gere a versão estática com `npm run build` e inicie a API com `npm start`. A API persiste em `data/graph.json`; sirva `dist/` com um servidor estático configurado para encaminhar `/api` ao endereço local da API.
- Dados de demonstração são criados automaticamente na primeira inicialização. Para usar outro caminho, configure `GRAPH_DATA_FILE`; para trocar a porta da API, configure `API_PORT` (padrão `3001`). Não há arquivo `.env` obrigatório, PostgreSQL ou migração.
- Testes: `npm test`.

## Arquitetura

- **Frontend:** React + Vite, com Cytoscape.js para o grafo interativo.
- **API:** Node.js nativo, organizada em rotas de investigações, entidades, vínculos, fontes e métricas.
- **Persistência:** arquivo JSON local com escrita após cada alteração. É uma escolha simples para a demonstração acadêmica, não um banco concorrente para uso multiusuário.
- **Análises:** grau de vizinhança, betweenness de Brandes em grafo não direcionado e componentes conexos. A projeção agrega vínculos paralelos, ignora a direção e não atribui pesos.

## Uso rápido

1. Abra **Investigações** e crie um espaço.
2. Entre em **Análise de rede**, selecione a investigação e adicione entidades e relacionamentos.
3. Selecione nós ou arestas para consultar os detalhes. Use os filtros por tipo e confirmação; arraste os nós e controle zoom/centralização.
4. Cadastre referências em **Fontes** ou no painel de detalhes, associando-as a um relacionamento.
5. Consulte **Entidades** e as métricas na lateral do grafo.

## Classificações e limites

Cada vínculo usa `DOCUMENTED`, `REPORTED`, `ALLEGED` ou `UNCONFIRMED`. Essas classificações descrevem o estado de confirmação cadastrado, não culpa ou probabilidade criminal. As métricas são propriedades estruturais da rede e não demonstram influência, irregularidade ou responsabilidade. O usuário é responsável por cadastrar fontes verificáveis; as fontes seed são exemplos explicitamente fictícios e não apontam para URLs oficiais.

O MVP não implementa autenticação, permissões multiusuário, edição/exclusão individual de entidades ou relacionamentos, nem concorrência/recuperação de banco. Investigações podem ser arquivadas via API (`PUT /api/investigations/:id` com `{"status":"ARCHIVED"}`); a exclusão é recusada se ainda houver entidades. O arquivo JSON deve ser protegido e incluído em backup pelo operador.

## API principal

- `GET /api` — visão agregada do workspace.
- `POST /api/investigations`, `PUT/DELETE /api/investigations/:id`.
- `GET /api/investigations/:id/graph` e `GET /api/investigations/:id/metrics`.
- `POST /api/entities`, `POST /api/relationships`, `POST /api/sources`.

As rotas de criação validam campos essenciais e a pertença das entidades à investigação. Referências de fontes são armazenadas como texto, sem validação de URL.
