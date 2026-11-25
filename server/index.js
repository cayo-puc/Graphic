import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildCytoscapeGraph } from '../src/api/cytoscapeMapper.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.GRAPH_DATA_FILE || path.join(root, '..', 'data', 'graph.json');
let db = JSON.parse(await readFile(dbFile, 'utf8'));
const persist = async () => writeFile(dbFile, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
const statuses = new Set(['DOCUMENTED_FACT', 'OFFICIAL_ALLEGATION', 'REPORTED_SOURCE', 'UNCONFIRMED']);
const outcomes = new Set(['NOT_APPLICABLE', 'PENDING_JUDGMENT', 'SANCTIONED_ADMIN', 'ACQUITTED', 'SETTLED', 'CONVICTED_CRIMINAL']);
const entityTypes = new Set(['PERSON', 'COMPANY', 'ORGANIZATION', 'INSTITUTION', 'FINANCIAL_INSTITUTION', 'INVESTMENT_FUND', 'POLITICAL_PARTY', 'PUBLIC_BODY', 'ADMINISTRATIVE_PROCEEDING', 'JUDICIAL_PROCEEDING', 'ASSET_OR_TRANSACTION', 'PROCEDURAL_COHORT']);
const id = () => crypto.randomUUID();
const body = request => new Promise((resolve, reject) => {
  let content = '';
  request.on('data', chunk => { content += chunk; if (content.length > 1_000_000) reject(new Error('Corpo da requisição excede 1 MB')); });
  request.on('end', () => { try { resolve(JSON.parse(content || '{}')); } catch { reject(new Error('JSON inválido')); } });
});
const send = (response, code, value = null) => { response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(code === 204 ? '' : JSON.stringify(value)); };
const invById = investigationId => db.investigations.find(item => item.id === investigationId);
const entityById = entityId => db.entities.find(item => item.id === entityId);
const linkById = (investigationId, entityId) => db.investigation_entities.find(link => link.investigation_id === investigationId && link.entity_id === entityId);
const createEntityType = value => ({ INSTITUTION: 'INSTITUTION', PARTY: 'POLITICAL_PARTY', ORGANIZATION: 'ORGANIZATION' }[value] || value || 'ORGANIZATION');

function publicSource(source) {
  return { ...source, investigationId: source.investigation_id, documentType: source.source_type, reference: source.url || source.document_number || '', publishedAt: source.publication_date || '', description: source.issuing_body || '' };
}
function publicEntity(entity, investigationId) {
  const context = linkById(investigationId, entity.id);
  return { ...entity, id: entity.id, investigationId, name: entity.canonical_name, type: entity.entity_type, additional: entity.tax_or_reg_id || '', contextualRole: context?.contextual_role || null };
}
function publicRelationship(relationship) {
  const evs = db.evidences.filter(evidence => evidence.relationship_id === relationship.id).map(evidence => ({
    ...evidence, locationRef: evidence.location_ref, extractionNote: evidence.extraction_note,
    source: publicSource(db.sources.find(source => source.id === evidence.source_id) || {}),
  }));
  return { ...relationship, investigationId: relationship.investigation_id, sourceId: relationship.source_entity_id, targetId: relationship.target_entity_id, type: relationship.relation_type, directed: relationship.direction === 'DIRECTED', validFrom: relationship.start_date || '', validTo: relationship.end_date || '', status: relationship.epistemic_status, epistemicStatus: relationship.epistemic_status, legalOutcome: relationship.legal_outcome, metricValue: relationship.metric_value, metricUnit: relationship.metric_unit, sources: [...new Set(evs.map(evidence => evidence.source_id))], evidences: evs };
}
function workspace() {
  return {
    schemaVersion: db.schema_version,
    investigations: db.investigations.map(item => ({ ...item, name: item.title, description: item.description, createdAt: item.created_at })),
    entities: db.investigation_entities.flatMap(link => { const entity = entityById(link.entity_id); return entity ? [publicEntity(entity, link.investigation_id)] : []; }),
    relationships: db.relationships.map(publicRelationship),
    sources: db.sources.map(publicSource),
  };
}
function filteredRows(investigationId, filters = {}) {
  const graph = buildCytoscapeGraph(db, investigationId, filters);
  const entityIds = new Set(graph.elements.nodes.map(node => node.data.id));
  const relIds = new Set(graph.elements.edges.map(edge => edge.data.id));
  return {
    entities: db.entities.filter(entity => entityIds.has(entity.id)).map(entity => publicEntity(entity, investigationId)),
    relationships: db.relationships.filter(rel => relIds.has(rel.id)).map(publicRelationship),
    sources: db.sources.filter(source => source.investigation_id === investigationId).map(publicSource),
    elements: graph.elements,
    stats: graph.stats,
  };
}
function parseFilters(searchParams) {
  const list = key => searchParams.getAll(key).flatMap(value => value.split(',')).filter(Boolean);
  return { entityTypes: list('entityTypes'), relationTypes: list('relationTypes'), epistemicStatuses: list('epistemicStatuses'), legalOutcomes: list('legalOutcomes'), startDate: searchParams.get('startDate'), endDate: searchParams.get('endDate') };
}
function project(investigationId, filters = {}) {
  const relationships = db.relationships.filter(rel => rel.investigation_id === investigationId
    && (!filters.epistemicStatuses?.length || filters.epistemicStatuses.includes(rel.epistemic_status))
    && (!filters.legalOutcomes?.length || filters.legalOutcomes.includes(rel.legal_outcome))
    && (!filters.relationTypes?.length || filters.relationTypes.includes(rel.relation_type))
    && (!filters.startDate || !rel.end_date || rel.end_date >= filters.startDate)
    && (!filters.endDate || !rel.start_date || rel.start_date <= filters.endDate));
  const nodes = db.entities.filter(entity => linkById(investigationId, entity.id) && (!filters.entityTypes?.length || filters.entityTypes.includes(entity.entity_type)));
  const visible = new Set(nodes.map(node => node.id));
  return { nodes, relationships: relationships.filter(rel => visible.has(rel.source_entity_id) && visible.has(rel.target_entity_id)) };
}
function calculateMetrics(investigationId, filters = {}) {
  const { nodes, relationships } = project(investigationId, filters);
  const adjacency = new Map(nodes.map(node => [node.id, new Set()]));
  for (const rel of relationships) { adjacency.get(rel.source_entity_id)?.add(rel.target_entity_id); adjacency.get(rel.target_entity_id)?.add(rel.source_entity_id); }
  const degree = nodes.map(node => ({ entityId: node.id, name: node.canonical_name, value: adjacency.get(node.id)?.size || 0 })).sort((a, b) => b.value - a.value);
  const components = [], visited = new Set();
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const stack = [node.id], component = []; visited.add(node.id);
    while (stack.length) { const current = stack.pop(); component.push(current); for (const next of adjacency.get(current) || []) if (!visited.has(next)) { visited.add(next); stack.push(next); } }
    components.push(component);
  }
  const betweennessById = Object.fromEntries(nodes.map(node => [node.id, 0]));
  for (const source of nodes) {
    const stack = [], predecessors = new Map(nodes.map(node => [node.id, []]));
    const sigma = Object.fromEntries(nodes.map(node => [node.id, 0])), distance = Object.fromEntries(nodes.map(node => [node.id, -1]));
    sigma[source.id] = 1; distance[source.id] = 0; const queue = [source.id];
    while (queue.length) { const v = queue.shift(); stack.push(v); for (const w of adjacency.get(v) || []) { if (distance[w] < 0) { queue.push(w); distance[w] = distance[v] + 1; } if (distance[w] === distance[v] + 1) { sigma[w] += sigma[v]; predecessors.get(w).push(v); } } }
    const delta = Object.fromEntries(nodes.map(node => [node.id, 0]));
    while (stack.length) { const w = stack.pop(); for (const v of predecessors.get(w)) delta[v] += sigma[v] / sigma[w] * (1 + delta[w]); if (w !== source.id) betweennessById[w] += delta[w]; }
  }
  const n = nodes.length;
  if (n > 2) for (const key of Object.keys(betweennessById)) betweennessById[key] /= ((n - 1) * (n - 2));
  const betweenness = nodes.map(node => ({ entityId: node.id, name: node.canonical_name, value: +betweennessById[node.id].toFixed(4) })).sort((a, b) => b.value - a.value);
  const closeness = nodes.map(node => {
    const distances = new Map([[node.id, 0]]), queue = [node.id];
    while (queue.length) { const current = queue.shift(); for (const next of adjacency.get(current) || []) if (!distances.has(next)) { distances.set(next, distances.get(current) + 1); queue.push(next); } }
    const sum = [...distances.values()].filter(distance => distance > 0).reduce((total, distance) => total + 1 / distance, 0);
    return { entityId: node.id, name: node.canonical_name, value: n > 1 ? +(sum / (n - 1)).toFixed(4) : 0 };
  }).sort((a, b) => b.value - a.value);
  return { degree, betweenness, closeness, components: components.map(component => component.map(nodeId => entityById(nodeId)?.canonical_name)), componentCount: components.length, nodeCount: nodes.length, relationshipCount: relationships.length, methodology: 'Projeção simples não direcionada e sem pesos; vínculos paralelos contam uma vez.' };
}
function shortestPath(investigationId, from, to, filters = {}) {
  const { nodes, relationships } = project(investigationId, filters);
  const allowed = new Set(nodes.map(node => node.id));
  if (!allowed.has(from) || !allowed.has(to)) return null;
  const adjacency = new Map(nodes.map(node => [node.id, []]));
  for (const rel of relationships) { adjacency.get(rel.source_entity_id).push(rel.target_entity_id); if (rel.direction === 'UNDIRECTED') adjacency.get(rel.target_entity_id).push(rel.source_entity_id); }
  const previous = new Map([[from, null]]), queue = [from];
  while (queue.length && !previous.has(to)) { const current = queue.shift(); for (const next of adjacency.get(current) || []) if (!previous.has(next)) { previous.set(next, current); queue.push(next); } }
  if (!previous.has(to)) return [];
  const pathIds = []; for (let current = to; current !== null; current = previous.get(current)) pathIds.unshift(current);
  return pathIds.map(entityId => ({ id: entityId, name: entityById(entityId)?.canonical_name }));
}
function addEvidence(relationship, evidenceInput) {
  if (!evidenceInput?.excerpt?.trim()) throw new Error('Informe um trecho de evidência para o relacionamento.');
  let source;
  if (evidenceInput.sourceId) source = db.sources.find(item => item.id === evidenceInput.sourceId && item.investigation_id === relationship.investigation_id);
  else {
    if (!evidenceInput.sourceTitle?.trim()) throw new Error('Informe o título da fonte da evidência.');
    source = { id: id(), investigation_id: relationship.investigation_id, title: evidenceInput.sourceTitle.trim(), source_type: evidenceInput.sourceType || 'DOCUMENT', issuing_body: evidenceInput.issuingBody || null, document_number: evidenceInput.documentNumber || null, publication_date: evidenceInput.publicationDate || null, url: evidenceInput.url || null, reliability_tier: evidenceInput.reliabilityTier || 'USER_PROVIDED' };
    db.sources.push(source);
  }
  if (!source) throw new Error('Fonte não encontrada nesta investigação.');
  const evidence = { id: id(), relationship_id: relationship.id, source_id: source.id, location_ref: evidenceInput.locationRef || null, excerpt: evidenceInput.excerpt.trim(), extraction_note: evidenceInput.extractionNote || null };
  db.evidences.push(evidence); return evidence;
}

export const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost'); const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); return response.end(); }
    if (parts[0] !== 'api') return send(response, 404, { error: 'Rota não encontrada' });
    if (request.method === 'GET' && parts.length === 1) return send(response, 200, workspace());
    if (request.method === 'GET' && parts[1] === 'investigations' && parts[2] && parts[3] === 'graph') {
      const investigation = invById(parts[2]); if (!investigation) return send(response, 404, { error: 'Investigação não encontrada' });
      const filters = parseFilters(url.searchParams); const rows = filteredRows(parts[2], filters);
      const mapped = buildCytoscapeGraph(db, parts[2], filters);
      return send(response, 200, { ...rows, elements: mapped.elements, stats: mapped.stats, investigation: { ...investigation, methodology_notice: investigation.methodology_notice || investigation.description } });
    }
    if (request.method === 'GET' && parts[1] === 'investigations' && parts[2] && parts[3] === 'metrics') {
      if (!invById(parts[2])) return send(response, 404, { error: 'Investigação não encontrada' });
      return send(response, 200, calculateMetrics(parts[2], parseFilters(url.searchParams)));
    }
    if (request.method === 'GET' && parts[1] === 'investigations' && parts[2] && parts[3] === 'path') {
      if (!invById(parts[2])) return send(response, 404, { error: 'Investigação não encontrada' });
      const path = shortestPath(parts[2], url.searchParams.get('from'), url.searchParams.get('to'), parseFilters(url.searchParams));
      return path === null ? send(response, 400, { error: 'Entidades inválidas para esta investigação ou filtros' }) : send(response, 200, { path });
    }
    if (request.method === 'POST' && parts[1] === 'investigations') {
      const input = await body(request); if (!input.name?.trim()) return send(response, 400, { error: 'Nome é obrigatório' });
      const investigation = { id: id(), title: input.name.trim(), description: input.description || '', status: 'ACTIVE', created_at: new Date().toISOString(), methodology_notice: input.methodologyNotice || null };
      db.investigations.push(investigation); await persist(); return send(response, 201, { ...investigation, name: investigation.title, createdAt: investigation.created_at });
    }
    if (parts[1] === 'investigations' && parts[2]) {
      const investigation = invById(parts[2]); if (!investigation) return send(response, 404, { error: 'Investigação não encontrada' });
      if (request.method === 'PUT') { const input = await body(request); if (input.status) investigation.status = input.status; if (input.description !== undefined) investigation.description = input.description; await persist(); return send(response, 200, { ...investigation, name: investigation.title, createdAt: investigation.created_at }); }
      if (request.method === 'DELETE') { if (db.investigation_entities.some(link => link.investigation_id === investigation.id)) return send(response, 409, { error: 'A investigação contém entidades; arquive para preservar os registros.' }); db.investigations = db.investigations.filter(item => item.id !== investigation.id); await persist(); return send(response, 204); }
    }
    if (request.method === 'POST' && parts[1] === 'entities') {
      const input = await body(request); const investigationId = input.investigationId;
      if (!invById(investigationId) || !input.name?.trim()) return send(response, 400, { error: 'Nome e investigação válida são obrigatórios' });
      const type = createEntityType(input.type); if (!entityTypes.has(type)) return send(response, 400, { error: `Tipo de entidade inválido: ${type}` });
      const entity = { id: id(), canonical_name: input.name.trim(), entity_type: type, aliases: [], tax_or_reg_id: input.additional || null, description: input.description || '', metadata: {} };
      db.entities.push(entity); db.investigation_entities.push({ id: id(), investigation_id: investigationId, entity_id: entity.id, contextual_role: input.contextualRole || 'SUBJECT', notes: null });
      await persist(); return send(response, 201, publicEntity(entity, investigationId));
    }
    if (parts[1] === 'entities' && parts[2] && request.method === 'PUT') {
      const entity = entityById(parts[2]); if (!entity) return send(response, 404, { error: 'Entidade não encontrada' });
      const input = await body(request); const type = createEntityType(input.type || entity.entity_type); if (!entityTypes.has(type)) return send(response, 400, { error: `Tipo de entidade inválido: ${type}` });
      entity.canonical_name = input.name?.trim() || entity.canonical_name; entity.entity_type = type; entity.description = input.description ?? entity.description; entity.tax_or_reg_id = input.additional ?? entity.tax_or_reg_id;
      await persist(); return send(response, 200, publicEntity(entity, input.investigationId || db.investigation_entities.find(link => link.entity_id === entity.id)?.investigation_id));
    }
    if (parts[1] === 'entities' && parts[2] && request.method === 'DELETE') {
      const entity = entityById(parts[2]); if (!entity) return send(response, 404, { error: 'Entidade não encontrada' });
      const investigationId = url.searchParams.get('investigationId'); if (!investigationId || !linkById(investigationId, entity.id)) return send(response, 400, { error: 'investigationId válido é obrigatório para remover o vínculo contextual' });
      const removedRelationships = new Set(db.relationships.filter(rel => rel.investigation_id === investigationId && (rel.source_entity_id === entity.id || rel.target_entity_id === entity.id)).map(rel => rel.id));
      db.relationships = db.relationships.filter(rel => !removedRelationships.has(rel.id)); db.evidences = db.evidences.filter(evidence => !removedRelationships.has(evidence.relationship_id));
      db.investigation_entities = db.investigation_entities.filter(link => !(link.investigation_id === investigationId && link.entity_id === entity.id));
      if (!db.investigation_entities.some(link => link.entity_id === entity.id)) db.entities = db.entities.filter(item => item.id !== entity.id);
      await persist(); return send(response, 204);
    }
    if (request.method === 'POST' && parts[1] === 'relationships') {
      const input = await body(request); const investigationId = input.investigationId;
      if (!invById(investigationId) || !linkById(investigationId, input.sourceId) || !linkById(investigationId, input.targetId) || input.sourceId === input.targetId) return send(response, 400, { error: 'Investigação e entidades de origem/destino válidas são obrigatórias' });
      const epistemicStatus = input.epistemicStatus || input.status; const legalOutcome = input.legalOutcome || 'NOT_APPLICABLE';
      if (!statuses.has(epistemicStatus) || !outcomes.has(legalOutcome)) return send(response, 400, { error: 'Status epistêmico ou desfecho jurídico inválido' });
      if (!input.evidence?.excerpt?.trim()) return send(response, 400, { error: 'Toda relação precisa de ao menos uma evidência com trecho e fonte.' });
      const relationship = { id: id(), investigation_id: investigationId, source_entity_id: input.sourceId, target_entity_id: input.targetId, relation_type: input.type || 'OTHER', direction: input.directed ? 'DIRECTED' : 'UNDIRECTED', start_date: input.validFrom || null, end_date: input.validTo || null, epistemic_status: epistemicStatus, legal_outcome: legalOutcome, metric_value: input.metricValue === '' || input.metricValue == null ? null : Number(input.metricValue), metric_unit: input.metricUnit || null, description: input.description || '' };
      if (relationship.metric_value !== null && (!Number.isFinite(relationship.metric_value) || !relationship.metric_unit)) return send(response, 400, { error: 'Uma métrica numérica exige unidade objetiva documentada.' });
      db.relationships.push(relationship);
      try { addEvidence(relationship, input.evidence); } catch (error) { db.relationships.pop(); return send(response, 400, { error: error.message }); }
      await persist(); return send(response, 201, publicRelationship(relationship));
    }
    if (parts[1] === 'relationships' && parts[2] && request.method === 'PUT') {
      const relationship = db.relationships.find(item => item.id === parts[2]); if (!relationship) return send(response, 404, { error: 'Relacionamento não encontrado' });
      const input = await body(request); const epistemicStatus = input.epistemicStatus || input.status;
      if (epistemicStatus && !statuses.has(epistemicStatus)) return send(response, 400, { error: 'Status epistêmico inválido' });
      if (input.legalOutcome && !outcomes.has(input.legalOutcome)) return send(response, 400, { error: 'Desfecho jurídico inválido' });
      if (input.sourceId && (!linkById(relationship.investigation_id, input.sourceId) || !linkById(relationship.investigation_id, input.targetId) || input.sourceId === input.targetId)) return send(response, 400, { error: 'Entidades inválidas para este relacionamento' });
      relationship.source_entity_id = input.sourceId || relationship.source_entity_id; relationship.target_entity_id = input.targetId || relationship.target_entity_id;
      relationship.relation_type = input.type || relationship.relation_type; relationship.direction = input.directed === undefined ? relationship.direction : input.directed ? 'DIRECTED' : 'UNDIRECTED';
      relationship.start_date = input.validFrom ?? relationship.start_date; relationship.end_date = input.validTo ?? relationship.end_date;
      relationship.epistemic_status = epistemicStatus || relationship.epistemic_status; relationship.legal_outcome = input.legalOutcome || relationship.legal_outcome;
      relationship.description = input.description ?? relationship.description;
      if (input.evidence?.excerpt?.trim()) addEvidence(relationship, input.evidence);
      await persist(); return send(response, 200, publicRelationship(relationship));
    }
    if (parts[1] === 'relationships' && parts[2] && request.method === 'DELETE') {
      const relationship = db.relationships.find(item => item.id === parts[2]); if (!relationship) return send(response, 404, { error: 'Relacionamento não encontrado' });
      db.relationships = db.relationships.filter(item => item.id !== relationship.id); db.evidences = db.evidences.filter(evidence => evidence.relationship_id !== relationship.id);
      await persist(); return send(response, 204);
    }
    if (request.method === 'POST' && parts[1] === 'evidences') {
      const input = await body(request); const relationship = db.relationships.find(item => item.id === input.relationshipId);
      if (!relationship) return send(response, 404, { error: 'Relacionamento não encontrado' });
      const evidence = addEvidence(relationship, input); await persist(); return send(response, 201, evidence);
    }
    if (request.method === 'POST' && parts[1] === 'sources') {
      const input = await body(request); if (!invById(input.investigationId) || !input.title?.trim()) return send(response, 400, { error: 'Título e investigação válida são obrigatórios' });
      const source = { id: id(), investigation_id: input.investigationId, title: input.title.trim(), source_type: input.documentType || 'DOCUMENT', issuing_body: input.issuingBody || null, document_number: input.documentNumber || null, publication_date: input.publishedAt || null, url: input.reference || null, reliability_tier: input.reliabilityTier || 'USER_PROVIDED' };
      db.sources.push(source); await persist(); return send(response, 201, publicSource(source));
    }
    return send(response, 404, { error: 'Rota não encontrada' });
  } catch (error) { return send(response, 500, { error: error.message || 'Erro interno' }); }
});

const apiPort = Number(process.env.API_PORT || 3101);
if (process.env.NODE_ENV !== 'test') server.listen(apiPort, '127.0.0.1', () => {
  const investigationNames = db.investigations.map(item => item.title).join(' | ');
  console.log(`GRAPH API em http://127.0.0.1:${apiPort}`);
  console.log(`Base carregada: ${db.investigations.length} investigações — ${investigationNames}`);
});
