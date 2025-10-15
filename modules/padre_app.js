/** === PADRE (coordinador del flujo) === */
(function(){
  const logEl = document.getElementById('log');
  function log(msg){ if(logEl){ logEl.textContent += msg + "\n"; logEl.scrollTop = logEl.scrollHeight; } }

  let idx = 0; // índice del punto actual

  // API simple para hijos
  function puntoActual(){ return window.PUNTOS?.[idx] || null; }
  function irASiguiente(){
    if (idx < window.PUNTOS.length - 1) { idx++; }
    const p = puntoActual();
    window.postMessage({ tipo:"irAPunto", id: p?.id }, "*");
    log("➡️ Siguiente punto: " + (p?.id||"fin"));
  }
  function mostrarImagen(src, info){
    const img = document.getElementById("fotoPunto");
    if (img && src) img.src = src;
    const infoEl = document.getElementById("infoPunto");
    if (infoEl) infoEl.textContent = info || "";
  }

  // Mensajería central
  window.addEventListener("message", (e) => {
    const { tipo, id, req } = e.data || {};
    if (!tipo) return;
    log("📨 " + tipo + (id?(" :: " + id):""));

    switch (tipo) {
      case "solicitarPuntoActual":
        window.postMessage({ tipo:"puntoActual", data: puntoActual(), req }, "*");
        break;

      case "mostrarImagen":
        mostrarImagen(e.data.src, e.data.info || "");
        break;

      case "retoCompletado":
        irASiguiente();
        break;

      case "modoCambiado":
        // aquí podríamos bloquear/desbloquear controles por modo
        break;
    }
  });

  // Estado inicial → enfocar primer punto en el mapa
  window.addEventListener("DOMContentLoaded", () => {
    const p = puntoActual();
    if (p) window.postMessage({ tipo:"irAPunto", id: p.id }, "*");
  });

  window.__padreLog = log;
  log("✅ Padre cargado");
})();



