import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CURATION = path.join(ROOT, 'data', 'curadoria');
const OUTPUT = path.join(ROOT, 'data', 'graph.json');
const TYPES = new Set(['PERSON', 'COMPANY', 'ORGANIZATION', 'INSTITUTION', 'FINANCIAL_INSTITUTION', 'INVESTMENT_FUND', 'POLITICAL_PARTY', 'PUBLIC_BODY', 'ADMINISTRATIVE_PROCEEDING', 'JUDICIAL_PROCEEDING', 'ASSET_OR_TRANSACTION', 'PROCEDURAL_COHORT']);
const EPISTEMIC = new Set(['DOCUMENTED_FACT', 'OFFICIAL_ALLEGATION', 'REPORTED_SOURCE', 'UNCONFIRMED']);
const LEGAL = new Set(['NOT_APPLICABLE', 'PENDING_JUDGMENT', 'SANCTIONED_ADMIN', 'ACQUITTED', 'SETTLED', 'CONVICTED_CRIMINAL']);

function parseCsv(file) {
  const text = fs.readFileSync(path.join(CURATION, file), 'utf8').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field.trim()); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '').trim()); if (row.some(value => value !== '')) rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (quoted) throw new Error(`${file}: campo CSV com aspas não fechadas`);
  if (field.length || row.length) { row.push(field.replace(/\r$/, '').trim()); if (row.some(value => value !== '')) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map((value, index) => index === 0 ? value.replace(/^\uFEFF/, '') : value);
  return rows.map((values, line) => {
    if (values.length !== headers.length) throw new Error(`${file}, linha ${line + 2}: esperadas ${headers.length} colunas, encontradas ${values.length}`);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] === '' ? null : values[index]]));
  });
}

function assertUnique(rows, label) {
  const ids = new Set();
  for (const row of rows) {
    if (!row.id) throw new Error(`${label}: registro sem id`);
    if (ids.has(row.id)) throw new Error(`${label}: id duplicado ${row.id}`);
    ids.add(row.id);
  }
  return ids;
}
function requireForeignKey(set, value, label) { if (!set.has(value)) throw new Error(`${label}: referência inexistente ${value}`); }
function checkDate(value, label) { if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label}: data inválida ${value}`); }

export function buildDatabase() {
  const investigations = parseCsv('investigations.csv');
  const sources = parseCsv('sources.csv');
  const entities = parseCsv('entities.csv').map(entity => ({ ...entity, aliases: entity.aliases ? entity.aliases.split('|').map(value => value.trim()).filter(Boolean) : [], metadata: entity.metadata ? JSON.parse(entity.metadata) : {} }));
  const investigation_entities = parseCsv('investigation_entities.csv');
  const relationships = parseCsv('relationships.csv').map(relationship => ({ ...relationship, metric_value: relationship.metric_value === null ? null : Number(relationship.metric_value) }));
  const evidences = parseCsv('evidences.csv');

  const investigationIds = assertUnique(investigations, 'investigations');
  const entityIds = assertUnique(entities, 'entities');
  const sourceIds = assertUnique(sources, 'sources');
  const relationshipIds = assertUnique(relationships, 'relationships');
  assertUnique(investigation_entities, 'investigation_entities');
  assertUnique(evidences, 'evidences');

  for (const entity of entities) if (!TYPES.has(entity.entity_type)) throw new Error(`Tipo de entidade inválido em ${entity.id}: ${entity.entity_type}`);
  for (const source of sources) requireForeignKey(investigationIds, source.investigation_id, `Fonte ${source.id}`);
  const memberships = new Set();
  for (const membership of investigation_entities) {
    requireForeignKey(investigationIds, membership.investigation_id, `Vínculo contextual ${membership.id}`);
    requireForeignKey(entityIds, membership.entity_id, `Vínculo contextual ${membership.id}`);
    const pair = `${membership.investigation_id}\0${membership.entity_id}`;
    if (memberships.has(pair)) throw new Error(`Vínculo contextual duplicado: ${membership.investigation_id}/${membership.entity_id}`);
    memberships.add(pair);
  }
  for (const relationship of relationships) {
    requireForeignKey(investigationIds, relationship.investigation_id, `Relacionamento ${relationship.id}`);
    requireForeignKey(entityIds, relationship.source_entity_id, `Relacionamento ${relationship.id}`);
    requireForeignKey(entityIds, relationship.target_entity_id, `Relacionamento ${relationship.id}`);
    if (relationship.source_entity_id === relationship.target_entity_id) throw new Error(`Relacionamento ${relationship.id}: autoaresta não permitida`);
    if (!memberships.has(`${relationship.investigation_id}\0${relationship.source_entity_id}`) || !memberships.has(`${relationship.investigation_id}\0${relationship.target_entity_id}`)) throw new Error(`Relacionamento ${relationship.id}: ambas as entidades devem estar associadas à investigação`);
    if (!['DIRECTED', 'UNDIRECTED'].includes(relationship.direction)) throw new Error(`Direção inválida em ${relationship.id}`);
    if (!EPISTEMIC.has(relationship.epistemic_status)) throw new Error(`epistemic_status inválido em ${relationship.id}: ${relationship.epistemic_status}`);
    if (!LEGAL.has(relationship.legal_outcome)) throw new Error(`legal_outcome inválido em ${relationship.id}: ${relationship.legal_outcome}`);
    if (relationship.metric_value !== null && (!Number.isFinite(relationship.metric_value) || !relationship.metric_unit)) throw new Error(`Métrica objetiva sem valor numérico/unidade válida em ${relationship.id}`);
    checkDate(relationship.start_date, relationship.id); checkDate(relationship.end_date, relationship.id);
    if (relationship.start_date && relationship.end_date && relationship.start_date > relationship.end_date) throw new Error(`Intervalo temporal inválido em ${relationship.id}`);
  }
  const evidenceCount = new Map();
  for (const evidence of evidences) {
    requireForeignKey(relationshipIds, evidence.relationship_id, `Evidência ${evidence.id}`);
    requireForeignKey(sourceIds, evidence.source_id, `Evidência ${evidence.id}`);
    const relationship = relationships.find(item => item.id === evidence.relationship_id);
    const source = sources.find(item => item.id === evidence.source_id);
    if (relationship.investigation_id !== source.investigation_id) throw new Error(`Evidência ${evidence.id}: fonte e relacionamento pertencem a investigações diferentes`);
    evidenceCount.set(evidence.relationship_id, (evidenceCount.get(evidence.relationship_id) || 0) + 1);
  }
  for (const relationship of relationships) if (!evidenceCount.has(relationship.id)) throw new Error(`Regra de rigor violada: relacionamento ${relationship.id} não possui evidência vinculada`);

  const database = { schema_version: '2.0.0', generated_at: new Date().toISOString(), investigations, entities, investigation_entities, sources, relationships, evidences };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
  console.log(`Base ${database.schema_version} compilada: ${investigations.length} investigação, ${entities.length} entidades, ${relationships.length} relações e ${evidences.length} evidências.`);
  return database;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildDatabase();
