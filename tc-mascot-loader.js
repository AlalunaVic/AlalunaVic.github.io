// tc-mascot-loader.js — Travel Care Assistance (demo iAlucina)
// Reconstruye la mascota oficial (avioncito de Travel Care, WebP con transparencia)
// desde los trozos base64 mismo-origen (tc-mascot-data-1.js … -2.js) y
// la entrega como Blob image/webp a todo <img class="tc-mascot"> de la página
// (globito flotante y héroe junto al título).
// SHA-256 del máster reconstruido: 7446ba256a53aab4e3ea08a306d89e5fae9178b1946e7477c79010e7f45648cd
// Carga tolerante a fallos (patrón v2 de la casa): cada trozo se reintenta
// hasta 4 veces (espera creciente + cache-bust) con vigilancia de cuelgue
// (20 s), en paralelo. Si todo falla, dispara 'tc-mascot-error' y la página
// oculta los <img> (el globito conserva su círculo celeste; el héroe, su título).
(function () {
  var CHUNKS = 1, MAX_TRIES = 4, STALL_MS = 20000;
  var done = false;
  function fail() { if (!done) { done = true; document.dispatchEvent(new Event('tc-mascot-error')); } }
  function filled(i) { var p = window.__TC_MASCOT || []; return typeof p[i - 1] === 'string' && p[i - 1].length > 0; }
  function build() {
    if (done) return;
    try {
      var parts = window.__TC_MASCOT || [];
      if (parts.length !== CHUNKS) { fail(); return; }
      for (var k = 1; k <= CHUNKS; k++) { if (!filled(k)) { fail(); return; } }
      var bin = atob(parts.join(''));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
      window.__TC_MASCOT_URL = url;
      var imgs = document.querySelectorAll('img.tc-mascot');
      imgs.forEach(function (im) { im.src = url; im.classList.add('kn-on'); });
      done = true;
      document.dispatchEvent(new CustomEvent('tc-mascot-ready', { detail: { url: url } }));
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
    s.src = 'tc-mascot-data-' + i + '.js' + (attempt > 1 ? '?r=' + attempt : '');
    document.head.appendChild(s);
  }
  for (var k = 1; k <= CHUNKS; k++) load(k, 1);
})();
