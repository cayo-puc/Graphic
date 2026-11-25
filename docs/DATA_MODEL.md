# Modelo de dados GRAPH 2.0.0

## Esquema curado e compilado

Os seis CSVs em `data/curadoria/` são a fonte editável da base empírica. `npm run build:db` valida e compila `data/graph.json`, consumido pela API Node.

- `investigations`: investigação, descrição/metodologia e estado.
- `entities`: catálogo global (`canonical_name`, `entity_type`, aliases, identificador opcional, descrição e metadados).
- `investigation_entities`: associação N:M entre entidade e investigação, com `contextual_role` e notas.
- `relationships`: afirmação contextual com endpoints, tipo, direção, intervalo, status epistêmico, desfecho jurídico/administrativo e valor/unidade objetivos opcionais.
- `sources`: registros documentais, independentes de qualquer relacionamento; podem ser referenciados por várias evidências.
- `evidences`: vínculo entre relação e fonte, com localização/página, trecho e nota de extração.

Toda relação precisa ter ao menos uma evidência. `build-db.mjs` valida IDs únicos, chaves estrangeiras, associação dos endpoints à investigação, datas, tipos e vocabulários controlados; rejeita métricas numéricas sem unidade. Não atribui pesos subjetivos aos algoritmos.

## Vocabulários

Tipos de entidade incluem pessoa, empresa, organização, instituição, instituição financeira, fundo, partido, órgão público, processo administrativo/judicial, ativo/transação e grupo processual. `epistemic_status`: `DOCUMENTED_FACT`, `OFFICIAL_ALLEGATION`, `REPORTED_SOURCE`, `UNCONFIRMED`. `legal_outcome`: `NOT_APPLICABLE`, `PENDING_JUDGMENT`, `SANCTIONED_ADMIN`, `ACQUITTED`, `SETTLED`, `CONVICTED_CRIMINAL`. O desfecho qualifica a decisão sobre a imputação modelada; não é atributo global da pessoa nem inferência penal.

## Migração e runtime

A demonstração anterior foi preservada como investigação separada, explicitamente sintética, com fonte/evidências fictícias rotuladas. O arquivo `graph.json` é gerado a partir dos CSVs; alterações feitas por CRUD no runtime persistem nele e precisam ser refletidas de volta na curadoria se forem para integrar a fonte reproduzível. Não há sincronização automática de JSON para CSV. Fontes são preservadas quando uma relação é excluída; evidências daquela relação são removidas.

O JSON continua sendo armazenamento local de protótipo, sem transações multiusuário, concorrência segura, histórico ou política de retenção.
