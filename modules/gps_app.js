/** === GPS/MAPA (Leaflet) === */
(function(){
  const boxId = "mapaSimulado";
  let map, markers = {}, route;

  function initMap(){
    const el = document.getElementById(boxId);
    if (!el) return;

    // Mapa base
    map = L.map(el).setView([39.4758, -0.3760], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Cargar puntos
    const pts = window.PUNTOS || [];
    const latlngs = [];

    pts.forEach(p => {
      const m = L.marker([p.lat, p.lng]).addTo(map);
      m.bindPopup(`<b>${p.nombre}</b><br>ID: ${p.id}`);
      markers[p.id] = m;
      latlngs.push([p.lat, p.lng]);
    });

    // Polyline del recorrido
    route = L.polyline(latlngs, { color: 'dodgerblue', weight: 4, opacity: .8 }).addTo(map);
    if (latlngs.length) map.fitBounds(route.getBounds(), { padding: [20,20] });
    window.__padreLog && window.__padreLog("🗺️ Mapa cargado con " + latlngs.length + " puntos");
  }

  // Resaltar punto actual
  function focusPoint(id){
    const m = markers[id];
    if (!m) return;
    m.openPopup();
    map.setView(m.getLatLng(), 17, { animate: true });

    // Pequeño “ping”
    const c = L.circleMarker(m.getLatLng(), {radius: 16, color:'#22c55e', weight:2, fill:false});
    c.addTo(map);
    setTimeout(()=> map.removeLayer(c), 900);
  }

  // Mensajes desde el padre
  window.addEventListener("message", (e)=>{
    const { tipo, id } = e.data || {};
    if (tipo === "irAPunto" && id) focusPoint(id);
  });

  window.addEventListener("DOMContentLoaded", initMap);
})();
window.addEventListener("load", () => {
  if (typeof map !== "undefined" && map.invalidateSize) {
    setTimeout(() => map.invalidateSize(), 1000);
  }
});


