// shaday-loader.js — El Shaday Restaurant (demo Alaluna AI Solutions)
// Reconstruye dialogo-ejemplo.mp3 (ejemplo de llamada con tonito) desde los
// trozos base64 mismo-origen (shaday-data-1.js … shaday-data-13.js)
// y lo entrega como Blob audio/mpeg al <audio id="ccAudio"> de la tarjeta.
// SHA-256 del máster reconstruido: 0025557072d01e23c0c7e6b216c31847ae30d2ecbe4158cc70d7ddffe5372e38
(function () {
  var CHUNKS = 13;
  function fail() { document.dispatchEvent(new Event('sh-audio-error')); }
  function build() {
    try {
      var parts = window.__SH_DLG || [];
      if (parts.length !== CHUNKS) { fail(); return; }
      var bin = atob(parts.join(''));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      var audio = document.getElementById('ccAudio');
      if (audio) audio.src = url;
      document.dispatchEvent(new CustomEvent('sh-audio-ready', { detail: { url: url } }));
    } catch (e) { fail(); }
  }
  function load(i) {
    if (i > CHUNKS) { build(); return; }
    var s = document.createElement('script');
    s.src = 'shaday-data-' + i + '.js';
    s.onload = function () { load(i + 1); };
    s.onerror = fail;
    document.head.appendChild(s);
  }
  load(1);
})();
