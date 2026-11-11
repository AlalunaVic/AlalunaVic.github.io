// kennedy-mascot-loader.js — Kennedy Fried Chicken (demo Alaluna AI Solutions)
// Reconstruye la mascota oficial (muslito de Victor, WebP con transparencia)
// desde los trozos base64 mismo-origen (kennedy-mascot-data-1.js … -2.js) y
// la entrega como Blob image/webp a todo <img class="kn-mascot"> de la página
// (globito flotante y héroe junto al título).
// SHA-256 del máster reconstruido: 3b5e3526488483877d74bbe99e485fc2990183d4a92b6eea72ad7afd25037f3e
// Carga tolerante a fallos (patrón v2 de la casa): cada trozo se reintenta
// hasta 4 veces (espera creciente + cache-bust) con vigilancia de cuelgue
// (20 s), en paralelo. Si todo falla, dispara 'kn-mascot-error' y la página
// oculta los <img> (el globito conserva su círculo rojo; el héroe, su título).
(function () {
  var CHUNKS = 2, MAX_TRIES = 4, STALL_MS = 20000;
  var done = false;
  function fail() { if (!done) { done = true; document.dispatchEvent(new Event('kn-mascot-error')); } }
  function filled(i) { var p = window.__KN_MASCOT || []; return typeof p[i - 1] === 'string' && p[i - 1].length > 0; }
  function build() {
    if (done) return;
    try {
      var parts = window.__KN_MASCOT || [];
      if (parts.length !== CHUNKS) { fail(); return; }
      for (var k = 1; k <= CHUNKS; k++) { if (!filled(k)) { fail(); return; } }
      var bin = atob(parts.join(''));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
      window.__KN_MASCOT_URL = url;
      var imgs = document.querySelectorAll('img.kn-mascot');
      imgs.forEach(function (im) { im.src = url; im.classList.add('kn-on'); });
      done = true;
      document.dispatchEvent(new CustomEvent('kn-mascot-ready', { detail: { url: url } }));
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
    s.src = 'kennedy-mascot-data-' + i + '.js' + (attempt > 1 ? '?r=' + attempt : '');
    document.head.appendChild(s);
  }
  for (var k = 1; k <= CHUNKS; k++) load(k, 1);
})();
