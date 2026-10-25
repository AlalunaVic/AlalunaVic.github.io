(function () {
  var ES = {
    "Explore the demos": "Explora las demos",
    "THE LOCAL BUSINESS COLLECTION": "LA COLECCIÓN DE NEGOCIOS LOCALES",
    "SMALL BUSINESSES. BIG FIRST IMPRESSIONS.": "NEGOCIOS PEQUEÑOS. PRIMERAS IMPRESIONES GRANDES.",
    "Local businesses.": "Negocios locales.",
    "Extraordinary": "Extraordinarios",
    "websites.": "sitios web.",
    "Six businesses. Six distinct points of view.": "Seis negocios. Seis puntos de vista distintos.",
    "Thoughtful design you can see, touch, and try.": "Diseño pensado para verse, tocarse y probarse.",
    "DESIGNED TO BE EXPLORED": "DISEÑADO PARA EXPLORARSE",
    "BEST EXPERIENCED ON YOUR PHONE": "SE DISFRUTA MEJOR EN TU TELÉFONO",
    "EVERY DEMO. ONE COMPLETE SYSTEM.": "CADA DEMO. UN SISTEMA COMPLETO.",
    "WhatsApp built in. Orders matched to your trade.": "WhatsApp integrado. Órdenes según tu tipo de negocio.",
    "An AI assistant that serves your customers — and automates your business.": "Un asistente con IA que atiende a tus clientes — y automatiza tu negocio.",
    "INCLUDED WITH EVERY WEBSITE": "INCLUIDO EN CADA SITIO WEB",
    "Artificial Intelligence": "Inteligencia Artificial",
    "for business": "para negocios",
    "THE COLLECTION": "LA COLECCIÓN",
    "06 INDUSTRIES / ENDLESS POSSIBILITIES": "06 INDUSTRIAS / POSIBILIDADES INFINITAS",
    "Available to explore": "Disponible para explorar",
    "01 / BARBERSHOP": "01 / BARBERÍA",
    "02 / NAILS, LASHES & BEAUTY": "02 / UÑAS, PESTAÑAS Y BELLEZA",
    "03 / AUTO DETAILING": "03 / DETALLADO DE AUTOS",
    "04 / HOME & OFFICE CLEANING": "04 / LIMPIEZA DE CASAS Y OFICINAS",
    "05 / NEIGHBORHOOD KITCHEN": "05 / COCINA DE BARRIO",
    "06 / PET GROOMING": "06 / ESTÉTICA DE MASCOTAS",
    "Good hair. Great company.": "Buen cabello. Gran compañía.",
    "Little rituals. Beautiful moments.": "Pequeños rituales. Momentos hermosos.",
    "Every detail. No shortcuts.": "Cada detalle. Sin atajos.",
    "A clean space. A lighter day.": "Un espacio limpio. Un día más ligero.",
    "Good food. Your favorite people.": "Buena comida. Tu gente favorita.",
    "A little fresh. A lot of happy.": "Un poco de frescura. Mucha felicidad.",
    "Open demo": "Abrir demo",
    "MADE FOR THE NEIGHBORHOOD.": "HECHO PARA EL BARRIO.",
    "A good website should feel": "Un buen sitio web debe sentirse",
    "as individual as the business behind it.": "tan único como el negocio que representa.",
    "FICTIONAL BRANDS. REAL INTERACTIONS.": "MARCAS FICTICIAS. INTERACCIONES REALES.",
    "Fictional businesses · Illustrative services, prices, and locations.": "Negocios ficticios · Servicios, precios y ubicaciones ilustrativos.",
    "Requests require business confirmation. No payments are processed.": "Las solicitudes requieren confirmación del negocio. No se procesan pagos.",
    "Back to top": "Volver arriba",
    "Skip to content": "Saltar al contenido"
  };
  var TITLE_EN = "Demos for business | A better first impression";
  var TITLE_ES = "Demos para negocios | Una mejor primera impresión";
  var originals = [];
  var applied = false;

  function textNodes() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if (!p || p.tagName === "SCRIPT" || p.tagName === "STYLE") return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest("#lang-tab")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var out = [], n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function setLang(lang) {
    var nodes = textNodes();
    if (lang === "es") {
      if (!applied) {
        originals = nodes.map(function (n) { return n.nodeValue; });
        nodes.forEach(function (n) {
          var key = n.nodeValue.trim();
          if (ES[key]) n.nodeValue = n.nodeValue.replace(key, ES[key]);
        });
        applied = true;
      }
      document.title = TITLE_ES;
      document.documentElement.setAttribute("lang", "es");
    } else {
      if (applied) {
        nodes.forEach(function (n, i) { if (originals[i] != null) n.nodeValue = originals[i]; });
      }
      document.title = TITLE_EN;
      document.documentElement.setAttribute("lang", "en");
    }
    try { localStorage.setItem("dfb-lang", lang); } catch (e) {}
    var bEN = document.getElementById("lang-en"), bES = document.getElementById("lang-es");
    if (bEN && bES) {
      bEN.style.color = lang === "en" ? "#d8a775" : "#edf1e8";
      bES.style.color = lang === "es" ? "#d8a775" : "#edf1e8";
      bEN.style.fontWeight = lang === "en" ? "700" : "500";
      bES.style.fontWeight = lang === "es" ? "700" : "500";
    }
  }

  function buildTab() {
    var tab = document.createElement("div");
    tab.id = "lang-tab";
    tab.setAttribute("role", "group");
    tab.setAttribute("aria-label", "Language / Idioma");
    tab.style.cssText = "position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:9999;background:#233026;border-radius:999px 0 0 999px;padding:10px 8px 10px 12px;display:flex;flex-direction:column;gap:6px;box-shadow:0 4px 18px rgba(0,0,0,.25);font-family:inherit";
    function btn(id, label) {
      var b = document.createElement("button");
      b.id = id; b.type = "button"; b.textContent = label;
      b.style.cssText = "background:none;border:none;cursor:pointer;font-size:12px;letter-spacing:.12em;padding:2px 4px;color:#edf1e8;font-family:inherit";
      return b;
    }
    var bEN = btn("lang-en", "EN"), bES = btn("lang-es", "ES");
    var sep = document.createElement("div");
    sep.style.cssText = "height:1px;background:rgba(237,241,232,.3);margin:0 4px";
    bEN.addEventListener("click", function () { setLang("en"); });
    bES.addEventListener("click", function () { setLang("es"); });
    tab.appendChild(bEN); tab.appendChild(sep); tab.appendChild(bES);
    document.body.appendChild(tab);
  }

  function init() {
    buildTab();
    var saved = "en";
    try { saved = localStorage.getItem("dfb-lang") || "en"; } catch (e) {}
    setLang(saved === "es" ? "es" : "en");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
