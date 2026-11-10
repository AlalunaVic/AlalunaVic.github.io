// anitas-loader.js — Anita's Deli Grocery (demo Alaluna AI Solutions)
// Reconstruye el audio de ejemplo (69.00 s) desde los trozos base64
// mismo-origen (anitas-data-1.js … anitas-data-18.js) y lo entrega como
// Blob audio/mpeg al <audio id="ccAudio"> de la tarjeta.
// SHA-256 del máster reconstruido: 6d9b98d08d62652fb9a280e404beadca323ef6940fab1be1edf790d7c73a2bf9
(function () {
  var CHUNKS = 18;
  function fail() { document.dispatchEvent(new Event('tm-audio-error')); }
  function build() {
    try {
      var parts = window.__ANITAS_DLG || [];
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
    s.src = 'anitas-data-' + i + '.js';
    s.onload = function () { load(i + 1); };
    s.onerror = fail;
    document.head.appendChild(s);
  }
  load(1);
})();
