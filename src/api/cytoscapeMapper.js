export function buildCytoscapeGraph(db, investigationId, filters = {}) {
  const { entityTypes = [], relationTypes = [], epistemicStatuses = [], legalOutcomes = [], startDate = null, endDate = null } = filters;
  const memberships = db.investigation_entities.filter(link => link.investigation_id === investigationId);
  const allowed = new Set(memberships.map(link => link.entity_id));
  const roleById = new Map(memberships.map(link => [link.entity_id, link]));
  const entities = db.entities.filter(entity => allowed.has(entity.id) && (!entityTypes.length || entityTypes.includes(entity.entity_type)));
  const visible = new Set(entities.map(entity => entity.id));
  const sources = new Map(db.sources.map(source => [source.id, source]));
  const evidencesByRelationship = new Map();
  for (const evidence of db.evidences) {
    if (!evidencesByRelationship.has(evidence.relationship_id)) evidencesByRelationship.set(evidence.relationship_id, []);
    const source = sources.get(evidence.source_id);
    evidencesByRelationship.get(evidence.relationship_id).push({
      id: evidence.id,
      locationRef: evidence.location_ref,
      excerpt: evidence.excerpt,
      extractionNote: evidence.extraction_note,
      source: source ? { ...source } : null,
    });
  }
  const relationships = db.relationships.filter(rel => {
    if (rel.investigation_id !== investigationId || !visible.has(rel.source_entity_id) || !visible.has(rel.target_entity_id)) return false;
    if (relationTypes.length && !relationTypes.includes(rel.relation_type)) return false;
    if (epistemicStatuses.length && !epistemicStatuses.includes(rel.epistemic_status)) return false;
    if (legalOutcomes.length && !legalOutcomes.includes(rel.legal_outcome)) return false;
    if (startDate && rel.end_date && rel.end_date < startDate) return false;
    if (endDate && rel.start_date && rel.start_date > endDate) return false;
    return true;
  });
  const nodes = entities.map(entity => {
    const context = roleById.get(entity.id);
    return { data: { id: entity.id, label: entity.canonical_name, type: entity.entity_type, aliases: entity.aliases, taxOrRegId: entity.tax_or_reg_id, contextualRole: context?.contextual_role || null, description: entity.description, metadata: entity.metadata } };
  });
  const edges = relationships.map(rel => ({ data: {
    id: rel.id, source: rel.source_entity_id, target: rel.target_entity_id, label: rel.relation_type,
    directed: rel.direction === 'DIRECTED', startDate: rel.start_date, endDate: rel.end_date,
    epistemicStatus: rel.epistemic_status, legalOutcome: rel.legal_outcome,
    metricValue: rel.metric_value, metricUnit: rel.metric_unit, description: rel.description,
    evidences: evidencesByRelationship.get(rel.id) || [],
  } }));
  return { investigationId, stats: { nodeCount: nodes.length, edgeCount: edges.length }, elements: { nodes, edges } };
}
