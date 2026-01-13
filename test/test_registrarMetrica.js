import { registrarMetrica, estadoMonitoreo } from '../js/monitoreo.js';

const results = [];

// Prefer global `window.registrarMetrica` when running in page scripts/tests
const reg = (typeof window !== 'undefined' && window.registrarMetrica) || registrarMetrica;

// Preparar entorno
estadoMonitoreo.configuracion.habilitado = true;
estadoMonitoreo.configuracion.niveles.metricas = true;
estadoMonitoreo.metricas = new Map();
estadoMonitoreo.eventos = [];

// Test 1: registro básico de uso_memoria
reg('uso_memoria', 42, { unidad: '%' });
let m = estadoMonitoreo.metricas.get('uso_memoria');
if (m && m.length > 0 && m[0].valor === 42) {
  results.push('OK: uso_memoria registrado (42)');
} else {
  results.push('FAIL: uso_memoria no registrado correctamente');
}

// Test 2: umbral y evento
window.estadoPadre = { monitoreo: { config: { umbralAlerta: { usoMemoria: 50 } } } };
reg('uso_memoria', 99, { unidad: '%' });
let ev = estadoMonitoreo.eventos && estadoMonitoreo.eventos[0];
if (ev && ev.tipo === 'uso_memoria_elevado') {
  results.push('OK: evento uso_memoria_elevado generado');
} else {
  results.push('FAIL: evento uso_memoria_elevado NO generado');
}

// Mostrar resultados
const out = document.getElementById('results');
out.innerHTML = '<pre>' + results.join('\n') + '</pre>'; 
console.log(results.join('\n'));
