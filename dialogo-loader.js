// dialogo-loader.js — Travel Care Assistance (demo iAlucina)
// Reconstruye dialogo-ejemplo.mp3 desde los trozos base64 mismo-origen
// (dialogo-data-1.js … dialogo-data-12.js) y lo entrega como Blob audio/mpeg
// al <audio id="ccAudio"> de la tarjeta de llamada.
// SHA-256 del máster reconstruido: 047038761cf266d3bdc4c945f745bfaf7aa2360fdd24de06e7523c3021b304ac
(function () {
  var CHUNKS = 12;
  function fail() { document.dispatchEvent(new Event('tc-audio-error')); }
  function build() {
    try {
      var parts = window.__TC_DLG || [];
      if (parts.length !== CHUNKS) { fail(); return; }
      var bin = atob(parts.join(''));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      var audio = document.getElementById('ccAudio');
      if (audio) audio.src = url;
      document.dispatchEvent(new CustomEvent('tc-audio-ready', { detail: { url: url } }));
    } catch (e) { fail(); }
  }
  function load(i) {
    if (i > CHUNKS) { build(); return; }
    var s = document.createElement('script');
    s.src = 'dialogo-data-' + i + '.js';
    s.onload = function () { load(i + 1); };
    s.onerror = fail;
    document.head.appendChild(s);
  }
  load(1);
})();
