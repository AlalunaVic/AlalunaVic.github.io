import { MEASURES, TEMPLATES, STAGES, elapsedMs, validateMeasurements } from './domain.js';
const sameName = (a, b) => String(a ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase() === String(b ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
import { WorkshopStore } from './storage.js';
import { qrSVG, decodeQRFile } from './labels.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const dateFormat = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' });
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' });
const datetime = value => value ? `${dateFormat.format(new Date(value))}, ${timeFormat.format(new Date(value))}` : '—';
const dateOnly = value => value ? dateFormat.format(new Date(`${value.slice(0, 10)}T12:00:00`)) : 'No date set';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', plus: '<path d="M12 5v14M5 12h14"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', check: '<path d="m5 12 4 4L19 6"/>', box: '<path d="m3 7 9-4 9 4v11l-9 4-9-4zM3 7l9 5 9-5M12 12v10"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>', alert: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4m0 4h.01"/>', pause: '<path d="M8 5v14M16 5v14"/>', play: '<path d="m8 5 11 7-11 7z"/>', print: '<path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6z"/>', file: '<path d="M14 2H5v20h14V7zM14 2v5h5M8 12h8M8 16h6"/>'
})[name] ?? '<circle cx="12" cy="12" r="8"/>'}</svg>`;
const badge = status => `<span class="stage-badge" data-stage="${esc(status)}">${esc(STAGES[status]?.label ?? status)}</span>`;
const duration = milliseconds => { const seconds = Math.floor(Math.max(0, milliseconds) / 1000); return `${Math.floor(seconds / 3600).toString().padStart(2,'0')}:${Math.floor(seconds / 60 % 60).toString().padStart(2,'0')}:${(seconds % 60).toString().padStart(2,'0')}`; };

let view = sessionStorage.getItem('setupqc_active_view') || 'luthier';
if (!['luthier', 'qc', 'manager', 'history'].includes(view)) view = 'luthier';
let demo = new URLSearchParams(location.search).get('demo') === '1' || sessionStorage.getItem('setupqc_demo_mode') === 'true';
let operatorName = sessionStorage.getItem('setupqc_operator_name') || 'Victor Alaluna';
let store, unsubscribe, workspace, currentId = null, detailVersion, busy = false, saveTimer, pendingDraft = null, toastTimer, volatileDirty = false;
let draftSavePromise = Promise.resolve();
let filter = { search: '', status: '', batch: '' };
let saveFailure = false;
const normalizedName = name => String(name || '').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
const actor = () => ({ name: $('#operator-name').value.trim(), role: view === 'qc' ? 'qc' : view === 'manager' ? 'manager' : 'luthier' });
const record = () => workspace?.instruments.find(item => item.id === currentId);
const isOwner = item => !item.technician || normalizedName(item.technician) === normalizedName(actor().name);
const editable = item => view === 'luthier' && isOwner(item) && ['received','working','paused','rework'].includes(item.status);

// Translate earlier system copy for display, leaving signed records and user text intact.
const earlierSystemEvents = new Map([
  ['Instrumento recibido; ficha y especificación registradas.', 'Instrument received; record and specification saved.'],
  ['Trabajo iniciado en el banco.', 'Bench work started.'],
  ['Trabajo en pausa; reloj detenido.', 'Work paused; timer stopped.'],
  ['Problema resuelto; trabajo habilitado.', 'Problem resolved; work can continue.'],
  ['Seis medidas y kit completos; enviado a QC a ciegas.', 'Six measurements and kit complete; sent to blind QC.'],
  ['QC registrado con discrepancias; requiere resolución.', 'QC recorded with discrepancies; resolution required.'],
  ['QC a ciegas registrado; medidas concordantes.', 'Blind QC recorded; measurements agree.'],
  ['QC independiente aprobado; falta verificación final de empaque.', 'Independent QC approved; final packing check required.'],
  ['Alturas verificadas de nuevo; revisión funcional y visual firmada.', 'String heights rechecked; functional and visual checks signed.'],
  ['Instrumento devuelto; registro cerrado.', 'Instrument returned; record closed.']
]);
function eventText(event) {
  if (earlierSystemEvents.has(event.text)) return earlierSystemEvents.get(event.text);
  if (event.type === 'block' && event.text.startsWith('Trabajo bloqueado: ')) return `Work blocked: ${event.text.slice('Trabajo bloqueado: '.length)}`;
  if (event.type === 'qcReturn' && event.text.startsWith('Devuelto para retrabajo: ')) return `Returned for rework: ${event.text.slice('Devuelto para retrabajo: '.length)}`;
  return event.text;
}
const displaySize = size => size === 'Violín 4/4' ? 'Violin 4/4' : size;
const earlierPartNames = new Map([
  ['Puente', 'Bridge'], ['Juego de cuerdas', 'String set'], ['Cordal', 'Tailpiece'],
  ['Puente Despiau', 'Despiau bridge'], ['Juego de cuerdas viola 13″', 'Viola 13″ string set'],
  ['Cordal Wittner', 'Wittner tailpiece'], ['Puente cello 4/4', 'Cello 4/4 bridge'],
  ['Juego de cuerdas cello 4/4', 'Cello 4/4 string set']
]);
const displayPart = name => earlierPartNames.get(name) || name;

function toast(message, error = false) {
  const node = $('#toast');
  node.hidden = false;
  node.textContent = message;
  node.classList.toggle('is-error', error);
  node.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('visible'), 5000);
}

function setSaveStatus(text = 'Saved on this computer', failed = false) {
  saveFailure = failed;
  const status = $('#sync-status');
  status.innerHTML = `<span class="status-dot" aria-hidden="true"></span><span>${esc(text)}</span>`;
  status.dataset.state = failed ? 'error' : text.includes('Saving') ? 'saving' : 'saved';
}

async function connectWorkspace() {
  unsubscribe?.();
  store?.destroy?.();
  store = new WorkshopStore({ demo });
  workspace = await store.getState();
  unsubscribe = store.subscribe(next => {
    workspace = next;
    renderOverview();
    const item = record();
    if ($('#instrument-dialog').open && item && item.version !== detailVersion && !busy && !pendingDraft) {
      if (volatileDirty) showDetailError({code:'conflict',message:'This record changed in another tab. Keep your measurements before reloading the current record.'});
      else renderDetail(item);
    }
  });
  $('#workspace-mode').value = demo ? 'demo' : 'real';
  document.body.classList.toggle('demo-mode', demo);
  setSaveStatus();
  renderOverview();
}

function metric(label, value, foot, glyph = 'box', tone = '') {
  return `<article class="metric-card ${tone}"><div class="metric-top"><span class="metric-label">${label}</span><span class="metric-icon">${icon(glyph)}</span></div><strong class="metric-value">${esc(value)}</strong><span class="metric-foot">${foot}</span></article>`;
}

function toolbar(items, options = true) {
  const batches = [...new Set(workspace.instruments.map(item => item.batch).filter(Boolean))];
  return `<div class="toolbar"><label class="search-input">${icon('search')}<input id="record-search" type="search" placeholder="Search serial, code or model" aria-label="Search instruments" value="${esc(filter.search)}"></label>${options ? `<select class="filter-select" id="stage-filter" aria-label="Filter by stage"><option value="">All stages</option><option value="attention" ${filter.status === 'attention' ? 'selected' : ''}>Blocks and rework</option>${Object.entries(STAGES).map(([key, stage]) => `<option value="${key}" ${filter.status === key ? 'selected' : ''}>${esc(stage.label)}</option>`).join('')}</select><select class="filter-select" id="batch-filter" aria-label="Filter by batch"><option value="">All batches</option>${batches.map(batch => `<option ${filter.batch === batch ? 'selected' : ''}>${esc(batch)}</option>`).join('')}</select>` : ''}<button class="btn btn-secondary btn-small" data-scan-label title="Read a photo of the label">${icon('search')} Read QR</button><span class="result-count">${items.length} instruments</span></div>`;
}

function filtered(items) {
  const query = filter.search.toLocaleLowerCase().trim();
  return items.filter(item => (!query || `${item.serial} ${item.code} ${item.specSnapshot.model} ${item.batch} ${item.assignee}`.toLocaleLowerCase().includes(query)) && (!filter.status || filter.status === item.status || (filter.status === 'attention' && ['blocked','rework'].includes(item.status))) && (!filter.batch || filter.batch === item.batch));
}

function empty(title, description, action = '') {
  return `<div class="empty-state"><span class="empty-icon">${icon('box')}</span><h3>${title}</h3><p>${description}</p>${action}</div>`;
}

function instrumentTable(items, manager = false) {
  if (!items.length) return empty('No instruments in this view', 'Change the filters or receive your first instrument.');
  return `<div class="table-wrap"><table class="instrument-table"><thead><tr><th>Instrument / Serial</th><th>Batch and client</th><th>Assigned to</th><th>Stage</th><th>${manager ? 'Recorded work' : 'Return date'}</th><th><span class="sr-only">Open record</span></th></tr></thead><tbody>${items.map(item => `<tr data-stage="${esc(item.status)}"><td><button class="record-link" data-open="${esc(item.id)}"><strong>${esc(item.specSnapshot.model)} <span class="instrument-size">${esc(displaySize(item.specSnapshot.size))}</span></strong><span>${esc(item.serial)} <span class="code-label">${esc(item.code)}</span></span></button></td><td><strong>${esc(item.batch || 'No batch')}</strong><span class="cell-secondary">${esc(item.specSnapshot.client)}</span></td><td><span class="avatar-sm">${esc((item.technician || item.assignee || '—').split(' ').map(n => n[0]).slice(0,2).join(''))}</span>${esc(item.technician || item.assignee || 'Unassigned')}</td><td>${badge(item.status)}${item.problem ? `<span class="cell-secondary problem-text">${esc(item.problem.reason)}</span>` : ''}</td><td>${manager ? `<span class="mono" data-timer-id="${esc(item.id)}">${duration(elapsedMs(item))}</span>` : `<span class="${item.dueDate && item.dueDate < today() && !['ready','delivered'].includes(item.status) ? 'overdue-text' : ''}">${dateOnly(item.dueDate)}</span>`}</td><td><button class="btn btn-ghost btn-small icon-only" data-open="${esc(item.id)}" aria-label="Open instrument ${esc(item.serial)}">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>`;
}

function batchCards() {
  const groups = new Map();
  for (const item of workspace.instruments.filter(item => item.status !== 'delivered')) {
    const key = item.batch || 'No batch';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  if (!groups.size) return '<p class="muted small">Batches appear when instruments are received.</p>';
  return [...groups].map(([batch, items]) => {
    const ready = items.filter(item => item.status === 'ready').length;
    const blocked = items.filter(item => item.status === 'blocked' || item.status === 'rework').length;
    const due = items.map(item => item.dueDate).filter(Boolean).sort()[0];
    return `<article class="batch-card"><div class="batch-heading"><span class="batch-icon">${icon('box')}</span><strong>${esc(batch)}</strong><span class="batch-count">${items.length}</span></div><p>${esc([...new Set(items.map(item => item.specSnapshot.client))].join(' · '))}</p><div class="batch-progress-label"><span>${ready} of ${items.length} ready</span><span>${Math.round(100*ready/items.length)}%</span></div><div class="progress-track"><span class="progress-fill" style="width:${100*ready/items.length}%"></span></div><div class="batch-footer"><span>Due ${dateOnly(due)}</span>${blocked ? `<span class="problem-text">${blocked} need attention</span>` : '<span>On track</span>'}</div></article>`;
  }).join('');
}

function activityList(limit = 7) {
  const events = workspace.activity.slice(0, limit);
  return events.length ? `<ol class="activity-list">${events.map(event => `<li class="activity-item"><span class="activity-dot"></span><div><p>${esc(eventText(event))}</p><span>${esc(event.actor)} · ${datetime(event.at)}</span></div></li>`).join('')}</ol>` : '<p class="muted small">Confirmed workshop updates will appear here.</p>';
}

function luthierView() {
  const all = workspace.instruments;
  const items = filtered(all.filter(item => item.status !== 'delivered'));
  const active = all.find(item => item.status === 'working' && item.timer.startedAt && (!item.technician || normalizedName(item.technician) === normalizedName(actor().name)));
  const alerts = all.filter(item => ['blocked', 'rework'].includes(item.status));
  return `${demo ? '<div class="demo-banner"><strong>Demo workspace</strong><span>These instruments are examples. Your workshop records are stored separately.</span></div>' : ''}<div class="metric-grid">${metric('Ready to start', all.filter(item => ['received','rework'].includes(item.status)).length, 'Intake and rework', 'box')}${metric('At the bench', all.filter(item => ['working','paused'].includes(item.status)).length, 'Work in progress', 'clock', 'metric-accent')}${metric('Quality control', all.filter(item => ['qc','final'].includes(item.status)).length, 'QC and final checks', 'check')}${metric('Ready for return', all.filter(item => item.status === 'ready').length, 'All three checks complete', 'file')}</div>${active ? `<section class="active-work"><div><span class="eyebrow">ON YOUR BENCH NOW</span><h2>${esc(active.specSnapshot.model)} <span>${esc(active.serial)}</span></h2><p>${esc(active.batch || 'No batch')} · ${esc(active.specSnapshot.client)}</p></div><span class="active-timer" data-timer-id="${esc(active.id)}">${duration(elapsedMs(active))}</span><button class="btn btn-primary" data-open="${esc(active.id)}">Continue work ${icon('arrow')}</button></section>` : ''}${alerts.length ? `<button class="exception-strip" data-filter-exceptions>${icon('alert')}<strong>${alerts.length} instrument${alerts.length === 1 ? '' : 's'} need${alerts.length === 1 ? 's' : ''} attention</strong><span>Parts, blocks or rework</span>${icon('arrow')}</button>` : ''}<div class="workbench-layout"><section class="panel"><div class="panel-header"><div><span class="eyebrow">WORKSHOP FLOW</span><h2>Your workbench</h2></div><span class="quiet-label">One record per instrument</span></div>${toolbar(items)}${instrumentTable(items)}${!all.length ? `<div class="first-run-actions"><button class="btn btn-primary" data-new-instrument>${icon('plus')} Receive first instrument</button><button class="btn btn-secondary" data-demo>Explore demo</button></div>` : ''}</section><aside class="overview-aside"><section class="panel"><div class="panel-header"><div><span class="eyebrow">UPCOMING RETURNS</span><h2>Active batches</h2></div></div><div class="batch-grid">${batchCards()}</div></section><section class="panel"><div class="panel-header"><h2>Recent activity</h2></div>${activityList(5)}</section></aside></div>`;
}

function qcView() {
  const items = filtered(workspace.instruments.filter(item => ['qc','final','ready','rework'].includes(item.status)));
  return `<div class="info-banner">${icon('check')}<div><strong>Blind inspection, honestly labeled.</strong><p>Enter your six measurements before seeing the luthier’s. Working solo? Your own re-measurement is recorded as a SELF-RECHECK — never as independent QC. Returning an instrument for rework preserves its full history.</p></div></div><div class="metric-grid">${metric('Awaiting inspection', workspace.instruments.filter(item => item.status === 'qc').length, 'Independent measurement', 'search')}${metric('Final verification', workspace.instruments.filter(item => item.status === 'final').length, 'Remeasure both string heights', 'check')}${metric('In rework', workspace.instruments.filter(item => item.status === 'rework').length, 'Returned with a reason', 'alert')}${metric('Certificates ready', workspace.instruments.filter(item => item.status === 'ready').length, 'Ready for return', 'file')}</div><section class="panel"><div class="panel-header"><div><span class="eyebrow">QUALITY ASSURANCE</span><h2>Inspection queue</h2></div></div>${toolbar(items)}${instrumentTable(items)}</section>`;
}

function managerView() {
  const all = workspace.instruments;
  const active = all.filter(item => item.status !== 'delivered');
  const overdue = active.filter(item => item.dueDate && item.dueDate < today() && item.status !== 'ready');
  const examined = all.filter(item => item.qcAttempts.some(attempt => ['approved', 'returned'].includes(attempt.decision)));
  const firstPass = examined.filter(item => item.qcAttempts[0]?.decision === 'approved').length;
  const counts = Object.keys(STAGES).map(status => [status, active.filter(item => item.status === status).length]).filter(([status]) => status !== 'delivered');
  const people = [...new Set(active.map(item => item.technician || item.assignee).filter(Boolean))];
  const items = filtered(all);
  return `${demo ? '<div class="demo-banner"><strong>Demo</strong><span>Example activity and metrics. These are not actual inventory records.</span></div>' : ''}<div class="manager-live"><span class="live-dot"></span>Live on this computer <span>Last activity: ${workspace.activity[0] ? datetime(workspace.activity[0].at) : 'no activity yet'}</span></div><div class="metric-grid">${metric('Active instruments', active.length, `${all.filter(item => item.status === 'delivered').length} returned`, 'box')}${metric('Need attention', active.filter(item => ['blocked','rework'].includes(item.status)).length, `${overdue.length} past their return date`, 'alert', 'metric-warn')}${metric('First-pass QC', examined.length ? `${Math.round(firstPass / examined.length * 100)}%` : '—', `${firstPass} / ${examined.length} instruments inspected`, 'check')}${metric('Ready for return', all.filter(item => item.status === 'ready').length, 'Final check signed off', 'file')}</div><div class="manager-summary-grid"><section class="panel"><div class="panel-header"><div><span class="eyebrow">FROM INTAKE TO RETURN</span><h2>Workshop by stage</h2></div></div><div class="stage-flow">${counts.map(([status,count]) => `<button class="stage-summary" data-stage-filter="${status}">${badge(status)}<strong>${count}</strong><span>${count === 1 ? 'instrument' : 'instruments'}</span></button>`).join('')}</div></section><section class="panel"><div class="panel-header"><h2>Luthier workload</h2></div><div class="people-list">${people.length ? people.map(name => { const list = active.filter(item => (item.technician || item.assignee) === name); const working = list.find(item => item.timer.startedAt); return `<div class="person-row"><span class="avatar">${esc(name.split(' ').map(n=>n[0]).slice(0,2).join(''))}</span><div><strong>${esc(name)}</strong><span>${list.length} assigned · ${list.filter(item=>item.status==='ready').length} ready</span></div><span class="person-status">${working ? 'Working' : 'No active timer'}</span></div>`; }).join('') : '<p class="muted small">Assign a luthier when receiving instruments.</p>'}</div></section></div><div class="workbench-layout"><section class="panel"><div class="panel-header"><div><span class="eyebrow">THE COMPLETE PICTURE</span><h2>Instrument tracking</h2></div><span class="quiet-label">Live updates across tabs</span></div>${toolbar(items)}${instrumentTable(items, true)}</section><aside class="overview-aside"><section class="panel"><div class="panel-header"><h2>Batch commitments</h2></div><div class="batch-grid">${batchCards()}</div></section><section class="panel"><div class="panel-header"><h2>Workshop activity</h2></div>${activityList(8)}</section></aside></div>`;
}

function historyView() {
  return `<section class="panel"><div class="panel-header"><div><span class="eyebrow">TRACEABILITY</span><h2>Workshop log</h2></div><span class="quiet-label">${workspace.activity.length} recorded events</span></div>${activityList(workspace.activity.length)}</section>`;
}

function renderOverview() {
  if (!workspace) return;
  const headings = {
    luthier: ['CRAFTSMANSHIP, WITH EVERY DETAIL IN PLACE', 'Your workshop, in order.', 'Receive, set up and check every instrument before its return.'],
    qc: ['QUALITY CONTROL', 'A second set of eyes.', 'Independent measurements, comparison and final verification.'],
    manager: ['GENERAL MANAGEMENT', 'Your entire workshop, at a glance.', 'Progress, ownership and exceptions in one shared record.'],
    history: ['THE WORKSHOP RECORD', 'Every step leaves a record.', 'Signatures, time and decisions with the full history intact.']
  };
  const [kicker, title, description] = headings[view];
  $('#page-kicker').textContent = kicker;
  $('#page-title').textContent = title;
  $('#page-description').textContent = description;
  $$('[data-view]').forEach(button => { button.classList.toggle('active', button.dataset.view === view); button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false'); });
  $('#nav-qc-count').textContent = workspace.instruments.filter(item => ['qc','final'].includes(item.status)).length;
  const blockedCount = $('#nav-blocked-count');
  if (blockedCount) blockedCount.textContent = workspace.instruments.filter(item => ['blocked','rework'].includes(item.status)).length;
  $('#view-content').innerHTML = ({luthier:luthierView, qc:qcView, manager:managerView, history:historyView})[view]();
  $('#new-instrument-btn').hidden = view !== 'luthier';
  const search = $('#record-search');
  search?.addEventListener('input', () => {
    const position = search.selectionStart;
    filter.search = search.value;
    renderOverview();
    const replacement = $('#record-search');
    replacement.focus();
    try { replacement.setSelectionRange(position, position); } catch {}
  });
  $('#stage-filter')?.addEventListener('change', event => { filter.status = event.target.value; renderOverview(); });
  $('#batch-filter')?.addEventListener('change', event => { filter.batch = event.target.value; renderOverview(); });
}

function rangeText(range) { return range[0] === range[1] ? String(range[0]) : `${range[0]}–${range[1]}`; }
function measureFields(item, prefix, values = {}, readonly = false) {
  return `<div class="measure-grid">${MEASURES.map((measure, index) => `<label class="measure-field" data-measure="${measure.key}"><span class="measure-number">${String(index+1).padStart(2,'0')}</span><span class="measure-label">${esc(measure.label)}</span><span class="measure-input-wrap"><input type="text" inputmode="decimal" autocomplete="off" name="${prefix}-${measure.key}" value="${esc(values[measure.key] ?? '')}" ${readonly ? 'readonly' : ''} aria-label="${esc(measure.label)}"><span>mm</span></span><span class="measure-target">Spec: ${rangeText(item.specSnapshot.targets[measure.key])} mm</span><span class="measure-feedback" aria-live="polite"></span></label>`).join('')}</div>`;
}

function updateMeasureFeedback(scope = $('#instrument-dialog')) {
  $$('.measure-field', scope).forEach(field => {
    const input = $('input', field);
    const raw = input.value.trim().replace(',', '.');
    const range = record()?.specSnapshot.targets[field.dataset.measure];
    const number = Number(raw);
    const valid = raw && Number.isFinite(number) && number > 0 && number >= range[0]-1e-9 && number <= range[1]+1e-9;
    field.dataset.valid = !raw ? 'empty' : valid ? 'yes' : 'no';
    $('.measure-feedback', field).textContent = !raw ? 'Not measured' : valid ? 'Within spec' : 'Check measurement';
  });
}

function detailStepper(item) {
  const stages = ['received','working','qc','final','ready'];
  const position = ({received:0,working:1,paused:1,blocked:1,rework:1,qc:2,final:3,ready:4,delivered:4})[item.status];
  return `<ol class="stepper">${['Intake','Bench','Independent QC','Final check','Ready'].map((label,index)=>`<li class="step ${index < position ? 'done' : index === position ? 'active' : ''}"><span>${index < position ? icon('check') : index+1}</span>${label}</li>`).join('')}</ol>`;
}

function historyHTML(item) {
  return `<ol class="history-list">${[...item.history].reverse().map(event => `<li><span class="history-dot"></span><div><strong>${esc(eventText(event))}</strong><small>${esc(event.actor)} · ${datetime(event.at)}</small></div></li>`).join('')}</ol>`;
}

function workForm(item) {
  const canEdit = editable(item);
  const writable = ['working','paused','rework'].includes(item.status) && canEdit;
  const reason = item.qcAttempts.filter(attempt => attempt.decision === 'returned').at(-1)?.reason;
  return `${reason && item.status === 'rework' ? `<div class="alert alert-danger"><strong>Returned to bench</strong><p>${esc(reason)}</p></div>` : ''}${!canEdit ? '<div class="alert alert-success">Tracking view. Use the assigned luthier’s signature to continue; measurements submitted to QC stay locked.</div>' : ''}<div class="section-heading"><div><span class="eyebrow">PASS A · ACTUAL MEASUREMENTS</span><h3>The six card measurements</h3></div><span class="quiet-label">No rounding · millimeters</span></div>${measureFields(item, 'measure', item.measurements, !writable)}<p class="form-hint">Measure the finished work. Reference values are never filled in automatically.</p><div class="section-heading"><h3>Kit and installed parts</h3></div><div class="parts-list">${item.parts.map((part,index) => `<div class="part-row"><label for="part-${index}">${esc(displayPart(part.name))}</label><select id="part-${index}" name="part-${index}" ${!writable ? 'disabled' : ''}>${[['pending','Pending'],['installed','Installed'],['substituted','Substituted'],['not_required','Not required by the order']].map(([value,label]) => `<option value="${value}" ${part.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select><input name="part-note-${index}" type="text" placeholder="Substituted or omitted part: explain why" aria-label="Note for ${esc(displayPart(part.name))}" value="${esc(part.note)}" ${!writable ? 'readonly' : ''}></div>`).join('')}</div><label class="form-field notes-field">Bench notes<textarea name="work-notes" rows="3" placeholder="Observations, adjustments or work evidence" ${!writable ? 'readonly' : ''}>${esc(item.notes)}</textarea></label>${canEdit ? `<div class="work-actions">${item.status === 'received' ? `<button class="btn btn-primary" data-action="start">${icon('play')} Start work</button>` : item.status === 'paused' ? `<button class="btn btn-primary" data-action="resume">${icon('play')} Resume</button>` : item.status === 'rework' ? `<button class="btn btn-secondary" data-action="start">${icon('play')} Start rework</button>` : `<button class="btn btn-secondary" data-action="pause">${icon('pause')} Pause timer</button>`}${item.status !== 'received' ? `<button class="btn btn-primary" data-action="submit">Submit to QC ${icon('arrow')}</button>` : ''}</div>` : ''}`;
}

function comparisonTable(item, attempt) {
  return `<div class="table-wrap"><table class="comparison-table"><thead><tr><th>Measurement</th><th>Spec</th><th>Luthier</th><th>QC</th><th>Result</th></tr></thead><tbody>${MEASURES.map(measure => {
    const range = item.specSnapshot.targets[measure.key];
    const own = Number(String(attempt.measurements[measure.key]).replace(',', '.'));
    const original = Number(String(item.measurements[measure.key]).replace(',', '.'));
    const delta = Math.abs(own-original);
    const pass = own >= range[0]-1e-9 && own <= range[1]+1e-9;
    return `<tr><td>${esc(measure.shortLabel || measure.label)}</td><td>${rangeText(range)}</td><td>${esc(item.measurements[measure.key])}</td><td>${esc(attempt.measurements[measure.key])}</td><td><span class="${pass ? 'good-text' : 'problem-text'}">${pass ? 'Pass' : 'Out of spec'}</span>${delta > .2+1e-9 ? ` <span class="problem-text" title="QC differs from the bench reading by more than 0.2 mm — flagged on the record; approval is decided against the specification">≠ bench Δ${delta.toFixed(1)} · noted</span>` : ''}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function qcForm(item) {
  const latest = item.qcAttempts.at(-1);
  if (latest?.decision === 'pending') return `<div class="section-heading"><div><span class="eyebrow">PASS B · COMPARISON</span><h3>Two measurements, one decision</h3></div></div><p class="form-hint">Inspection by ${esc(latest.inspector)}.${latest.mode === 'self-recheck' ? ' <strong>SELF-RECHECK — the technician re-measured their own work; this is not independent QC.</strong>' : ''} An out-of-spec measurement prevents approval; a difference over 0.2 mm is flagged on the record.</p>${comparisonTable(item,latest)}<label class="form-field">Reason for rework<textarea name="qc-reason" placeholder="Explain what needs correcting" rows="3"></textarea></label><div class="work-actions"><button class="btn btn-secondary" data-action="qcReturn">Return to bench</button><button class="btn btn-primary" data-action="qcApprove">${icon('check')} Approve QC</button></div>`;
  const selfMode = sameName(actor().name, item.technician);
  return `${selfMode ? `<div class="alert alert-warning"><strong>You performed this work</strong><p>Recording your own measurements is a <strong>SELF-RECHECK</strong>. It will be labeled that way on the record, the activity log and the certificate — it is not independent QC.</p><label class="check-field"><input type="checkbox" name="qc-self-recheck"> Record this inspection as a SELF-RECHECK</label></div>` : `<div class="alert alert-info"><strong>Blind verification</strong><p>The luthier’s measurements appear after you record your own. The inspector must be a different person from the technician.</p></div>`}<div class="section-heading"><div><span class="eyebrow">PASS B · INDEPENDENT INSPECTOR</span><h3>Your six measurements</h3></div></div>${measureFields(item,'qc')}<div class="work-actions"><button class="btn btn-primary" data-action="qcSubmit">Record and compare ${icon('arrow')}</button></div>`;
}

function finalForm(item) {
  return `<div class="alert alert-success"><strong>Independent QC approved</strong><p>Remeasure both string heights with the instrument ready for packing. Sign off to issue its certificate.</p></div><div class="section-heading"><div><span class="eyebrow">PASS C · BEFORE PACKING</span><h3>Final verification</h3></div></div><div class="form-grid"><label class="form-field">Treble string height (mm)<input name="final-treble" type="text" inputmode="decimal" autocomplete="off" placeholder="Actual measurement"><small>Spec: ${rangeText(item.specSnapshot.targets.treble)} mm</small></label><label class="form-field">Bass string height (mm)<input name="final-bass" type="text" inputmode="decimal" autocomplete="off" placeholder="Actual measurement"><small>Spec: ${rangeText(item.specSnapshot.targets.bass)} mm</small></label></div><label class="checklist"><input name="final-functional" type="checkbox"><span><strong>Functional check complete</strong><small>Pegs, fine tuners, tailpiece, chinrest and centered strings.</small></span></label><label class="checklist"><input name="final-visual" type="checkbox"><span><strong>Visual check complete</strong><small>No tool marks, rosin dust or dirt.</small></span></label><div class="work-actions"><button class="btn btn-primary" data-action="finalSignoff">${icon('check')} Sign off as ready</button></div>`;
}

function readyPanel(item) {
  const final = item.finalCheck;
  return `<div class="ready-state"><span class="ready-mark">${icon('check')}</span><span class="eyebrow">ALL THREE CHECKS COMPLETE</span><h3>${item.status === 'delivered' ? 'Instrument returned.' : 'Ready to play again.'}</h3><p>Bench work, independent QC and final verification recorded.</p><button class="btn btn-primary" data-action="printCertificate">${icon('print')} Print certificate</button>${item.status === 'ready' && ['manager','luthier'].includes(view) ? '<button class="btn btn-secondary" data-action="deliver">Record return</button>' : ''}</div>${final ? `<div class="signoff-summary"><span>Treble height <strong>${esc(final.treble)} mm</strong></span><span>Bass height <strong>${esc(final.bass)} mm</strong></span><span>Final sign-off <strong>${esc(final.checkedBy || final.name || final.actor)}</strong></span></div>` : ''}${item.qcAttempts.length ? comparisonTable(item,item.qcAttempts.at(-1)) : ''}`;
}

function renderDetail(item) {
  detailVersion = item.version;
  volatileDirty = false;
  const blind = view === 'qc' && item.status === 'qc' && item.qcAttempts.at(-1)?.decision !== 'pending';
  let body;
  if (['ready','delivered'].includes(item.status)) body = readyPanel(item);
  else if (item.status === 'blocked') body = `<div class="alert alert-danger"><strong>Work stopped</strong><p>${esc(item.problem?.reason)}</p></div>${view === 'luthier' && isOwner(item) ? '<button class="btn btn-primary" data-action="resolveBlock">Issue resolved · resume</button>' : '<p class="muted">The luthier must resolve the block before work continues.</p>'}`;
  else if (item.status === 'qc' && view === 'qc') body = qcForm(item);
  else if (item.status === 'final' && view === 'luthier' && isOwner(item)) body = finalForm(item);
  else if (item.status === 'final') body = '<div class="alert alert-info"><strong>QC approved. Return to the bench for the final check.</strong><p>The assigned luthier must remeasure both string heights, complete the functional and visual checks, and sign off before it is ready.</p></div>' + comparisonTable(item,item.qcAttempts.at(-1));
  else body = workForm(item);
  $('#instrument-dialog-content').innerHTML = `<div class="detail-header"><div><span class="eyebrow">INSTRUMENT RECORD <span class="code-label">${esc(item.code)}</span></span><h2 id="detail-title">${esc(item.specSnapshot.model)} <span>${esc(displaySize(item.specSnapshot.size))}</span></h2><p>Serial <strong>${esc(item.serial)}</strong> · ${esc(item.specSnapshot.client)} · ${esc(item.batch || 'No batch')}</p></div><button id="detail-close" class="btn btn-ghost icon-only" data-action="closeDetail" aria-label="Close record">${icon('close')}</button></div>${detailStepper(item)}<div class="signature-bar"><span>Active signature: <strong>${esc(actor().name || 'Enter your name')}</strong></span><button class="btn btn-ghost btn-small" data-action="changeSigner">Change signature</button></div><div id="detail-alert" role="alert"></div><div class="detail-grid"><div class="detail-main">${body}</div><aside class="detail-aside"><div class="detail-status">${badge(item.status)}<span class="detail-timer mono" data-timer-id="${esc(item.id)}">${duration(elapsedMs(item))}</span><span class="muted small">Recorded work time</span></div><dl class="detail-facts"><div><dt>Assigned to</dt><dd>${esc(item.technician || item.assignee || 'Unassigned')}</dd></div><div><dt>Committed return</dt><dd>${dateOnly(item.dueDate)}</dd></div><div><dt>Received</dt><dd>${datetime(item.createdAt)}</dd></div><div><dt>Specification</dt><dd>${esc(item.specSnapshot.model)} · ${esc(item.specSnapshot.client)} · ${esc(displaySize(item.specSnapshot.size))}</dd></div></dl>${['received','working','paused','rework'].includes(item.status) && view === 'luthier' ? '<button class="btn btn-secondary full-width" data-action="showBlock">Flag an issue</button>' : ''}<div id="block-form" hidden><label class="form-field">What is blocking work?<textarea name="block-reason" rows="3" placeholder="Missing part, damage, specification question…"></textarea></label><button class="btn btn-danger full-width" data-action="block">Stop and flag</button></div><div class="label-preview"><div id="detail-qr" aria-label="QR for ${esc(item.code)}"></div><span class="label-caption">${esc(item.code)}</span><button class="btn btn-secondary btn-small full-width" data-action="printLabel">${icon('print')} Print label</button></div><h3 class="aside-heading">Traceability</h3>${historyHTML(item)}</aside></div>`;
  // This is a local shared-workstation workflow, not an authenticated multiuser system.
  // Do not expose the application to customers or describe UI blinding as access control.
  $('#instrument-dialog').setAttribute('aria-labelledby','detail-title');
  if (blind) $('#instrument-dialog-content').dataset.blind = 'true';
  else delete $('#instrument-dialog-content').dataset.blind;
  updateMeasureFeedback();
  const qrTarget = $('#detail-qr');
  qrSVG(item.code).then(svg => { if (qrTarget.isConnected) qrTarget.innerHTML = svg; }).catch(() => { if (qrTarget.isConnected) qrTarget.textContent = 'Use the code or serial number to identify it.'; });
}

async function openDetail(id) {
  if (!await canLeaveDetail()) return;
  currentId = id;
  const item = record();
  if (!item) return;
  renderDetail(item);
  if (!$('#instrument-dialog').open) $('#instrument-dialog').showModal();
}

function collectDraft() {
  const item = record();
  if (!item || !editable(item) || item.status === 'received') return null;
  return { type: 'saveDraft', instrumentId: item.id, expectedVersion: detailVersion, payload: {
    measurements: Object.fromEntries(MEASURES.map(measure => [measure.key, $(`[name="measure-${measure.key}"]`)?.value ?? item.measurements[measure.key]])),
    parts: item.parts.map((part,index) => ({ ...part, status: $(`[name="part-${index}"]`)?.value || part.status, note: $(`[name="part-note-${index}"]`)?.value ?? part.note })),
    notes: $('[name="work-notes"]')?.value ?? item.notes
  }};
}

function queueDraft() {
  pendingDraft = collectDraft();
  if (!pendingDraft) return;
  setSaveStatus('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushDraft, 450);
}

async function flushDraft() {
  clearTimeout(saveTimer);
  await draftSavePromise;
  if (!pendingDraft) return !saveFailure;
  const action = pendingDraft;
  pendingDraft = null;
  let success = false;
  draftSavePromise = (async () => {
    try {
      busy = true;
      const next = await store.dispatch(action, actor());
      workspace = next || await store.getState();
      detailVersion = record()?.version;
      if (pendingDraft && pendingDraft.instrumentId === action.instrumentId) pendingDraft.expectedVersion = detailVersion;
      setSaveStatus();
      success = true;
      renderOverview();
    } catch (error) {
      pendingDraft = pendingDraft || action;
      setSaveStatus('Unsaved changes', true);
      showDetailError(error);
    } finally { busy = false; }
  })();
  await draftSavePromise;
  return success;
}

function showDetailError(error) {
  const target = $('#detail-alert');
  if (target && $('#instrument-dialog').open) target.innerHTML = `<div class="alert alert-danger"><strong>Action could not be completed</strong><p>${esc(error.message || String(error))}</p>${error.code === 'conflict' ? '<button class="btn btn-secondary btn-small" data-action="reloadDetail">Reload current record</button><p class="small">Your visible text has not been overwritten. Copy your notes before reloading.</p>' : ''}${saveFailure ? '<button class="btn btn-secondary btn-small" data-action="exportRecovery">Download backup and unsaved draft</button>' : ''}</div>`;
  toast(error.message || String(error), true);
}

async function canLeaveDetail() {
  if (!await flushDraft()) return false;
  if (volatileDirty && !window.confirm('You have unsigned QC or final-check measurements. Discard them and leave this record?')) return false;
  volatileDirty = false;
  return true;
}

async function changeView(next) {
  if (!await canLeaveDetail()) return;
  $('#instrument-dialog').close();
  currentId = null;
  view = next;
  sessionStorage.setItem('setupqc_active_view', view);
  filter = { search:'', status:'', batch:'' };
  renderOverview();
}

function showIntake() {
  const form = $('#intake-form');
  form.reset();
  $('[name="assignee"]',form).value = actor().name;
  $('#intake-template').innerHTML = '<option value="" disabled selected>Select model, client and size</option>' + TEMPLATES.map(template => `<option value="${esc(template.id)}">${esc(template.model)} · ${esc(template.client)} · ${esc(template.size)}</option>`).join('');
  $('#intake-error').textContent = '';
  $('#intake-error').hidden = true;
  $('#intake-dialog').showModal();
}

async function detailAction(action) {
  if (action === 'closeDetail') { if (await canLeaveDetail()) { $('#instrument-dialog').close(); currentId = null; } return; }
  if (action === 'changeSigner') { if (await canLeaveDetail()) { $('#instrument-dialog').close(); currentId = null; $('#operator-name').focus(); $('#operator-name').select(); } return; }
  if (action === 'exportRecovery') { await exportWorkspace(true); return; }
  if (action === 'showBlock') { $('#block-form').hidden = !$('#block-form').hidden; $('[name="block-reason"]').focus(); return; }
  if (action === 'reloadDetail') { pendingDraft = null; setSaveStatus(); workspace = await store.getState(); renderDetail(record()); return; }
  if (action === 'printCertificate') { printCertificate(record()); return; }
  if (action === 'printLabel') {
    try {
      const item = record();
      const svg = await qrSVG(item.code);
      $('#print-area').innerHTML = `<article class="instrument-label"><div><p>SetupQC · ${demo ? 'DEMO' : 'Instrument identification'}</p><h1>${esc(item.specSnapshot.model)} · ${esc(displaySize(item.specSnapshot.size))}</h1><p>Serial <strong>${esc(item.serial)}</strong></p><strong class="label-code">${esc(item.code)}</strong></div><div>${svg}</div></article>`;
      window.print();
    } catch (error) { toast(error.message,true); }
    return;
  }
  if (busy) return;
  if (!await flushDraft()) return;
  const item = record();
  if (!item) return;
  const command = { type: action === 'resume' ? 'start' : action, instrumentId: item.id, expectedVersion: detailVersion, payload: {} };
  if (action === 'qcSubmit') command.payload.measurements = Object.fromEntries(MEASURES.map(measure => [measure.key, $(`[name="qc-${measure.key}"]`).value]));
  if (action === 'qcSubmit') command.payload.selfRecheck = document.querySelector('[name="qc-self-recheck"]')?.checked === true;
  if (action === 'qcReturn') command.payload.reason = $('[name="qc-reason"]').value;
  if (action === 'block') command.payload.reason = $('[name="block-reason"]').value;
  if (action === 'finalSignoff') command.payload = { treble: $('[name="final-treble"]').value, bass: $('[name="final-bass"]').value, functional: $('[name="final-functional"]').checked, visual: $('[name="final-visual"]').checked };
  try {
    busy = true;
    $$('[data-action]', $('#instrument-dialog')).forEach(button => button.disabled = true);
    workspace = await store.dispatch(command, actor()) || await store.getState();
    setSaveStatus();
    renderOverview();
    renderDetail(record());
    toast(({start:'Work started.',pause:'Timer paused. Your measurements are saved.',submit:'Record signed and submitted to QC.',qcSubmit:'Independent measurements recorded.',qcApprove:'QC approved. Final verification is still required.',qcReturn:'Returned to the bench with a recorded reason.',finalSignoff:'Instrument ready. Certificate available.',block:'Issue flagged for management.',resolveBlock:'Block resolved.',deliver:'Return recorded.'})[command.type] || 'Change saved.');
  } catch (error) { showDetailError(error); }
  finally { busy = false; $$('[data-action]', $('#instrument-dialog')).forEach(button => button.disabled = false); }
}

function printCertificate(item) {
  if (!['ready','delivered'].includes(item.status) || !item.finalCheck) return;
  const qc = item.qcAttempts.filter(attempt => attempt.decision === 'approved').at(-1);
  $('#print-area').innerHTML = `<article class="certificate"><header><span>SetupQC · ${demo ? 'DEMO' : 'Quality control'}</span><h1>Verification certificate</h1><p>${esc(item.specSnapshot.model)} · ${esc(item.specSnapshot.client)} · ${esc(displaySize(item.specSnapshot.size))}</p></header><div class="certificate-meta"><p>Serial <strong>${esc(item.serial)}</strong></p><p>Code <strong>${esc(item.code)}</strong></p><p>Batch <strong>${esc(item.batch || 'No batch')}</strong></p></div><table><thead><tr><th>Measurement (mm)</th><th>Spec</th><th>Bench</th><th>QC</th><th>Final</th></tr></thead><tbody>${MEASURES.map(measure => `<tr><td>${esc(measure.label)}</td><td>${rangeText(item.specSnapshot.targets[measure.key])}</td><td>${esc(item.measurements[measure.key])}</td><td>${esc(qc?.measurements[measure.key])}</td><td>${['treble','bass'].includes(measure.key) ? esc(item.finalCheck[measure.key]) : '—'}</td></tr>`).join('')}</tbody></table><p>Bench: ${esc(item.technician)} · ${qc?.mode === 'self-recheck' ? `QC: SELF-RECHECK by ${esc(qc.inspector)} — the bench technician, not an independent inspection` : `Independent QC: ${esc(qc?.inspector)}`}</p><p>Final verification: ${esc(item.finalCheck.checkedBy || item.finalCheck.name || item.finalCheck.actor)} · ${datetime(item.finalCheck.at)}</p><p>Functional and visual checks completed. Actual values recorded without rounding.</p><div class="signature-line">Received by: __________________________ Date: ______________</div></article>`;
  window.print();
}

async function exportWorkspace(includeRecovery = false) {
  const saved = includeRecovery ? false : await flushDraft();
  // A full browser must not prevent downloading the last durable state.
  // Keep unfinished inputs in a separate recovery file, never invent signed data.
  const blob = new Blob([JSON.stringify(workspace,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `setupqc-${demo ? 'demo' : 'workshop'}-${today()}.json`;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  if (!saved && (pendingDraft || volatileDirty)) {
    const recovery = { recoveryVersion: 1, exportedAt: new Date().toISOString(), instrumentId: currentId, unsignedDraft: pendingDraft, unsignedInputs: Object.fromEntries($$('input[name],textarea[name],select[name]',$('#instrument-dialog')).map(input=>[input.name,input.type === 'checkbox' ? input.checked : input.value])) };
    const recoveryURL = URL.createObjectURL(new Blob([JSON.stringify(recovery,null,2)],{type:'application/json'}));
    const recoveryLink = document.createElement('a');
    recoveryLink.href = recoveryURL;
    recoveryLink.download = `setupqc-unsaved-draft-${today()}.json`;
    recoveryLink.click();
    setTimeout(()=>URL.revokeObjectURL(recoveryURL),1000);
    toast('Saved backup and unsigned draft downloaded separately. The draft is not a signed record.');
  } else toast('Backup exported. Keep a copy outside this browser.');
}

async function importWorkspace(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast('The backup exceeds the 10 MB limit.',true); return; }
  try {
    if (busy || !await canLeaveDetail()) return;
    const incoming = JSON.parse(await file.text());
    if (!window.confirm(`This will restore a backup in your ${demo ? 'demo' : 'workshop'} workspace. Export your current records first. Continue?`)) return;
    $('#instrument-dialog').close();
    currentId = null;
    workspace = await store.importWorkspace(incoming) || await store.getState();
    renderOverview();
    toast('Backup restored. The previous state is backed up on this computer.');
  } catch (error) { toast(`Backup not restored: ${error.message}`,true); }
  finally { $('#import-file').value = ''; }
}

document.addEventListener('click', async event => {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) return changeView(viewButton.dataset.view);
  const openButton = event.target.closest('[data-open]');
  if (openButton) return openDetail(openButton.dataset.open);
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) return detailAction(actionButton.dataset.action);
  if (event.target.closest('[data-new-instrument]')) return showIntake();
  if (event.target.closest('[data-scan-label]')) return $('#scan-image-file').click();
  if (event.target.closest('[data-demo]')) { $('#workspace-mode').value = 'demo'; $('#workspace-mode').dispatchEvent(new Event('change')); }
  const stage = event.target.closest('[data-stage-filter]');
  if (stage) { filter.status = stage.dataset.stageFilter; renderOverview(); }
  if (event.target.closest('[data-filter-exceptions]')) { filter.status = 'attention'; renderOverview(); }
});

$('#operator-name').value = operatorName;
$('#operator-name').addEventListener('change', async event => {
  const previous = operatorName;
  if (!await flushDraft()) { event.target.value = previous; return; }
  operatorName = event.target.value.trim();
  sessionStorage.setItem('setupqc_operator_name',operatorName);
  renderOverview();
});
$('#workspace-mode').addEventListener('change', async event => {
  if (!await canLeaveDetail()) { event.target.value = demo ? 'demo' : 'real'; return; }
  $('#instrument-dialog').close();
  currentId = null;
  demo = event.target.value === 'demo';
  sessionStorage.setItem('setupqc_demo_mode',String(demo));
  filter = {search:'',status:'',batch:''};
  const url = new URL(location.href);
  if (demo) url.searchParams.set('demo','1'); else url.searchParams.delete('demo');
  history.replaceState(null,'',url);
  await connectWorkspace();
});
$('#new-instrument-btn').addEventListener('click',showIntake);
$('#intake-close').addEventListener('click',()=>$('#intake-dialog').close());
$('#intake-cancel').addEventListener('click',()=>$('#intake-dialog').close());
$('#intake-form').addEventListener('submit',async event => {
  event.preventDefault();
  if (busy) return;
  try {
    busy = true;
    const payload = Object.fromEntries(new FormData(event.target));
    workspace = await store.dispatch({type:'intake',payload},actor()) || await store.getState();
    $('#intake-dialog').close();
    renderOverview();
    const item = workspace.instruments.find(item => item.serial.trim().toLocaleLowerCase() === payload.serial.trim().toLocaleLowerCase());
    toast('Instrument received. Its record is ready to start.');
    await openDetail(item.id);
  } catch (error) { $('#intake-error').textContent = error.message; $('#intake-error').hidden = false; }
  finally { busy = false; }
});
$('#instrument-dialog').addEventListener('input',event => { if (event.target.matches('[name^="measure-"], [name^="part-"], [name="work-notes"]')) queueDraft(); if (event.target.matches('[name^="qc-"], [name^="final-"]')) volatileDirty = true; updateMeasureFeedback(); });
$('#instrument-dialog').addEventListener('change',event => { if (event.target.matches('[name^="part-"]')) queueDraft(); });
$('#instrument-dialog').addEventListener('cancel',async event => { event.preventDefault(); if (await canLeaveDetail()) { $('#instrument-dialog').close(); currentId = null; } });
$('#export-btn').addEventListener('click',()=>exportWorkspace());
$('#import-btn').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',event=>importWorkspace(event.target.files[0]));
const scanInput = document.createElement('input');
scanInput.id = 'scan-image-file';
scanInput.type = 'file';
scanInput.accept = 'image/*';
scanInput.setAttribute('capture','environment');
scanInput.hidden = true;
document.body.append(scanInput);
scanInput.addEventListener('change',async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const code = (await decodeQRFile(file)).trim();
    const item = workspace.instruments.find(item => normalizedName(item.code) === normalizedName(code) || normalizedName(item.serial) === normalizedName(code));
    if (!item) throw new Error('This QR does not match an instrument in this workspace. You can also search by serial number.');
    await openDetail(item.id);
    toast('Label identified. Start or resume work when you are ready.');
  } catch (error) { toast(error.message,true); }
  finally { scanInput.value = ''; }
});
window.addEventListener('beforeunload',event => { if (pendingDraft || saveFailure || volatileDirty) { event.preventDefault(); event.returnValue = ''; } });
setInterval(()=>{ $$('[data-timer-id]').forEach(node => { const item = workspace?.instruments.find(item=>item.id === node.dataset.timerId); if (item) node.textContent = duration(elapsedMs(item)); }); },1000);

try { await connectWorkspace(); }
catch (error) { setSaveStatus('Storage unavailable',true); $('#view-content').innerHTML = `<div class="alert alert-danger"><h2>The workshop could not be opened</h2><p>${esc(error.message)}</p><p>Enable browser storage. Keep the existing records intact.</p></div>`; }
