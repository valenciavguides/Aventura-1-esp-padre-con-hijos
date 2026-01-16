
/**
 * Módulo de mensajería para comunicación entre componentes
 * @module Mensajeria
 * @version 4.0.0
 * @description Sistema centralizado de mensajería para comunicación entre iframes
 * con manejo de errores, reintentos, validación de mensajes y limpieza de recursos.
 */

import { TIPOS_MENSAJE, TIPOS_MENSAJE_VALIDOS } from './constants.js';
import { ajustarTimeoutPorConexion, generarIdUnico, getPadreId } from './utils.js';
import logger from './logger.js';

// ================== UTILIDADES INTERNAS =====================


// Manejadores centralizados (separado del objeto estadoMensajeria
// para evitar errores de acceso durante imports circulares).
const manejadores = new Map();

// Getter seguro para los manejadores. Devuelve el Map del módulo si está
// disponible, o el fallback en `globalThis.__vv_manejadores` cuando sea
// necesario (registro temprano durante imports circulares).
function __vv_getManejadores() {
    try {
        if (typeof manejadores !== 'undefined' && manejadores instanceof Map) {
            return manejadores;
        }
    } catch (e) {
        // ignore
    }
    if (!globalThis.__vv_manejadores) globalThis.__vv_manejadores = new Map();
    return globalThis.__vv_manejadores;
}

// Fallback global para registros tempranos (evita TDZ en import cycles).
// Algunos módulos pueden invocar `registrarControlador` mientras este
// módulo todavía se está evaluando por una importación circular. Para
// soportar eso, guardamos registros tempranos en `globalThis.__vv_manejadores`
// y los migramos a `manejadores` una vez que `inicializarMensajeria` se
// haya ejecutado. Usamos `globalThis` en tiempo de ejecución para evitar
// TDZ al leer una variable de módulo que aún no se inicializó.
globalThis.__vv_manejadores = globalThis.__vv_manejadores || new Map();

/**
 * Migrar manejadores tempranos desde el fallback global al Map interno.
 * Esta función es idempotente y segura de llamar múltiples veces.
 * Devuelve true si se migraron entradas, false si no había nada que migrar.
 */
export function migrarManejadoresTempranos() {
    try {
        if (globalThis.__vv_manejadores && globalThis.__vv_manejadores.size > 0) {
            const migrated = [];
            globalThis.__vv_manejadores.forEach((cb, key) => {
                try {
                    if (!manejadores.has(key)) {
                        manejadores.set(key, cb);
                        migrated.push({ tipo: key, duplicado: false });
                    } else {
                        migrated.push({ tipo: key, duplicado: true });
                    }
                } catch (e) { /* ignore individual failures */ }
            });
            try { globalThis.__vv_manejadores.clear(); } catch (e) { /* ignore */ }
            return migrated;
        }
    } catch (e) {
        // non-fatal
    }
    return [];
}

// Para evitar spam de logs, sólo advertimos una vez si un caller usa la forma objeto
// sin proveer `origen` explícito. Esto facilita migrar el código sin generar demasiados warnings.
let _warnedMissingOrigen = false;

// ================== MENSAJERÍA CENTRALIZADA =====================

// Estado global de la mensajería (configuración local)
const estadoMensajeria = {
    inicializado: false,
    manejadores: new Map(),
    mensajesPendientes: new Map(),
    tiempoEspera: 10000,
    maxReintentos: 3,
    mensajesProcesados: new Set(),
    estadisticas: {
        mensajesEnviados: 0,
        mensajesRecibidos: 0,
        errores: 0,
        totalTiempoRespuesta: 0,
        tiempoPromedioRespuesta: 0,
        ultimoError: null
    },
    instancias: new Map(),
    rol: 'hijo',
    estado: 'inactivo',
    timeouts: {},
    colaMensajes: [],
    procesandoCola: false,
    listenerRegistrado: false,
    heartbeat: {
        activo: false,
        userPaused: false, // pause requested by user/mode (distinguished from visibility-based pause)
        hijosConectados: new Set(),
        ultimoHeartbeat: new Map(),
        timeoutsHeartbeat: new Map(),
        intervalo: 5000,
        timer: null,
        listenerRegistrado: false
    },
    broadcastsPendientes: [], // Cola de broadcasts esperando a que hijos estén listos
    // Hijos críticos: estos deben estar listos antes de considerar la aplicación completamente inicializada.
    // Nota: `hijo1-hamburguesa` y `hijo1-opciones` se excluyen a propósito (son UI helpers) y se cargan secuencialmente
    // por el padre, pero no se consideran críticos para bloquear la readiness del sistema.
    hijosEsperados: ['hijo2', 'hijo3', 'hijo4', 'hijo5-casa'], // Hijos críticos que deben estar listos
    hijosListos: new Set(), // Hijos críticos que ya enviaron HIJO_LISTO
    
    // ✅ Sistema de sincronización Script 1 ↔ Script 2
    script2Listo: false, // Flag que indica si Script 2 completó registro de controladores
    mensajesPendientesScript2: [] // Cola de mensajes que esperan a que Script 2 esté listo
};

// Flag to indicate that heartbeat pre-warm has been executed
let _heartbeatPrewarmed = false;

// Registro de capacidades declaradas por cada hijo (padre mantiene esto)
// Map<hijoId, Set<capability>>
const hijosCapacidades = new Map();

/**
 * Registra las capacidades declaradas por un hijo.
 * @param {string} hijoId
 * @param {Array<string>} capacidades
 */
function registrarCapacidadesHijo(hijoId, capacidades = []) {
    try {
        if (!hijoId) return;
        const set = new Set(Array.isArray(capacidades) ? capacidades : [capacidades]);
        hijosCapacidades.set(hijoId, set);
        if (estadoMensajeria.debug) console.debug('[MENSAJERIA] Capacidades registradas', hijoId, Array.from(set));
    } catch (e) {
        console.warn('[MENSAJERIA] Error registrando capacidades hijo:', e);
    }
}

// Helper de diagnóstico accesible desde la consola para verificar configuración de orígenes
if (typeof window !== 'undefined') {
    window.diagnosticarMensajeria = function() {
        try {
            const origenActual = window.location.origin;
            const allowed = (window.Config && window.Config.MENSAJERIA && Array.isArray(window.Config.MENSAJERIA.ALLOWED_ORIGINS)) ? window.Config.MENSAJERIA.ALLOWED_ORIGINS : [];
            console.info('[MENSAJERIA][DIAG] origenActual:', origenActual, 'ALLOWED_ORIGINS:', allowed);
            return { origenActual, allowedOrigins: allowed };
        } catch (e) {
            console.warn('[MENSAJERIA][DIAG] Error diagnósticando mensajería:', e && e.message);
            return null;
        }
    };
}

// Helper de desarrollo: simula un mensaje entrante (no debe usarse en producción)
if (typeof window !== 'undefined') {
    window.simularMensajeEntrada = function({ origin = 'null', data = {} } = {}) {
        try {
            console.info('[MENSAJERIA][DIAG] Simulando mensaje entrante', { origin, data });
            // Llamar al handler interno con una estructura que imita MessageEvent
            manejarMensajeEntrante({ origin, data, source: window.parent });
            return true;
        } catch (e) {
            console.warn('[MENSAJERIA][DIAG] Error simulando mensaje:', e && e.message);
            return false;
        }
    };
}

/**
 * Obtiene los hijos que declaran una capacidad específica
 * @param {string} capability
 * @returns {Array<string>} lista de ids
 */
export function hijosConCapability(capability) {
    const result = [];
    for (const [hijoId, set] of hijosCapacidades.entries()) {
        if (set && set.has(capability)) result.push(hijoId);
    }
    return result;
}

/**
 * Broadcast dirigido por capability; clona `datos` antes de enviar.
 * @param {string} capability
 * @param {Object} mensajeObj - objeto con tipo, origen, datos, version opcional
 */
export function broadcastToCapability(capability, mensajeObj) {
    if (!capability || !mensajeObj) return { enviados: 0 };
    // Security: only allow GPS capability broadcasts from the parent
    try {
        if (capability === 'gps') {
            const padreId = (typeof getPadreId === 'function') ? getPadreId() : 'padre';
            if (mensajeObj.origen !== padreId && estadoMensajeria.rol !== 'padre') {
                console.warn(`[MENSAJERIA] Broadcast 'gps' rechazado: solo el padre (${padreId}) puede emitir broadcasts de gps`);
                try { typeof window.incrementarContador === 'function' && window.incrementarContador('mensajeria.rejected_broadcast_gps'); } catch (e) { /* ignore */ }
                return { enviados: 0 };
            }
        }
    } catch (e) { /* ignore seguridad check errors */ }
    const targets = hijosConCapability(capability);
    const origenSeguro = window.location.origin;
    let enviados = 0;
    const datosClonados = (typeof structuredClone === 'function')
        ? structuredClone(mensajeObj.datos)
        : JSON.parse(JSON.stringify(mensajeObj.datos || {}));

    const mensaje = {
        id: generarIdUnico(),
        tipo: mensajeObj.tipo,
        origen: mensajeObj.origen,
        destino: 'broadcast',
        datos: datosClonados,
        version: mensajeObj.version || '1.0.0',
        timestamp: new Date().toISOString()
    };

    targets.forEach(hijoId => {
        try {
            const iframe = document.getElementById(hijoId);
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(mensaje, origenSeguro);
                enviados++;
            }
        } catch (e) {
            console.warn(`[MENSAJERIA] No se pudo enviar mensaje a ${hijoId}:`, e);
        }
    });

    if (estadoMensajeria.debug) console.debug(`[MENSAJERIA] broadcastToCapability(${capability}) enviados: ${enviados}`);
    return { enviados };
}

// Export registrarCapacidadesHijo too so other modules can introspect/update
export { registrarCapacidadesHijo };

// ================== FUNCIONES PRINCIPALES CENTRALIZADAS =====================

/**
 * Valida que un destino sea válido (existe como iframe o es 'padre')
 * @param {string} destino - ID del destino a validar
 * @returns {boolean} true si el destino es válido
 */
function validarDestino(destino) {
    if (!destino || typeof destino !== 'string') {
        return false;
    }
    
    // 'padre' siempre es válido (desde hijo o para comunicación interna del padre)
    if (destino === 'padre') {
        return true;
    }
    // Soportar ID canónico del padre (ej., si no usan el literal 'padre')
    try {
        if (typeof getPadreId === 'function' && destino === getPadreId()) return true;
    } catch (e) { /* ignore */ }
    
    // Soportar envíos globales/broadcast desde el padre (o alias 'todos')
    if (destino === 'broadcast' || destino === 'todos') {
        // Consideramos válido el destino broadcast; la resolución final
        // se hace en `enviarMensaje` (se enviará a todos los iframes hijos).
        return true;
    }
    
    // Verificar si existe un iframe con ese ID
    const iframe = document.getElementById(destino);
    return iframe !== null && iframe.contentWindow !== null;
}

/**
 * Inicializa el sistema de mensajería para el componente.
 * @param {Object} config - Configuración de inicialización
 * @param {string} [config.rol] - Rol del componente: 'padre' o 'hijo'
 * @param {string} [config.iframeId] - ID del iframe (para hijos)
 * @param {string} [config.componenteId] - ID del componente lógico
 * @param {string} [config.idComponente] - Alias de componenteId
 * @param {boolean} [config.debug] - Modo debug
 * @param {string} [config.estado] - Estado inicial (obsoleto, se mantiene por compatibilidad)
 * @returns {Promise<void>}
 */
export async function inicializarMensajeria(config = {}) {
    try {
        // Detectar rol automáticamente si no se proporciona
        const rol = config.rol || (window.parent === window ? 'padre' : 'hijo');
        
        // Asignar configuración al estado
        estadoMensajeria.rol = rol;
        estadoMensajeria.iframeId = config.iframeId || null;
        estadoMensajeria.componenteId = config.componenteId || config.idComponente || config.iframeId || (rol === 'padre' ? 'padre' : null);
        estadoMensajeria.debug = config.debug || false;
        estadoMensajeria.inicializado = true;

        if (estadoMensajeria.debug) {
            console.log(`[MENSAJERIA] Inicializado - Rol: ${rol}, ID: ${estadoMensajeria.componenteId || estadoMensajeria.iframeId || 'desconocido'}`);
        }

        // Migrar controladores tempranos usando la función exportada (idempotente)
        try {
            migrarManejadoresTempranos();
        } catch (e) {
            // No crítico; seguimos adelante
            console.warn('[MENSAJERIA] Error migrando manejadores tempranos:', e);
        }
        
        // Registrar listener de message solo UNA vez para evitar duplicados
        if (!estadoMensajeria.listenerRegistrado) {
            window.addEventListener('message', manejarMensajeEntrante);
            estadoMensajeria.listenerRegistrado = true;
            if (estadoMensajeria.debug) {
                console.debug('[MENSAJERIA] Listener de message registrado (único)');
            }
        } else {
            if (estadoMensajeria.debug) {
                console.debug('[MENSAJERIA] Listener de message ya estaba registrado, omitiendo');
            }
        }
        
        // ✅ TIMEOUT DE SEGURIDAD: Si Script 2 no se marca como listo en 15s,
        // forzar procesamiento de mensajes pendientes
        if (window.parent === window && !estadoMensajeria.script2Listo) {
            setTimeout(() => {
                if (!estadoMensajeria.script2Listo) {
                    console.warn('[MENSAJERIA][TIMEOUT] Script 2 no se marcó como listo en 15s, forzando procesamiento');
                    try {
                        marcarScript2Listo();
                    } catch (error) {
                        console.error('[MENSAJERIA][TIMEOUT] Error forzando Script 2:', error);
                    }
                }
            }, 15000); // 15 segundos
        }

        return Promise.resolve();
    } catch (error) {
        console.error('[MENSAJERIA] Error durante inicialización:', error);
        throw error;
    }
}

/**
 * Pre-inicializa el subsistema de heartbeat sin arrancar los intervalos.
 * Esto puede registrar listeners y preparar estado para acelerar el
 * arranque del heartbeat cuando sea necesario.
 * @param {number} [timeoutMs]
 * @returns {Promise<{ready:boolean}>}
 */
export async function preiniciarHeartbeat(timeoutMs = null) {
    try {
        const cfgTimeout = (window.Config && window.Config.MENSAJERIA && window.Config.MENSAJERIA.HEARTBEAT_PREWARM && window.Config.MENSAJERIA.HEARTBEAT_PREWARM.TIMEOUT_MS) || 8000;
        const to = timeoutMs || cfgTimeout;

        if (_heartbeatPrewarmed) return { ready: true };

        // Ensure listener is registered (but do not start timers)
        if (!estadoMensajeria.heartbeat.listenerRegistrado) {
            // The normal initialization registers message listeners; here we just
            // mark the flag so the system knows heartbeat is prepared.
            estadoMensajeria.heartbeat.listenerRegistrado = true;
        }

        // Simulate small async preparation window so callers can await readiness
        await new Promise(resolve => setTimeout(resolve, Math.min(200, to)));
        _heartbeatPrewarmed = true;
        return { ready: true };
    } catch (e) {
        logger.warn('[MENSAJERIA][preiniciarHeartbeat] fallo en preiniciar:', e && e.message ? e.message : e);
        return { ready: false };
    }
}

/**
 * Espera a que los hijos críticos envíen HIJO_LISTO o hasta timeout
 * @param {number} timeoutMs
 * @returns {Promise<{ready:boolean, missing:Array<string>}>}
 */
export function esperarHijosListos(timeoutMs = 10000) {
    return new Promise(resolve => {
        const expected = Array.from(estadoMensajeria.hijosEsperados || []);

        const missingNow = expected.filter(id => !estadoMensajeria.hijosListos.has(id));
        if (missingNow.length === 0) return resolve({ ready: true, missing: [] });

        const interval = setInterval(() => {
            const missing = expected.filter(id => !estadoMensajeria.hijosListos.has(id));
            if (missing.length === 0) {
                clearInterval(interval);
                clearTimeout(timeout);
                return resolve({ ready: true, missing: [] });
            }
        }, 200);

        const timeout = setTimeout(() => {
            clearInterval(interval);
            const missing = expected.filter(id => !estadoMensajeria.hijosListos.has(id));
            return resolve({ ready: false, missing });
        }, timeoutMs);
    });
}

/**
 * Procesa la cola de mensajes pendientes.
 * Intenta enviar mensajes encolados cuando sus destinos están listos.
 * Implementa TTL (30s), manejo de reintentos y limpieza de mensajes expirados.
 */
async function procesarColaMensajes() {
    if (estadoMensajeria.procesandoCola) {
        console.debug('[MENSAJERIA][COLA] Ya se está procesando la cola, omitiendo');
        return;
    }
    
    if (estadoMensajeria.colaMensajes.length === 0) {
        return; // Nada que procesar
    }
    
    estadoMensajeria.procesandoCola = true;
    const TTL_MS = 30000; // 30 segundos
    const MAX_REINTENTOS = 5;
    
    try {
        console.log(`🔄 [MENSAJERIA][COLA] Procesando ${estadoMensajeria.colaMensajes.length} mensaje(s) encolado(s)`);
        
        let procesados = 0;
        let expirados = 0;
        let reenviados = 0;
        
        // Procesar cola (usar un bucle while para permitir modificación durante iteración)
        while (estadoMensajeria.colaMensajes.length > 0) {
            const item = estadoMensajeria.colaMensajes[0]; // Peek primero
            const edad = Date.now() - item.timestamp;
            
            // Verificar si expiró (TTL)
            if (edad > TTL_MS) {
                console.warn(`⏰ [MENSAJERIA][COLA] Mensaje expirado (${Math.round(edad/1000)}s) - tipo: ${item.mensaje.tipo}, destino: ${item.destino}`);
                estadoMensajeria.colaMensajes.shift(); // Remover
                expirados++;
                continue;
            }
            
            // Verificar si alcanzó el máximo de reintentos
            if (item.intentos >= MAX_REINTENTOS) {
                console.error(`❌ [MENSAJERIA][COLA] Mensaje descartado (${item.intentos} intentos) - tipo: ${item.mensaje.tipo}, destino: ${item.destino}`);
                estadoMensajeria.colaMensajes.shift(); // Remover
                continue;
            }
            
            // Intentar enviar el mensaje
            try {
                // Verificar si el destino ya está disponible
                const destinoListo = validarDestinoDisponible(item.destino);
                
                if (!destinoListo) {
                    // Destino aún no disponible, incrementar intentos y continuar
                    item.intentos++;
                    console.debug(`⏳ [MENSAJERIA][COLA] Destino ${item.destino} aún no listo (intento ${item.intentos}/${MAX_REINTENTOS})`);
                    break; // Salir del bucle, intentaremos más tarde
                }
                
                // Destino listo, enviar mensaje
                console.log(`📤 [MENSAJERIA][COLA] Enviando mensaje encolado - tipo: ${item.mensaje.tipo}, destino: ${item.destino}`);
                
                // Enviar usando la lógica interna directa
                const iframe = document.getElementById(item.destino);
                if (iframe && iframe.contentWindow) {
                    const origenSeguro = window.location.origin;
                    iframe.contentWindow.postMessage(item.mensaje, origenSeguro);
                    reenviados++;
                } else {
                    throw new Error(`Iframe ${item.destino} no encontrado`);
                }
                
                // Mensaje enviado exitosamente, remover de la cola
                estadoMensajeria.colaMensajes.shift();
                procesados++;
                
            } catch (error) {
                // Error al enviar, incrementar intentos
                item.intentos++;
                console.warn(`⚠️ [MENSAJERIA][COLA] Error enviando mensaje a ${item.destino} (intento ${item.intentos}/${MAX_REINTENTOS}):`, error.message);
                
                if (item.intentos >= MAX_REINTENTOS) {
                    console.error(`❌ [MENSAJERIA][COLA] Mensaje descartado después de ${item.intentos} intentos fallidos`);
                    estadoMensajeria.colaMensajes.shift(); // Remover
                } else {
                    break; // Salir del bucle, intentaremos más tarde
                }
            }
        }
        
        if (procesados > 0 || expirados > 0) {
            console.log(`✅ [MENSAJERIA][COLA] Procesamiento completado - enviados: ${reenviados}, expirados: ${expirados}, pendientes: ${estadoMensajeria.colaMensajes.length}`);
        }
        
    } catch (error) {
        console.error('[MENSAJERIA][COLA] Error procesando cola:', error);
    } finally {
        estadoMensajeria.procesandoCola = false;
    }
}

/**
 * Valida si un destino está disponible para recibir mensajes.
 * @param {string} destino - ID del destino a validar
 * @returns {boolean} true si el destino está disponible
 */
function validarDestinoDisponible(destino) {
    if (!destino) return false;
    
    // Padre siempre disponible
    if (destino === 'padre') return true;
    
    // Broadcasts siempre se procesan
    if (destino === 'broadcast' || destino === 'todos') return true;
    
    // Para otros destinos, verificar que el iframe exista y el hijo esté listo
    try {
        const iframe = document.getElementById(destino);
        if (!iframe || !iframe.contentWindow) return false;
        
        // Verificar si el hijo está en la lista de listos (si es crítico)
        if (estadoMensajeria.hijosEsperados.includes(destino)) {
            return estadoMensajeria.hijosListos.has(destino);
        }
        
        // Para hijos no críticos, si el iframe existe, asumimos que está listo
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Determinar si el mensaje debe ser encolado o descartado cuando el destino no está disponible.
 * @param {string} destino - ID del destino
 * @param {string} tipo - Tipo de mensaje
 * @returns {boolean} true si debe encolarse
 */
function debeEncolarMensaje(destino, tipo) {
    // No encolar broadcasts (tienen su propia cola)
    if (destino === 'broadcast' || destino === 'todos') return false;
    
    // No encolar mensajes al padre (siempre disponible)
    if (destino === 'padre') return false;
    
    // Encolar solo si es un hijo que podría estar inicializando
    return true;
}

/**
 * Envía un mensaje a un destino específico.
 * @param {Object} params - Parámetros del mensaje.
 * @param {string} params.tipo - Tipo de mensaje.
 * @param {string} params.origen - Origen del mensaje.
 * @param {string} params.destino - Destino del mensaje.
 * @param {Object} [params.datos={}] - Datos del mensaje.
 * @param {string} [params.version='1.0.0'] - Versión del mensaje.
 */
export function enviarMensaje(paramsOrDestino, tipoOrOptions, maybeDatos) {
    // Compute default origin with more robust parent canonicalization.
    // Prefer explicit componenteId; if not available, and we're running in the parent
    // prefer a canonical parent id via getPadreId() (runtime-seguro helper), then fall back to 'padre'.
    let defaultOrigen = estadoMensajeria.componenteId || null;
    try {
        if (!defaultOrigen) {
            if (typeof window !== 'undefined' && window.parent === window) {
                // Use canonical helper if available (returns CONFIG_PADRE.ID or fallback)
                defaultOrigen = (typeof getPadreId === 'function' ? getPadreId() : null) || 'padre';
            } else {
                defaultOrigen = 'hijo';
            }
        }
    } catch (e) {
        // Fallback to legacy resolution if helper failed
        defaultOrigen = estadoMensajeria.componenteId || (window.parent === window ? 'padre' : 'hijo');
    }

    return Promise.resolve().then(() => {
        // Normalizar firma: aceptar tanto un objeto {tipo, origen, destino, datos}
        // como la forma legacy (destino, tipo, datos)
        let tipo, origen, destino, datos = {}, version = '1.0.0';

        // Validación temprana: paramsOrDestino no puede ser null/undefined
        if (paramsOrDestino === null || paramsOrDestino === undefined) {
            throw new Error('enviarMensaje llamado con parámetro null/undefined');
        }

        if (typeof paramsOrDestino === 'object' && paramsOrDestino !== null && !Array.isArray(paramsOrDestino)) {
            ({ tipo, origen, destino, datos = {}, version = '1.0.0' } = paramsOrDestino);
            // Sanity: if calling code omitted origen, fallback to defaultOrigin (caller component)
            if (!origen) {
                origen = defaultOrigen;
                try {
                    if (!_warnedMissingOrigen) {
                        // Emit helpful trace once (caller stack) to find the location in code that omitted `origen`.
                        const stack = (typeof Error === 'function' && new Error().stack) || 'stack trace not available';
                        logger && logger.debug && logger.debug('[MENSAJERIA] enviarMensaje called without explicit "origen" (object signature); using default origin: ' + origen + '\n' + stack);
                        _warnedMissingOrigen = true;
                    } else {
                        logger && logger.debug && logger.debug('[MENSAJERIA] Re-using default origen for enviarMensaje when caller omitted `origen`.');
                    }
                } catch (e) { console.warn('[MENSAJERIA] Warn logging failed', e); }
            }
        } else {
            destino = paramsOrDestino;
            tipo = tipoOrOptions;
            datos = maybeDatos || {};
            origen = datos.origen || defaultOrigen;
        }

        if (!tipo || !origen || !destino) {
            throw new Error('Campos obligatorios faltantes para enviarMensaje: tipo, origen y destino son obligatorios');
        }

        // Permitir destinos especiales: 'broadcast' o 'todos'
        if (destino === 'broadcast' || destino === 'todos') {
            // Si estamos en el padre, enviar a todos los iframes hijos encontrados
            if (window.parent === window) {
                const origenSeguro = window.location.origin;
                const datosClonados = (typeof structuredClone === 'function')
                    ? structuredClone(datos)
                    : JSON.parse(JSON.stringify(datos || {}));

                const mensaje = {
                    id: generarIdUnico(),
                    tipo,
                    origen,
                    destino: 'broadcast',
                    datos: datosClonados,
                    version,
                    timestamp: new Date().toISOString()
                };

                // Verificar si TODOS los hijos esperados están listos
                const todosHijosListos = estadoMensajeria.hijosEsperados.every(h => estadoMensajeria.hijosListos.has(h));
                
                if (!todosHijosListos) {
                    // Encolar el broadcast para cuando TODOS los hijos estén listos
                    const faltantes = estadoMensajeria.hijosEsperados.filter(h => !estadoMensajeria.hijosListos.has(h));
                    estadoMensajeria.broadcastsPendientes.push(mensaje);
                    console.log(`⏳ [MENSAJERIA] Broadcast encolado (esperando hijos) - tipo: ${tipo}, listos: ${estadoMensajeria.hijosListos.size}/${estadoMensajeria.hijosEsperados.length}, faltantes: [${faltantes.join(', ')}]`);
                    return { encolado: true, mensaje };
                }

                // Enviar a todos los iframes con contentWindow
                const iframes = Array.from(document.getElementsByTagName('iframe'));
                let enviados = 0;
                iframes.forEach(iframe => {
                    try {
                        if (iframe && iframe.contentWindow) {
                            iframe.contentWindow.postMessage(mensaje, origenSeguro);
                            enviados++;
                        }
                    } catch (e) {
                        console.warn(`[MENSAJERIA] No se pudo enviar broadcast a iframe ${iframe.id}:`, e);
                    }
                });

                console.log(`📤 [MENSAJERIA] Broadcast enviado - tipo: ${tipo}, origen: ${origen}, enviados: ${enviados}`);
                try {
                    console.debug('[MENSAJERIA][BROADCAST] detalles', {
                        tipo,
                        origen,
                        enviados,
                        datos: datosClonados,
                        timestamp: mensaje.timestamp
                    });
                } catch (e) {
                    console.debug('[MENSAJERIA][BROADCAST] enviado (no se pudo serializar detalles)');
                }

                return { broadcast: true, enviados };
            } else {
                // Si estamos en un hijo, reenviamos al padre para que haga el broadcast
                const mensajeForward = {
                    id: generarIdUnico(),
                    tipo,
                    origen,
                    destino: 'broadcast',
                    datos,
                    version,
                    timestamp: new Date().toISOString()
                };
                try {
                    console.debug('[MENSAJERIA] Reenviando broadcast al padre', { tipo, origen, destino: 'broadcast', datos: (typeof structuredClone === 'function') ? structuredClone(datos || {}) : JSON.parse(JSON.stringify(datos || {})) });
                } catch (e) {
                    // ignore serialization problems in debug
                }
                window.parent.postMessage(mensajeForward, window.location.origin);
                return { forwarded: true };
            }
        }

        // Allow some legacy aliases and map them to canonical destinations to avoid noisy errors
        const canonicalizarDestino = (d) => {
            if (!d) return d;
            if (d === 'sistema-notificaciones') {
                // Prefer the legacy element if it exists, otherwise map to 'sistema-ui' if available
                try {
                    if (document.getElementById('sistema-notificaciones')) return 'sistema-notificaciones';
                    if (document.getElementById('sistema-ui')) return 'sistema-ui';
                } catch (e) {
                    // ignore DOM access errors
                }
                return 'broadcast';
            }
            return d;
        };

        destino = canonicalizarDestino(destino);

        if (!validarDestino(destino)) {
            // Increment a monitoring counter so we can track how often invalid destinations occur
            try { typeof window.incrementarContador === 'function' && window.incrementarContador('mensajeria.destino_invalido'); } catch (e) { /* ignore */ }

            const errorMsg = destino === 'funciones-mapa'
                ? `Destino 'funciones-mapa' no válido. Los mensajes GPS ahora se manejan directamente llamando a las funciones de funciones-mapa.js desde el padre.`
                : `Destino no válido: ${destino}`;
            throw new Error(errorMsg);
        }

        // Validación específica para mensajes de consulta
        if (tipo === TIPOS_MENSAJE.NAVEGACION.SOLICITAR_COORDENADAS ||
            tipo === TIPOS_MENSAJE.AUDIO.SOLICITAR_AUDIO ||
            tipo === TIPOS_MENSAJE.DATOS.SOLICITAR_RETO) {
            
            if (!datos.paradaId) {
                throw new Error(`Mensaje de consulta ${tipo} requiere 'paradaId' en datos`);
            }
            if (!datos.tipoConsulta) {
                throw new Error(`Mensaje de consulta ${tipo} requiere 'tipoConsulta' en datos`);
            }
        }

        const mensaje = {
            id: (typeof paramsOrDestino === 'object' && paramsOrDestino && paramsOrDestino.id) ? paramsOrDestino.id : generarIdUnico(),
            tipo,
            origen,
            destino,
            datos,
            version,
            timestamp: new Date().toISOString()
        };

        // Determinar el destino del mensaje
        let targetWindow;
        const origenSeguro = window.location.origin;

        if (destino === 'padre') {
            // Comunicación hijo → padre: usar window.parent
            // O padre → padre (comunicación interna): usar window
            if (window.parent === window) {
                // Ya estamos en el padre, usar window para comunicación interna
                targetWindow = window;
            } else {
                targetWindow = window.parent;
            }
        } else {
            // Comunicación padre → hijo: usar iframe
            const iframe = document.getElementById(destino);
            if (!iframe || !iframe.contentWindow) {
                // Destino no disponible - verificar si debemos encolar
                if (debeEncolarMensaje(destino, tipo)) {
                    console.log(`⏳ [MENSAJERIA] Destino ${destino} no disponible, encolando mensaje - tipo: ${tipo}`);
                    estadoMensajeria.colaMensajes.push({
                        mensaje,
                        destino,
                        timestamp: Date.now(),
                        intentos: 0
                    });
                    
                    // Intentar procesar la cola inmediatamente
                    setTimeout(() => procesarColaMensajes(), 100);
                    
                    return { enqueued: true, mensajeId: mensaje.id };
                }
                
                throw new Error(`Destino ${destino} no encontrado o no accesible`);
            }
            targetWindow = iframe.contentWindow;
        }

        // Enviar el mensaje al destino correspondiente
        console.log(`📤 [MENSAJERIA] Enviando mensaje - tipo: ${mensaje.tipo}, origen: ${mensaje.origen}, destino: ${mensaje.destino}`);
        targetWindow.postMessage(mensaje, origenSeguro);
        // Devolver información útil incluyendo el id del mensaje publicado
        return { delivered: true, mensajeId: mensaje.id };
    });
}

/**
 * Envía un mensaje y espera confirmación con timeout.
 * @param {Object} params - Parámetros del mensaje (mismos que enviarMensaje)
 * @param {number} [params.timeout=10000] - Timeout en milisegundos
 * @returns {Promise<Object>} Promesa que resuelve con la respuesta
 */
export function enviarMensajeConConfirmacion({ tipo, origen, destino, datos = {}, version = '1.0.0', timeout = ajustarTimeoutPorConexion(10000) }) {
    return new Promise((resolve, reject) => {
        const internalId = generarIdUnico();
        const publishedId = generarIdUnico();

        // Configurar timeout
        const timer = setTimeout(() => {
            const info = confirmacionesPendientes.get(internalId) || confirmacionesPendientes.get(publishedId);
            if (info) {
                eliminarConfirmacionPorInfo(info);
            }
            reject(new Error(`Timeout esperando confirmación de ${destino} para mensaje ${tipo}`));
        }, timeout);

        // Registrar en confirmacionesPendientes AMBAS claves sincronamente
        const info = { resolve, reject, timer, tipo, destino, internalId, publishedId };
        confirmacionesPendientes.set(internalId, info);
        confirmacionesPendientes.set(publishedId, info);

        // Enviar mensaje forzando el id publicado y dejando el id interno en payload.
        // Añadimos campos canónicos para facilitar la correlación por parte
        // de los receptores: `respuestaA` (referencia al id interno usado
        // por quien espera la confirmación) y `mensajeOriginal` (id publicado
        // en el encabezado). No sobrescribimos si el llamador ya los proveyó.
        try {
            const datosEnviados = { ...datos };
            // asegurar compatibilidad: mantener mensajeId para código legado
            if (!datosEnviados.mensajeId) datosEnviados.mensajeId = internalId;
            if (!datosEnviados.respuestaA) datosEnviados.respuestaA = internalId;
            if (!datosEnviados.mensajeOriginal) datosEnviados.mensajeOriginal = publishedId;

            const prom = Promise.resolve(enviarMensaje({ tipo, origen, destino, datos: datosEnviados, version, id: publishedId }));
            // Compat: asegurar que si enviarMensaje devuelve un mensajeId lo tengamos registrado
            prom.then(res => {
                try {
                    if (res && res.mensajeId && !confirmacionesPendientes.has(res.mensajeId)) {
                        confirmacionesPendientes.set(res.mensajeId, info);
                    }
                } catch (e) { /* ignore */ }
            }).catch(() => { /* ignore */ });
        } catch (error) {
            clearTimeout(timer);
            eliminarConfirmacionPorInfo(info);
            reject(error);
        }
    });
}

/**
 * Registra un controlador para un tipo de mensaje específico.
 * @param {string} tipo - Tipo de mensaje.
 * @param {Function} callback - Función que manejará el mensaje.
 */
export function registrarControlador(tipo, callback) {
    if (!tipo || typeof callback !== 'function') {
        // No lanzar excepción para evitar romper la inicialización de la app.
        // En su lugar, registrar información diagnóstica para investigar la llamada errónea.
        try {
            console.warn('[MENSAJERIA] Registrar controlador ignorado: tipo o callback inválido', { tipo, callbackType: typeof callback });
            console.trace();
        } catch (e) {
            // Si console falla por alguna razón, ignoramos silenciosamente
        }
        return;
    }

    // Guardar el controlador. Si `manejadores` aún no está disponible
    // (puede pasar por TDZ debido a imports circulares), usamos el
    // fallback global `__vv_manejadores`. Cuando `inicializarMensajeria`
    // corra, migramos las entradas al Map real.
    try {
        __vv_getManejadores().set(tipo, callback);
    } catch (err) {
        if (!globalThis.__vv_manejadores) globalThis.__vv_manejadores = new Map();
        globalThis.__vv_manejadores.set(tipo, callback);
    }
}

// Exponer globalmente para compatibilidad con código que espera window.mensajeria
if (typeof window !== 'undefined') {
    window.mensajeria = {
        enviarMensaje,
        registrarControlador,
        inicializarMensajeria,
        migrarManejadoresTempranos
    };
}

/**
 * Maneja mensajes entrantes.
 * @param {MessageEvent} event - Evento de mensaje.
 */
function manejarMensajeEntrante(event) {
    // Diagnóstico opcional: mostrar detalles de mensajes entrantes
    try {
        if (window.__vv_diagnostics) {
            try {
                console.info('[MENSAJERIA][DIAG] Mensaje entrante - origin:', event.origin, 'expected:', window.location.origin, 'data:', event.data);
                // event.source puede no ser serializable en todos los entornos
                try { console.debug('[MENSAJERIA][DIAG] event.source:', event.source); } catch (e) { /* ignore */ }
            } catch (e) { /* no-op diagnóstico */ }
        }
    } catch (e) {
        // proteger diagnósticos para no romper el handler
    }

    // Validar el origen del mensaje para seguridad
    const origenEsperado = window.location.origin;
    const origenMensaje = event.origin || 'null';
    // Orígenes permitidos configurables via CONFIG.MENSAJERIA.ALLOWED_ORIGINS
    const allowedOriginsConfig = (window.Config && window.Config.MENSAJERIA && Array.isArray(window.Config.MENSAJERIA.ALLOWED_ORIGINS)) ? window.Config.MENSAJERIA.ALLOWED_ORIGINS : [];
    const origenPermitido = (origenMensaje === origenEsperado) || (origenMensaje === 'null') || allowedOriginsConfig.includes(origenMensaje) || (event.source === window.parent);
    if (!origenPermitido) {
        console.warn(`Mensaje rechazado de origen no confiable: ${origenMensaje} (esperado: ${origenEsperado})`);
        try { typeof window.incrementarContador === 'function' && window.incrementarContador('mensajeria.rejected_origin'); } catch (e) { /* ignore */ }
        // Añadir ayuda rápida para el desarrollador
        if (window.__vv_diagnostics) {
            console.info('[MENSAJERIA][DIAG] Sugerencia: si está ejecutando desde file:// o en un iframe sandboxed, agregue "null" a CONFIG.MENSAJERIA.ALLOWED_ORIGINS o sirva la app desde localhost/https.');
            try { console.debug('[MENSAJERIA][DIAG] payload:', event.data); } catch (e) { /* ignore */ }
        }
        return;
    }
    if (window.__vv_diagnostics && origenMensaje === 'null') {
        console.info('[MENSAJERIA][DIAG] Aceptando mensaje de origen "null" (posible file:// o iframe sandboxed)');
    }

    const mensaje = event.data;

    // Filtrar mensajes que no son del sistema (ej: extensiones del navegador)
    if (!mensaje || typeof mensaje !== 'object' || !mensaje.tipo || !mensaje.origen || !mensaje.destino) {
        // Ignorar silenciosamente mensajes no relacionados con el sistema
        return;
    }

    // Validar tipo contra la lista canónica de tipos
    try {
        if (Array.isArray(TIPOS_MENSAJE_VALIDOS) && TIPOS_MENSAJE_VALIDOS.length > 0) {
            if (!TIPOS_MENSAJE_VALIDOS.includes(mensaje.tipo)) {
                console.warn(`[MENSAJERIA] Tipo de mensaje no reconocido: ${mensaje.tipo} - descartando`);
                return;
            }
        }
    } catch (e) {
        // No bloquear por errores de validación de tipos
    }
    
    console.log(`📥 [MENSAJERIA] Mensaje recibido - tipo: ${mensaje.tipo}, origen: ${mensaje.origen}, destino: ${mensaje.destino}`);

    // Verificar que el mensaje está destinado a este componente
    const idComponenteActual = estadoMensajeria.componenteId || estadoMensajeria.iframeId;
    if (mensaje.destino !== idComponenteActual && mensaje.destino !== 'broadcast') {
        // Ignorar mensajes no destinados a este componente (excepto broadcasts)
        console.log(`🚫 [MENSAJERIA] Mensaje ignorado - destino: ${mensaje.destino}, actual: ${idComponenteActual}, tipo: ${mensaje.tipo}`);
        return;
    }
    
    console.log(`✅ [MENSAJERIA] Mensaje aceptado - destino: ${mensaje.destino}, tipo: ${mensaje.tipo}, origen: ${mensaje.origen}`);

    // Security: only allow the parent to emit GPS-originated updates (ubicación/estado/error).
    try {
        const gpsOutgoing = new Set([
            TIPOS_MENSAJE.NAVEGACION.GPS.UBICACION_ACTUALIZADA,
            TIPOS_MENSAJE.NAVEGACION.GPS.ESTADO_ACTUALIZADO,
            TIPOS_MENSAJE.NAVEGACION.GPS.ERROR
        ]);
        const padreId = (typeof getPadreId === 'function') ? getPadreId() : 'padre';
        if (gpsOutgoing.has(mensaje.tipo) && mensaje.origen !== padreId) {
            console.warn(`[MENSAJERIA] Mensaje GPS rechazado: solo el padre (${padreId}) puede emitir ${mensaje.tipo} - origen: ${mensaje.origen}`);
            try { typeof window.incrementarContador === 'function' && window.incrementarContador('mensajeria.rejected_gps_message'); } catch (e) { /* ignore */ }
            return; // Drop the message to avoid spoofing between children
        }
    } catch (e) { /* don't block on security check errors */ }
    // Compat: detectar respuestas que referencian un mensaje original en el payload
    // (datos.mensajeOriginal, idSolicitud, solicitudOriginalId) y resolver la
    // confirmación pendiente por mensajeId.
    try {
        const mensajeOriginalRef = mensaje.datos && (mensaje.datos.mensajeOriginal || mensaje.datos.idSolicitud || mensaje.datos.solicitudOriginalId || mensaje.datos.mensajeId);
        if (mensajeOriginalRef && confirmacionesPendientes.has(mensajeOriginalRef)) {
            const info = confirmacionesPendientes.get(mensajeOriginalRef);
            try { clearTimeout(info.timer); } catch (e) {}
            try { info.resolve(mensaje.datos); } catch (e) { /* ignore */ }
            eliminarConfirmacionPorInfo(info);
            // No llamar al controlador adicionalmente; la confirmación ya se procesó.
            return;
        }
    } catch (e) {
        // ignore
    }

    // Compat adicional: algunos componentes envían respuestas usando un tipo
    // dinámico con el formato `${TIPO}_RESPONSE_${mensajeId}`. Detectar ese
    // patrón y resolver la confirmación pendiente si existe.
    try {
        const dynMatch = typeof mensaje.tipo === 'string' && mensaje.tipo.match(/(.+)_RESPONSE_([A-Za-z0-9_-]+)$/);
        if (dynMatch) {
            const mensajeIdRef = dynMatch[2];
            if (confirmacionesPendientes.has(mensajeIdRef)) {
                const info = confirmacionesPendientes.get(mensajeIdRef);
                try { clearTimeout(info.timer); } catch (e) {}
                try { info.resolve(mensaje.datos); } catch (e) { /* ignore */ }
                eliminarConfirmacionPorInfo(info);
                return;
            }
        }
    } catch (e) {
        // ignore
    }

    // Compat adicional: resolver confirmaciones por id top-level o propiedades comunes
    try {
        const candidatos = [];
        if (mensaje.id) candidatos.push(mensaje.id);
        if (mensaje.mensajeId) candidatos.push(mensaje.mensajeId);
        if (mensaje.datos && mensaje.datos.mensajeId) candidatos.push(mensaje.datos.mensajeId);
        for (const cand of candidatos) {
            if (cand && confirmacionesPendientes.has(cand)) {
                const info = confirmacionesPendientes.get(cand);
                try { clearTimeout(info.timer); } catch (e) {}
                try { info.resolve(mensaje.datos); } catch (e) { /* ignore */ }
                eliminarConfirmacionPorInfo(info);
                return;
            }
        }
    } catch (e) {
        // ignore
    }

    // Procesar mensajes de registro de capacidades (handshake) enviados por hijos
    try {
        if (mensaje.tipo === TIPOS_MENSAJE.SISTEMA.COMPONENTE_INICIALIZADO || mensaje.tipo === TIPOS_MENSAJE.SISTEMA.HIJO_LISTO || mensaje.tipo === TIPOS_MENSAJE.SISTEMA.HIJO_PREPARADO) {
            const capacidades = mensaje.datos && mensaje.datos.capacidades ? mensaje.datos.capacidades : null;
            if (capacidades) {
                registrarCapacidadesHijo(mensaje.origen, capacidades);
            }
            // Registrar al hijo como conectado para heartbeat si estamos en el padre
            if (window.parent === window && mensaje.origen) {
                estadoMensajeria.heartbeat.hijosConectados.add(mensaje.origen);
                // Registrar hijo crítico si está en la lista de esperados
                if (estadoMensajeria.hijosEsperados.includes(mensaje.origen)) {
                    estadoMensajeria.hijosListos.add(mensaje.origen);
                    console.log(`✅ [MENSAJERIA] Hijo crítico listo: ${mensaje.origen} (${estadoMensajeria.hijosListos.size}/${estadoMensajeria.hijosEsperados.length})`);
                }
                
                // Procesar cola de mensajes cuando un hijo se marca como listo
                if (estadoMensajeria.colaMensajes.length > 0) {
                    console.log(`🔄 [MENSAJERIA] Hijo ${mensaje.origen} listo, procesando cola de mensajes...`);
                    setTimeout(() => procesarColaMensajes(), 50);
                }
                
                // Procesar broadcasts pendientes cuando TODOS los hijos críticos están listos
                const todosListos = estadoMensajeria.hijosEsperados.every(h => estadoMensajeria.hijosListos.has(h));
                if (todosListos && estadoMensajeria.broadcastsPendientes.length > 0) {
                    const pendientes = estadoMensajeria.broadcastsPendientes.length;
                    console.log(`🔄 [MENSAJERIA] ¡TODOS los hijos listos! Procesando ${pendientes} broadcast(s) pendiente(s)`);
                    const cola = [...estadoMensajeria.broadcastsPendientes];
                    estadoMensajeria.broadcastsPendientes = [];
                    cola.forEach(mensajePendiente => {
                        try {
                            const iframes = Array.from(document.getElementsByTagName('iframe'));
                            let enviados = 0;
                            const origenSeguro = window.location.origin;
                            iframes.forEach(iframe => {
                                try {
                                    if (iframe && iframe.contentWindow) {
                                        iframe.contentWindow.postMessage(mensajePendiente, origenSeguro);
                                        enviados++;
                                    }
                                } catch (e) {
                                    console.warn(`[MENSAJERIA] Error enviando broadcast pendiente:`, e);
                                }
                            });
                            console.log(`📤 [MENSAJERIA] Broadcast pendiente enviado - tipo: ${mensajePendiente.tipo}, enviados: ${enviados}`);
                        } catch (e) {
                            console.warn('[MENSAJERIA] Error procesando broadcast pendiente:', e);
                        }
                    });
                }
                // --- PATCH: Propagar HIJO_LISTO a todos los controladores registrados ---
                if (mensaje.tipo === TIPOS_MENSAJE.SISTEMA.HIJO_LISTO) {
                    try {
                        const mapa = __vv_getManejadores();
                        if (mapa && typeof mapa.forEach === 'function') {
                            mapa.forEach((cb, key) => {
                                if (key === TIPOS_MENSAJE.SISTEMA.HIJO_LISTO && typeof cb === 'function') {
                                    try {
                                        cb(mensaje);
                                    } catch (e) {
                                        console.warn('[MENSAJERIA] Error en controlador HIJO_LISTO propagado:', e);
                                    }
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('[MENSAJERIA] Error propagando HIJO_LISTO a controladores:', e);
                    }
                }
                // --- END PATCH ---
            }
            // Si el hijo indica que está PREPARADO para recibir datos (handshake explícito),
            // el padre responde inmediatamente con PADRE_LISTO (si somos el padre real).
            if (mensaje.tipo === TIPOS_MENSAJE.SISTEMA.HIJO_PREPARADO && window.parent === window && mensaje.origen) {
                // Evitar enviar PADRE_LISTO más de una vez por hijo para prevenir loops
                if (!window.estadoPadre) window.estadoPadre = {};
                if (!window.estadoPadre.hijosQueRecibieronPadreListo) window.estadoPadre.hijosQueRecibieronPadreListo = new Set();
                if (window.estadoPadre.hijosQueRecibieronPadreListo.has(mensaje.origen)) {
                    if (estadoMensajeria.debug) console.debug(`[MENSAJERIA] PADRE_LISTO ya enviado previamente a ${mensaje.origen}, omitiendo`);
                    return;
                }
                window.estadoPadre.hijosQueRecibieronPadreListo.add(mensaje.origen);
                
                try {
                    const datosPadre = {
                        modo: (window.estadoPadre && window.estadoPadre.modo) ? window.estadoPadre.modo : null,
                        paradaActual: (window.estadoPadre && window.estadoPadre.paradaActual) ? window.estadoPadre.paradaActual : null,
                        paradas: (window.AVENTURA_PARADAS || []),
                        timestamp: Date.now()
                    };
                    // No esperar respuesta, enviar en background
                    enviarMensaje({
                        destino: mensaje.origen,
                        tipo: TIPOS_MENSAJE.SISTEMA.PADRE_LISTO,
                        origen: estadoMensajeria.componenteId || getPadreId(),
                        datos: datosPadre
                    }).catch(() => {});
                    if (estadoMensajeria.debug) console.debug(`[MENSAJERIA] PADRE_LISTO enviado a ${mensaje.origen}`);
                } catch (e) {
                    console.warn('[MENSAJERIA] Error enviando PADRE_LISTO:', e && e.message ? e.message : e);
                }
            }
            // Enviar confirmación de padre al hijo (no bloquear) - SOLO si NO es el padre real
            // El padre real envía confirmación personalizada desde su controlador HIJO_LISTO
            if (estadoMensajeria.rol !== 'padre') {
                try {
                    enviarMensaje({
                        destino: mensaje.origen,
                        tipo: TIPOS_MENSAJE.SISTEMA.PADRE_CONFIRMA_HIJO_LISTO,
                        origen: estadoMensajeria.componenteId || getPadreId(),
                        datos: { timestamp: Date.now() }
                    }).catch && null;
                } catch (e) {
                    // ignorar errores en confirmación
                }
            }
            // Ya procesamos este handshake especial; no intentar buscar un controlador genérico
            return;
        }
    } catch (e) {
        console.warn('[MENSAJERIA] Error procesando handshake de capacidades:', e);
    }
    // Intentar obtener el controlador desde el Map principal. Si no
    // existe (o no está accesible por TDZ), intentar el fallback global.
    const mapa = __vv_getManejadores();
    const controlador = mapa && mapa.get ? mapa.get(mensaje.tipo) : undefined;
    if (!controlador) {
        // ✅ SINCRONIZACIÓN SCRIPT 2: Si el mensaje es para el padre y Script 2 NO está listo,
        // encolar el mensaje para procesarlo cuando Script 2 complete el registro de controladores
        const esMensajeParaPadre = (mensaje.destino === 'padre' || mensaje.destino === (typeof getPadreId === 'function' ? getPadreId() : null));
        
        if (esMensajeParaPadre && !estadoMensajeria.script2Listo && window.parent === window) {
            console.info(`⏳ [MENSAJERIA][SCRIPT2_PENDIENTE] Handler para "${mensaje.tipo}" no existe aún (Script 2 no listo), ENCOLANDO mensaje`, {
                mensajeId: mensaje.mensajeId || mensaje.id,
                origen: mensaje.origen,
                destino: mensaje.destino,
                posicionCola: estadoMensajeria.mensajesPendientesScript2.length + 1
            });
            
            // Marcar timestamp de encolado para detectar mensajes muy antiguos
            mensaje._timestampEncolado = Date.now();
            
            // Agregar a la cola de mensajes pendientes de Script 2
            estadoMensajeria.mensajesPendientesScript2.push(mensaje);
            
            // No procesar el mensaje ahora, esperar a que Script 2 esté listo
            return;
        }
        
        // Si no es para el padre O Script 2 ya está listo, es un error real
        try {
            const datosClon = (typeof structuredClone === 'function')
                ? structuredClone(mensaje.datos || {})
                : JSON.parse(JSON.stringify(mensaje.datos || {}));
            const handlersRegistered = mapa && typeof mapa.keys === 'function' ? Array.from(mapa.keys()) : [];
            if (window.__vv_diagnostics) {
                try {
                    console.debug('[MENSAJERIA][DIAG] Handlers registrados en este componente:', handlersRegistered);
                } catch (e) { /* ignore diag failure */ }
            }
            // Para broadcasts es normal que muchos iframes no tengan manejador
            // específico; bajar la severidad del log para evitar spam en consola.
            if (mensaje.destino === 'broadcast') {
                console.debug('[MENSAJERIA] Mensaje broadcast sin controlador en este componente (esperado en muchos casos)', {
                    tipo: mensaje.tipo,
                    origen: mensaje.origen,
                    destino: mensaje.destino,
                    handlersRegisteredCount: handlersRegistered.length
                });
            } else {
                console.warn('[MENSAJERIA] Mensaje no reconocido o sin controlador registrado', {
                    tipo: mensaje.tipo,
                    origen: mensaje.origen,
                    destino: mensaje.destino,
                    datos: datosClon,
                    handlersRegistered
                });
            }
        } catch (e) {
            if (mensaje.destino === 'broadcast') {
                console.debug('Mensaje broadcast sin controlador (no se pudo serializar):', mensaje.tipo, mensaje.origen);
            } else {
                console.warn('Mensaje no reconocido o sin controlador registrado (no se pudo serializar):', mensaje);
            }
        }
        return;
    }
    try {
        controlador(mensaje);
    } catch (error) {
        console.error(`Error manejando mensaje de tipo ${mensaje.tipo}:`, error);
    }
}

// NOTA: Listener de mensajes se registra en inicializarMensajeria() para evitar duplicados
// (Ver línea ~308 - registro condicional con estadoMensajeria.listenerRegistrado)

// Mapa para confirmaciones pendientes: mensajeOriginalId -> { resolve, reject, timer }
const confirmacionesPendientes = new Map();

/**
 * Elimina todas las claves en el Map de confirmaciones que referencian
 * al mismo objeto info (para evitar fugas cuando registramos múltiples
 * claves por la misma confirmación: internalId y publishedId).
 * @param {Object} info
 */
function eliminarConfirmacionPorInfo(info) {
    if (!info) return;
    try {
        for (const [k, v] of Array.from(confirmacionesPendientes.entries())) {
            if (v === info) confirmacionesPendientes.delete(k);
        }
    } catch (e) {
        // No crítico
    }
}

/**
 * Inicia el sistema de heartbeat para monitorear conectividad con hijos.
 * @param {number} [intervalo] - Intervalo en milisegundos entre heartbeats (opcional, por defecto usa configuración)
 */
export function iniciarHeartbeat(intervalo) {
    if (estadoMensajeria.rol !== 'padre') {
        throw new Error('El sistema de heartbeat solo puede iniciarse en el componente padre');
    }

    if (estadoMensajeria.heartbeat.activo) {
        console.warn('El sistema de heartbeat ya está activo');
        return;
    }

    // Usar intervalo personalizado si se proporciona
    if (intervalo && typeof intervalo === 'number' && intervalo > 0) {
        estadoMensajeria.heartbeat.intervalo = intervalo;
    }

    // No start if user requested pause (mode 'casa')
    if (estadoMensajeria.heartbeat.userPaused) {
        logger.info && logger.info('[heartbeat] Ignorando iniciarHeartbeat porque userPaused=true');
        return;
    }

    // No marcar activo hasta verificar que no estamos en pausa por modo
    let heartbeatPausado = false;
    let primerHeartbeat = true; // Flag para mostrar el primer latido

    const enviarHeartbeat = () => {
        // Pausar heartbeat si la página está oculta o si el usuario pidió pausa por modo
        if (document.hidden || heartbeatPausado || estadoMensajeria.heartbeat.userPaused) {
            return;
        }

        // Mostrar confirmación solo en el primer heartbeat
        if (primerHeartbeat) {
            console.info('💓 Heartbeat iniciado - Monitoreando conexión con hijos (solo errores se reportarán)');
            primerHeartbeat = false;
        }

        // Usar heartbeat.hijosConectados en vez de hijosConectados directamente
        estadoMensajeria.heartbeat.hijosConectados.forEach(hijoId => {
            enviarMensaje({
                tipo: TIPOS_MENSAJE.SISTEMA.HEARTBEAT,
                origen: getPadreId(),
                destino: hijoId,
                datos: { mensajeId: generarIdUnico() }
            }).catch(error => console.error(`❌ Error enviando heartbeat a ${hijoId}:`, error));
        });
    };

    // Pausar/reanudar heartbeat según visibilidad; registrar el listener una sola vez
    if (!estadoMensajeria.heartbeat.listenerRegistrado) {
        estadoMensajeria.heartbeat.listenerRegistrado = true;
        document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            heartbeatPausado = true;
        } else {
            heartbeatPausado = false;
            // Enviar heartbeat inmediatamente al reanudar
            enviarHeartbeat();
        }
    });
    }

    // Guardar cualquier timer previo y limpiarlo para evitar duplicados
    if (estadoMensajeria.heartbeat.timer) {
        try { clearInterval(estadoMensajeria.heartbeat.timer); } catch (e) { /* ignore */ }
        estadoMensajeria.heartbeat.timer = null;
    }
    estadoMensajeria.heartbeat.activo = true;
    estadoMensajeria.heartbeat.timer = setInterval(enviarHeartbeat, estadoMensajeria.heartbeat.intervalo);
    enviarHeartbeat();
}

/**
 * Detiene el sistema de heartbeat
 */
export function detenerHeartbeat() {
    if (estadoMensajeria.heartbeat.timer) {
        clearInterval(estadoMensajeria.heartbeat.timer);
        estadoMensajeria.heartbeat.timer = null;
        estadoMensajeria.heartbeat.activo = false;
    }
}

/**
 * Pausa el sistema de heartbeat (deja de enviar pings)
 * ✅ PROBLEMA 29: Pausar heartbeat en modo casa para ahorrar recursos
 */
export function pausarHeartbeat() {
    // Solo el padre mantiene la lógica de heartbeat; en hijos ignorar la llamada
    if (estadoMensajeria.rol !== 'padre') {
        try { logger.debug && logger.debug('[heartbeat] pausarHeartbeat invocado en rol no-padre, omitiendo'); } catch (e) { /* ignore logging failure */ }
        return;
    }

    // Mark user pause to avoid visibilitychange from reactivating the heartbeat
    estadoMensajeria.heartbeat.userPaused = true;

    if (estadoMensajeria.heartbeat.timer) {
        clearInterval(estadoMensajeria.heartbeat.timer);
        estadoMensajeria.heartbeat.timer = null;
        estadoMensajeria.heartbeat.activo = false;
        logger.debug('[heartbeat] Sistema pausado (modo casa)');
    }

    // Limpieza de timeouts de heartbeats pendientes (solo en padre)
    try {
        const timeoutsMap = estadoMensajeria.heartbeat.timeoutsHeartbeat;
        if (timeoutsMap && typeof timeoutsMap.entries === 'function') {
            for (const [hijoId, t] of timeoutsMap.entries()) {
                try { clearTimeout(t); } catch (e) { /* ignore */ }
            }
            try { timeoutsMap.clear && timeoutsMap.clear(); } catch (e) { /* ignore */ }
            logger.debug('[heartbeat] Limpiados timeoutsHeartbeat pendientes al pausar');
        }
    } catch (e) {
        logger.warn && logger.warn('[heartbeat] Error limpiando timeoutsHeartbeat:', e);
    }
}

/**
 * Reanuda el sistema de heartbeat (vuelve a enviar pings)
 * ✅ PROBLEMA 29: Reanudar heartbeat en modo aventura
 */
export function reanudarHeartbeat() {
    // Only re-enable if the pause was explicitly set by the user
    if (estadoMensajeria.rol !== 'padre') return;
    try {
        estadoMensajeria.heartbeat.userPaused = false;
        // Iniciar únicamente si no está activo
        if (!estadoMensajeria.heartbeat.activo) {
            iniciarHeartbeat();
            logger.debug('[heartbeat] Sistema reanudado (modo aventura)');
        }
    } catch (e) {
        logger.warn && logger.warn('[heartbeat] Error reanudando heartbeat:', e);
    }
}

// ================== CONTROLADORES DE COORDINACION =====================

/**
 * Procesa respuesta de datos de un componente hijo
 * @param {Object} mensaje - Mensaje de respuesta
 */
export async function procesarRespuestaDatosHijo(mensaje) {
    const { idSolicitud, datos, exito, error } = mensaje.datos || {};

    if (!idSolicitud || !estadoCoordinacion.solicitudesPendientes.has(idSolicitud)) {
        logger.warn(`Respuesta inesperada o solicitud no encontrada: ${idSolicitud}`);
        return;
    }

    const solicitud = estadoCoordinacion.solicitudesPendientes.get(idSolicitud);
    clearTimeout(solicitud.timeout);
    estadoCoordinacion.solicitudesPendientes.delete(idSolicitud);

    try {
        if (exito && datos) {
            // Cachear los datos
            const claveCache = `${solicitud.componente}_${solicitud.tipoDatos}`;
            estadoCoordinacion.datosCache.set(claveCache, {
                datos,
                timestamp: Date.now()
            });

            logger.debug(`Datos cacheados para ${claveCache}`);
            solicitud.resolve(datos);
        } else {
            solicitud.reject(new Error(error || 'Error en respuesta del componente'));
        }
    } catch (error) {
        logger.error('Error procesando respuesta de datos:', error);
        solicitud.reject(error);
    }
}

/**
 * Controlador para respuestas de datos de componentes hijo.
 * Procesa las respuestas a solicitudes de información previamente realizadas,
 * gestionando el cache y resolviendo las promesas pendientes.
 */
registrarControlador(TIPOS_MENSAJE.COORDINACION.RESPUESTA_DATOS_HIJO, procesarRespuestaDatosHijo);

/**
 * ✅ PROBLEMA 29: Controlador para cambio de modo (casa/aventura)
 * Pausa heartbeat en modo casa, lo reanuda en modo aventura
 */
registrarControlador(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, async (mensaje) => {
    const logPrefix = '[mensajeria][CAMBIO_MODO]';
    const { modo } = mensaje.datos || {};
    
    if (!modo) {
        logger.warn(`${logPrefix} Mensaje sin modo especificado`);
        return;
    }
    
    logger.info(`${logPrefix} Cambio de modo detectado: ${modo}`);
    
    // Actualizar estado local
    if (estadoMensajeria.modo !== undefined) {
        estadoMensajeria.modo = modo;
    }
    
    // ✅ PROBLEMA 29: Pausar/reanudar heartbeat según modo
    if (modo === 'casa') {
        logger.info(`${logPrefix} Modo CASA: Pausando heartbeat (no necesario sin GPS)`);
        pausarHeartbeat();
    } else if (modo === 'aventura') {
        logger.info(`${logPrefix} Modo AVENTURA: Reanudando heartbeat (necesario para GPS)`);
        reanudarHeartbeat();
    }
});

// Controlador: SISTEMA.HEARTBEAT.START (orden para iniciar heartbeat desde mensajería)
registrarControlador(TIPOS_MENSAJE.SISTEMA.HEARTBEAT_START, async (mensaje) => {
    const logPrefix = '[mensajeria][HEARTBEAT_START]';
    const datos = mensaje.datos || {};
    try {
        if (estadoMensajeria.rol !== 'padre') {
            // Si no es padre, el mensaje de start solo lo consumimos y respondemos
            logger.debug && logger.debug(`${logPrefix} recibido en rol no-padre, ignorando iniciarHeartbeat`);
            return { exito: true };
        }
        // Intentar iniciar heartbeat con el intervalo sugerido o usar el por defecto
        const intervalo = typeof datos.intervalo === 'number' && datos.intervalo > 0 ? datos.intervalo : undefined;
        // Respetar pausa por modo
        if (estadoMensajeria.heartbeat.userPaused) {
            logger.info && logger.info(`${logPrefix} Ignorando petición de inicio por heartbeat.userPaused=true`);
            return { exito: true };
        }
        iniciarHeartbeat(intervalo);
        logger.info(`${logPrefix} Heartbeat iniciado por mensaje (intervalo: ${intervalo || estadoMensajeria.heartbeat.intervalo})`);
        return { exito: true };
    } catch (e) {
        logger.error && logger.error(`${logPrefix} Error iniciando heartbeat:`, e);
        return { exito: false, error: e.message };
    }
});

// Controlador: SISTEMA.HEARTBEAT.PAUSE (orden para pausar heartbeat desde mensajería)
registrarControlador(TIPOS_MENSAJE.SISTEMA.HEARTBEAT_PAUSE, async (mensaje) => {
    const logPrefix = '[mensajeria][HEARTBEAT_PAUSE]';
    try {
        if (estadoMensajeria.rol !== 'padre') {
            logger.debug && logger.debug(`${logPrefix} recibido en rol no-padre, ignorando pausarHeartbeat`);
            return { exito: true };
        }
        pausarHeartbeat();
        logger.info(`${logPrefix} Heartbeat pausado por mensaje`);
        return { exito: true };
    } catch (e) {
        logger.error && logger.error(`${logPrefix} Error pausando heartbeat:`, e);
        return { exito: false, error: e.message };
    }
});

// Controlador: SISTEMA.HEARTBEAT.ESTADO (consulta del estado del heartbeat)
registrarControlador(TIPOS_MENSAJE.SISTEMA.HEARTBEAT_ESTADO, async (mensaje) => {
    const logPrefix = '[mensajeria][HEARTBEAT_ESTADO]';
    try {
        if (estadoMensajeria.rol !== 'padre') {
            logger.debug && logger.debug(`${logPrefix} consulta recibida en rol no-padre, respondiendo con estado local`);
            return {
                exito: true,
                estado: {
                    rol: estadoMensajeria.rol,
                    activo: estadoMensajeria.heartbeat.activo,
                    userPaused: estadoMensajeria.heartbeat.userPaused,
                    intervalo: estadoMensajeria.heartbeat.intervalo,
                    timerPresent: !!estadoMensajeria.heartbeat.timer,
                    hijosConectados: Array.from(estadoMensajeria.heartbeat.hijosConectados || []),
                    timeoutsHeartbeat: (estadoMensajeria.heartbeat.timeoutsHeartbeat && typeof estadoMensajeria.heartbeat.timeoutsHeartbeat.size === 'number') ? estadoMensajeria.heartbeat.timeoutsHeartbeat.size : undefined
                },
                timestamp: new Date().toISOString()
            };
        }
        // Para el padre, enviar info completa
        return {
            exito: true,
            estado: {
                rol: estadoMensajeria.rol,
                activo: estadoMensajeria.heartbeat.activo,
                userPaused: estadoMensajeria.heartbeat.userPaused,
                intervalo: estadoMensajeria.heartbeat.intervalo,
                timerPresent: !!estadoMensajeria.heartbeat.timer,
                hijosConectados: Array.from(estadoMensajeria.heartbeat.hijosConectados || []),
                timeoutsHeartbeat: (estadoMensajeria.heartbeat.timeoutsHeartbeat && typeof estadoMensajeria.heartbeat.timeoutsHeartbeat.size === 'number') ? estadoMensajeria.heartbeat.timeoutsHeartbeat.size : undefined
            },
            timestamp: new Date().toISOString()
        };
    } catch (e) {
        logger.error && logger.error(`${logPrefix} Error consultando estado heartbeat:`, e);
        return { exito: false, error: e.message };
    }
});

/**
 * Obtiene el estado actual del sistema de coordinación
 * @returns {Object} Estado de coordinación
 */
export function obtenerEstadoCoordinacion() {
    return {
        solicitudesPendientes: estadoCoordinacion.solicitudesPendientes.size,
        datosCache: estadoCoordinacion.datosCache.size,
        coordinacionesActivas: estadoCoordinacion.coordinacionesActivas.size,
        tiempoEsperaMax: estadoCoordinacion.tiempoEsperaMax,
        cacheTTL: estadoCoordinacion.cacheTTL
    };
}

/**
 * Controlador para consultar el estado del sistema de coordinación.
 * Proporciona información sobre solicitudes pendientes, cache, coordinaciones activas
 * y configuración del sistema.
 */
registrarControlador(TIPOS_MENSAJE.COORDINACION.ESTADO_COORDINACION, async (mensaje) => {
    const estadoCoord = obtenerEstadoCoordinacion();
    return {
        estado: estadoCoord,
        timestamp: new Date().toISOString()
    };
});

/**
 * Maneja las solicitudes de datos a componentes hijo.
 * Este controlador coordina las peticiones de información a diferentes componentes,
 * gestionando timeouts, reintentos y respuestas agregadas.
 * 
 * @param {Object} mensaje - Mensaje de solicitud de datos
 * @param {string} mensaje.origen - Origen del mensaje (componente solicitante)
 * @param {Object} mensaje.datos - Datos de la solicitud
 * @param {string|Array<string>} mensaje.datos.hijo - ID del hijo o array de IDs de hijos a consultar
 * @param {string} mensaje.datos.tipoInfo - Tipo de información solicitada ('estado', 'datos', 'configuracion', etc.)
 * @param {Object} [mensaje.datos.parametros] - Parámetros adicionales para la solicitud
 * @param {number} [mensaje.datos.timeout=5000] - Timeout en ms para la respuesta
 * @param {boolean} [mensaje.datos.permitirParcial=false] - Si se permiten respuestas parciales en caso de múltiples hijos
 * @param {string} [mensaje.mensajeId] - ID único del mensaje para seguimiento
 */
registrarControlador(TIPOS_MENSAJE.COORDINACION.SOLICITAR_DATOS_HIJO, async (mensaje) => {
    const logPrefix = `[COORDINACION.SOLICITAR_DATOS_HIJO][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje sin origen, ignorando solicitud de datos hijo';
            logger.warn(`${logPrefix} ${errorMsg}`);
            return;
        }

        if (!mensaje?.datos?.hijo) {
            const errorMsg = 'Hijo no especificado en la solicitud';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId });
            throw new Error(errorMsg);
        }

        const { 
            hijo, 
            tipoInfo = 'estado', 
            parametros = {}, 
            timeout = ajustarTimeoutPorConexion(5000),
            permitirParcial = false
        } = mensaje.datos;

        logger.info(`${logPrefix} Solicitando datos tipo '${tipoInfo}' a hijo(s)`, { 
            mensajeId,
            hijo: Array.isArray(hijo) ? hijo.join(', ') : hijo,
            tipoInfo,
            timeout
        });

        // 2. Normalizar hijos a array
        const hijos = Array.isArray(hijo) ? hijo : [hijo];
        
        // 3. Validar que los hijos existen y están activos
        const hijosValidos = hijos.filter(hijoId => {
            const iframe = document.getElementById(hijoId);
            if (!iframe) {
                logger.warn(`${logPrefix} Hijo '${hijoId}' no encontrado en el DOM`);
                return false;
            }
            return true;
        });

        if (hijosValidos.length === 0) {
            const errorMsg = 'Ninguno de los hijos especificados es válido';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId, hijos });
            throw new Error(errorMsg);
        }

        // 4. Enviar solicitudes a cada hijo
        const solicitudes = hijosValidos.map(async hijoId => {
            const solicitudId = generarIdUnico();
            
            try {
                logger.debug(`${logPrefix} Enviando solicitud a hijo '${hijoId}'`, { 
                    solicitudId, 
                    tipoInfo 
                });

                // Enviar solicitud con timeout
                const respuesta = await Promise.race([
                    enviarMensajeConConfirmacion({
                        destino: hijoId,
                        tipo: TIPOS_MENSAJE.DATOS.SOLICITAR_DATOS,
                        origen: 'coordinador',
                        mensajeId: solicitudId,
                        datos: {
                            tipoInfo,
                            parametros,
                            solicitudOriginalId: mensajeId,
                            timeout
                        }
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`Timeout esperando respuesta de ${hijoId}`)), timeout)
                    )
                ]);

                return {
                    hijoId,
                    exito: true,
                    datos: respuesta,
                    timestamp: Date.now()
                };
                
            } catch (error) {
                logger.error(`${logPrefix} Error al solicitar datos a hijo '${hijoId}': ${error.message}`, error);
                
                return {
                    hijoId,
                    exito: false,
                    error: error.message,
                    timestamp: Date.now()
                };
            }
        });

        // 5. Esperar respuestas
        const respuestas = await Promise.all(solicitudes);

        // 6. Analizar resultados
        const exitosas = respuestas.filter(r => r.exito);
        const fallidas = respuestas.filter(r => !r.exito);

        if (exitosas.length === 0 && !permitirParcial) {
            const errorMsg = 'Todas las solicitudes a hijos fallaron';
            logger.error(`${logPrefix} ${errorMsg}`, { 
                mensajeId, 
                respuestas 
            });
            throw new Error(errorMsg);
        }

        // 7. Preparar respuesta agregada
        const respuestaAgregada = {
            exitosas: exitosas.map(r => ({
                hijoId: r.hijoId,
                datos: r.datos,
                timestamp: r.timestamp
            })),
            fallidas: fallidas.map(r => ({
                hijoId: r.hijoId,
                error: r.error,
                timestamp: r.timestamp
            })),
            total: respuestas.length,
            exitosos: exitosas.length,
            fallidos: fallidas.length,
            parcial: fallidas.length > 0,
            tipoInfo
        };

        // 8. Actualizar caché de coordinación
        exitosas.forEach(respuesta => {
            const cacheKey = `${respuesta.hijoId}:${tipoInfo}`;
            estadoCoordinacion.cacheRespuestas.set(cacheKey, {
                datos: respuesta.datos,
                timestamp: respuesta.timestamp,
                ttl: estadoCoordinacion.cacheTTL
            });
        });

        // 9. Enviar respuesta al solicitante
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.COORDINACION.RESPUESTA_DATOS_HIJO,
            origen: 'coordinador',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                timestamp: Date.now(),
                respuesta: respuestaAgregada
            }
        });

        logger.info(`${logPrefix} Solicitud completada`, { 
            mensajeId,
            exitosos: exitosas.length,
            fallidos: fallidas.length
        });

        return respuestaAgregada;
        
    } catch (error) {
        const errorNoManejado = `Error no manejado en SOLICITAR_DATOS_HIJO: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar error al origen
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    origen: 'coordinador',
                    mensajeId: generarIdUnico(),
                    datos: {
                        error: errorNoManejado,
                        mensajeOriginalId: mensajeId,
                        timestamp: Date.now(),
                        tipo: 'ERROR_SOLICITAR_DATOS_HIJO',
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    }
                });
            }
        } catch (nestedError) {
            logger.error(`${logPrefix} Error al notificar error: ${nestedError.message}`);
        }
        
        throw error;
    }
});

/**
 * Maneja la coordinación de acciones entre múltiples componentes.
 * Este controlador orquesta acciones sincronizadas entre diferentes componentes,
 * asegurando que se ejecuten en el orden correcto y manejando dependencias.
 * 
 * @param {Object} mensaje - Mensaje de coordinación de acción
 * @param {string} mensaje.origen - Origen del mensaje
 * @param {Object} mensaje.datos - Datos de la acción a coordinar
 * @param {string} mensaje.datos.accion - Tipo de acción a coordinar
 * @param {Array<Object>} mensaje.datos.participantes - Lista de componentes participantes
 * @param {string} mensaje.datos.participantes[].componenteId - ID del componente
 * @param {string} mensaje.datos.participantes[].rol - Rol en la coordinación ('iniciador', 'ejecutor', 'observador')
 * @param {Object} [mensaje.datos.participantes[].parametros] - Parámetros específicos del participante
 * @param {Array<string>} [mensaje.datos.dependencias] - IDs de componentes que deben estar listos primero
 * @param {boolean} [mensaje.datos.transaccional=false] - Si la acción es transaccional (all-or-nothing)
 * @param {number} [mensaje.datos.timeout=10000] - Timeout para la coordinación en ms
 * @param {string} [mensaje.mensajeId] - ID único del mensaje
 */
registrarControlador(TIPOS_MENSAJE.COORDINACION.COORDINAR_ACCION, async (mensaje) => {
    const logPrefix = `[COORDINACION.COORDINAR_ACCION][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje sin origen, ignorando coordinación';
            logger.warn(`${logPrefix} ${errorMsg}`);
            return;
        }

        if (!mensaje?.datos?.accion) {
            const errorMsg = 'Acción no especificada';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId });
            throw new Error(errorMsg);
        }

        if (!mensaje?.datos?.participantes || !Array.isArray(mensaje.datos.participantes)) {
            const errorMsg = 'Participantes no especificados o inválidos';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId });
            throw new Error(errorMsg);
        }

        const { 
            accion, 
            participantes, 
            dependencias = [], 
            transaccional = false,
            timeout = 10000
        } = mensaje.datos;

        logger.info(`${logPrefix} Coordinando acción '${accion}' con ${participantes.length} participantes`, { 
            mensajeId,
            accion,
            participantes: participantes.map(p => p.componenteId),
            transaccional
        });

        // 2. Validar dependencias primero
        if (dependencias.length > 0) {
            logger.debug(`${logPrefix} Verificando ${dependencias.length} dependencias`, { dependencias });
            
            for (const depId of dependencias) {
                const iframe = document.getElementById(depId);
                if (!iframe) {
                    throw new Error(`Dependencia '${depId}' no encontrada`);
                }
                
                // Verificar que la dependencia está lista
                try {
                    await enviarMensajeConConfirmacion({
                        destino: depId,
                        tipo: TIPOS_MENSAJE.SISTEMA.HEARTBEAT,
                        origen: 'coordinador',
                        mensajeId: generarIdUnico()
                    }, 2000);
                } catch (error) {
                    throw new Error(`Dependencia '${depId}' no responde: ${error.message}`);
                }
            }
        }

        // 3. Notificar a participantes sobre la acción coordinada
        const notificaciones = participantes.map(async (participante) => {
            const { componenteId, rol, parametros = {} } = participante;
            
            try {
                logger.debug(`${logPrefix} Notificando a '${componenteId}' (rol: ${rol})`, { 
                    componenteId, 
                    rol 
                });

                const respuesta = await Promise.race([
                    enviarMensajeConConfirmacion({
                        destino: componenteId,
                        tipo: TIPOS_MENSAJE.CONTROL.EJECUTAR,
                        origen: 'coordinador',
                        mensajeId: generarIdUnico(),
                        datos: {
                            accion,
                            rol,
                            parametros,
                            coordinacionId: mensajeId,
                            timestamp
                        }
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`Timeout en ${componenteId}`)), timeout)
                    )
                ]);

                return {
                    componenteId,
                    exito: true,
                    respuesta,
                    timestamp: Date.now()
                };
                
            } catch (error) {
                logger.error(`${logPrefix} Error en participante '${componenteId}': ${error.message}`, error);
                
                return {
                    componenteId,
                    exito: false,
                    error: error.message,
                    timestamp: Date.now()
                };
            }
        });

        // 4. Esperar respuestas de todos los participantes
        const resultados = await Promise.all(notificaciones);

        // 5. Analizar resultados
        const exitosos = resultados.filter(r => r.exito);
        const fallidos = resultados.filter(r => !r.exito);

        // 6. Manejar modo transaccional
        if (transaccional && fallidos.length > 0) {
            logger.error(`${logPrefix} Coordinación transaccional falló, revertiendo`, { 
                mensajeId,
                fallidos: fallidos.map(f => f.componenteId)
            });

            // Enviar rollback a participantes exitosos
            await Promise.all(exitosos.map(resultado => 
                enviarMensaje({
                    destino: resultado.componenteId,
                    tipo: TIPOS_MENSAJE.CONTROL.ROLLBACK,
                    origen: 'coordinador',
                    mensajeId: generarIdUnico(),
                    datos: {
                        coordinacionId: mensajeId,
                        motivo: 'fallo_en_participante',
                        fallos: fallidos
                    }
                })
            ));

            throw new Error(`Coordinación transaccional falló: ${fallidos.length} participantes fallaron`);
        }

        // 7. Preparar respuesta
        const respuestaCoordinacion = {
            accion,
            total: resultados.length,
            exitosos: exitosos.length,
            fallidos: fallidos.length,
            exitoso: fallidos.length === 0,
            parcial: fallidos.length > 0 && exitosos.length > 0,
            resultados: resultados.map(r => ({
                componenteId: r.componenteId,
                exito: r.exito,
                error: r.error,
                timestamp: r.timestamp
            })),
            timestamp: Date.now()
        };

        // 8. Notificar resultado al solicitante
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'coordinador',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                coordinacion: respuestaCoordinacion
            }
        });

        // 9. Notificar a observadores si los hay
        const observadores = participantes.filter(p => p.rol === 'observador');
        if (observadores.length > 0) {
            await Promise.all(observadores.map(obs => 
                enviarMensaje({
                    destino: obs.componenteId,
                    tipo: TIPOS_MENSAJE.COORDINACION.ESTADO_COORDINACION,
                    origen: 'coordinador',
                    mensajeId: generarIdUnico(),
                    datos: {
                        coordinacionId: mensajeId,
                        estado: respuestaCoordinacion
                    }
                })
            ));
        }

        logger.info(`${logPrefix} Coordinación completada`, { 
            mensajeId,
            accion,
            exitoso: respuestaCoordinacion.exitoso
        });

        return respuestaCoordinacion;
        
    } catch (error) {
        const errorNoManejado = `Error no manejado en COORDINAR_ACCION: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar error al origen
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    origen: 'coordinador',
                    mensajeId: generarIdUnico(),
                    datos: {
                        error: errorNoManejado,
                        mensajeOriginalId: mensajeId,
                        timestamp: Date.now(),
                        tipo: 'ERROR_COORDINAR_ACCION',
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    }
                });
            }
        } catch (nestedError) {
            logger.error(`${logPrefix} Error al notificar error: ${nestedError.message}`);
        }
        
        throw error;
    }
});

/**
 * Maneja la sincronización de estado entre componentes.
 * Este controlador asegura que múltiples componentes mantengan estados consistentes,
 * propagando cambios y resolviendo conflictos.
 * 
 * @param {Object} mensaje - Mensaje de sincronización
 * @param {string} mensaje.origen - Origen del mensaje
 * @param {Object} mensaje.datos - Datos de sincronización
 * @param {Array<string>} mensaje.datos.componentes - IDs de componentes a sincronizar
 * @param {string} mensaje.datos.estadoTipo - Tipo de estado a sincronizar
 * @param {Object} [mensaje.datos.estadoReferencia] - Estado de referencia a propagar
 * @param {string} [mensaje.datos.estrategia='propagacion'] - Estrategia: 'propagacion', 'consolidacion', 'resolucion'
 * @param {boolean} [mensaje.datos.forzar=false] - Forzar sincronización ignorando conflictos
 * @param {number} [mensaje.datos.timeout=8000] - Timeout para la sincronización
 * @param {string} [mensaje.mensajeId] - ID único del mensaje
 */
registrarControlador(TIPOS_MENSAJE.COORDINACION.SINCRONIZAR_COMPONENTES, async (mensaje) => {
    const logPrefix = `[COORDINACION.SINCRONIZAR_COMPONENTES][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje sin origen, ignorando sincronización';
            logger.warn(`${logPrefix} ${errorMsg}`);
            return;
        }

        if (!mensaje?.datos?.componentes || !Array.isArray(mensaje.datos.componentes) || mensaje.datos.componentes.length === 0) {
            const errorMsg = 'Componentes no especificados, inválidos o vacíos';
            logger.error(`${logPrefix} ${errorMsg}`, { 
                mensajeId,
                tipoRecibido: typeof mensaje?.datos?.componentes,
                esArray: Array.isArray(mensaje?.datos?.componentes),
                longitud: mensaje?.datos?.componentes?.length
            });
            throw new Error(errorMsg);
        }

        if (!mensaje?.datos?.estadoTipo) {
            const errorMsg = 'Tipo de estado no especificado';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId });
            throw new Error(errorMsg);
        }

        const { 
            componentes, 
            estadoTipo, 
            estadoReferencia = null, 
            estrategia = 'propagacion',
            forzar = false,
            timeout = 8000
        } = mensaje.datos;

        logger.info(`${logPrefix} Sincronizando estado '${estadoTipo}' entre ${componentes.length} componentes`, { 
            mensajeId,
            componentes,
            estrategia
        });

        // 2. Validar que los componentes existen
        const componentesValidos = componentes.filter(compId => {
            const iframe = document.getElementById(compId);
            if (!iframe) {
                logger.warn(`${logPrefix} Componente '${compId}' no encontrado`);
                return false;
            }
            return true;
        });

        if (componentesValidos.length === 0) {
            throw new Error('Ningún componente válido para sincronizar');
        }

        let resultadoSincronizacion;

        // 3. Ejecutar según estrategia
        switch (estrategia) {
            case 'propagacion':
                // Propagar estado de referencia a todos los componentes
                if (!estadoReferencia) {
                    throw new Error('Estado de referencia requerido para estrategia de propagación');
                }

                resultadoSincronizacion = await Promise.all(componentesValidos.map(async compId => {
                    try {
                        await Promise.race([
                            enviarMensajeConConfirmacion({
                                destino: compId,
                                tipo: TIPOS_MENSAJE.SISTEMA.ESTADO,
                                origen: 'coordinador',
                                mensajeId: generarIdUnico(),
                                datos: {
                                    estadoTipo,
                                    estado: estadoReferencia,
                                    forzar,
                                    sincronizacionId: mensajeId
                                }
                            }),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error(`Timeout en ${compId}`)), timeout)
                            )
                        ]);

                        return { componenteId: compId, exito: true };
                    } catch (error) {
                        logger.error(`${logPrefix} Error sincronizando '${compId}': ${error.message}`);
                        return { componenteId: compId, exito: false, error: error.message };
                    }
                }));
                break;

            case 'consolidacion':
                // Obtener estados de todos y consolidar
                const estadosActuales = await Promise.all(componentesValidos.map(async compId => {
                    try {
                        const respuesta = await Promise.race([
                            enviarMensajeConConfirmacion({
                                destino: compId,
                                tipo: TIPOS_MENSAJE.DATOS.SOLICITAR_DATOS,
                                origen: 'coordinador',
                                mensajeId: generarIdUnico(),
                                datos: { tipoInfo: estadoTipo }
                            }),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error(`Timeout en ${compId}`)), timeout)
                            )
                        ]);

                        return { componenteId: compId, exito: true, estado: respuesta };
                    } catch (error) {
                        return { componenteId: compId, exito: false, error: error.message };
                    }
                }));

                // Consolidar estados (estrategia simple: mayoría gana)
                const estadosExitosos = estadosActuales.filter(e => e.exito);
                if (estadosExitosos.length === 0) {
                    throw new Error('No se pudo obtener ningún estado para consolidar');
                }

                // Por ahora, tomar el estado más reciente como referencia
                const estadoConsolidado = estadosExitosos.reduce((prev, current) => {
                    return (current.estado.timestamp > prev.estado.timestamp) ? current : prev;
                }).estado;

                // Propagar estado consolidado
                resultadoSincronizacion = await Promise.all(componentesValidos.map(async compId => {
                    try {
                        await enviarMensaje({
                            destino: compId,
                            tipo: TIPOS_MENSAJE.SISTEMA.ESTADO,
                            origen: 'coordinador',
                            mensajeId: generarIdUnico(),
                            datos: {
                                estadoTipo,
                                estado: estadoConsolidado,
                                sincronizacionId: mensajeId
                            }
                        });

                        return { componenteId: compId, exito: true };
                    } catch (error) {
                        return { componenteId: compId, exito: false, error: error.message };
                    }
                }));
                break;

            case 'resolucion':
                // Resolver conflictos entre componentes
                logger.info(`${logPrefix} Estrategia de resolución no implementada completamente, usando propagación`);
                resultadoSincronizacion = [{ mensaje: 'Estrategia en desarrollo' }];
                break;

            default:
                throw new Error(`Estrategia desconocida: ${estrategia}`);
        }

        // 4. Analizar resultados
        const exitosos = resultadoSincronizacion.filter(r => r.exito);
        const fallidos = resultadoSincronizacion.filter(r => !r.exito);

        const respuesta = {
            estadoTipo,
            estrategia,
            total: componentesValidos.length,
            exitosos: exitosos.length,
            fallidos: fallidos.length,
            exitoso: fallidos.length === 0,
            componentes: resultadoSincronizacion,
            timestamp: Date.now()
        };

        // 5. Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'coordinador',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                sincronizacion: respuesta
            }
        });

        logger.info(`${logPrefix} Sincronización completada`, { 
            mensajeId,
            exitosos: exitosos.length,
            fallidos: fallidos.length
        });

        return respuesta;
        
    } catch (error) {
        const errorNoManejado = `Error no manejado en SINCRONIZAR_COMPONENTES: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar error al origen
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    origen: 'coordinador',
                    mensajeId: generarIdUnico(),
                    datos: {
                        error: errorNoManejado,
                        mensajeOriginalId: mensajeId,
                        timestamp: Date.now(),
                        tipo: 'ERROR_SINCRONIZAR_COMPONENTES',
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    }
                });
            }
        } catch (nestedError) {
            logger.error(`${logPrefix} Error al notificar error: ${nestedError.message}`);
        }
        
        throw error;
    }
});

// ===================================================================
// SINCRONIZACIÓN SCRIPT 2
// ===================================================================

/**
 * Marca Script 2 como listo y procesa todos los mensajes que esperaban
 * a que los controladores de Script 2 estuvieran registrados.
 * 
 * Esta función debe llamarse AL FINAL de Script 2 en codigo-padre.html,
 * después de que todos los controladores estén registrados.
 * 
 * @returns {Object} Resultado del procesamiento con estadísticas
 */
export function marcarScript2Listo() {
    const logPrefix = '[MENSAJERIA][SCRIPT2_LISTO]';
    
    if (estadoMensajeria.script2Listo) {
        logger.warn(`${logPrefix} Ya estaba marcado como listo, omitiendo`);
        return { yaListo: true, procesados: 0, fallidos: 0 };
    }
    
    estadoMensajeria.script2Listo = true;
    logger.info(`${logPrefix} Script 2 marcado como LISTO`);
    
    const cantidadPendientes = estadoMensajeria.mensajesPendientesScript2.length;
    
    if (cantidadPendientes === 0) {
        logger.info(`${logPrefix} No había mensajes pendientes`);
        return { yaListo: false, procesados: 0, fallidos: 0 };
    }
    
    logger.info(`${logPrefix} Procesando ${cantidadPendientes} mensaje(s) pendiente(s)`);
    
    const mensajesProcesados = [];
    const mensajesFallidos = [];
    
    // Copiar cola y vaciarla inmediatamente para evitar reentrancia
    const cola = [...estadoMensajeria.mensajesPendientesScript2];
    estadoMensajeria.mensajesPendientesScript2 = [];
    
    // Procesar cada mensaje pendiente
    cola.forEach((mensajePendiente, index) => {
        try {
            const edad = Date.now() - (mensajePendiente._timestampEncolado || 0);
            logger.debug(`${logPrefix} [${index + 1}/${cola.length}] Procesando: ${mensajePendiente.tipo} (edad: ${edad}ms)`);
            
            // Re-procesar el mensaje ahora que Script 2 está listo
            // Buscar el controlador y ejecutarlo directamente
            const mapa = __vv_getManejadores();
            const controlador = mapa && mapa.get ? mapa.get(mensajePendiente.tipo) : undefined;
            
            if (controlador && typeof controlador === 'function') {
                try {
                    const resultado = controlador(mensajePendiente);
                    // Si el controlador devuelve una promesa, manejarla
                    if (resultado && typeof resultado.then === 'function') {
                        resultado
                            .then(() => {
                                mensajesProcesados.push(mensajePendiente.tipo);
                                logger.debug(`${logPrefix} ✅ Mensaje procesado (async): ${mensajePendiente.tipo}`);
                            })
                            .catch(error => {
                                mensajesFallidos.push({ tipo: mensajePendiente.tipo, error: error.message });
                                logger.error(`${logPrefix} ❌ Error procesando mensaje (async): ${mensajePendiente.tipo}`, error);
                            });
                    } else {
                        mensajesProcesados.push(mensajePendiente.tipo);
                        logger.debug(`${logPrefix} ✅ Mensaje procesado (sync): ${mensajePendiente.tipo}`);
                    }
                } catch (error) {
                    mensajesFallidos.push({ tipo: mensajePendiente.tipo, error: error.message });
                    logger.error(`${logPrefix} ❌ Error ejecutando controlador: ${mensajePendiente.tipo}`, error);
                }
            } else {
                mensajesFallidos.push({ tipo: mensajePendiente.tipo, error: 'Controlador no encontrado' });
                logger.warn(`${logPrefix} ⚠️ Controlador no encontrado para: ${mensajePendiente.tipo}`);
            }
                
        } catch (error) {
            mensajesFallidos.push({ tipo: mensajePendiente.tipo || 'desconocido', error: error.message });
            logger.error(`${logPrefix} ❌ Error procesando mensaje pendiente:`, error);
        }
    });
    
    // Dar tiempo a que se procesen las promesas (async)
    setTimeout(() => {
        const totalProcesados = mensajesProcesados.length;
        const totalFallidos = mensajesFallidos.length;
        
        logger.info(`${logPrefix} Procesamiento completado: ${totalProcesados} exitosos, ${totalFallidos} fallidos`);
        
        if (totalFallidos > 0) {
            logger.warn(`${logPrefix} Detalles de mensajes fallidos:`, mensajesFallidos);
        }
    }, 500);
    
    return {
        yaListo: false,
        procesados: cola.length,
        fallidos: 0, // Se actualizará asíncronamente
        detalles: { cantidadInicial: cantidadPendientes }
    };
}

export { estadoMensajeria, procesarColaMensajes };
