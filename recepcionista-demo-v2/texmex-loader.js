// texmex-loader.js — El Tex Mex Burrito Cafe (demo Alaluna AI Solutions)
// Reconstruye el audio de ejemplo vigente (v3, 78.68 s) desde los trozos
// base64 mismo-origen (texmex-data-1.js … texmex-data-20.js) y lo entrega
// como Blob audio/mpeg al <audio id="ccAudio"> de la tarjeta.
// SHA-256 del máster reconstruido: 497f7b4f2defce67d62a539b5766aba5e0b7918e7bbb907fe50fd8f2937a45ec
(function () {
  var CHUNKS = 20;
  function fail() { document.dispatchEvent(new Event('tm-audio-error')); }
  function build() {
    try {
      var parts = window.__TM_DLG || [];
      if (parts.length !== CHUNKS) { fail(); return; }
      var bin = atob(parts.join(''));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      var audio = document.getElementById('ccAudio');
      if (audio) audio.src = url;
      document.dispatchEvent(new CustomEvent('tm-audio-ready', { detail: { url: url } }));
    } catch (e) { fail(); }
  }
  function load(i) {
    if (i > CHUNKS) { build(); return; }
    var s = document.createElement('script');
    s.src = 'texmex-data-' + i + '.js';
    s.onload = function () { load(i + 1); };
    s.onerror = fail;
    document.head.appendChild(s);
  }
  load(1);
})();
