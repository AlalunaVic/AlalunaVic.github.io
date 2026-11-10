// multident-loader.js — Multident (demo Alaluna AI Solutions)
// Reconstruye el audio de ejemplo desde los trozos base64 mismo-origen
// (multident-data-1.js … multident-data-19.js) y lo entrega como
// Blob audio/mpeg al <audio id="ccAudio"> de la tarjeta.
// SHA-256 del máster reconstruido: f85b65428362e90c62edeb0440d652ee8f8a4ce172d4321b3defdbf102fca77c
(function () {
  var CHUNKS = 19;
  function fail() { document.dispatchEvent(new Event('tm-audio-error')); }
  function build() {
    try {
      var parts = window.__MULTI_DLG || [];
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
    s.src = 'multident-data-' + i + '.js';
    s.onload = function () { load(i + 1); };
    s.onerror = fail;
    document.head.appendChild(s);
  }
  load(1);
})();
