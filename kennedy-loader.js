// kennedy-loader.js — Kennedy Fried Chicken (demo Alaluna AI Solutions)
// Rebuilds dialogo-ejemplo.mp3 (sample call with ringtone) from the same-origin
// base64 chunks (kennedy-data-1.js … kennedy-data-16.js) and hands it
// to the card's <audio id="ccAudio"> as a Blob audio/mpeg.
// SHA-256 of the rebuilt master: bbc133bad15cab924bf974cb4aab7b8809cc11fc655dfaee188f878fb8a5bdcb
(function () {
  var CHUNKS = 16;
  function fail() { document.dispatchEvent(new Event('kn-audio-error')); }
  function build() {
    try {
      var parts = window.__KN_DLG || [];
      if (parts.length !== CHUNKS) { fail(); return; }
      var bin = atob(parts.join(''));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      var audio = document.getElementById('ccAudio');
      if (audio) audio.src = url;
      document.dispatchEvent(new CustomEvent('kn-audio-ready', { detail: { url: url } }));
    } catch (e) { fail(); }
  }
  function load(i) {
    if (i > CHUNKS) { build(); return; }
    var s = document.createElement('script');
    s.src = 'kennedy-data-' + i + '.js';
    s.onload = function () { load(i + 1); };
    s.onerror = fail;
    document.head.appendChild(s);
  }
  load(1);
})();
