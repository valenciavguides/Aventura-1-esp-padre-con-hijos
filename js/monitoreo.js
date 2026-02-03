/**
 * @fileoverview Sistema de monitoreo para ValenciaVGuides
 * @version 2.0.0
 * 
 * Proporciona funciones de monitoreo, métricas y diagnóstico
 * del sistema de mensajería y componentes.
 */

import { TIPOS_MENSAJE, LOG_LEVELS } from './constants.js';
import logger from './logger.js';
import { CONFIG } from './config.js';

/**
 * Estado del monitoreo
 * @type {Object}
 */
const estadoMonitoreo = {
    inicializado: false,
    intervaloMetricas: null,
    intervaloHeartbeat: null,
    metricas: {
        mensajesEnviados: 0,
        mensajesRecibidos: 0,
        errores: 0,
        tiempoRespuestaPromedio: 0,
        tiemposRespuesta: [],
        ultimaActividad: null
    },
    alertas: [],
    componentesActivos: new Map()
};

/**
 * Límites para alertas
 * @type {Object}
 */
const UMBRALES = {
    MEMORIA_MB: 50,
    MENSAJES_PENDIENTES: 50,
    TIEMPO_RESPUESTA_MS: 1000,
    ERRORES_POR_MINUTO: 10
};

/**
 * Historial de errores para tracking
 * @type {Array}
 */
const historialErrores = [];

/**
 * Map de promesas pendientes para tracking de operaciones asíncronas
 * @type {Map<string, {promise: Promise, timestamp: number, descripcion: string}>}
 */
export const promesasPendientes = new Map();

/**
 * Inicializa el sistema de monitoreo
 * @param {Object} opciones - Opciones de configuración
 * @returns {Promise<boolean>}
 */
export async function inicializarMonitoreo(opciones = {}) {
    if (estadoMonitoreo.inicializado) {
        logger.warn('[monitoreo] Ya inicializado');
        return true;
    }
    
    const {
        intervaloMetricas = CONFIG.MONITOREO?.INTERVALO_METRICAS || 30000,
        habilitarHeartbeat = true,
        intervaloHeartbeat = CONFIG.HIJOS?.INTERVALO_HEARTBEAT || 5000
    } = opciones;
    
    logger.info('[monitoreo] Inicializando sistema de monitoreo');
    
    // Iniciar recolección de métricas
    estadoMonitoreo.intervaloMetricas = setInterval(() => {
        recolectarMetricas();
    }, intervaloMetricas);
    
    // Iniciar heartbeat si está habilitado
    if (habilitarHeartbeat) {
        estadoMonitoreo.intervaloHeartbeat = setInterval(() => {
            enviarHeartbeat();
        }, intervaloHeartbeat);
    }
    
    // Registrar listeners de errores globales
    if (typeof window !== 'undefined') {
        window.addEventListener('error', manejarErrorGlobal);
        window.addEventListener('unhandledrejection', manejarPromiseRechazada);
    }
    
    estadoMonitoreo.inicializado = true;
    logger.info('[monitoreo] Sistema de monitoreo iniciado');
    
    return true;
}

/**
 * Registra una métrica
 * @param {string} nombre - Nombre de la métrica
 * @param {*} valor - Valor de la métrica
 * @param {Object} [tags] - Tags adicionales
 */
export function registrarMetrica(nombre, valor, tags = {}) {
    const metrica = {
        nombre,
        valor,
        tags,
        timestamp: Date.now()
    };
    
    // Actualizar métricas según tipo
    switch (nombre) {
        case 'mensaje_enviado':
            estadoMonitoreo.metricas.mensajesEnviados++;
            break;
        case 'mensaje_recibido':
            estadoMonitoreo.metricas.mensajesRecibidos++;
            break;
        case 'error':
            estadoMonitoreo.metricas.errores++;
            historialErrores.push({
                mensaje: valor,
                timestamp: Date.now(),
                tags
            });
            // Limpiar errores antiguos
            limpiarHistorialErrores();
            break;
        case 'tiempo_respuesta':
            if (typeof valor === 'number') {
                estadoMonitoreo.metricas.tiemposRespuesta.push(valor);
                // Mantener solo los últimos 100
                if (estadoMonitoreo.metricas.tiemposRespuesta.length > 100) {
                    estadoMonitoreo.metricas.tiemposRespuesta.shift();
                }
                // Calcular promedio
                const tiempos = estadoMonitoreo.metricas.tiemposRespuesta;
                estadoMonitoreo.metricas.tiempoRespuestaPromedio = 
                    tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
            }
            break;
    }
    
    estadoMonitoreo.metricas.ultimaActividad = Date.now();
    
    logger.debug(`[monitoreo] Métrica registrada: ${nombre}`, { valor, tags });
}

/**
 * Recolecta métricas del sistema
 */
function recolectarMetricas() {
    const metricas = {
        timestamp: Date.now(),
        memoria: obtenerUsoMemoria(),
        rendimiento: obtenerMetricasRendimiento(),
        mensajeria: {
            enviados: estadoMonitoreo.metricas.mensajesEnviados,
            recibidos: estadoMonitoreo.metricas.mensajesRecibidos,
            errores: estadoMonitoreo.metricas.errores,
            tiempoRespuestaPromedio: estadoMonitoreo.metricas.tiempoRespuestaPromedio
        },
        componentesActivos: estadoMonitoreo.componentesActivos.size
    };
    
    // Verificar umbrales y generar alertas
    verificarUmbrales(metricas);
    
    logger.debug('[monitoreo] Métricas recolectadas', metricas);
}

/**
 * Obtiene el uso de memoria
 * @returns {Object|null}
 */
function obtenerUsoMemoria() {
    if (typeof performance !== 'undefined' && performance.memory) {
        return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            usedMB: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)
        };
    }
    return null;
}

/**
 * Obtiene métricas de rendimiento
 * @returns {Object}
 */
function obtenerMetricasRendimiento() {
    if (typeof performance === 'undefined') return {};
    
    const navegacion = performance.getEntriesByType('navigation')[0];
    
    return {
        tiempoCarga: navegacion ? Math.round(navegacion.loadEventEnd - navegacion.startTime) : null,
        tiempoDomInteractivo: navegacion ? Math.round(navegacion.domInteractive - navegacion.startTime) : null
    };
}

/**
 * Verifica umbrales y genera alertas
 * @param {Object} metricas - Métricas a verificar
 */
function verificarUmbrales(metricas) {
    // Verificar memoria
    if (metricas.memoria && metricas.memoria.usedMB > UMBRALES.MEMORIA_MB) {
        generarAlerta('MEMORIA_ALTA', `Uso de memoria elevado: ${metricas.memoria.usedMB}MB`);
    }
    
    // Verificar tiempo de respuesta
    if (metricas.mensajeria.tiempoRespuestaPromedio > UMBRALES.TIEMPO_RESPUESTA_MS) {
        generarAlerta('TIEMPO_RESPUESTA_ALTO', 
            `Tiempo de respuesta promedio elevado: ${Math.round(metricas.mensajeria.tiempoRespuestaPromedio)}ms`);
    }
    
    // Verificar errores por minuto
    const erroresUltimoMinuto = historialErrores.filter(
        e => Date.now() - e.timestamp < 60000
    ).length;
    if (erroresUltimoMinuto > UMBRALES.ERRORES_POR_MINUTO) {
        generarAlerta('ERRORES_FRECUENTES', 
            `${erroresUltimoMinuto} errores en el último minuto`);
    }
}

/**
 * Genera una alerta
 * @param {string} tipo - Tipo de alerta
 * @param {string} mensaje - Mensaje de la alerta
 */
function generarAlerta(tipo, mensaje) {
    const alerta = {
        tipo,
        mensaje,
        timestamp: Date.now()
    };
    
    estadoMonitoreo.alertas.push(alerta);
    
    // Mantener solo las últimas 50 alertas
    if (estadoMonitoreo.alertas.length > 50) {
        estadoMonitoreo.alertas.shift();
    }
    
    logger.warn(`[monitoreo] Alerta: ${tipo} - ${mensaje}`);
}

/**
 * Envía heartbeat a componentes
 */
function enviarHeartbeat() {
    if (typeof window !== 'undefined' && window.mensajeria && typeof window.mensajeria.enviarMensaje === 'function') {
        try {
            // Usar el formato correcto con objeto completo incluyendo tipo
            const tipoHeartbeat = (TIPOS_MENSAJE && TIPOS_MENSAJE.SISTEMA && TIPOS_MENSAJE.SISTEMA.HEARTBEAT) || 'SISTEMA.HEARTBEAT';
            window.mensajeria.enviarMensaje({
                tipo: tipoHeartbeat,
                origen: 'monitoreo',
                destino: 'broadcast',
                datos: {
                    timestamp: Date.now(),
                    fuente: 'monitoreo'
                }
            });
        } catch (e) {
            // Silenciar errores de heartbeat para no llenar la consola
            if (typeof console !== 'undefined' && console.debug) {
                console.debug('[monitoreo] Error enviando heartbeat:', e && e.message);
            }
        }
    }
}

/**
 * Registra actividad de un componente
 * @param {string} componenteId - ID del componente
 */
export function registrarActividadComponente(componenteId) {
    estadoMonitoreo.componentesActivos.set(componenteId, {
        ultimaActividad: Date.now()
    });
}

/**
 * Maneja errores globales
 * @param {ErrorEvent} event - Evento de error
 */
function manejarErrorGlobal(event) {
    registrarMetrica('error', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        tipo: 'global'
    });
}

/**
 * Maneja promesas rechazadas no capturadas
 * @param {PromiseRejectionEvent} event - Evento de rechazo
 */
function manejarPromiseRechazada(event) {
    const mensaje = event.reason?.message || String(event.reason);
    registrarMetrica('error', mensaje, {
        tipo: 'unhandled_rejection'
    });
}

/**
 * Limpia el historial de errores antiguos
 */
function limpiarHistorialErrores() {
    const limiteAntiguedad = Date.now() - 300000; // 5 minutos
    while (historialErrores.length > 0 && historialErrores[0].timestamp < limiteAntiguedad) {
        historialErrores.shift();
    }
}

/**
 * Obtiene el estado del monitoreo
 * @returns {Object}
 */
export function getEstadoMonitoreo() {
    return {
        ...estadoMonitoreo,
        componentesActivos: Array.from(estadoMonitoreo.componentesActivos.entries())
    };
}

/**
 * Obtiene las alertas activas
 * @param {number} [limite=10] - Número máximo de alertas
 * @returns {Array}
 */
export function getAlertas(limite = 10) {
    return estadoMonitoreo.alertas.slice(-limite);
}

/**
 * Detiene el monitoreo
 */
export function detenerMonitoreo() {
    if (estadoMonitoreo.intervaloMetricas) {
        clearInterval(estadoMonitoreo.intervaloMetricas);
        estadoMonitoreo.intervaloMetricas = null;
    }
    
    if (estadoMonitoreo.intervaloHeartbeat) {
        clearInterval(estadoMonitoreo.intervaloHeartbeat);
        estadoMonitoreo.intervaloHeartbeat = null;
    }
    
    if (typeof window !== 'undefined') {
        window.removeEventListener('error', manejarErrorGlobal);
        window.removeEventListener('unhandledrejection', manejarPromiseRechazada);
    }
    
    estadoMonitoreo.inicializado = false;
    logger.info('[monitoreo] Sistema de monitoreo detenido');
}

// Exponer para debugging
if (typeof window !== 'undefined') {
    window.__vv_monitoreo = {
        inicializarMonitoreo,
        registrarMetrica,
        getEstadoMonitoreo,
        getAlertas,
        detenerMonitoreo,
        registrarActividadComponente
    };
}

export default {
    inicializarMonitoreo,
    registrarMetrica,
    getEstadoMonitoreo,
    getAlertas,
    detenerMonitoreo,
    registrarActividadComponente
};
