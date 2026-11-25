import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import cytoscape from 'cytoscape';
import { Activity, ChevronDown, CircleHelp, FileText, Filter, FolderKanban, GitBranch, LayoutDashboard, Maximize2, Minimize2, Network, Plus, Search, ShieldAlert, Users, X, ZoomIn, ZoomOut, BarChart3 } from 'lucide-react';
import './style.css';
import './workspace.css';
import './interaction.css';

const api = async (path, options) => {
  const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    let payload = {};
    try { payload = await response.json(); } catch { /* response may be empty */ }
    throw new Error(payload.error || 'Falha ao comunicar com a GRAPH');
  }
  return response.status === 204 ? null : response.json();
};
const types = { PERSON: 'Pessoa', COMPANY: 'Empresa', ORGANIZATION: 'Organização', INSTITUTION: 'Instituição', FINANCIAL_INSTITUTION: 'Instituição financeira', INVESTMENT_FUND: 'Fundo de investimento', POLITICAL_PARTY: 'Partido político', PUBLIC_BODY: 'Órgão público', ADMINISTRATIVE_PROCEEDING: 'Processo administrativo', JUDICIAL_PROCEEDING: 'Processo judicial', ASSET_OR_TRANSACTION: 'Ativo ou transação', PROCEDURAL_COHORT: 'Grupo processual' };
const reltypes = { CORPORATE: 'Societário', PROFESSIONAL: 'Profissional', INSTITUTIONAL: 'Institucional', POLITICAL: 'Político', FINANCIAL: 'Financeiro', OTHER: 'Outro' };
const statuses = { DOCUMENTED_FACT: 'Fato documentado', OFFICIAL_ALLEGATION: 'Imputação oficial', REPORTED_SOURCE: 'Fonte reportada', UNCONFIRMED: 'Não confirmado' };
const outcomes = { NOT_APPLICABLE: 'Não aplicável', PENDING_JUDGMENT: 'Aguardando julgamento', SANCTIONED_ADMIN: 'Sanção administrativa', ACQUITTED: 'Absolvido da imputação', SETTLED: 'Termo de compromisso', CONVICTED_CRIMINAL: 'Condenação criminal' };
const colors = { PERSON: '#61d6b0', COMPANY: '#83a6ff', ORGANIZATION: '#9bb3a6', INSTITUTION: '#c391f5', FINANCIAL_INSTITUTION: '#67c6e8', INVESTMENT_FUND: '#e1bc69', POLITICAL_PARTY: '#ff9d68', PUBLIC_BODY: '#cf91b8', ADMINISTRATIVE_PROCEEDING: '#f08080', JUDICIAL_PROCEEDING: '#de9d69', ASSET_OR_TRANSACTION: '#a4bb75', PROCEDURAL_COHORT: '#b393d6' };
const emptyData = { investigations: [], entities: [], relationships: [], sources: [] };

function App() {
  const [data, setData] = useState(emptyData), [selected, setSelected] = useState(''), [page, setPage] = useState('Overview');
  const [showAnalytics, setShowAnalytics] = useState(false), [showFilters, setShowFilters] = useState(false), [showPath, setShowPath] = useState(false);
  const [query, setQuery] = useState(''), [metrics, setMetrics] = useState(null), [graph, setGraph] = useState(null), [active, setActive] = useState(null);
  const [filterType, setFilterType] = useState('ALL'), [filterRel, setFilterRel] = useState('ALL'), [filterStatus, setFilterStatus] = useState('ALL'), [filterLegal, setFilterLegal] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(''), [dateTo, setDateTo] = useState(''), [pathFrom, setPathFrom] = useState(''), [pathTo, setPathTo] = useState(''), [pathResult, setPathResult] = useState(null);
  const [modal, setModal] = useState(''), [editing, setEditing] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [toast, setToast] = useState('');
  const cyRef = useRef(null), cyObj = useRef(null), hoverTimer = useRef(null), pinnedRef = useRef(false), graphLayoutRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const investigation = data.investigations.find(item => item.id === selected);

  const refresh = async () => {
    try {
      const result = await api(''); setData(result);
      if (!result.investigations.some(item => item.id === selected)) {
        setSelected(result.investigations[0]?.id || '');
        pinnedRef.current = false;
        setGraph(null); setMetrics(null); setActive(null); setPathResult(null);
      }
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const onFullscreenChange = () => {
      const fullscreen = document.fullscreenElement === graphLayoutRef.current;
      setIsFullscreen(fullscreen);
      requestAnimationFrame(() => { cyObj.current?.resize(); cyObj.current?.fit(undefined, 55); });
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  useEffect(() => {
    if (!selected) { setGraph(null); setMetrics(null); return; }
    let cancelled = false;
    const qs = new URLSearchParams();
    if (filterStatus !== 'ALL') qs.set('epistemicStatuses', filterStatus);
    if (filterLegal !== 'ALL') qs.set('legalOutcomes', filterLegal);
    if (filterRel !== 'ALL') qs.set('relationTypes', filterRel);
    if (filterType !== 'ALL') qs.set('entityTypes', filterType);
    if (dateFrom) qs.set('startDate', dateFrom);
    if (dateTo) qs.set('endDate', dateTo);
    setGraph(null); setMetrics(null);
    Promise.all([api(`/investigations/${selected}/graph`), api(`/investigations/${selected}/metrics?${qs}`)])
      .then(([g, m]) => { if (!cancelled) { setGraph(g); setMetrics(m); setError(''); } })
      .catch(err => { if (!cancelled) { setGraph(null); setMetrics(null); setError(err.message); } });
    return () => { cancelled = true; };
  }, [selected, data, filterStatus, filterLegal, filterRel, filterType, dateFrom, dateTo]);

  const filteredEntities = useMemo(() => data.entities.filter(entity => entity.investigationId === selected && (filterType === 'ALL' || entity.type === filterType)), [data, selected, filterType]);
  const filteredRel = useMemo(() => data.relationships.filter(rel => rel.investigationId === selected && (filterRel === 'ALL' || rel.type === filterRel) && (filterStatus === 'ALL' || rel.epistemicStatus === filterStatus) && (filterLegal === 'ALL' || rel.legalOutcome === filterLegal) && (!dateFrom || !rel.validTo || rel.validTo >= dateFrom) && (!dateTo || !rel.validFrom || rel.validFrom <= dateTo) && filteredEntities.some(e => e.id === rel.sourceId) && filteredEntities.some(e => e.id === rel.targetId)), [data, selected, filterRel, filterStatus, filterLegal, dateFrom, dateTo, filteredEntities]);

  useEffect(() => {
    if (!cyRef.current || !graph) return;
    cyObj.current?.destroy();
    const degreeById = new Map(filteredEntities.map(entity => [entity.id, filteredRel.filter(rel => rel.sourceId === entity.id || rel.targetId === entity.id).length]));
    const elements = [
      ...filteredEntities.map(e => ({ data: { id: e.id, label: e.name, type: e.type, degree: degreeById.get(e.id) || 0 } })),
      ...filteredRel.map(r => ({ data: { id: r.id, source: r.sourceId, target: r.targetId, label: reltypes[r.type] || r.type.replaceAll('_', ' '), directed: r.directed, status: r.epistemicStatus }, classes: `${r.type} ${r.epistemicStatus}`.toLowerCase() })),
    ];
    const cy = cytoscape({ container: cyRef.current, elements, style: [
      { selector: 'node', style: { 'background-color': ele => colors[ele.data('type')] || '#42c8a5', shape: ele => ({ PERSON: 'ellipse', COMPANY: 'round-rectangle', INSTITUTION: 'diamond', PARTY: 'hexagon', ORGANIZATION: 'rectangle' }[ele.data('type')] || 'ellipse'), label: 'data(label)', color: '#f4f5f3', 'font-size': 11, 'font-family': 'Inter, sans-serif', 'text-wrap': 'wrap', 'text-max-width': 110, 'text-valign': 'bottom', 'text-margin-y': 9, width: ele => 38 + Math.min(ele.data('degree') * 4, 22), height: ele => 38 + Math.min(ele.data('degree') * 4, 22), 'border-width': 2, 'border-color': '#172322' } },
      { selector: 'edge', style: { width: 2, 'line-color': '#45615b', 'target-arrow-color': '#45615b', 'target-arrow-shape': ele => ele.data('directed') ? 'triangle' : 'none', 'curve-style': 'bezier', label: '', 'font-size': 9, color: '#c6d1ca', 'text-background-color': '#121b19', 'text-background-opacity': 1, 'text-background-padding': 3 } },
      { selector: 'edge.hover, edge.pinned, edge:selected', style: { label: 'data(label)', width: 3, 'line-color': '#6fcda8', 'target-arrow-color': '#6fcda8', 'z-index': 10 } },
      { selector: 'node.hover, node.pinned', style: { 'border-color': '#f1a35d', 'border-width': 4, 'z-index': 10 } },
      { selector: '.official_allegation, .unconfirmed', style: { 'line-style': 'dashed', 'line-color': '#e9ad58', 'target-arrow-color': '#e9ad58' } },
      { selector: ':selected', style: { 'border-color': '#f1a35d', 'border-width': 4 } },
      { selector: '.path-muted', style: { opacity: 0.12 } },
    ], layout: { name: 'cose', animate: true, animationDuration: 900, randomize: true, numIter: 1800, idealEdgeLength: 210, edgeElasticity: 90, nodeRepulsion: 6200, componentSpacing: 180, gravity: 0.12, padding: 90 }, minZoom: 0.12, maxZoom: 2.5 });
    const inspect = (kind, event, pin = false) => {
      if (!pin && pinnedRef.current) return;
      clearTimeout(hoverTimer.current);
      const item = kind === 'entity' ? data.entities.find(x => x.id === event.target.id()) : data.relationships.find(x => x.id === event.target.id());
      if (item) {
        if (pin) {
          pinnedRef.current = true;
          cy.elements().unselect().removeClass('pinned hover');
          event.target.select().addClass('pinned');
        } else event.target.addClass('hover');
        setActive({ kind, item, pinned: pin });
      }
    };
    const clearHover = event => {
      event.target.removeClass('hover');
      if (!pinnedRef.current) hoverTimer.current = setTimeout(() => setActive(null), 420);
    };
    cy.on('mouseover', 'node', event => inspect('entity', event));
    cy.on('mouseover', 'edge', event => inspect('rel', event));
    cy.on('mouseout', 'node, edge', clearHover);
    cy.on('tap', 'node', event => inspect('entity', event, true));
    cy.on('tap', 'edge', event => inspect('rel', event, true));
    cy.on('tap', event => { if (event.target === cy) { pinnedRef.current = false; cy.elements().unselect().removeClass('pinned hover'); setActive(null); } });
    cyObj.current = cy;
    return () => cy.destroy();
  }, [graph, filteredEntities, filteredRel]);

  useEffect(() => {
    const cy = cyObj.current;
    if (!cy || !pathResult) return;
    const ids = new Set(pathResult.map(item => item.id));
    cy.elements().removeClass('path-muted');
    cy.nodes().filter(node => !ids.has(node.id())).addClass('path-muted');
    cy.edges().filter(edge => !ids.has(edge.data('source')) || !ids.has(edge.data('target'))).addClass('path-muted');
  }, [pathResult, graph]);

  const notify = message => { setToast(message); setTimeout(() => setToast(''), 2500); };
  const openModal = (kind, item = null) => { setError(''); setEditing(item); setModal(kind); };
  const submit = async event => {
    event.preventDefault(); setError(''); setBusy(true);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const evidence = modal === 'relationship' ? { sourceTitle: form.sourceTitle, sourceType: form.sourceType, issuingBody: form.issuingBody, documentNumber: form.documentNumber, publicationDate: form.publicationDate, url: form.sourceUrl, locationRef: form.locationRef, excerpt: form.excerpt, extractionNote: form.extractionNote } : undefined;
      const opts = { method: editing ? 'PUT' : 'POST', body: JSON.stringify({ ...form, evidence, investigationId: selected, ...(modal === 'relationship' ? { directed: form.directed === 'true' || form.directed === 'on', epistemicStatus: form.epistemicStatus, legalOutcome: form.legalOutcome } : {}) }) };
      if (modal === 'entity') await api(editing ? `/entities/${editing.id}` : '/entities', opts);
      if (modal === 'relationship') await api(editing ? `/relationships/${editing.id}` : '/relationships', opts);
      if (modal === 'source') await api('/sources', { method: 'POST', body: JSON.stringify({ ...form, investigationId: selected }) });
      if (modal === 'investigation') { const created = await api('/investigations', { method: 'POST', body: JSON.stringify(form) }); setSelected(created.id); }
      await refresh(); setModal(''); setEditing(null); notify('Alterações salvas');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const remove = async (kind, item) => {
    if (!window.confirm(`Excluir ${kind === 'entity' ? 'entidade e vínculos' : 'relacionamento e fontes associadas'}?`)) return;
    try { await api(`/${kind === 'entity' ? 'entities' : 'relationships'}/${item.id}${kind === 'entity' ? `?investigationId=${encodeURIComponent(selected)}` : ''}`, { method: 'DELETE' }); setActive(null); setPathResult(null); await refresh(); notify('Registro excluído'); }
    catch (err) { setError(err.message); }
  };
  const findPath = async () => {
    if (!pathFrom || !pathTo) { setError('Selecione a origem e o destino do caminho.'); return; }
    const params = new URLSearchParams({ from: pathFrom, to: pathTo });
    if (filterStatus !== 'ALL') params.set('epistemicStatuses', filterStatus);
    if (filterLegal !== 'ALL') params.set('legalOutcomes', filterLegal);
    if (filterRel !== 'ALL') params.set('relationTypes', filterRel);
    if (filterType !== 'ALL') params.set('entityTypes', filterType);
    if (dateFrom) params.set('startDate', dateFrom); if (dateTo) params.set('endDate', dateTo);
    try { const result = await api(`/investigations/${selected}/path?${params}`); setPathResult(result.path); }
    catch (err) { setError(err.message); }
  };
  const relationshipNames = rel => `${data.entities.find(e => e.id === rel.sourceId)?.name || '—'} → ${data.entities.find(e => e.id === rel.targetId)?.name || '—'}`;
  const supportingEntityEvidences = active?.kind === 'entity' ? data.relationships
    .filter(rel => rel.investigationId === selected && (rel.sourceId === active.item.id || rel.targetId === active.item.id))
    .flatMap(rel => (rel.evidences || []).map(evidence => ({ ...evidence, relationshipLabel: relationshipNames(rel) }))) : [];
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === graphLayoutRef.current) await document.exitFullscreen();
      else await graphLayoutRef.current?.requestFullscreen();
    } catch (err) { setError(`Não foi possível abrir o grafo em tela cheia: ${err.message}`); }
  };
  const availableRelationTypes = [...new Set([...Object.keys(reltypes), ...data.relationships.filter(rel => rel.investigationId === selected).map(rel => rel.type)])];
  const pageTitle = page === 'Graph' ? investigation?.name || 'Investigação' : 'Investigações';

  return <div className="shell">
    <aside className="sidebar"><div className="brand"><div className="brandmark"><Network size={19}/></div><div><b>GRAPH</b><small>ANÁLISE DE REDES</small></div></div><div className="nav-label">WORKSPACE</div><nav><button className={`navitem ${page === 'Overview' ? 'active' : ''}`} onClick={() => setPage('Overview')}><LayoutDashboard size={17}/>Investigações</button>{page === 'Graph' && <button className="navitem active"><Network size={17}/>Rede aberta<span className="nav-live"/></button>}</nav><div className="sidebar-bottom"><div className="storage-card"><span className="status-dot"/> Dados locais <span>JSON</span></div><div className="user-card"><div className="avatar">GR</div><div><b>GRAPH</b><small>Pesquisa local</small></div></div></div></aside>
    <main className="main"><header className="topbar"><div className="crumb"><span>GRAPH</span><span className="slash">/</span><b>{pageTitle}</b></div><div className="top-actions"><span className="secure"><span className="status-dot"/> Ambiente local</span><CircleHelp size={17}/><div className="avatar small">GR</div></div></header>
      <section className={`content ${page === 'Graph' ? 'graph-content' : 'overview-content'}`}>{page === 'Overview' && <div className="page-heading"><div><div className="eyebrow">WORKSPACE DE PESQUISA</div><h1>Investigações</h1><p>Escolha uma investigação para abrir e explorar sua rede.</p></div><button className="primary" onClick={() => openModal('investigation')}><Plus size={16}/> Nova investigação</button></div>}
        {error && <div className="error-banner"><ShieldAlert size={17}/>{error}<button onClick={() => setError('')}><X size={15}/></button></div>}
        {page === 'Overview' && <><div className="investigation-overview-head"><div><h2>Todas as investigações</h2><p>{data.investigations.length} redes disponíveis neste workspace</p></div><label className="search"><Search size={16}/><input placeholder="Buscar investigação" value={query} onChange={e => setQuery(e.target.value)}/></label></div><div className="investigation-grid overview-investigation-grid">{data.investigations.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).map(item => <button className="investigation-card" key={item.id} onClick={() => { pinnedRef.current = false; setSelected(item.id); setPage('Graph'); setShowAnalytics(false); setActive(null); }}><div className="card-top"><div className="investigation-icon"><Network size={18}/></div><span className={`pill ${item.status === 'ARCHIVED' ? '' : 'active-pill'}`}>{item.status === 'ARCHIVED' ? 'Arquivada' : 'Ativa'}</span></div><h3>{item.name}</h3><p>{item.description || 'Sem descrição.'}</p><div className="card-foot"><span>{data.entities.filter(e => e.investigationId === item.id).length} vértices</span><span>{data.relationships.filter(r => r.investigationId === item.id).length} arestas</span><b>Abrir rede →</b></div></button>)}</div>{!data.investigations.length && <div className="empty-investigations"><FolderKanban size={28}/><b>Nenhuma investigação ainda</b><span>Crie uma investigação para começar a mapear uma rede.</span></div>}</>}
        {page === 'Investigations' && <><div className="toolbar"><label className="search"><Search size={16}/><input placeholder="Buscar investigações..." value={query} onChange={e => setQuery(e.target.value)}/></label><span className="muted">{data.investigations.length} investigações</span></div><div className="table-wrap"><table><thead><tr><th>INVESTIGAÇÃO</th><th>STATUS</th><th>ENTIDADES</th><th>RELACIONAMENTOS</th><th>CRIADA EM</th><th/></tr></thead><tbody>{data.investigations.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).map(item => <tr key={item.id} onClick={() => { setSelected(item.id); setPage('Graph'); }}><td><b>{item.name}</b><small>{item.description}</small></td><td>{item.status === 'ARCHIVED' ? 'Arquivada' : 'Ativa'}</td><td>{data.entities.filter(e => e.investigationId === item.id).length}</td><td>{data.relationships.filter(r => r.investigationId === item.id).length}</td><td>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</td><td><button className="table-action" onClick={async e => { e.stopPropagation(); try { await api(`/investigations/${item.id}`, { method: 'PUT', body: JSON.stringify({ status: item.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED' }) }); await refresh(); } catch (err) { setError(err.message); } }}>{item.status === 'ARCHIVED' ? 'Reativar' : 'Arquivar'}</button></td></tr>)}</tbody></table></div></>}
        {page === 'Graph' && <><div className="graph-page-head"><button className="back-to-investigations" onClick={() => { pinnedRef.current = false; setActive(null); setPage('Overview'); }}>← Todas as investigações</button><div className="investigation-title-row"><div><span className="selected-label">REDE DA INVESTIGAÇÃO</span><h1>{investigation?.name}</h1></div><select aria-label="Selecionar investigação" value={selected} onChange={e => { pinnedRef.current = false; setSelected(e.target.value); setPathResult(null); setActive(null); }}>{data.investigations.map(i => <option value={i.id} key={i.id}>{i.name}</option>)}</select></div><div className="graph-actionbar"><button className={showAnalytics ? 'action-active' : ''} onClick={() => setShowAnalytics(value => !value)}><BarChart3 size={16}/>{showAnalytics ? 'Ocultar análises' : 'Analisar rede'}</button><button className={showFilters ? 'action-active' : ''} onClick={() => setShowFilters(value => !value)}><Filter size={16}/>Filtros</button><button className={showPath ? 'action-active' : ''} onClick={() => setShowPath(value => !value)}><GitBranch size={16}/>Caminhos</button><span className="actionbar-spacer"/><button onClick={() => openModal('entity')}><Plus size={16}/> Entidade</button><button className="action-primary" onClick={() => openModal('relationship')}><Plus size={16}/> Relação</button></div></div>{investigation?.description && <div className="methodology-notice"><ShieldAlert size={16}/><span>{investigation.description}</span></div>}
          <div className="graph-layout" ref={graphLayoutRef}><div className="graph-card"><div className="graph-toolbar"><div><b>Mapa de conexões</b><span>{filteredEntities.length} entidades · {filteredRel.length} vínculos</span></div><div className="graph-tools"><button title="Afastar" aria-label="Afastar" onClick={() => cyObj.current?.zoom(cyObj.current.zoom() * 0.8)}><ZoomOut size={16}/></button><button title="Aproximar" aria-label="Aproximar" onClick={() => cyObj.current?.zoom(cyObj.current.zoom() * 1.2)}><ZoomIn size={16}/></button><button title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'} aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'} onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</button></div></div>
            {showFilters && <><div className="graph-filters"><Filter size={15}/><select value={filterType} onChange={e => setFilterType(e.target.value)}><option value="ALL">Todos os tipos de entidade</option>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={filterRel} onChange={e => setFilterRel(e.target.value)}><option value="ALL">Todos os tipos de relação</option>{availableRelationTypes.map(key => <option key={key} value={key}>{reltypes[key] || key.replaceAll('_', ' ')}</option>)}</select><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="ALL">Todos os status epistêmicos</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={filterLegal} onChange={e => setFilterLegal(e.target.value)}><option value="ALL">Todos os desfechos</option>{Object.entries(outcomes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="date-filters"><label>De <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}/></label><label>Até <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}/></label><button className="text-btn" onClick={() => { setDateFrom(''); setDateTo(''); }}>Limpar período</button></div></>}
            {showPath && <div className="path-tools"><b>Explorar caminho</b><select value={pathFrom} onChange={e => setPathFrom(e.target.value)}><option value="">Origem</option>{filteredEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><select value={pathTo} onChange={e => setPathTo(e.target.value)}><option value="">Destino</option>{filteredEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><button className="secondary" onClick={findPath}>Encontrar</button>{pathResult && <small>{pathResult.length ? pathResult.map(x => x.name).join(' → ') : 'Nenhum caminho encontrado.'}</small>}</div>}
            <div className="canvas" ref={cyRef}>{!filteredEntities.length && <div className="empty-graph">Adicione entidades para construir a rede.</div>}</div><div className="legend">{Object.entries(types).map(([key, label]) => <span key={key}><i style={{ background: colors[key] }}/>{label}</span>)}</div></div>
            <aside className="detail-column" onMouseEnter={() => clearTimeout(hoverTimer.current)} onMouseLeave={() => { if (!pinnedRef.current) hoverTimer.current = setTimeout(() => setActive(null), 500); }}><div className="detail-card"><div className="detail-head"><b>{active?.kind === 'entity' ? active.pinned ? 'Vértice fixado' : 'Prévia do vértice' : active?.kind === 'rel' ? active.pinned ? 'Aresta fixada' : 'Prévia da aresta' : 'Detalhes do grafo'}</b>{active && <button aria-label="Limpar seleção" onClick={() => { pinnedRef.current = false; cyObj.current?.elements().unselect().removeClass('pinned hover'); setActive(null); }}><X size={15}/></button>}</div>
              {active?.kind === 'entity' && <><div className="entity-hero"><div className="entity-avatar" style={{ color: colors[active.item.type] }}><Users size={21}/></div><h3>{active.item.name}</h3><span className="pill">{types[active.item.type] || active.item.type}</span></div><p className="detail-description">{active.item.description || 'Sem descrição.'}</p>{active.item.contextualRole && <div className="detail-row"><span>Papel nesta investigação</span><b>{active.item.contextualRole}</b></div>}<div className="detail-row"><span>Identificador</span><b>{active.item.id.slice(0, 8)}</b></div><div className="detail-row"><span>Conexões nesta rede</span><b>{data.relationships.filter(r => r.investigationId === selected && (r.sourceId === active.item.id || r.targetId === active.item.id)).length}</b></div>{active.pinned && <div className="inline-actions"><button className="secondary" onClick={() => openModal('entity', active.item)}>Editar</button><button className="secondary" onClick={() => remove('entity', active.item)}>Remover desta investigação</button></div>}{supportingEntityEvidences.length > 0 && <div className="source-list evidence-list"><b>Documentos ligados a este vértice ({supportingEntityEvidences.length})</b>{supportingEntityEvidences.map(evidence => <EvidenceCard evidence={evidence} key={evidence.id}/>)}</div>}</>}
              {active?.kind === 'rel' && <><h3 className="rel-name">{relationshipNames(active.item)}</h3><span className="pill relation-type-pill">{reltypes[active.item.type] || active.item.type.replaceAll('_', ' ')}</span><p className="detail-description">{active.item.description || 'Sem descrição.'}</p><div className="status-separation"><div><small>STATUS EPISTÊMICO</small><span className={`badge epistemic-${active.item.epistemicStatus?.toLowerCase()}`}>{statuses[active.item.epistemicStatus] || active.item.epistemicStatus}</span></div><div><small>DESFECHO ADMINISTRATIVO/JURÍDICO</small><span className={`badge legal-${active.item.legalOutcome?.toLowerCase()}`}>{outcomes[active.item.legalOutcome] || active.item.legalOutcome}</span></div></div><div className="detail-row"><span>Período registrado</span><b>{active.item.validFrom || '—'} {active.item.validTo ? `— ${active.item.validTo}` : ''}</b></div>{active.item.metricValue != null && <div className="detail-row"><span>Valor objetivo documentado</span><b>{active.item.metricUnit === 'BRL' ? Number(active.item.metricValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : `${active.item.metricValue} ${active.item.metricUnit}`}</b></div>}{active.pinned && <div className="inline-actions"><button className="secondary" onClick={() => openModal('relationship', active.item)}>Editar</button><button className="secondary" onClick={() => remove('relationship', active.item)}>Excluir relação</button></div>}<div className="source-list evidence-list"><b>Documentos vinculados ({active.item.evidences?.length || 0})</b>{(active.item.evidences || []).map(evidence => <EvidenceCard evidence={evidence} key={evidence.id}/>)}</div></>}
              {!active && <div className="detail-empty"><Network size={23}/><b>Passe o cursor pelo grafo</b><p>Os detalhes de vértices, arestas e fontes aparecem aqui.</p></div>}</div>
              </aside></div><div className="graph-footnote">Passe o cursor para pré-visualizar. Clique no vértice ou aresta para fixar as informações e acessar as ações de edição. Clique no fundo ou no X para limpar.</div>{showAnalytics && <div className="inline-analytics"><Analytics data={data} selected={selected} onSelect={setSelected} metrics={metrics}/></div>}<Disclaimer/></>}
        {page === 'Entities' && <><div className="toolbar"><label className="search"><Search size={16}/><input placeholder="Buscar entidades..." value={query} onChange={e => setQuery(e.target.value)}/></label><button className="primary" onClick={() => openModal('entity')}><Plus size={15}/> Nova entidade</button></div><div className="table-wrap"><table><thead><tr><th>NOME</th><th>TIPO</th><th>INVESTIGAÇÃO</th><th>RELACIONAMENTOS</th><th>AÇÕES</th></tr></thead><tbody>{data.entities.filter(x => x.investigationId === selected && x.name.toLowerCase().includes(query.toLowerCase())).map(x => <tr key={x.id}><td><b>{x.name}</b><small>{x.description}</small></td><td>{types[x.type] || x.type}</td><td>{investigation?.name}</td><td>{data.relationships.filter(r => r.sourceId === x.id || r.targetId === x.id).length}</td><td><button className="table-action" onClick={() => openModal('entity', x)}>Editar</button> <button className="table-action" onClick={() => remove('entity', x)}>Excluir</button></td></tr>)}</tbody></table></div></>}
        {page === 'Sources' && <><div className="toolbar"><span className="muted">Referências associadas à investigação selecionada.</span><button className="primary" onClick={() => openModal('source')}><Plus size={15}/> Nova fonte</button></div><div className="source-grid">{data.sources.filter(s => s.investigationId === selected).map(s => <div className="source-card" key={s.id}><FileText size={18}/><div><b>{s.title}</b><small>{s.documentType} · {s.reference}</small><p>{s.description}</p></div></div>)}</div></>}
        {toast && <div className="toast">✓ &nbsp;{toast}</div>}
        {modal && <div className="modal-backdrop" onClick={() => { setModal(''); setEditing(null); }}><form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">GRAPH · CADASTRO</span><h2>{editing ? `Editar ${modal === 'entity' ? 'entidade' : 'relacionamento'}` : ({ investigation: 'Nova investigação', entity: 'Nova entidade', relationship: 'Novo relacionamento', source: 'Nova fonte' })[modal]}</h2></div><button type="button" onClick={() => { setModal(''); setEditing(null); }}><X size={18}/></button></div>
          {modal === 'investigation' && <><Field label="Nome"><input name="name" required placeholder="Ex.: Rede de fornecedores"/></Field><Field label="Descrição"><textarea name="description" rows="3"/></Field><Field label="Aviso metodológico"><textarea name="methodologyNotice" rows="2" placeholder="Presença na rede não implica responsabilidade."/></Field></>}
          {modal === 'entity' && <><Field label="Nome"><input name="name" required defaultValue={editing?.name}/></Field><Field label="Tipo"><select name="type" defaultValue={editing?.type || 'PERSON'}>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Descrição"><textarea name="description" rows="3" defaultValue={editing?.description}/></Field><Field label="Informações adicionais"><input name="additional" defaultValue={editing?.additional} placeholder="Sem documentos pessoais sensíveis"/></Field></>}
          {modal === 'relationship' && <><Field label="Origem"><select name="sourceId" required defaultValue={editing?.sourceId || ''}>{filteredEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field><Field label="Destino"><select name="targetId" required defaultValue={editing?.targetId || ''}>{filteredEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field><div className="form-row"><Field label="Tipo de relação"><select name="type" defaultValue={editing?.type || 'OTHER'}>{availableRelationTypes.map(key => <option key={key} value={key}>{reltypes[key] || key.replaceAll('_', ' ')}</option>)}</select></Field><Field label="Direção"><select name="directed" defaultValue={editing ? String(editing.directed) : 'true'}><option value="true">Direcionada</option><option value="false">Não direcionada</option></select></Field></div><div className="form-row"><Field label="Status epistêmico"><select name="epistemicStatus" defaultValue={editing?.epistemicStatus || 'DOCUMENTED_FACT'}>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Desfecho jurídico/administrativo"><select name="legalOutcome" defaultValue={editing?.legalOutcome || 'NOT_APPLICABLE'}>{Object.entries(outcomes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div><Field label="Descrição / imputação"><textarea name="description" rows="2" defaultValue={editing?.description}/></Field><div className="form-row"><Field label="Data inicial"><input name="validFrom" type="date" defaultValue={editing?.validFrom}/></Field><Field label="Data final"><input name="validTo" type="date" defaultValue={editing?.validTo}/></Field></div><div className="form-row"><Field label="Valor documentado (opcional)"><input name="metricValue" type="number" min="0" step="any" defaultValue={editing?.metricValue ?? ''}/></Field><Field label="Unidade (ex.: BRL, %) "><input name="metricUnit" defaultValue={editing?.metricUnit || ''}/></Field></div><div className="evidence-form"><b>{editing ? 'Adicionar evidência (opcional)' : 'Evidência documental obrigatória'}</b><Field label="Título da fonte"><input name="sourceTitle" required={!editing} placeholder="Voto, decisão, documento…"/></Field><div className="form-row"><Field label="Órgão emissor"><input name="issuingBody" placeholder="CVM"/></Field><Field label="Nº do documento"><input name="documentNumber" placeholder="Processo / SEI"/></Field></div><Field label="URL da fonte"><input name="sourceUrl" type="url" placeholder="https://…"/></Field><Field label="Página, parágrafo ou localização"><input name="locationRef" required={!editing}/></Field><Field label="Trecho literal que sustenta esta relação"><textarea name="excerpt" rows="3" required={!editing}/></Field><Field label="Nota de extração"><textarea name="extractionNote" rows="2"/></Field></div></>}
          {modal === 'source' && <><Field label="Título"><input name="title" required/></Field><Field label="Tipo de documento"><input name="documentType" placeholder="Relatório, notícia, registro..."/></Field><Field label="URL ou referência documental"><input name="reference"/></Field><Field label="Data de publicação"><input name="publishedAt" type="date"/></Field><Field label="Descrição"><textarea name="description" rows="2"/></Field><small className="form-hint">A fonte é cadastrada no catálogo. Para sustentá-la como evidência de uma relação, inclua localização e trecho no formulário da relação.</small></>}
          {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={() => { setModal(''); setEditing(null); }}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button></div></form></div>}
      </section></main>
  </div>;
}
function Stat({ icon: Icon, label, value, note }) { return <div className="stat-card"><div className="stat-icon"><Icon size={17}/></div><span>{label}</span><div className="stat-value">{value}</div><small>{note}</small></div>; }
function Metric({ title, desc, rows }) { return <div className="metric-block"><div className="metric-title">{title}</div><small>{desc}</small>{rows.map((row, i) => <div className="metric-row" key={row.entityId}><span><i>{i + 1}</i>{row.name}</span><b>{row.value}</b></div>)}</div>; }
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Disclaimer() { return <div className="disclaimer"><ShieldAlert size={18}/><div><b>Contexto e evidências são essenciais</b><p>Presença na rede e métricas estruturais não implicam responsabilidade criminal. Consulte a fonte e o trecho associados a cada relação.</p></div><span>GRAPH · PESQUISA</span></div>; }
function Analytics({ data, selected, onSelect, metrics }) {
  const entities = data.entities.filter(e => e.investigationId === selected);
  const relationships = data.relationships.filter(r => r.investigationId === selected);
  const countTypes = (items, key) => Object.entries(items.reduce((acc, item) => { const value = item[key] || 'OTHER'; acc[value] = (acc[value] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const entityTypes = countTypes(entities, 'type'), relationTypes = countTypes(relationships, 'type');
  const statusCounts = countTypes(relationships, 'status');
  const maxDegree = Math.max(1, ...(metrics?.degree || []).map(x => x.value));
  const maxBetweenness = Math.max(0.0001, ...(metrics?.betweenness || []).map(x => x.value));
  return <div className="analytics-page">
    <div className="analytics-heading"><div><span className="selected-label">PAINEL ANALÍTICO</span><h2>Perspectivas da rede</h2><p>Distribuições e métricas da investigação selecionada.</p></div><select value={selected} onChange={e => onSelect(e.target.value)}>{data.investigations.map(i => <option value={i.id} key={i.id}>{i.name}</option>)}</select></div>
    <div className="stats-grid analytics-kpis"><Stat icon={Users} label="Entidades" value={entities.length} note="nós da rede"/><Stat icon={GitBranch} label="Relacionamentos" value={relationships.length} note="arestas cadastradas"/><Stat icon={Activity} label="Componentes" value={metrics?.componentCount ?? '—'} note="conexos · não direcionados"/><Stat icon={FileText} label="Fontes" value={data.sources.filter(s => s.investigationId === selected).length} note="referências vinculadas"/></div>
    <div className="chart-grid">
      <ChartCard title="Tipos de entidade" subtitle="Composição dos nós"><HorizontalBars rows={entityTypes.map(([key, value]) => [types[key] || key, value])} color="mint"/></ChartCard>
      <ChartCard title="Tipos de relacionamento" subtitle="Categorias de arestas"><HorizontalBars rows={relationTypes.map(([key, value]) => [reltypes[key] || key, value])} color="orange"/></ChartCard>
      <ChartCard title="Status documental" subtitle="Qualificação informada nos registros"><StatusChart rows={statusCounts.map(([key, value]) => [statuses[key] || key, value, key])}/></ChartCard>
      <ChartCard title="Maior grau" subtitle="Número de vizinhos distintos · projeção não direcionada"><RankChart rows={(metrics?.degree || []).slice(0, 7)} max={maxDegree} color="#54c9a3"/></ChartCard>
      <ChartCard title="Betweenness centrality" subtitle="Participação em caminhos mínimos · valor normalizado"><RankChart rows={(metrics?.betweenness || []).slice(0, 7)} max={maxBetweenness} color="#f29b67" format/></ChartCard>
      <ChartCard title="Closeness harmônica" subtitle="Alcance e distância na componente conectada"><RankChart rows={(metrics?.closeness || []).slice(0, 7)} max={1} color="#8ca7ff" format/></ChartCard>
    </div>
    <div className="analysis-note"><ShieldAlert size={17}/><span>Não há gráfico temporal porque as datas atuais qualificam relações e não constituem uma série completa. Métricas são propriedades do recorte e não indicam culpa, causalidade ou coordenação.</span></div>
  </div>;
}
function ChartCard({ title, subtitle, children }) { return <article className="chart-card"><header><div><h3>{title}</h3><p>{subtitle}</p></div><span className="chart-menu">···</span></header>{children}</article>; }
function HorizontalBars({ rows, color }) { const max = Math.max(1, ...rows.map(row => row[1])); return rows.length ? <div className="h-bars">{rows.map(([label, value]) => <div className="h-bar-row" key={label}><span title={label}>{label}</span><div className="h-bar-track"><i className={color} style={{ width: `${Math.max(3, value / max * 100)}%` }}/></div><b>{value}</b></div>)}</div> : <ChartEmpty/>; }
function RankChart({ rows, max, color, format = false }) { return rows.length ? <div className="rank-chart">{rows.map((row, index) => <div className="rank-row" key={row.entityId}><span className="rank-index">{String(index + 1).padStart(2, '0')}</span><span className="rank-name" title={row.name}>{row.name}</span><div className="rank-track"><i style={{ width: `${Math.max(row.value > 0 ? 3 : 0, row.value / max * 100)}%`, background: color }}/></div><b>{format ? Number(row.value).toFixed(3) : row.value}</b></div>)}</div> : <ChartEmpty/>; }
function StatusChart({ rows }) { const palette = ['#55c9a2', '#69a6ee', '#f5b85f', '#e47c91']; const total = rows.reduce((sum, row) => sum + row[1], 0); let cursor = 0; const segments = rows.map(([label, value, key], i) => { const start = total ? cursor / total * 100 : 0; cursor += value; return { label, value, key, color: palette[i % palette.length], start, end: cursor / (total || 1) * 100 }; }); const gradient = segments.length ? `conic-gradient(${segments.map(x => `${x.color} ${x.start}% ${x.end}%`).join(',')})` : '#28332f'; return <div className="status-chart"><div className="donut" style={{ background: gradient }}><div><b>{total}</b><small>relações</small></div></div><div className="status-legend">{segments.map(x => <div key={x.key}><i style={{ background: x.color }}/><span>{x.label}</span><b>{x.value}</b></div>)}</div></div>; }
function ChartEmpty() { return <div className="chart-empty">Cadastre dados para gerar esta perspectiva.</div>; }
function EvidenceCard({ evidence }) {
  const source = evidence.source || {};
  const documentTitle = source.title || 'Documento sem título cadastrado';
  const documentMeta = [source.issuing_body || source.issuingBody || source.description, source.document_number || source.documentNumber, source.documentType || source.source_type, evidence.location_ref || evidence.locationRef || 'Localizador não informado'].filter(Boolean);
  return <article className="evidence-card"><div className="evidence-document"><FileText size={15}/><div><small>DOCUMENTO DE ORIGEM</small><strong>{documentTitle}</strong></div></div>{documentMeta.length > 0 && <small className="evidence-document-meta">{documentMeta.join(' · ')}</small>}<blockquote>{evidence.excerpt || 'Trecho não informado.'}</blockquote>{(evidence.extraction_note || evidence.extractionNote) && <p>Nota de extração: {evidence.extraction_note || evidence.extractionNote}</p>}{source.url && <a href={source.url} target="_blank" rel="noreferrer">Abrir documento ↗</a>}</article>;
}

createRoot(document.getElementById('root')).render(<App/>);
