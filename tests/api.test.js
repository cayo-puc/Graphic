import assert from 'node:assert/strict';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let server, base, temp;
const request = async (route, payload, method) => {
  const response = await fetch(base + route, { method: method || (payload ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
};
const run = async () => {
  temp = await mkdtemp(path.join(os.tmpdir(), 'graph-v2-test-'));
  process.env.NODE_ENV = 'test'; process.env.GRAPH_DATA_FILE = path.join(temp, 'graph.json');
  await copyFile(path.join(root, 'data', 'graph.json'), process.env.GRAPH_DATA_FILE);
  const { server: apiServer } = await import('../server/index.js'); server = apiServer;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}/api`;

  const seed = await request('/');
  assert.equal(seed.data.schemaVersion, '2.0.0');
  assert(seed.data.relationships.length >= 61);
  const cvm = seed.data.investigations.find(item => item.id === 'INV-MASTER-001');
  assert(cvm);
  const cvmGraph = await request(`/investigations/${cvm.id}/graph`);
  assert(cvmGraph.data.elements.edges.every(edge => edge.data.evidences.length > 0));
  const relationCite = cvmGraph.data.elements.edges.find(edge => edge.data.id === 'REL-002');
  assert.equal(relationCite.data.legalOutcome, 'NOT_APPLICABLE');
  assert(relationCite.data.evidences.some(item => item.excerpt.includes('16.783.000')));

  const investigation = await request('/investigations', { name: 'Teste do modelo v2', description: 'Fixture automatizada' });
  assert.equal(investigation.status, 201); const investigationId = investigation.data.id;
  const addEntity = name => request('/entities', { investigationId, name, type: 'PERSON', description: 'Fixture' });
  const a = await addEntity('Entidade A'), b = await addEntity('Entidade B');
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  const source = await request('/sources', { investigationId, title: 'Fonte compartilhável', documentType: 'TEST', reference: 'Fixture' });
  const relationshipInput = { investigationId, sourceId: a.data.id, targetId: b.data.id, type: 'TEST_LINK', description: 'Relação sustentada', directed: false, epistemicStatus: 'DOCUMENTED_FACT', legalOutcome: 'NOT_APPLICABLE', validFrom: '2024-01-01', evidence: { sourceId: source.data.id, locationRef: 'Página 2', excerpt: 'Trecho que sustenta o vínculo.', extractionNote: 'Nota fixture' } };
  const noEvidence = await request('/relationships', { ...relationshipInput, evidence: undefined });
  assert.equal(noEvidence.status, 400);
  const relationship = await request('/relationships', relationshipInput);
  assert.equal(relationship.status, 201);
  const detail = await request(`/investigations/${investigationId}/graph`);
  assert.equal(detail.data.relationships[0].evidences[0].source.title, 'Fonte compartilhável');
  assert.equal(detail.data.relationships[0].evidences[0].locationRef, 'Página 2');
  const metrics = await request(`/investigations/${investigationId}/metrics`);
  assert.equal(metrics.data.componentCount, 1); assert.deepEqual(metrics.data.degree.map(row => row.value), [1, 1]);
  assert.equal(metrics.data.closeness[0].value, 1);
  const pathResult = await request(`/investigations/${investigationId}/path?from=${a.data.id}&to=${b.data.id}`);
  assert.deepEqual(pathResult.data.path.map(item => item.id), [a.data.id, b.data.id]);
  const edited = await request(`/entities/${a.data.id}`, { name: 'Entidade A editada', type: 'PERSON', description: 'Atualizada', investigationId }, 'PUT');
  assert.equal(edited.data.name, 'Entidade A editada');
  const deleted = await request(`/relationships/${relationship.data.id}`, null, 'DELETE'); assert.equal(deleted.status, 204);
  const remainingSources = await request('/'); assert(remainingSources.data.sources.some(item => item.id === source.data.id));
  console.log('✓ esquema v2, mapper/evidências, fonte desacoplada, CRUD, métricas e caminho');

  const makeGraph = async (name, count, edges) => {
    const inv = (await request('/investigations', { name })).data; const nodes = [];
    for (let i = 0; i < count; i += 1) nodes.push((await request('/entities', { investigationId: inv.id, name: `${name}-${i}`, type: 'ORGANIZATION' })).data.id);
    for (const [u, v] of edges) await request('/relationships', { investigationId: inv.id, sourceId: nodes[u], targetId: nodes[v], type: 'TEST', epistemicStatus: 'DOCUMENTED_FACT', legalOutcome: 'NOT_APPLICABLE', directed: false, evidence: { sourceTitle: 'Fixture', locationRef: 'Synthetic', excerpt: 'Synthetic test evidence' } });
    return request(`/investigations/${inv.id}/metrics`);
  };
  const pathGraph = await makeGraph('Caminho', 4, [[0, 1], [1, 2], [2, 3]]);
  assert.deepEqual(pathGraph.data.degree.map(row => row.value), [2, 2, 1, 1]); assert.equal(pathGraph.data.betweenness[0].value, 0.6667); assert.equal(pathGraph.data.closeness[0].value, 0.8333);
  const star = await makeGraph('Estrela', 5, [[0, 1], [0, 2], [0, 3], [0, 4]]); assert.equal(star.data.degree[0].value, 4); assert.equal(star.data.betweenness[0].value, 1);
  const cycle = await makeGraph('Ciclo', 4, [[0, 1], [1, 2], [2, 3], [3, 0]]); assert.equal(cycle.data.componentCount, 1);
  const disconnected = await makeGraph('Desconexo', 5, [[0, 1], [1, 2], [3, 4]]); assert.equal(disconnected.data.componentCount, 2);
  console.log('✓ métricas não ponderadas: caminho, estrela, ciclo e componentes desconexos');
};
try { await run(); }
catch (error) { console.error(error); process.exitCode = 1; }
finally { if (server) await new Promise(resolve => server.close(resolve)); if (temp) await rm(temp, { recursive: true, force: true }); delete process.env.GRAPH_DATA_FILE; delete process.env.NODE_ENV; }
