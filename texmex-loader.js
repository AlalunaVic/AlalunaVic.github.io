// texmex-loader.js — El Tex Mex Burrito Cafe (demo Alaluna AI Solutions)
// Reconstruye dialogo-ejemplo.mp3 (ejemplo de llamada con tonito) desde los
// trozos base64 mismo-origen (texmex-data-1.js … texmex-data-11.js)
// y lo entrega como Blob audio/mpeg al <audio id="ccAudio"> de la tarjeta.
// SHA-256 del máster reconstruido: 2873e2dc4d5bbe15aa9a147bd3868c6c048efb4d146db1a64183f15eaf5f0bbb
(function () {
  var CHUNKS = 11;
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
