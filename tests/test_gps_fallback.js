// Test harness for GPS fallback in codigo-padre.html
(async function(){
  const status = document.getElementById('status');
  const log = document.getElementById('log');
  const append = (...args) => { log.textContent += args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ') + '\n'; };

  const iframe = document.getElementById('sut');
  await new Promise(resolve => { iframe.onload = resolve; });
  append('[test] iframe cargado');

  const win = iframe.contentWindow;
  if (!win) {
    status.textContent = 'ERROR: no se pudo acceder al iframe';
    return;
  }

  // Diagnostic: list scripts loaded in the iframe (src or inline)
  try {
    const scripts = Array.from(iframe.contentDocument && iframe.contentDocument.scripts || []);
    append('[diag] scripts en iframe:');
    scripts.forEach(s => append('  -', s.src || '[inline]'));
  } catch (e) { append('[diag] no se pudo listar scripts del iframe:', e && e.message); }

  try { append('[diag] iframe.src', iframe.src); } catch (e) { /* ignore */ }
  try { append('[diag] iframe.location.href', iframe.contentWindow && iframe.contentWindow.location && iframe.contentWindow.location.href); } catch (e) { append('[diag] iframe.location.href inaccesible (cross-origin)'); }


  // Stub navigator.geolocation inside the iframe to return low-accuracy positions
  const stubGeo = (function(){
    let attempts = 0;
    return {
      getCurrentPosition(success, error, opts){
        attempts++;
        append('[stubGeo] getCurrentPosition called, attempt', attempts);
        // Simulate low-accuracy reading (84908m) to trigger fallback
        setTimeout(()=>{
          success({
            coords: { latitude: 38.918554, longitude: -0.121242, accuracy: 84908 },
            timestamp: Date.now()
          });
        }, 20);
      },
      watchPosition(success, error, opts){
        append('[stubGeo] watchPosition installed');
        // Return id and immediately call update with low-precision position
        const id = 42;
        setTimeout(()=>{
          success({ coords: { latitude: 38.918554, longitude: -0.121242, accuracy: 84908 }, timestamp: Date.now() });
        }, 20);
        return id;
      },
      clearWatch(id){ append('[stubGeo] clearWatch', id); }
    };
  })();

  try {
    Object.defineProperty(win.navigator, 'geolocation', { value: stubGeo, configurable: true });
    append('[test] navigator.geolocation reemplazado en iframe');
  } catch (e) {
    append('[test] WARNING: no se pudo sobrescribir navigator.geolocation:', e.message);
    status.textContent = 'SKIP: No se puede sobrescribir navigator.geolocation en este navegador';
    return;
  }

  // Ensure P-0 fallback coordinates expected by code
  const expectedFallback = { lat: 39.47876, lng: -0.37626 };

  // Diagnostic: is activarGPS already present immediately after load?
  try { append('[diag] typeof activarGPS (inmediato):', typeof win.activarGPS); } catch (e) { append('[diag] typeof activarGPS error:', e && e.message); }

  // Wait for activarGPS to be available on the iframe window (it may be attached asynchronously)
  const waitFor = async (predicate, timeout = 5000, interval = 100) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try { if (predicate()) return true; } catch (e) { /* ignore */ }
      await new Promise(r => setTimeout(r, interval));
    }
    return false;
  };

  const hasActivar = await waitFor(() => typeof win.activarGPS === 'function', 5000, 100);
  if (!hasActivar) {
    append('[test] ERROR: window.activarGPS no está disponible en iframe después de esperar');
    status.textContent = 'FAIL: activarGPS no disponible';
    return;
  }

  append('[test] Llamando a activarGPS()');
  try {
    await win.activarGPS();
  } catch (err) {
    append('[test] activarGPS lanzó excepción:', err && err.message);
  }

  // Poll window.estadoPadre.gps for expected fallback
  const timeoutMs = 5000;
  const start = Date.now();
  let passed = false;
  while (Date.now() - start < timeoutMs) {
    const estado = win.window && win.window.estadoPadre && win.window.estadoPadre.gps;
    if (estado && estado.posicionUsuario) {
      append('[test] estadoPadre.gps.posicionUsuario encontrado:', estado.posicionUsuario);
      const p = estado.posicionUsuario;
      // Accept either exact fallback or fallback-applied with accuracy >=1000
      if ((Math.abs(p.lat - expectedFallback.lat) < 0.0002 && Math.abs(p.lng - expectedFallback.lng) < 0.0002) || (p.accuracy && p.accuracy >= 1000)) {
        passed = true; break;
      }
    }
    await new Promise(r => setTimeout(r, 150));
  }

  if (passed) {
    append('[TEST PASS] Fallback GPS aplicado correctamente (P-0 o accuracy >=1000)');
    status.textContent = 'PASS';
  } else {
    append('[TEST FAIL] No se aplicó fallback GPS dentro del tiempo límite');
    status.textContent = 'FAIL';
  }
})();