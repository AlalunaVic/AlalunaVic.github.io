/* SetupQC published build: the vendored jsQR library exceeds the publish
   channel's per-file limit, so it ships in three same-origin parts that are
   assembled here before use. The private repository keeps the pristine file. */
(function () {
  var base = new URL('.', document.currentScript.src).href;
  var parts = ['jsQR.p1.js', 'jsQR.p2.js', 'jsQR.p3.js'];
  var src = '';
  for (var i = 0; i < parts.length; i++) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', base + parts[i], false);
    xhr.send(null);
    if (xhr.status !== 200) throw new Error('jsQR part failed to load: ' + parts[i]);
    src += xhr.responseText;
  }
  (0, eval)(src);
})();
