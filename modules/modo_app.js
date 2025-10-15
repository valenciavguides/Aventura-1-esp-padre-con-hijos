/** === MODO Casa/Aventura === */
(function(){
  const botonModo = document.getElementById("btnModoCasa");
  if (!botonModo) return;

  function setModo(nombre){
    document.body.classList.toggle("modo-aventura", nombre==="Aventura");
    botonModo.textContent = "Modo " + nombre;
    window.postMessage({ tipo:"modoCambiado", id: nombre }, "*");
    window.__padreLog && window.__padreLog("🔁 Modo: " + nombre);
  }

  // Estado inicial
  setModo("Casa");

  botonModo.addEventListener("click", ()=>{
    const nuevo = botonModo.textContent.includes("Casa") ? "Aventura" : "Casa";
    setModo(nuevo);
  });
})();

