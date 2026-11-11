// tc-intro-loader.js — Travel Care Assistance (demo iAlucina)
// Reconstruye el video de bienvenida (intro Alaluna -> Travel Care, 10 s) desde
// los trozos base64 mismo-origen (tc-intro-data-1.js … tc-intro-data-11.js)
// y lo entrega como Blob video/mp4 al <video id="tcIntroVideo"> de la intro.
// SHA-256 del máster reconstruido: 4bdba1c14f9169ddcc2add9ada956b40107f3252659c0225d1ca7ec9332ce756
// v2 (2026-11-10): carga tolerante a fallos. Cada trozo se reintenta hasta
// 4 veces (espera creciente + cache-bust en los reintentos) y se vigila que
// no quede colgado (20 s). Los trozos cargan EN PARALELO (la intro debe
// arrancar cuanto antes; el loader de audio de la casa es secuencial, este
// no). Si todo falla, dispara 'tc-intro-error' y la página retira la intro
// y muestra la demo.
(function () {
  var CHUNKS = 11, MAX_TRIES = 4, STALL_MS = 20000;
  var done = false;
  function fail() { if (!done) { done = true; document.dispatchEvent(new Event('tc-intro-error')); } }
  function filled(i) { var p = window.__TC_INTRO || []; return typeof p[i - 1] === 'string' && p[i - 1].length > 0; }
  function build() {
    if (done) return;
    try {
      var parts = window.__TC_INTRO || [];
      if (parts.length !== CHUNKS) { fail(); return; }
      for (var k = 1; k <= CHUNKS; k++) { if (!filled(k)) { fail(); return; } }
      var bin = atob(parts.join(''));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
      window.__TC_INTRO_URL = url;
      var video = document.getElementById('tcIntroVideo');
      if (video) video.src = url;
      done = true;
      document.dispatchEvent(new CustomEvent('tc-intro-ready', { detail: { url: url } }));
    } catch (e) { fail(); }
  }
  function maybeBuild() { for (var k = 1; k <= CHUNKS; k++) { if (!filled(k)) return; } build(); }
  function retry(i, attempt) {
    if (done) return;
    if (attempt >= MAX_TRIES) { fail(); return; }
    setTimeout(function () { load(i, attempt + 1); }, 600 * attempt);
  }
  function load(i, attempt) {
    if (done) return;
    if (filled(i)) { maybeBuild(); return; }
    var settled = false;
    var s = document.createElement('script');
    var stall = setTimeout(function () {
      if (settled) return; settled = true;
      if (s.parentNode) s.parentNode.removeChild(s);
      retry(i, attempt);
    }, STALL_MS);
    s.onload = function () {
      if (settled) return; settled = true; clearTimeout(stall);
      if (filled(i)) { maybeBuild(); } else { retry(i, attempt); }
    };
    s.onerror = function () {
      if (settled) return; settled = true; clearTimeout(stall);
      retry(i, attempt);
    };
    s.src = 'tc-intro-data-' + i + '.js' + (attempt > 1 ? '?r=' + attempt : '');
    document.head.appendChild(s);
  }
  for (var k = 1; k <= CHUNKS; k++) load(k, 1);
})();
