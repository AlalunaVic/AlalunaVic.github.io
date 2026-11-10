// belisario-loader.js — Don Belisario (demo Alaluna AI Solutions)
// Reconstruye el audio de ejemplo desde los trozos base64 mismo-origen
// (belisario-data-1.js … belisario-data-23.js) y lo entrega como
// Blob audio/mpeg al <audio id="ccAudio"> de la tarjeta.
// SHA-256 del máster reconstruido: abbe51b543ab86158630419f633f721c2ed50c82a020a5cd8beda1fb1a3628f5
(function () {
  var CHUNKS = 23;
  function fail() { document.dispatchEvent(new Event('tm-audio-error')); }
  function build() {
    try {
      var parts = window.__BELI_DLG || [];
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
    s.src = 'belisario-data-' + i + '.js';
    s.onload = function () { load(i + 1); };
    s.onerror = fail;
    document.head.appendChild(s);
  }
  load(1);
})();
