/** === RETOS: cuestionario múltiple === */
(function(){
  // Preguntas de ejemplo por punto (puedes ampliarlas)
  const QUIZ = {
    "P01": [
      { q: "¿Qué puertas históricas ves aquí?", ops: ["Quart", "Serranos", "Mar"], ok: 1 },
      { q: "¿La ciudad es…", ops: ["Valencia", "Madrid", "Sevilla"], ok: 0 }
    ],
    "P02": [
      { q: "¿Sede de las Cortes?", ops: ["Sí", "No", "A veces"], ok: 0 },
      { q: "¿Barrio?", ops: ["Carmen", "Ruzafa", "Malvarrosa"], ok: 0 }
    ],
    "P03": [
      { q: "¿Basílica y Catedral comparten plaza?", ops: ["Sí", "No", "Solo domingos"], ok: 0 },
      { q: "¿Fuente famosa?", ops: ["Neptuno", "Turia", "Valenciano"], ok: 1 }
    ],
    "P04": [
      { q: "¿Dónde está este edificio?", ops: ["Ayuntamiento", "Mercado", "Lonja"], ok: 0 },
      { q: "¿Plaza amplia?", ops: ["Sí", "No", "Casi"], ok: 0 }
    ]
  };

  // UI modal
  function buildModal(){ 
    let ov = document.getElementById("quizOverlay");
    if (ov) return ov;
    ov = document.createElement("div");
    ov.id = "quizOverlay";
    ov.innerHTML = `
      <div id="quizBox">
        <h3>🧩 Reto</h3>
        <div id="quizQ"></div>
        <div id="quizOps"></div>
        <div class="foot">
          <button id="btnQuit">Cancelar</button>
          <button id="btnNext" class="primary">Siguiente</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    return ov;
  }

  function quizFor(puntoId){
    const set = QUIZ[puntoId] || [
      { q:"Pregunta ejemplo 1", ops:["A","B","C"], ok:0 },
      { q:"Pregunta ejemplo 2", ops:["1","2","3"], ok:1 }
    ];

    const ov = buildModal();
    const qEl = ov.querySelector("#quizQ");
    const opsEl = ov.querySelector("#quizOps");
    const btnNext = ov.querySelector("#btnNext");
    const btnQuit = ov.querySelector("#btnQuit");

    let i = 0;
    let okCount = 0;
    let chosen = -1;

    function paint(){
      const item = set[i];
      qEl.innerHTML = `<p><b>${i+1}/${set.length}</b> — ${item.q}</p>`;
      opsEl.innerHTML = "";
      item.ops.forEach((txt, idx)=>{
        const b = document.createElement("button");
        b.className = "op";
        b.textContent = txt;
        b.onclick = ()=> { chosen = idx; document.querySelectorAll("#quizOps .op").forEach(x=>x.style.outline=""); b.style.outline="2px solid #0ea5e9"; };
        opsEl.appendChild(b);
      });
      btnNext.textContent = (i === set.length-1) ? "Terminar" : "Siguiente";
    }

    btnQuit.onclick = ()=> { ov.style.display = "none"; };
    btnNext.onclick = ()=>{
      if (chosen < 0) { alert("Elige una opción."); return; }
      if (chosen === set[i].ok) okCount++;

      if (i < set.length-1){
        i++; chosen = -1; paint();
      } else {
        ov.style.display = "none";
        if (okCount === set.length){
          window.__padreLog && window.__padreLog("✅ Reto superado");
          window.postMessage({ tipo:"retoCompletado" }, "*");
        } else {
          window.__padreLog && window.__padreLog(`❌ Reto fallado (${okCount}/${set.length})`);
          alert("No has acertado todas. ¡Inténtalo de nuevo cuando quieras!");
        }
      }
    };

    ov.style.display = "flex";
    paint();
  }

  // Cuando el padre diga “activar reto”
  document.addEventListener("activarReto", (e) => {
    const punto = e.detail || "P01";
    quizFor(punto);
  });
})();
