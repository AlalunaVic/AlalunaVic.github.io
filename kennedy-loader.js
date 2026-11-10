// kennedy-loader.js — Kennedy Fried Chicken (demo Alaluna AI Solutions)
// Rebuilds dialogo-ejemplo.mp3 (sample call with ringtone) from the same-origin
// base64 chunks (kennedy-data-1.js … kennedy-data-23.js) and hands it
// to the card's <audio id="ccAudio"> as a Blob audio/mpeg.
// SHA-256 of the rebuilt master: 7f30ee9294a78545dfd7914fe529396956cfc9914d69846ef6e052ab84215f5b
// v2 (2026-11-10): carga tolerante a fallos, misma plantilla que Voltia.
// Cada trozo se reintenta hasta 4 veces (espera creciente + cache-bust en los
// reintentos) y se vigila que no quede colgado (20 s). Antes, UN solo error de
// red en cualquier trozo disparaba el fallo definitivo y el audio moría para
// toda la visita. Los eventos de la página no cambian: kn-audio-ready /
// kn-audio-error, y el global sigue siendo window.__KN_DLG.
(function () {
  var CHUNKS = 23, MAX_TRIES = 4, STALL_MS = 20000;
  var done = false;
  function fail() { if (!done) { done = true; document.dispatchEvent(new Event('kn-audio-error')); } }
  function filled(i) { var p = window.__KN_DLG || []; return typeof p[i - 1] === 'string' && p[i - 1].length > 0; }
  function build() {
    if (done) return;
    try {
      var parts = window.__KN_DLG || [];
      if (parts.length !== CHUNKS) { fail(); return; }
      for (var k = 1; k <= CHUNKS; k++) { if (!filled(k)) { fail(); return; } }
      var bin = atob(parts.join(''));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      var audio = document.getElementById('ccAudio');
      if (audio) audio.src = url;
      done = true;
      document.dispatchEvent(new CustomEvent('kn-audio-ready', { detail: { url: url } }));
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
    s.src = 'kennedy-data-' + i + '.js' + (attempt > 1 ? '?r=' + attempt : '');
    document.head.appendChild(s);
  }
  load(1, 1);
})();
