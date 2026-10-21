/** Workshop rules. Actual measurements remain the exact strings entered by users. */
export const MEASURES = Object.freeze([
  { key: 'nut', label: 'Nut string spacing', shortLabel: 'Nut' },
  { key: 'feet', label: 'Bridge thickness at feet', shortLabel: 'Feet' },
  { key: 'top', label: 'Bridge thickness at strings', shortLabel: 'Strings' },
  { key: 'spacing', label: 'Bridge string spacing', shortLabel: 'Spacing' },
  { key: 'treble', label: 'Treble string height', shortLabel: 'Treble' },
  { key: 'bass', label: 'Bass string height', shortLabel: 'Bass' },
]);

// Model + client + size are intentional: these are not universal instrument specs.
// Sources: README invariants, docs/CONNOLLY-SISTEMA-COMPLETO-2026-10-17.md §6,
// existing SR52 Stock 13-inch template, and data/connolly-2026-10-26-batch.csv.
export const TEMPLATES = Object.freeze([
  { id: 'rev25-sw-44', model: 'REV25', client: 'Sweetwater', size: 'Violin 4/4', name: 'REV25 · Sweetwater · 4/4', source: 'REV25 Sweetwater card; system brief §6.1. Nominal bridge feet 5 mm ±1 mm (README).', targets: { nut: [16.4, 16.6], feet: [4, 6], top: [1.3, 1.6], spacing: [33.9, 34.1], treble: [3.5, 3.7], bass: [5.5, 5.7] }, kit: ['Bridge', 'String set', 'Tailpiece'] },
  { id: 'sr52-stock-13', model: 'SR52E13H', client: 'Stock', size: 'Viola 13″', name: 'SR52E13H · Stock · 13″', source: 'SR52E13H Stock template from the existing application. Nominal bridge feet 3.9 mm ±1 mm (README). Confirm the physical card at intake.', targets: { nut: [14.9, 15.1], feet: [2.9, 4.9], top: [1.1, 1.3], spacing: [30.9, 31.1], treble: [3.1, 3.3], bass: [5, 5.2] }, kit: ['Despiau bridge', 'Viola 13″ string set', 'Wittner tailpiece'] },
  { id: 'sr43-rmi-44', model: 'SR43E4H', client: 'RMI', size: 'Cello 4/4', name: 'SR43E4H · RMI · 4/4', source: 'Standard Spec cello 4/4 card from the SR43E4H record; scan/PROJECT.md documents RMI. Nominal bridge feet 11 mm ±1 mm (README).', targets: { nut: [21.9, 22.1], feet: [10, 12], top: [2.5, 2.7], spacing: [46.9, 47.1], treble: [5.4, 5.6], bass: [7.9, 8.1] }, kit: ['Cello 4/4 bridge', 'Cello 4/4 string set', 'Tailpiece'] },
]);

export const STAGES = Object.freeze({
  received: { label: 'Received', color: 'slate' },
  working: { label: 'At the bench', color: 'blue' },
  paused: { label: 'Paused', color: 'slate' },
  blocked: { label: 'Blocked', color: 'red' },
  qc: { label: 'Blind QC', color: 'amber' },
  final: { label: 'Final check', color: 'violet' },
  ready: { label: 'Ready for return', color: 'green' },
  delivered: { label: 'Returned', color: 'green' },
  rework: { label: 'Rework', color: 'red' },
});

export class DomainError extends Error {
  constructor(code, message, fields = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.fields = fields;
  }
}

const clone = value => structuredClone(value);
const clean = value => typeof value === 'string' ? value.trim() : '';
const identity = value => clean(value).normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase();
const text = (value, max = 5000) => typeof value === 'string' && value.length <= max;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const emptyMeasurements = () => Object.fromEntries(MEASURES.map(({ key }) => [key, '']));
const editable = new Set(['received', 'working', 'paused', 'rework']);
const fail = (code, message, fields) => { throw new DomainError(code, message, fields); };
const id = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

function dateValue(now) {
  const value = now instanceof Date ? now.toISOString() : now;
  if (!validDate(value)) fail('date', 'The record date is not valid.');
  return value;
}

function numberValue(raw) {
  const source = typeof raw === 'number' ? String(raw) : clean(raw);
  if (!source) return null;
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(source)) return NaN;
  return Number(source.replace(',', '.'));
}

export function validateMeasurements(measurements, snapshot) {
  const missing = [], invalid = [], outOfRange = [], details = {};
  for (const { key } of MEASURES) {
    const raw = measurements?.[key];
    const value = numberValue(raw);
    const target = snapshot?.targets?.[key];
    let reason = null;
    if (value === null) { missing.push(key); reason = 'missing'; }
    else if (!Number.isFinite(value) || value <= 0 || !Array.isArray(target) || target.length !== 2 || !target.every(Number.isFinite) || value > Math.max(target[1] * 3, target[1] + 10)) { invalid.push(key); reason = 'invalid'; }
    else if (value < target[0] - 1e-9 || value > target[1] + 1e-9) { outOfRange.push(key); reason = 'outOfRange'; }
    details[key] = { raw: raw ?? '', value: Number.isFinite(value) ? value : null, target: target ? [...target] : null, valid: reason === null, reason };
  }
  return { valid: !(missing.length || invalid.length || outOfRange.length), missing, invalid, outOfRange, details };
}

export function elapsedMs(instrument, now = new Date().toISOString()) {
  const timer = instrument?.timer || {};
  const saved = Number.isFinite(timer.elapsedMs) ? Math.max(0, timer.elapsedMs) : 0;
  const started = Date.parse(timer.startedAt);
  const current = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : Date.parse(now);
  return saved + (Number.isFinite(started) && Number.isFinite(current) ? Math.max(0, current - started) : 0);
}

export function createWorkspace({ demo = false, now = new Date().toISOString() } = {}) {
  if (demo) return createDemoWorkspace(now);
  return { schemaVersion: 1, revision: 0, demo: false, createdAt: dateValue(now), instruments: [], activity: [] };
}

function requireRole(actor, allowed) {
  if (!actor || !clean(actor.name) || !text(actor.name, 150)) fail('actor', 'Enter your name before recording work (maximum 150 characters).');
  if (!allowed.includes(actor.role)) fail('role', 'This action belongs to another workshop role.');
}

function requireOwner(instrument, actor) {
  if (instrument.technician && identity(instrument.technician) !== identity(actor.name)) fail('owner', `${instrument.technician} is responsible for this record. Keep the original signature and use that person’s session to continue.`);
}

function requireStage(instrument, allowed) {
  if (!allowed.includes(instrument.status)) fail('stage', 'The record changed stage or this action is no longer available.');
}

function requireValid(measurements, snapshot) {
  const result = validateMeasurements(measurements, snapshot);
  if (!result.valid) fail('measurements', 'Complete all six actual measurements and correct any values outside the specification.', result);
  return result;
}

function stopped(instrument, now) {
  instrument.timer = { elapsedMs: elapsedMs(instrument, now), startedAt: null };
}

function event(state, instrument, actor, type, message, now) {
  const entry = { id: id('event'), at: now, actor: clean(actor.name), role: actor.role, type, text: message };
  instrument.history.push(entry);
  state.activity.unshift({ ...entry, instrumentId: instrument.id, serial: instrument.serial, code: instrument.code });
}

function draftValues(payload, instrument) {
  if (payload.measurements !== undefined) {
    if (!plain(payload.measurements) || Object.keys(payload.measurements).some(key => !MEASURES.some(m => m.key === key))) fail('measurements', 'The record contains unknown measurement fields.');
    for (const [key, value] of Object.entries(payload.measurements)) {
      if (!text(value, 100)) fail('measurements', 'Keep each measurement as decimal text without rounding.');
      instrument.measurements[key] = value;
    }
  }
  if (payload.parts !== undefined) {
    if (!Array.isArray(payload.parts) || payload.parts.length !== instrument.parts.length) fail('parts', 'The parts list does not match the record.');
    instrument.parts = payload.parts.map((part, index) => {
      if (!plain(part) || part.name !== instrument.parts[index].name || !['pending', 'installed', 'substituted', 'not_required'].includes(part.status) || !text(part.note ?? '')) fail('parts', 'Check each part’s status and note.');
      return { name: part.name, status: part.status, note: part.note ?? '' };
    });
  }
  if (payload.notes !== undefined) {
    if (!text(payload.notes)) fail('notes', 'The note is too long.');
    instrument.notes = payload.notes;
  }
}

/** All mutations are immutable; callers may supply expectedVersion to reject stale forms. */
export function reduceWorkspace(previous, action, actor = {}, now = new Date().toISOString()) {
  if (!previous || previous.schemaVersion !== 1 || !Array.isArray(previous.instruments)) fail('schema', 'The workshop record has an unknown format.');
  if (!action || !text(action.type, 80)) fail('action', 'The action is not valid.');
  const at = dateValue(now);
  const payload = action.payload || {};
  const state = clone(previous);
  const allowedRoles = action.type === 'deliver' ? ['luthier', 'manager'] : action.type.startsWith('qc') ? ['qc'] : ['luthier'];
  requireRole(actor, allowedRoles);
  let instrument;
  if (action.type === 'intake') {
    const serial = clean(payload.serial);
    if (!serial || serial.length > 150) fail('serial', 'Read and enter the instrument’s serial number.', { serial: 'required' });
    if (state.instruments.some(item => identity(item.serial) === identity(serial))) fail('duplicate_serial', 'This serial number is already registered.', { serial: 'duplicate' });
    const template = TEMPLATES.find(item => item.id === payload.templateId);
    if (!template) fail('template', 'Select a valid model, client and size specification.');
    for (const key of ['batch', 'assignee', 'notes']) if (payload[key] !== undefined && !text(payload[key])) fail('intake', 'Check the intake details.');
    const dueDate = clean(payload.dueDate);
    if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !validDate(`${dueDate}T12:00:00Z`) || new Date(`${dueDate}T12:00:00Z`).toISOString().slice(0, 10) !== dueDate)) fail('dueDate', 'Select a valid return date.');
    let code;
    do { code = `QC-${id('').replace(/[^a-z0-9]/gi, '').slice(0, 7).toUpperCase()}`; } while (state.instruments.some(item => item.code === code));
    instrument = { id: id('instrument'), version: 1, code, serial, templateId: template.id, specSnapshot: clone(template), batch: clean(payload.batch), dueDate, assignee: clean(payload.assignee), status: 'received', technician: '', measurements: emptyMeasurements(), parts: template.kit.map(name => ({ name, status: 'pending', note: '' })), notes: payload.notes || '', createdAt: at, updatedAt: at, timer: { elapsedMs: 0, startedAt: null }, qcAttempts: [], finalCheck: null, problem: null, history: [] };
    state.instruments.unshift(instrument);
    event(state, instrument, actor, 'intake', 'Instrument received; record and specification saved.', at);
  } else {
    instrument = state.instruments.find(item => item.id === (action.instrumentId || payload.instrumentId));
    if (!instrument) fail('not_found', 'The instrument was not found.');
    if (action.expectedVersion !== undefined && action.expectedVersion !== instrument.version) fail('conflict', 'The record changed in another tab. Review the current version before saving; your changes have not been overwritten.');
    switch (action.type) {
      case 'start':
        requireStage(instrument, ['received', 'paused', 'rework']);
        requireOwner(instrument, actor);
        if (state.instruments.some(item => item.id !== instrument.id && item.status === 'working' && identity(item.technician) === identity(actor.name))) fail('active_timer', 'You already have an instrument at the bench. Pause it before starting another.');
        instrument.technician ||= clean(actor.name);
        instrument.status = 'working';
        instrument.timer.startedAt = at;
        event(state, instrument, actor, 'start', 'Bench work started.', at);
        break;
      case 'pause':
        requireStage(instrument, ['working']); requireOwner(instrument, actor);
        stopped(instrument, at); instrument.status = 'paused';
        event(state, instrument, actor, 'pause', 'Work paused; timer stopped.', at);
        break;
      case 'saveDraft': {
        const stage = instrument.status === 'blocked' ? instrument.problem?.previousStatus : instrument.status;
        if (!editable.has(stage)) fail('locked', 'Measurements sent to QC are locked. Returning the instrument for rework unlocks the record.');
        requireOwner(instrument, actor); draftValues(payload, instrument);
        // Draft saves have a revision but do not flood the manager activity feed.
        break;
      }
      case 'block':
        requireStage(instrument, ['received', 'working', 'paused', 'rework', 'final']); requireOwner(instrument, actor);
        if (!clean(payload.reason) || !text(payload.reason)) fail('reason', 'Describe the problem so the manager can review it (maximum 5000 characters).');
        instrument.problem = { reason: clean(payload.reason), previousStatus: instrument.status, at, actor: clean(actor.name) };
        stopped(instrument, at); instrument.status = 'blocked';
        event(state, instrument, actor, 'block', `Work blocked: ${instrument.problem.reason}`, at);
        break;
      case 'resolveBlock': {
        requireStage(instrument, ['blocked']); requireOwner(instrument, actor);
        const stage = instrument.problem?.previousStatus;
        if (!['received', 'working', 'paused', 'rework', 'final'].includes(stage)) fail('stage', 'The previous stage cannot be restored.');
        if (stage === 'working' && state.instruments.some(item => item.id !== instrument.id && item.status === 'working' && identity(item.technician) === identity(actor.name))) fail('active_timer', 'Pause the current instrument before resuming the blocked work.');
        instrument.status = stage;
        instrument.problem = null;
        if (stage === 'working') instrument.timer.startedAt = at;
        event(state, instrument, actor, 'resolveBlock', 'Problem resolved; work can continue.', at);
        break;
      }
      case 'submit':
        requireStage(instrument, ['working', 'paused', 'rework']); requireOwner(instrument, actor);
        if (!instrument.technician) fail('technician', 'Start work to record the responsible technician.');
        // Accept a current form atomically as well as previously saved drafts.
        draftValues(payload, instrument);
        requireValid(instrument.measurements, instrument.specSnapshot);
        if (instrument.parts.some(part => part.status === 'pending' || (['substituted', 'not_required'].includes(part.status) && !clean(part.note)))) fail('parts', 'Install the parts or document every substitution and non-required part before sending to QC.');
        stopped(instrument, at); instrument.status = 'qc'; instrument.finalCheck = null;
        event(state, instrument, actor, 'submit', 'Six measurements and kit complete; sent to blind QC.', at);
        break;
      case 'qcSubmit': {
        requireStage(instrument, ['qc']);
        const selfRecheck = identity(actor.name) === identity(instrument.technician);
        if (selfRecheck && payload.selfRecheck !== true) fail('same_inspector', 'The inspector cannot be the technician who performed the work, unless the inspection is explicitly recorded as a SELF-RECHECK. A self-recheck is not independent QC.');
        if (instrument.qcAttempts.at(-1)?.decision === 'pending') fail('pending_qc', 'This inspection is already recorded; approve it or return it for rework.');
        const result = validateMeasurements(payload.measurements, instrument.specSnapshot);
        if (result.missing.length || result.invalid.length) fail('measurements', 'Record all six actual inspector measurements before comparing.', result);
        const measures = Object.fromEntries(MEASURES.map(({ key }) => [key, String(payload.measurements[key])]));
        const flags = [];
        for (const { key } of MEASURES) {
          if (result.outOfRange.includes(key)) flags.push({ key, type: 'outOfRange' });
          const delta = Math.abs(numberValue(measures[key]) - numberValue(instrument.measurements[key]));
          if (delta > 0.2 + 1e-9) flags.push({ key, type: 'discrepancy', delta });
        }
        instrument.qcAttempts.push({ id: id('qc'), mode: selfRecheck ? 'self-recheck' : 'independent', inspector: clean(actor.name), technician: instrument.technician, measurements: measures, technicianMeasurements: clone(instrument.measurements), specSnapshot: clone(instrument.specSnapshot), submittedAt: at, decision: 'pending', reason: '', flags });
        event(state, instrument, actor, 'qcSubmit', selfRecheck ? 'SELF-RECHECK recorded: the technician re-measured their own work. This is not independent QC.' : (flags.length ? 'QC recorded with discrepancies; resolution required.' : 'Blind QC recorded; measurements agree.'), at);
        break;
      }
      case 'qcApprove': {
        requireStage(instrument, ['qc']);
        const attempt = instrument.qcAttempts.at(-1);
        if (!attempt || attempt.decision !== 'pending') fail('qc', 'Record a blind inspection first.');
        if (identity(attempt.inspector) !== identity(actor.name)) fail('inspector', 'The inspector who recorded these measurements must sign.');
        requireValid(attempt.measurements, instrument.specSnapshot);
        if (attempt.flags.some(flag => flag.type === 'outOfRange')) fail('qc_flags', 'QC recorded out-of-spec measurements. Return the instrument for correction and remeasurement.');
        attempt.decision = 'approved'; attempt.decidedAt = at;
        instrument.status = 'final';
        const noted = attempt.flags.some(flag => flag.type === 'discrepancy') ? ' Discrepancies over 0.2 mm vs the bench readings are noted on the record; all values are within spec.' : '';
        event(state, instrument, actor, 'qcApprove', (attempt.mode === 'self-recheck' ? 'SELF-RECHECK approved; final packing check required.' : 'Independent QC approved; final packing check required.') + noted, at);
        break;
      }
      case 'qcReturn': {
        requireStage(instrument, ['qc']);
        const attempt = instrument.qcAttempts.at(-1);
        if (!attempt || attempt.decision !== 'pending') fail('qc', 'Record the blind inspection first.');
        if (identity(attempt.inspector) !== identity(actor.name)) fail('inspector', 'The inspector who recorded these measurements must sign.');
        if (!clean(payload.reason) || !text(payload.reason)) fail('reason', 'Describe what needs correction before returning to the bench (maximum 5000 characters).');
        attempt.decision = 'returned'; attempt.reason = clean(payload.reason); attempt.decidedAt = at;
        instrument.status = 'rework'; instrument.finalCheck = null;
        event(state, instrument, actor, 'qcReturn', `Returned for rework: ${attempt.reason}`, at);
        break;
      }
      case 'finalSignoff': {
        requireStage(instrument, ['final']); requireOwner(instrument, actor);
        if (payload.functional !== true || payload.visual !== true) fail('final_checks', 'Confirm the functional and visual checks before closing.');
        const measures = { ...instrument.measurements, treble: String(payload.treble ?? ''), bass: String(payload.bass ?? '') };
        const result = validateMeasurements(measures, instrument.specSnapshot);
        if (['treble', 'bass'].some(key => !result.details[key].valid)) fail('final_measurements', 'Remeasure both string heights and confirm that they meet the specification.', result);
        instrument.finalCheck = { treble: measures.treble, bass: measures.bass, functional: true, visual: true, actor: clean(actor.name), at };
        instrument.status = 'ready';
        event(state, instrument, actor, 'finalSignoff', 'String heights rechecked; functional and visual checks signed.', at);
        break;
      }
      case 'deliver':
        requireStage(instrument, ['ready']);
        instrument.status = 'delivered';
        event(state, instrument, actor, 'deliver', 'Instrument returned; record closed.', at);
        break;
      default: fail('action', 'The action is not valid.');
    }
    instrument.version = (instrument.version || 0) + 1;
    instrument.updatedAt = at;
  }
  state.revision = previous.revision + 1;
  return state;
}

/** Explicit synthetic data, stored under a different key from real workshop work. */
export function createDemoWorkspace(now = new Date().toISOString()) {
  const at = dateValue(now);
  let state = { ...createWorkspace({ now: at }), demo: true };
  const tech = { name: 'Demo luthier', role: 'luthier' };
  const inspector = { name: 'Demo inspector', role: 'qc' };
  const due = new Date(Date.parse(at) + 86400000).toISOString().slice(0, 10);
  const values = { nut: '16.5', feet: '5.00', top: '1.45', spacing: '34', treble: '3.6', bass: '5.6' };
  for (const [index, target] of ['received', 'blocked', 'qc', 'final', 'ready', 'rework', 'working'].entries()) {
    state = reduceWorkspace(state, { type: 'intake', payload: { serial: `DEMO-${String(index + 1).padStart(3, '0')}`, templateId: 'rev25-sw-44', batch: 'Demo batch', dueDate: due, assignee: tech.name, notes: 'Synthetic examples for exploring the workflow; these are not company inventory.' } }, tech, at);
    const instrumentId = state.instruments[0].id;
    const act = (type, payload = {}, actor = tech) => { state = reduceWorkspace(state, { type, instrumentId, payload }, actor, at); };
    if (target === 'received') continue;
    act('start');
    act('saveDraft', { measurements: values, parts: state.instruments[0].parts.map(part => ({ ...part, status: 'installed' })) });
    if (target === 'working') continue;
    if (target === 'blocked') { act('block', { reason: 'A replacement part needs confirmation (demo).' }); continue; }
    act('submit');
    if (target === 'qc') continue;
    act('qcSubmit', { measurements: target === 'rework' ? { ...values, bass: '5.9' } : values }, inspector);
    if (target === 'rework') { act('qcReturn', { reason: 'Correct the bass string height before repeating QC (demo).' }, inspector); continue; }
    act('qcApprove', {}, inspector);
    if (target === 'ready') act('finalSignoff', { treble: '3.6', bass: '5.6', functional: true, visual: true });
  }
  return state;
}

/** Strict bounded backup validation; unknown shapes cannot replace local records. */
export function validateWorkspace(value, { demo } = {}) {
  const errors = [];
  const error = message => errors.push(message);
  const keys = (object, allowed) => plain(object) && Object.keys(object).every(key => allowed.includes(key));
  const rootKeys = ['schemaVersion', 'revision', 'demo', 'createdAt', 'instruments', 'activity'];
  if (!keys(value, rootKeys)) return { valid: false, errors: ['Unknown backup format.'] };
  if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.demo !== 'boolean' || !validDate(value.createdAt)) error('Invalid backup header.');
  if (demo !== undefined && value.demo !== demo) error('This backup belongs to another workspace: real work and demonstrations remain separate.');
  if (!Array.isArray(value.instruments) || value.instruments.length > 10000 || !Array.isArray(value.activity) || value.activity.length > 200000) return { valid: false, errors: [...errors, 'Invalid record lists.'] };
  const ids = new Set(), serials = new Set(), codes = new Set();
  const rawMeasures = measures => keys(measures, MEASURES.map(m => m.key)) && MEASURES.every(({ key }) => text(measures[key], 100));
  const snapshot = spec => plain(spec) && text(spec.id, 150) && text(spec.name, 300) && text(spec.model, 150) && text(spec.client, 150) && text(spec.size, 150) && plain(spec.targets) && MEASURES.every(({ key }) => Array.isArray(spec.targets[key]) && spec.targets[key].length === 2 && spec.targets[key].every(n => Number.isFinite(n) && n > 0) && spec.targets[key][0] <= spec.targets[key][1]) && Array.isArray(spec.kit) && spec.kit.length <= 100 && spec.kit.every(part => text(part, 300));
  const historyEntry = item => plain(item) && text(item.id, 150) && validDate(item.at) && text(item.actor, 150) && text(item.type, 100) && text(item.text);
  const instrumentKeys = ['id', 'version', 'code', 'serial', 'templateId', 'specSnapshot', 'batch', 'dueDate', 'assignee', 'status', 'technician', 'measurements', 'parts', 'notes', 'createdAt', 'updatedAt', 'timer', 'qcAttempts', 'finalCheck', 'problem', 'history'];
  for (const item of value.instruments) {
    if (!keys(item, instrumentKeys) || !text(item.id, 150) || !item.id || !Number.isSafeInteger(item.version) || item.version < 1 || !text(item.serial, 150) || !clean(item.serial) || !text(item.code, 150) || !item.code) { error('Invalid instrument identification.'); continue; }
    if (ids.has(item.id) || serials.has(identity(item.serial)) || codes.has(identity(item.code))) error('The backup contains duplicate IDs, serial numbers or codes.');
    ids.add(item.id); serials.add(identity(item.serial)); codes.add(identity(item.code));
    if (!Object.hasOwn(STAGES, item.status) || !snapshot(item.specSnapshot) || item.templateId !== item.specSnapshot.id || !rawMeasures(item.measurements)) error(`Invalid specification or stage: ${item.serial}.`);
    if (!['batch', 'dueDate', 'assignee', 'technician', 'notes'].every(key => text(item[key])) || !validDate(item.createdAt) || !validDate(item.updatedAt)) error(`Invalid general details: ${item.serial}.`);
    if (!keys(item.timer, ['elapsedMs', 'startedAt']) || !Number.isFinite(item.timer.elapsedMs) || item.timer.elapsedMs < 0 || (item.timer.startedAt !== null && !validDate(item.timer.startedAt))) error(`Invalid timer: ${item.serial}.`);
    if (!Array.isArray(item.parts) || item.parts.length > 100 || item.parts.some(part => !keys(part, ['name', 'status', 'note']) || !text(part.name, 300) || !['pending', 'installed', 'substituted', 'not_required'].includes(part.status) || !text(part.note)) || (snapshot(item.specSnapshot) && (item.parts.length !== item.specSnapshot.kit.length || item.parts.some((part, index) => part.name !== item.specSnapshot.kit[index])))) error(`Invalid parts: ${item.serial}.`);
    const attemptKeys = ['id', 'inspector', 'technician', 'measurements', 'technicianMeasurements', 'specSnapshot', 'submittedAt', 'decision', 'reason', 'flags', 'decidedAt'];
    if (!Array.isArray(item.qcAttempts) || item.qcAttempts.length > 1000 || item.qcAttempts.some(attempt => !keys(attempt, [...attemptKeys, 'mode']) || (Object.hasOwn(attempt, 'mode') && !['independent', 'self-recheck'].includes(attempt.mode)) || !text(attempt.id, 150) || !text(attempt.inspector, 150) || !text(attempt.technician, 150) || (identity(attempt.inspector) === identity(attempt.technician) && attempt.mode !== 'self-recheck') || !rawMeasures(attempt.measurements) || !rawMeasures(attempt.technicianMeasurements) || !snapshot(attempt.specSnapshot) || !validDate(attempt.submittedAt) || !['pending', 'approved', 'returned'].includes(attempt.decision) || !text(attempt.reason) || !Array.isArray(attempt.flags) || attempt.flags.length > 12 || attempt.flags.some(flag => !keys(flag, ['key', 'type', 'delta']) || !MEASURES.some(m => m.key === flag.key) || !['outOfRange', 'discrepancy'].includes(flag.type) || (flag.type === 'discrepancy' && !Number.isFinite(flag.delta))))) error(`Invalid QC inspections: ${item.serial}.`);
    if (Array.isArray(item.qcAttempts)) for (const attempt of item.qcAttempts) {
      if (plain(attempt) && rawMeasures(attempt.measurements) && rawMeasures(attempt.technicianMeasurements) && snapshot(attempt.specSnapshot) && attempt.decision === 'approved' && (!validateMeasurements(attempt.measurements, attempt.specSnapshot).valid)) error(`The approved QC does not meet the specification: ${item.serial}.`);
    }
    if (!Array.isArray(item.history) || item.history.length > 100000 || !item.history.every(historyEntry)) error(`Invalid history: ${item.serial}.`);
    if (item.problem !== null && (!keys(item.problem, ['reason', 'previousStatus', 'at', 'actor']) || !text(item.problem.reason) || !Object.hasOwn(STAGES, item.problem.previousStatus) || !validDate(item.problem.at) || !text(item.problem.actor, 150))) error(`Invalid block: ${item.serial}.`);
    if (item.finalCheck !== null && (!keys(item.finalCheck, ['treble', 'bass', 'functional', 'visual', 'actor', 'at']) || !text(item.finalCheck.treble, 100) || !text(item.finalCheck.bass, 100) || item.finalCheck.functional !== true || item.finalCheck.visual !== true || !text(item.finalCheck.actor, 150) || !validDate(item.finalCheck.at))) error(`Invalid final signature: ${item.serial}.`);
    if (['ready', 'delivered'].includes(item.status) && !item.finalCheck) error(`Missing final check: ${item.serial}.`);
    if ((item.status === 'blocked') !== (item.problem !== null)) error(`The stage does not match the block: ${item.serial}.`);
    if (item.timer && ((item.status === 'working') !== (item.timer.startedAt !== null))) error(`The stage does not match the timer: ${item.serial}.`);
    if (['final', 'ready', 'delivered'].includes(item.status) && (!Array.isArray(item.qcAttempts) || item.qcAttempts.at(-1)?.decision !== 'approved' || item.qcAttempts.at(-1)?.flags?.some(flag => flag.type === 'outOfRange'))) error(`Missing approved QC: ${item.serial}.`);
    if (item.status === 'qc' && item.qcAttempts?.at?.(-1)?.decision === 'approved') error(`The stage does not match the approved QC: ${item.serial}.`);
    if (item.status === 'rework' && item.qcAttempts?.at?.(-1)?.decision !== 'returned') error(`Missing the return requiring rework: ${item.serial}.`);
    if (['working', 'paused', 'qc', 'final', 'ready', 'delivered', 'rework'].includes(item.status) && !clean(item.technician)) error(`Missing responsible technician: ${item.serial}.`);
    if (['qc', 'final', 'ready', 'delivered'].includes(item.status) && (!validateMeasurements(item.measurements, item.specSnapshot).valid || !Array.isArray(item.parts) || item.parts.some(part => part.status === 'pending' || (['substituted', 'not_required'].includes(part.status) && !clean(part.note))))) error(`The submitted record is incomplete: ${item.serial}.`);
    if (['ready', 'delivered'].includes(item.status) && item.finalCheck && (!validateMeasurements({ ...item.measurements, treble: item.finalCheck.treble, bass: item.finalCheck.bass }, item.specSnapshot).valid || identity(item.finalCheck.actor) !== identity(item.technician))) error(`The final check does not match the specification or signature: ${item.serial}.`);
  }
  const activeTechnicians = value.instruments.filter(item => item?.status === 'working').map(item => identity(item.technician));
  if (new Set(activeTechnicians).size !== activeTechnicians.length) error('A technician has more than one active timer.');
  if (!value.activity.every(historyEntry)) error('Invalid activity in the backup.');
  return { valid: errors.length === 0, errors };
}
