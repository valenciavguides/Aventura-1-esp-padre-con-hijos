/**
 * @fileoverview Utilidades generales para ValenciaVGuides
 * @version 2.0.0
 * 
 * Funciones de utilidad comunes usadas a lo largo de toda la aplicación.
 */

import { TIPOS_MENSAJE } from './constants.js';

/**
 * Canonicaliza un modo a su forma estándar
 * @param {string} modo - Modo a canonicalizar
 * @returns {string|null} 'casa' | 'aventura' | null si no es válido
 */
export function canonicalizarModo(modo) {
    if (!modo) return null;
    const modoStr = String(modo).toLowerCase().trim();
    return modoStr === 'casa' || modoStr === 'aventura' ? modoStr : null;
}

/**
 * Genera un ID único
 * @param {string} [prefijo=''] - Prefijo opcional para el ID
 * @returns {string} ID único generado
 */
export function generarIdUnico(prefijo = '') {
    const timestamp = Date.now().toString(36);
    const aleatorio = Math.random().toString(36).substring(2, 9);
    return prefijo ? `${prefijo}_${timestamp}_${aleatorio}` : `${timestamp}_${aleatorio}`;
}

/**
 * Obtiene el ID del padre desde la URL o genera uno nuevo
 * @returns {string} ID del padre
 */
export function getPadreId() {
    // Intentar obtener de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const padreIdFromUrl = urlParams.get('padreId');
    
    if (padreIdFromUrl) {
        return padreIdFromUrl;
    }
    
    // Intentar obtener de sessionStorage
    const padreIdFromStorage = sessionStorage.getItem('vvguides_padreId');
    if (padreIdFromStorage) {
        return padreIdFromStorage;
    }
    
    // Generar nuevo ID
    const nuevoPadreId = generarIdUnico('padre');
    sessionStorage.setItem('vvguides_padreId', nuevoPadreId);
    return nuevoPadreId;
}

/**
 * Normaliza un array de paradas a un formato consistente
 * @param {Array|Object} paradas - Paradas a normalizar
 * @returns {Array} Array de paradas normalizado
 */
export function normalizarParadas(paradas) {
    if (!paradas) return [];
    
    // Si ya es un array, procesarlo
    if (Array.isArray(paradas)) {
        return paradas.map((parada, index) => normalizarParada(parada, index));
    }
    
    // Si es un objeto con propiedades numéricas o IDs
    if (typeof paradas === 'object') {
        return Object.entries(paradas).map(([key, value], index) => {
            const parada = typeof value === 'object' ? value : { id: key, valor: value };
            return normalizarParada(parada, index);
        });
    }
    
    return [];
}

/**
 * Normaliza una parada individual
 * @param {Object|string} parada - Parada a normalizar
 * @param {number} index - Índice de la parada
 * @returns {Object} Parada normalizada
 */
function normalizarParada(parada, index) {
    if (typeof parada === 'string') {
        return {
            id: parada,
            index,
            nombre: parada
        };
    }
    
    if (typeof parada === 'object' && parada !== null) {
        return {
            id: parada.id || parada.ID || parada.parada_id || `parada_${index}`,
            index: parada.index !== undefined ? parada.index : index,
            nombre: parada.nombre || parada.name || parada.titulo || `Parada ${index + 1}`,
            coordenadas: parada.coordenadas || parada.coords || null,
            audio: parada.audio || null,
            reto: parada.reto || null,
            ...parada
        };
    }
    
    return {
        id: `parada_${index}`,
        index,
        nombre: `Parada ${index + 1}`
    };
}

/**
 * Resuelve IDs de parada a partir de diferentes formatos
 * @param {*} input - Input que puede contener IDs de parada
 * @returns {Array<string>} Array de IDs de parada
 */
export function resolverIdsParada(input) {
    if (!input) return [];
    
    // Si es string, puede ser un ID único o lista separada por comas
    if (typeof input === 'string') {
        return input.split(',').map(id => id.trim()).filter(Boolean);
    }
    
    // Si es número, convertir a string
    if (typeof input === 'number') {
        return [String(input)];
    }
    
    // Si es array
    if (Array.isArray(input)) {
        return input.flatMap(item => resolverIdsParada(item));
    }
    
    // Si es objeto con propiedad id
    if (typeof input === 'object' && input !== null) {
        if (input.id) return [String(input.id)];
        if (input.ID) return [String(input.ID)];
        if (input.parada_id) return [String(input.parada_id)];
    }
    
    return [];
}

/**
 * Ajusta el timeout basado en la calidad de la conexión
 * @param {number} timeoutBase - Timeout base en ms
 * @param {number} [factor=1] - Factor multiplicador
 * @returns {number} Timeout ajustado
 */
export function ajustarTimeoutPorConexion(timeoutBase, factor = 1) {
    const connection = navigator.connection || 
                       navigator.mozConnection || 
                       navigator.webkitConnection;
    
    if (!connection) {
        return timeoutBase * factor;
    }
    
    // Ajustar según tipo de conexión
    const ajustes = {
        'slow-2g': 4,
        '2g': 3,
        '3g': 2,
        '4g': 1,
        '5g': 0.8
    };
    
    const ajuste = ajustes[connection.effectiveType] || 1;
    return Math.round(timeoutBase * factor * ajuste);
}

/**
 * Obtiene la función enviarMensaje del contexto global o padre
 * @returns {Function|null} Función enviarMensaje o null
 */
export function getEnviarMensaje() {
    // Primero intentar desde window.mensajeria (hijos)
    if (window.mensajeria && typeof window.mensajeria.enviarMensaje === 'function') {
        return window.mensajeria.enviarMensaje;
    }
    
    // Intentar desde parent.mensajeria
    if (window.parent && window.parent !== window) {
        try {
            if (window.parent.mensajeria && typeof window.parent.mensajeria.enviarMensaje === 'function') {
                return window.parent.mensajeria.enviarMensaje;
            }
        } catch (e) {
            // Cross-origin, ignorar
        }
    }
    
    // Fallback: función que usa postMessage
    return function(tipo, datos, destino) {
        const mensaje = {
            tipo,
            datos,
            origen: 'utils_fallback',
            timestamp: Date.now(),
            id: generarIdUnico('msg')
        };
        
        if (window.parent && window.parent !== window) {
            window.parent.postMessage(mensaje, '*');
        }
    };
}

/**
 * Obtiene la función registrarControlador del contexto global o padre
 * @returns {Function|null} Función registrarControlador o null
 */
export function getRegistrarControlador() {
    // Primero intentar desde window.mensajeria
    if (window.mensajeria && typeof window.mensajeria.registrarControlador === 'function') {
        return window.mensajeria.registrarControlador;
    }
    
    // Intentar desde parent.mensajeria
    if (window.parent && window.parent !== window) {
        try {
            if (window.parent.mensajeria && typeof window.parent.mensajeria.registrarControlador === 'function') {
                return window.parent.mensajeria.registrarControlador;
            }
        } catch (e) {
            // Cross-origin, ignorar
        }
    }
    
    // Fallback: registrar localmente
    return function(tipo, handler) {
        if (!window.__vv_handlers) {
            window.__vv_handlers = new Map();
        }
        window.__vv_handlers.set(tipo, handler);
        console.log(`[utils] Handler registrado localmente para: ${tipo}`);
    };
}

/**
 * Obtiene la función enviarMensajeConConfirmacion
 * @returns {Function|null} Función o null
 */
export function getEnviarMensajeConConfirmacion() {
    if (window.mensajeria && typeof window.mensajeria.enviarMensajeConConfirmacion === 'function') {
        return window.mensajeria.enviarMensajeConConfirmacion;
    }
    
    if (window.parent && window.parent !== window) {
        try {
            if (window.parent.mensajeria && typeof window.parent.mensajeria.enviarMensajeConConfirmacion === 'function') {
                return window.parent.mensajeria.enviarMensajeConConfirmacion;
            }
        } catch (e) {
            // Cross-origin
        }
    }
    
    // Fallback simple
    return function(tipo, datos, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const enviar = getEnviarMensaje();
            if (enviar) {
                enviar(tipo, datos);
                // Sin confirmación real, resolver después de timeout corto
                setTimeout(() => resolve({ success: true, simulado: true }), 100);
            } else {
                reject(new Error('No hay función de envío disponible'));
            }
        });
    };
}

/**
 * Reintenta una operación hasta que esté disponible
 * @param {Function} checkFn - Función que retorna true cuando está listo
 * @param {Object} [options] - Opciones
 * @param {number} [options.maxIntentos=10] - Máximo de intentos
 * @param {number} [options.intervalo=100] - Intervalo entre intentos (ms)
 * @param {string} [options.mensaje=''] - Mensaje de log
 * @returns {Promise<boolean>} Promise que resuelve cuando está listo
 */
export function retryUntilAvailable(checkFn, options = {}) {
    const { maxIntentos = 10, intervalo = 100, mensaje = '' } = options;
    
    return new Promise((resolve, reject) => {
        let intentos = 0;
        
        const intentar = function() {
            intentos++;
            
            try {
                if (checkFn()) {
                    if (mensaje) console.log(`[utils] ${mensaje} - disponible después de ${intentos} intentos`);
                    resolve(true);
                    return;
                }
            } catch (e) {
                // Ignorar errores en checkFn
            }
            
            if (intentos >= maxIntentos) {
                if (mensaje) console.warn(`[utils] ${mensaje} - no disponible después de ${maxIntentos} intentos`);
                resolve(false);
                return;
            }
            
            setTimeout(intentar, intervalo);
        }
        
        intentar();
    });
}

/**
 * Debounce de una función
 * @param {Function} fn - Función a ejecutar
 * @param {number} espera - Tiempo de espera en ms
 * @returns {Function} Función con debounce
 */
export function debounce(fn, espera) {
    let timeoutId;
    
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), espera);
    };
}

/**
 * Throttle de una función
 * @param {Function} fn - Función a ejecutar
 * @param {number} limite - Límite de tiempo en ms
 * @returns {Function} Función con throttle
 */
export function throttle(fn, limite) {
    let ultimaEjecucion = 0;
    
    return function(...args) {
        const ahora = Date.now();
        if (ahora - ultimaEjecucion >= limite) {
            ultimaEjecucion = ahora;
            fn.apply(this, args);
        }
    };
}

/**
 * Espera un tiempo determinado
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clona un objeto de forma profunda
 * @param {*} obj - Objeto a clonar
 * @returns {*} Clon del objeto
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    if (obj instanceof Map) {
        const mapClone = new Map();
        obj.forEach((value, key) => {
            mapClone.set(deepClone(key), deepClone(value));
        });
        return mapClone;
    }
    
    if (obj instanceof Set) {
        const setClone = new Set();
        obj.forEach(value => {
            setClone.add(deepClone(value));
        });
        return setClone;
    }
    
    if (typeof obj === 'object') {
        const clone = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                clone[key] = deepClone(obj[key]);
            }
        }
        return clone;
    }
    
    return obj;
}

/**
 * Merge profundo de objetos
 * @param {Object} target - Objeto destino
 * @param {...Object} sources - Objetos fuente
 * @returns {Object} Objeto merged
 */
export function deepMerge(target, ...sources) {
    if (!sources.length) return target;
    
    const source = sources.shift();
    
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    
    return deepMerge(target, ...sources);
}

/**
 * Verifica si es un objeto plano
 * @param {*} item - Item a verificar
 * @returns {boolean} True si es objeto plano
 */
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Formatea bytes a string legible
 * @param {number} bytes - Bytes a formatear
 * @param {number} [decimales=2] - Decimales a mostrar
 * @returns {string} String formateado
 */
export function formatearBytes(bytes, decimales = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimales)) + ' ' + sizes[i];
}

/**
 * Formatea milisegundos a string legible
 * @param {number} ms - Milisegundos
 * @returns {string} String formateado
 */
export function formatearTiempo(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Capitaliza la primera letra de un string
 * @param {string} str - String a capitalizar
 * @returns {string} String capitalizado
 */
export function capitalizar(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Trunca un string a una longitud máxima
 * @param {string} str - String a truncar
 * @param {number} maxLength - Longitud máxima
 * @param {string} [sufijo='...'] - Sufijo a añadir
 * @returns {string} String truncado
 */
export function truncar(str, maxLength, sufijo = '...') {
    if (!str || str.length <= maxLength) return str;
    return str.slice(0, maxLength - sufijo.length) + sufijo;
}

/**
 * Obtiene un valor de un objeto por path
 * @param {Object} obj - Objeto
 * @param {string} path - Path (ej: 'a.b.c')
 * @param {*} [defecto] - Valor por defecto
 * @returns {*} Valor encontrado o defecto
 */
export function getByPath(obj, path, defecto = undefined) {
    const partes = path.split('.');
    let actual = obj;
    
    for (const parte of partes) {
        if (actual === null || actual === undefined) {
            return defecto;
        }
        actual = actual[parte];
    }
    
    return actual !== undefined ? actual : defecto;
}

/**
 * Establece un valor en un objeto por path
 * @param {Object} obj - Objeto
 * @param {string} path - Path (ej: 'a.b.c')
 * @param {*} valor - Valor a establecer
 */
export function setByPath(obj, path, valor) {
    const partes = path.split('.');
    let actual = obj;
    
    for (let i = 0; i < partes.length - 1; i++) {
        const parte = partes[i];
        if (!(parte in actual) || typeof actual[parte] !== 'object') {
            actual[parte] = {};
        }
        actual = actual[parte];
    }
    
    actual[partes[partes.length - 1]] = valor;
}

/**
 * Verifica si dos valores son iguales (deep equality)
 * @param {*} a - Primer valor
 * @param {*} b - Segundo valor
 * @returns {boolean} True si son iguales
 */
export function sonIguales(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((item, index) => sonIguales(item, b[index]));
    }
    
    if (typeof a === 'object') {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every(key => sonIguales(a[key], b[key]));
    }
    
    return false;
}

/**
 * Maneja errores de forma centralizada
 * @param {Error} error - El error a manejar
 * @param {Object} [contexto] - Contexto adicional (ej: mensaje que causó el error)
 * @param {Object} [opciones] - Opciones de manejo
 * @param {boolean} [opciones.notificar=true] - Si debe notificar al usuario
 * @param {boolean} [opciones.reenviar=false] - Si debe reenviar el error
 */
export function manejarError(error, contexto = null, opciones = {}) {
    const { notificar = true, reenviar = false } = opciones;
    
    // Construir información del error
    const errorInfo = {
        mensaje: error?.message || String(error),
        nombre: error?.name || 'Error',
        stack: error?.stack || null,
        timestamp: Date.now(),
        contexto: contexto ? {
            tipo: contexto.tipo || null,
            origen: contexto.origen || null,
            destino: contexto.destino || null,
            mensajeId: contexto.mensajeId || contexto.id || null
        } : null
    };
    
    // Log del error
    console.error('[ERROR]', errorInfo.mensaje, errorInfo);
    
    // Intentar enviar error al padre si estamos en un iframe
    if (window.parent && window.parent !== window) {
        try {
            window.parent.postMessage({
                tipo: 'ERROR_HIJO',
                datos: errorInfo,
                origen: window.name || 'hijo-desconocido',
                timestamp: Date.now()
            }, '*');
        } catch (e) {
            // Ignorar errores de cross-origin
        }
    }
    
    // Registrar en historial de errores global si existe
    if (window.__vv_errores) {
        window.__vv_errores.push(errorInfo);
        // Mantener solo los últimos 100 errores
        if (window.__vv_errores.length > 100) {
            window.__vv_errores.shift();
        }
    } else {
        window.__vv_errores = [errorInfo];
    }
    
    // Re-lanzar si se solicita
    if (reenviar) {
        throw error;
    }
}

// Exponer funciones útiles globalmente para debugging
if (typeof window !== 'undefined') {
    window.__vv_utils = {
        generarIdUnico,
        getPadreId,
        normalizarParadas,
        resolverIdsParada,
        ajustarTimeoutPorConexion,
        getEnviarMensaje,
        getRegistrarControlador,
        retryUntilAvailable,
        manejarError,
        canonicalizarModo
    };
}

export default {
    generarIdUnico,
    getPadreId,
    normalizarParadas,
    resolverIdsParada,
    ajustarTimeoutPorConexion,
    getEnviarMensaje,
    getRegistrarControlador,
    getEnviarMensajeConConfirmacion,
    retryUntilAvailable,
    debounce,
    throttle,
    sleep,
    deepClone,
    deepMerge,
    formatearBytes,
    formatearTiempo,
    capitalizar,
    truncar,
    getByPath,
    setByPath,
    sonIguales,
    manejarError,
    canonicalizarModo
};
