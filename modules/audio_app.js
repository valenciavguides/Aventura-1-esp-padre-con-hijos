/** === AUDIO: reproduce el del punto actual y muestra su foto === */
(function(){
  const btn = document.getElementById("btnPlayAudio");
  if (!btn) return;

  let esperandoRespuesta = false;

  // Cuando haga clic, pido al padre el punto actual:
  btn.addEventListener("click", ()=>{
    if (esperandoRespuesta) return;
    esperandoRespuesta = true;
    window.postMessage({ tipo:"solicitarPuntoActual", req:"audio" }, "*");
  });

  // Cuando el padre responde con el punto actual, cargo medios:
  window.addEventListener("message", (e)=>{
    const { tipo, data, req } = e.data || {};
    if (tipo === "puntoActual" && req === "audio"){
      esperandoRespuesta = false;

      const p = data;
      if (!p){ alert("No hay punto actual definido."); return; }

      // Mostrar imagen y título
      window.postMessage({ tipo:"mostrarImagen", src: encodeURI(p.img), info: `${p.id} — ${p.nombre}` }, "*");

      // Reproducir audio
      const src = encodeURI(p.audio);
      const audio = new Audio(src);
      audio.play().then(()=>{
        window.__padreLog && window.__padreLog("🎧 Reproduciendo: " + p.audio);
      }).catch(err=>{
        window.__padreLog && window.__padreLog("⚠️ No se pudo reproducir: " + err);
        alert("No se pudo reproducir el audio. Revisa la ruta:\n" + p.audio);
      });

      audio.onended = ()=>{
        // Al terminar, el padre despacha “activarReto” con el id del punto
        window.parent.postMessage({ tipo:"audioTerminado", id: p.id }, "*");
      };
    }
  });
})();

