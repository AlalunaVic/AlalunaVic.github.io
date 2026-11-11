// dialogo-loader.js — Travel Care Assistance (demo iAlucina)
// Reconstruye el audio de ejemplo desde los trozos base64 mismo-origen
// (dialogo-data-1.js … dialogo-data-16.js) y lo entrega como
// Blob audio/mpeg al <audio id="ccAudio"> de la tarjeta.
// SHA-256 del máster reconstruido: 289ae951388af4df59f1755e067ed0ee9b2955bd4c2cc532bf513b0f03b9237a
// v2 (2026-11-10): carga tolerante a fallos. Cada trozo se reintenta hasta
// 4 veces (espera creciente + cache-bust en los reintentos) y se vigila que
// no quede colgado (20 s). Antes, UN solo error de red en cualquier trozo
// disparaba el fallo definitivo y el audio moría para toda la visita.
(function () {
  var CHUNKS = 25, MAX_TRIES = 4, STALL_MS = 20000;
  var done = false;
  function fail() { if (!done) { done = true; document.dispatchEvent(new Event('tc-audio-error')); } }
  function filled(i) { var p = window.__TC_DLG || []; return typeof p[i - 1] === 'string' && p[i - 1].length > 0; }
  function build() {
    if (done) return;
    try {
      var parts = window.__TC_DLG || [];
      if (parts.length !== CHUNKS) { fail(); return; }
      for (var k = 1; k <= CHUNKS; k++) { if (!filled(k)) { fail(); return; } }
      var bin = atob(parts.join(''));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      var audio = document.getElementById('ccAudio');
      if (audio) audio.src = url;
      done = true;
      document.dispatchEvent(new CustomEvent('tc-audio-ready', { detail: { url: url } }));
    } catch (e) { fail(); }
  }
  function retry(i, attempt) {
    if (done) return;
    if (attempt >= MAX_TRIES) { fail(); return; }
    setTimeout(function () { load(i, attempt + 1); }, 600 * attempt);
  }
  function load(i, attempt) {
    if (done) return;
    if (i > CHUNKS) { build(); return; }
    if (filled(i)) { load(i + 1, 1); return; }
    var settled = false;
    var s = document.createElement('script');
    var stall = setTimeout(function () {
      if (settled) return; settled = true;
      if (s.parentNode) s.parentNode.removeChild(s);
      retry(i, attempt);
    }, STALL_MS);
    s.onload = function () {
      if (settled) return; settled = true; clearTimeout(stall);
      if (filled(i)) { load(i + 1, 1); } else { retry(i, attempt); }
    };
    s.onerror = function () {
      if (settled) return; settled = true; clearTimeout(stall);
      retry(i, attempt);
    };
    s.src = 'dialogo-data-' + i + '.js' + (attempt > 1 ? '?r=' + attempt : '');
    document.head.appendChild(s);
  }
  load(1, 1);
})();
