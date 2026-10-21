import { createWorkspace, reduceWorkspace, validateWorkspace, DomainError } from './domain.js';

export const STORAGE_KEYS = Object.freeze({ live: 'setupqc_workshop_v1', demo: 'setupqc_demo_v1' });
const queues = new Map();

/** Shared-computer persistence. No data is sent to a server or another computer. */
export class WorkshopStore {
  constructor({ demo = false, storage = globalThis.localStorage, locks = typeof globalThis.window !== 'undefined' ? globalThis.navigator?.locks : undefined, eventTarget = globalThis.window, channelFactory } = {}) {
    this.demo = demo;
    this.key = demo ? STORAGE_KEYS.demo : STORAGE_KEYS.live;
    this.storage = storage;
    this.locks = locks;
    this.eventTarget = eventTarget;
    this.listeners = new Set();
    this.source = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    if (!storage?.getItem || !storage?.setItem) throw new DomainError('storage_unavailable', 'This browser cannot save work. Use a window with local storage enabled.');
    this.onStorage = event => { if (event.key === this.key && (!event.storageArea || event.storageArea === this.storage)) this.refresh(); };
    eventTarget?.addEventListener?.('storage', this.onStorage);
    const makeChannel = channelFactory || (typeof globalThis.window !== 'undefined' && globalThis.BroadcastChannel ? name => new globalThis.BroadcastChannel(name) : null);
    this.channel = makeChannel?.(`setupqc:${this.key}`);
    if (this.channel) this.channel.onmessage = event => { if (event.data?.source !== this.source) this.refresh(); };
  }

  async atomic(work) {
    if (this.locks?.request) return this.locks.request(`setupqc:${this.key}`, () => Promise.resolve().then(work));
    // Browsers without Web Locks still serialize synchronous operations in this tab.
    const preceding = queues.get(this.key) || Promise.resolve();
    let release;
    const current = new Promise(resolve => { release = resolve; });
    queues.set(this.key, current);
    await preceding;
    try { return work(); }
    finally { release(); if (queues.get(this.key) === current) queues.delete(this.key); }
  }

  read() {
    let raw;
    try { raw = this.storage.getItem(this.key); } catch { throw new DomainError('storage_unavailable', 'The local record cannot be read. Do not clear the browser data.'); }
    if (raw === null) return null;
    let state;
    try { state = JSON.parse(raw); } catch { throw new DomainError('storage_corrupt', 'The local record cannot be read. Keep a backup before restoring data.'); }
    const validation = validateWorkspace(state, { demo: this.demo });
    if (!validation.valid) throw new DomainError('storage_corrupt', 'The local record has an invalid format. Preserve the data and restore a valid backup.', { errors: validation.errors });
    return state;
  }

  write(state) {
    try { this.storage.setItem(this.key, JSON.stringify(state)); }
    catch { throw new DomainError('storage_write', 'Work could not be saved. Storage may be full or blocked; keep the record open and export a backup.'); }
  }

  initialize() {
    const existing = this.read();
    if (existing) return existing;
    const state = createWorkspace({ demo: this.demo });
    this.write(state);
    return state;
  }

  async getState() { return this.atomic(() => this.initialize()); }

  async dispatch(action, actor) {
    return this.atomic(() => {
      const next = reduceWorkspace(this.initialize(), action, actor);
      this.write(next);
      this.notify(next);
      return next;
    });
  }

  async importWorkspace(workspace) {
    const candidate = structuredClone(workspace);
    const validation = validateWorkspace(candidate, { demo: this.demo });
    if (!validation.valid) throw new DomainError('import_invalid', 'The backup is not valid and did not replace the workshop record.', { errors: validation.errors });
    return this.atomic(() => {
      const previous = this.read();
      candidate.revision = Math.max(candidate.revision, previous?.revision || 0) + 1;
      // If the backup cannot be made, refuse replacement; never lose the prior state.
      if (previous) {
        try { this.storage.setItem(`${this.key}_backup`, JSON.stringify(previous)); }
        catch { throw new DomainError('backup_write', 'The previous backup could not be preserved. Free up space or export the data before importing.'); }
      }
      this.write(candidate);
      this.notify(candidate);
      return structuredClone(candidate);
    });
  }

  subscribe(callback) {
    if (typeof callback !== 'function') throw new TypeError('subscribe requires a callback');
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(state) {
    for (const callback of this.listeners) {
      try { callback(structuredClone(state)); }
      catch (error) { console.error('SetupQC: a view could not be updated.', error); }
    }
  }

  notify(state) {
    this.emit(state);
    try { this.channel?.postMessage({ source: this.source, revision: state.revision }); } catch { /* storage events remain available. */ }
  }

  refresh() {
    this.getState().then(state => this.emit(state)).catch(error => { this.lastError = error; });
  }

  destroy() {
    this.eventTarget?.removeEventListener?.('storage', this.onStorage);
    this.channel?.close();
    this.listeners.clear();
  }
}
