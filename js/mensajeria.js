/**
 * @fileoverview Sistema de mensajería para ValenciaVGuides
 * @version 2.0.0
 * 
 * Sistema centralizado de comunicación entre padre e hijos (iframes).
 * Todas las operaciones de registro y envío delegan al state-manager centralizado.
 */

import { TIPOS_MENSAJE, TTL_LIMPIEZA, ERRORES, ESTADOS } from './constants.js';
import logger from './logger.js';
import { generarIdUnico } from './utils.js';
import { esMovil } from './device-detection.js';

// =====================================================
// ESTADO LOCAL (mínimo, delegamos al state-manager)
// =====================================================

/**
 * Referencia al state-manager centralizado
 * @type {Object|null}
 */
let stateManager = null;

/**
 * Indica si la mensajería está inicializada
 * @type {boolean}
 */
let inicializado = false;

/**
 * ID del componente actual (padre o hijo)
 * @type {string}
 */
let componenteId = '';

/**
 * Tipo de componente ('padre' o 'hijo')
 * @type {string}
 */
let tipoComponente = 'desconocido';

/**
 * Referencia al iframe window para hijos
 * @type {Window|null}
 */
let ventanaPadre = null;

/**
 * Mapa local de iframes registrados (solo en padre)
 * @type {Map<string, Object>}
 */
const iframesRegistrados = new Map();

/**
 * Callbacks pendientes de confirmación
 * @type {Map<string, Object>}
 */
const confirmacionesPendientes = new Map();

/**
 * Flag para marcar script2 como listo
 * @type {boolean}
 */
let script2Listo = false;

/**
 * Cola de mensajes pendientes mientras no hay conexión
 * @type {Array}
 */
const colaMensajes = [];

/**
 * Capacidades registradas de los hijos
 * @type {Map<string, Set<string>>}
 */
const capacidadesHijos = new Map();

// =====================================================
// INICIALIZACIÓN
// =====================================================

/**
 * Inicializa el sistema de mensajería
 * @param {Object} opciones - Opciones de configuración
 * @param {string} opciones.tipo - 'padre' o 'hijo'
 * @param {string} [opciones.id] - ID del componente
 * @param {Object} [opciones.stateManager] - Referencia al state-manager
 * @returns {Promise<boolean>} True si se inicializó correctamente
 */
export async function inicializarMensajeria(opciones = {}) {
    if (inicializado) {
        logger.warn('[mensajeria] Ya inicializado, ignorando llamada duplicada');
        return true;
    }
    
    const { tipo = 'padre', id = generarIdUnico('comp'), stateManager: sm } = opciones;
    
    tipoComponente = tipo;
    componenteId = id;
    stateManager = sm || (typeof window !== 'undefined' ? window.__vv_stateManager : null);
    
    logger.info(`[mensajeria] Inicializando como ${tipo} con ID: ${id}`);
    
    // Configurar listener de mensajes
    if (typeof window !== 'undefined') {
        window.addEventListener('message', manejarMensajeEntrante);
        
        // Si es hijo, guardar referencia al padre
        if (tipo === 'hijo' && window.parent && window.parent !== window) {
            ventanaPadre = window.parent;
        }
    }
    
    inicializado = true;
    
    // Exponer API global
    exponerAPIGlobal();
    
    logger.info(`[mensajeria] Inicialización completada`);
    return true;
}

/**
 * Expone la API de mensajería en window.mensajeria
 */
function exponerAPIGlobal() {
    if (typeof window === 'undefined') return;
    
    window.mensajeria = {
        // Funciones principales
        inicializarMensajeria,
        registrarControlador,
        enviarMensaje,
        enviarMensajeConConfirmacion,
        broadcastToCapability,
        hijosConCapability,
        marcarScript2Listo,
        
        // Funciones de consulta
        getControladoresRegistrados,
        getControladoresPorTipo,
        estaInicializado: () => inicializado,
        getComponenteId: () => componenteId,
        getTipoComponente: () => tipoComponente,
        
        // Funciones de iframe (solo padre)
        registrarIframe,
        obtenerIframe,
        getIframesRegistrados: () => new Map(iframesRegistrados),
        
        // Funciones centralizadas (delegan a state-manager)
        registrarControladorCentral,
        enviarMensajeCentral,
        
        // Utilidades
        generarIdMensaje: () => generarIdUnico('msg'),
        
        // Diagnóstico
        getDiagnostico
    };
    
    // Alias para compatibilidad
    window.__vv_mensajeria = window.mensajeria;
}

// =====================================================
// REGISTRO DE CONTROLADORES
// =====================================================

/**
 * Obtiene la referencia al state-manager (dinámicamente)
 * @returns {Object|null} State manager o null
 */
function obtenerStateManager() {
    // Prioridad: variable local -> window global
    if (stateManager) return stateManager;
    if (typeof window !== 'undefined' && window.__vv_stateManager) {
        return window.__vv_stateManager;
    }
    return null;
}

/**
 * Registra un controlador para un tipo de mensaje
 * Delega al state-manager si está disponible
 * 
 * @param {string} tipo - Tipo de mensaje a manejar
 * @param {Function} handler - Función manejadora
 * @param {Object} [opciones] - Opciones adicionales
 * @returns {Promise<boolean>} True si se registró correctamente
 */
export async function registrarControlador(tipo, handler, opciones = {}) {
    if (!tipo || typeof handler !== 'function') {
        logger.error('[mensajeria] registrarControlador: tipo y handler son requeridos');
        return false;
    }
    
    logger.debug(`[mensajeria] Registrando controlador para: ${tipo}`);
    
    // Intentar usar state-manager centralizado (buscar dinámicamente)
    const sm = obtenerStateManager();
    if (sm && typeof sm.registrarManejador === 'function') {
        try {
            const resultado = await sm.registrarManejador(tipo, handler, opciones);
            logger.debug(`[mensajeria] Controlador delegado a state-manager: ${tipo}`);
            return resultado;
        } catch (error) {
            logger.error(`[mensajeria] Error delegando a state-manager: ${error.message}`);
        }
    }
    
    // Fallback: usar registro local mediante __vv_getManejadores
    const manejadores = obtenerMapaManejadores();
    manejadores.set(tipo, handler);
    logger.debug(`[mensajeria] Controlador registrado localmente: ${tipo}`);
    
    return true;
}

/**
 * Registra un controlador de forma centralizada (alias)
 * @param {string} tipo - Tipo de mensaje
 * @param {Function} handler - Manejador
 * @returns {Promise<boolean>}
 */
export async function registrarControladorCentral(tipo, handler) {
    return registrarControlador(tipo, handler, { centralizado: true });
}

/**
 * Obtiene el mapa de manejadores (local o del state-manager)
 * @returns {Map} Mapa de manejadores
 */
function obtenerMapaManejadores() {
    // Intentar obtener del state-manager (buscar dinámicamente)
    const sm = obtenerStateManager();
    if (sm && typeof sm.getManejadores === 'function') {
        return sm.getManejadores();
    }
    
    // Usar __vv_getManejadores si está definido
    if (typeof window !== 'undefined' && typeof window.__vv_getManejadores === 'function') {
        return window.__vv_getManejadores();
    }
    
    // Crear mapa local como último recurso
    if (typeof window !== 'undefined') {
        if (!window.__vv_manejadoresLocales) {
            window.__vv_manejadoresLocales = new Map();
        }
        return window.__vv_manejadoresLocales;
    }
    
    return new Map();
}

/**
 * Obtiene todos los controladores registrados
 * @returns {Map} Mapa de controladores
 */
export function getControladoresRegistrados() {
    return obtenerMapaManejadores();
}

/**
 * Obtiene controladores por tipo
 * @param {string} tipo - Tipo a buscar
 * @returns {Function|null} Handler o null
 */
export function getControladoresPorTipo(tipo) {
    const manejadores = obtenerMapaManejadores();
    return manejadores.get(tipo) || null;
}

// =====================================================
// ENVÍO DE MENSAJES
// =====================================================

/**
 * Envía un mensaje
 * @param {string} tipo - Tipo de mensaje
 * @param {*} datos - Datos del mensaje
 * @param {string|Window} [destino] - Destino del mensaje
 * @returns {boolean} True si se envió
 */
export function enviarMensaje(tipo, datos, destino) {
    if (!tipo) {
        logger.error('[mensajeria] enviarMensaje: tipo es requerido');
        return false;
    }
    
    const mensaje = crearMensaje(tipo, datos);
    
    logger.debug(`[mensajeria] Enviando mensaje: ${tipo}`, { destino: destino || 'broadcast' });
    
    return enviarMensajeInterno(mensaje, destino);
}

/**
 * Envía un mensaje centralizado (delega a state-manager)
 * @param {string} tipo - Tipo de mensaje
 * @param {*} datos - Datos
 * @param {string} destino - Destino
 * @returns {boolean}
 */
export function enviarMensajeCentral(tipo, datos, destino) {
    const sm = obtenerStateManager();
    if (sm && typeof sm.enviarMensaje === 'function') {
        return sm.enviarMensaje(tipo, datos, destino);
    }
    return enviarMensaje(tipo, datos, destino);
}

/**
 * Envía un mensaje y espera confirmación
 * @param {string} tipo - Tipo de mensaje
 * @param {*} datos - Datos del mensaje
 * @param {Object} [opciones] - Opciones
 * @param {number} [opciones.timeout=5000] - Timeout en ms
 * @param {string} [opciones.destino] - Destino específico
 * @returns {Promise<Object>} Respuesta del destinatario
 */
export function enviarMensajeConConfirmacion(tipo, datos, opciones = {}) {
    const { timeout = 5000, destino } = opciones;
    
    return new Promise((resolve, reject) => {
        const mensaje = crearMensaje(tipo, datos);
        mensaje.requiereConfirmacion = true;
        
        const idConfirmacion = mensaje.id;
        
        // Registrar callback pendiente
        const timeoutId = setTimeout(() => {
            confirmacionesPendientes.delete(idConfirmacion);
            reject(new Error(`Timeout esperando confirmación para: ${tipo}`));
        }, timeout);
        
        confirmacionesPendientes.set(idConfirmacion, {
            resolve,
            reject,
            timeoutId,
            tipo,
            timestamp: Date.now()
        });
        
        // Enviar mensaje
        const enviado = enviarMensajeInterno(mensaje, destino);
        
        if (!enviado) {
            clearTimeout(timeoutId);
            confirmacionesPendientes.delete(idConfirmacion);
            reject(new Error(`No se pudo enviar mensaje: ${tipo}`));
        }
    });
}

/**
 * Crea un objeto mensaje con estructura estándar
 * @param {string} tipo - Tipo de mensaje
 * @param {*} datos - Datos del mensaje
 * @returns {Object} Mensaje formateado
 */
function crearMensaje(tipo, datos) {
    return {
        tipo,
        datos,
        id: generarIdUnico('msg'),
        timestamp: Date.now(),
        origen: componenteId,
        tipoOrigen: tipoComponente
    };
}

/**
 * Envía un mensaje internamente
 * @param {Object} mensaje - Mensaje a enviar
 * @param {string|Window} destino - Destino
 * @returns {boolean} True si se envió
 */
function enviarMensajeInterno(mensaje, destino) {
    try {
        // Si es hijo, enviar al padre
        if (tipoComponente === 'hijo' && ventanaPadre) {
            ventanaPadre.postMessage(mensaje, '*');
            return true;
        }
        
        // Si es padre
        if (tipoComponente === 'padre') {
            // Destino específico
            if (typeof destino === 'string') {
                const iframe = iframesRegistrados.get(destino);
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage(mensaje, '*');
                    return true;
                }
                logger.warn(`[mensajeria] Iframe no encontrado: ${destino}`);
                return false;
            }
            
            // Window específica
            if (destino && typeof destino.postMessage === 'function') {
                destino.postMessage(mensaje, '*');
                return true;
            }
            
            // Broadcast a todos los iframes
            let enviados = 0;
            for (const [id, iframe] of iframesRegistrados) {
                if (iframe.contentWindow) {
                    iframe.contentWindow.postMessage(mensaje, '*');
                    enviados++;
                }
            }
            return enviados > 0;
        }
        
        // Fallback: postMessage genérico
        if (typeof window !== 'undefined') {
            window.postMessage(mensaje, '*');
            return true;
        }
        
        return false;
    } catch (error) {
        logger.error(`[mensajeria] Error enviando mensaje: ${error.message}`);
        return false;
    }
}

// =====================================================
// MANEJO DE MENSAJES ENTRANTES
// =====================================================

/**
 * Manejador principal de mensajes entrantes
 * @param {MessageEvent} event - Evento de mensaje
 */
function manejarMensajeEntrante(event) {
    const mensaje = event.data;
    
    // Ignorar mensajes inválidos
    if (!mensaje || typeof mensaje !== 'object' || !mensaje.tipo) {
        return;
    }
    
    // Ignorar mensajes propios
    if (mensaje.origen === componenteId) {
        return;
    }
    
    logger.debug(`[mensajeria] Mensaje recibido: ${mensaje.tipo}`, { origen: mensaje.origen });
    
    // Verificar si es una confirmación
    if (mensaje.tipo === TIPOS_MENSAJE.SISTEMA.CONFIRMACION && mensaje.idOriginal) {
        manejarConfirmacion(mensaje);
        return;
    }
    
    // Buscar handler registrado
    const manejadores = obtenerMapaManejadores();
    const handler = manejadores.get(mensaje.tipo);
    
    if (handler) {
        try {
            const resultado = handler(mensaje.datos, mensaje, event);
            
            // Enviar confirmación si se requiere
            if (mensaje.requiereConfirmacion) {
                enviarConfirmacion(mensaje, resultado, event.source);
            }
        } catch (error) {
            logger.error(`[mensajeria] Error en handler para ${mensaje.tipo}: ${error.message}`);
            
            if (mensaje.requiereConfirmacion) {
                enviarConfirmacion(mensaje, { error: error.message }, event.source);
            }
        }
    } else {
        logger.debug(`[mensajeria] Sin handler para: ${mensaje.tipo}`);
    }
}

/**
 * Maneja una confirmación recibida
 * @param {Object} mensaje - Mensaje de confirmación
 */
function manejarConfirmacion(mensaje) {
    const pendiente = confirmacionesPendientes.get(mensaje.idOriginal);
    
    if (pendiente) {
        clearTimeout(pendiente.timeoutId);
        confirmacionesPendientes.delete(mensaje.idOriginal);
        
        if (mensaje.error) {
            pendiente.reject(new Error(mensaje.error));
        } else {
            pendiente.resolve(mensaje.datos);
        }
    }
}

/**
 * Envía una confirmación de mensaje
 * @param {Object} mensajeOriginal - Mensaje original
 * @param {*} resultado - Resultado del procesamiento
 * @param {Window} destino - Ventana destino
 */
function enviarConfirmacion(mensajeOriginal, resultado, destino) {
    const confirmacion = {
        tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
        idOriginal: mensajeOriginal.id,
        datos: resultado,
        timestamp: Date.now(),
        origen: componenteId
    };
    
    if (destino && typeof destino.postMessage === 'function') {
        destino.postMessage(confirmacion, '*');
    }
}

// =====================================================
// GESTIÓN DE IFRAMES (SOLO PADRE)
// =====================================================

/**
 * Registra un iframe
 * @param {string} id - ID del iframe
 * @param {HTMLIFrameElement} iframe - Elemento iframe
 * @param {Object} [opciones] - Opciones adicionales
 * @returns {boolean} True si se registró
 */
export function registrarIframe(id, iframe, opciones = {}) {
    if (!id || !iframe) {
        logger.error('[mensajeria] registrarIframe: id e iframe son requeridos');
        return false;
    }
    
    iframesRegistrados.set(id, {
        elemento: iframe,
        contentWindow: iframe.contentWindow,
        capacidades: new Set(opciones.capacidades || []),
        estado: 'registrado',
        timestamp: Date.now()
    });
    
    logger.info(`[mensajeria] Iframe registrado: ${id}`);
    return true;
}

/**
 * Obtiene un iframe registrado
 * @param {string} id - ID del iframe
 * @returns {Object|null} Información del iframe o null
 */
export function obtenerIframe(id) {
    const iframe = iframesRegistrados.get(id);
    return iframe ? iframe.elemento : null;
}

/**
 * Registra capacidades para un hijo
 * @param {string} hijoId - ID del hijo
 * @param {Array<string>} capacidades - Capacidades
 */
export function registrarCapacidades(hijoId, capacidades) {
    if (!capacidadesHijos.has(hijoId)) {
        capacidadesHijos.set(hijoId, new Set());
    }
    
    const caps = capacidadesHijos.get(hijoId);
    capacidades.forEach(cap => caps.add(cap));
    
    // Actualizar en iframe registrado si existe
    const iframe = iframesRegistrados.get(hijoId);
    if (iframe) {
        capacidades.forEach(cap => iframe.capacidades.add(cap));
    }
}

/**
 * Obtiene los hijos que tienen una capacidad específica
 * @param {string} capacidad - Capacidad a buscar
 * @returns {Array<string>} IDs de hijos con la capacidad
 */
export function hijosConCapability(capacidad) {
    const hijos = [];
    
    for (const [id, caps] of capacidadesHijos) {
        if (caps.has(capacidad)) {
            hijos.push(id);
        }
    }
    
    // También buscar en iframes registrados
    for (const [id, iframe] of iframesRegistrados) {
        if (iframe.capacidades && iframe.capacidades.has(capacidad) && !hijos.includes(id)) {
            hijos.push(id);
        }
    }
    
    return hijos;
}

/**
 * Envía un mensaje broadcast a todos los hijos con una capacidad
 * @param {string} capacidad - Capacidad requerida
 * @param {string} tipo - Tipo de mensaje
 * @param {*} datos - Datos del mensaje
 * @returns {number} Número de mensajes enviados
 */
export function broadcastToCapability(capacidad, tipo, datos) {
    const hijos = hijosConCapability(capacidad);
    let enviados = 0;
    
    for (const hijoId of hijos) {
        if (enviarMensaje(tipo, datos, hijoId)) {
            enviados++;
        }
    }
    
    logger.debug(`[mensajeria] Broadcast a ${enviados}/${hijos.length} hijos con capacidad: ${capacidad}`);
    return enviados;
}

// =====================================================
// UTILIDADES
// =====================================================

/**
 * Marca script2 como listo
 */
export function marcarScript2Listo() {
    script2Listo = true;
    logger.info('[mensajeria] Script2 marcado como listo');
    
    // Procesar cola de mensajes pendientes
    procesarColaMensajes();
}

/**
 * Procesa la cola de mensajes pendientes
 */
function procesarColaMensajes() {
    while (colaMensajes.length > 0) {
        const { tipo, datos, destino } = colaMensajes.shift();
        enviarMensaje(tipo, datos, destino);
    }
}

/**
 * Obtiene información de diagnóstico
 * @returns {Object} Información de diagnóstico
 */
export function getDiagnostico() {
    return {
        inicializado,
        componenteId,
        tipoComponente,
        script2Listo,
        iframesRegistrados: Array.from(iframesRegistrados.keys()),
        controladoresRegistrados: Array.from(obtenerMapaManejadores().keys()),
        confirmacionesPendientes: confirmacionesPendientes.size,
        colaMensajes: colaMensajes.length,
        capacidadesHijos: Object.fromEntries(
            Array.from(capacidadesHijos.entries()).map(([k, v]) => [k, Array.from(v)])
        ),
        stateManagerDisponible: !!stateManager
    };
}

// =====================================================
// LIMPIEZA
// =====================================================

/**
 * Limpia recursos de la mensajería
 */
export function limpiar() {
    // Limpiar confirmaciones pendientes
    for (const [id, pendiente] of confirmacionesPendientes) {
        clearTimeout(pendiente.timeoutId);
        pendiente.reject(new Error('Mensajería limpiada'));
    }
    confirmacionesPendientes.clear();
    
    // Limpiar cola
    colaMensajes.length = 0;
    
    logger.info('[mensajeria] Recursos limpiados');
}

// Configurar limpieza periódica
if (typeof window !== 'undefined') {
    // Determinar TTL según dispositivo
    const ttlMensajeria = esMovil() ? TTL_LIMPIEZA.MENSAJERIA.MOVIL : TTL_LIMPIEZA.MENSAJERIA.DESKTOP;
    
    setInterval(() => {
        const ahora = Date.now();
        
        // Limpiar confirmaciones expiradas
        for (const [id, pendiente] of confirmacionesPendientes) {
            if (ahora - pendiente.timestamp > ttlMensajeria) {
                clearTimeout(pendiente.timeoutId);
                confirmacionesPendientes.delete(id);
                pendiente.reject(new Error('Confirmación expirada'));
            }
        }
    }, ttlMensajeria / 2);
}

export default {
    inicializarMensajeria,
    registrarControlador,
    enviarMensaje,
    enviarMensajeConConfirmacion,
    broadcastToCapability,
    hijosConCapability,
    marcarScript2Listo,
    getControladoresRegistrados,
    getControladoresPorTipo,
    registrarControladorCentral,
    enviarMensajeCentral,
    registrarIframe,
    obtenerIframe,
    registrarCapacidades,
    getDiagnostico,
    limpiar
};

// =====================================================
// EXPOSICIÓN INMEDIATA DE API GLOBAL
// Ejecutar exponerAPIGlobal() inmediatamente al cargar el módulo
// para que window.mensajeria esté disponible antes de inicializar
// =====================================================
exponerAPIGlobal();
console.log('[mensajeria] API expuesta globalmente (pre-inicialización)');

// Dispatch mensajeriaReady event to signal that the API is available
if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('mensajeriaReady'));
    console.log('[mensajeria] mensajeriaReady event dispatched');
}
