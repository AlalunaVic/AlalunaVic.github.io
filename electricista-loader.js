// electricista-loader.js — Voltia Servicios Eléctricos (demo Alaluna AI Solutions)
// Reconstruye el audio de ejemplo desde los trozos base64 mismo-origen
// (electricista-data-1.js … electricista-data-16.js) y lo entrega como
// Blob audio/mpeg al <audio id="ccAudio"> de la tarjeta.
// SHA-256 del máster reconstruido: 12b5897185729ca1c6a91fc6d313db1a8ebe8f2eff2a7b13f92f6658964fa076
(function () {
  var CHUNKS = 16;
  function fail() { document.dispatchEvent(new Event('tm-audio-error')); }
  function build() {
    try {
      var parts = window.__VOLTIA_DLG || [];
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
    s.src = 'electricista-data-' + i + '.js';
    s.onload = function () { load(i + 1); };
    s.onerror = fail;
    document.head.appendChild(s);
  }
  load(1);
})();
