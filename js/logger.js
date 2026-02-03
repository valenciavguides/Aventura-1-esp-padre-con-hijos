/**
 * @fileoverview Sistema de logging centralizado para ValenciaVGuides
 * @version 2.0.0
 * 
 * Proporciona un sistema de logging unificado con niveles configurables,
 * formateo consistente y soporte para diferentes destinos de salida.
 */

import { LOG_LEVELS } from './constants.js';

/**
 * Nivel actual de logging (puede ser configurado externamente)
 * @type {string}
 */
let nivelActual = LOG_LEVELS.DEBUG;

/**
 * Buffer para almacenar logs cuando se requiere persistencia
 * @type {Array<Object>}
 */
const bufferLogs = [];

/**
 * Tamaño máximo del buffer de logs
 * @type {number}
 */
const MAX_BUFFER_SIZE = 500;

/**
 * Contexto actual para los logs (identificador del módulo)
 * @type {string}
 */
let contextoActual = 'GLOBAL';

/**
 * Flag para habilitar/deshabilitar colores en consola
 * @type {boolean}
 */
let coloresHabilitados = true;

/**
 * Mapa de prioridad de niveles
 * @type {Object<string, number>}
 */
const PRIORIDAD_NIVELES = {
    [LOG_LEVELS.DEBUG]: 0,
    [LOG_LEVELS.INFO]: 1,
    [LOG_LEVELS.WARN]: 2,
    [LOG_LEVELS.ERROR]: 3
};

/**
 * Estilos de consola para cada nivel
 * @type {Object<string, string>}
 */
const ESTILOS = {
    [LOG_LEVELS.DEBUG]: 'color: #6c757d; font-style: italic;',
    [LOG_LEVELS.INFO]: 'color: #0d6efd;',
    [LOG_LEVELS.WARN]: 'color: #ffc107; font-weight: bold;',
    [LOG_LEVELS.ERROR]: 'color: #dc3545; font-weight: bold;'
};

/**
 * Prefijos para cada nivel
 * @type {Object<string, string>}
 */
const PREFIJOS = {
    [LOG_LEVELS.DEBUG]: '🔍',
    [LOG_LEVELS.INFO]: 'ℹ️',
    [LOG_LEVELS.WARN]: '⚠️',
    [LOG_LEVELS.ERROR]: '❌'
};

/**
 * Formatea un timestamp para los logs
 * @returns {string} Timestamp formateado
 */
function formatearTimestamp() {
    const ahora = new Date();
    return ahora.toISOString().replace('T', ' ').substring(0, 23);
}

/**
 * Determina si un mensaje debe ser logueado según el nivel actual
 * @param {string} nivel - Nivel del mensaje
 * @returns {boolean} True si debe loguearse
 */
function debeLoguear(nivel) {
    return PRIORIDAD_NIVELES[nivel] >= PRIORIDAD_NIVELES[nivelActual];
}

/**
 * Almacena un log en el buffer
 * @param {Object} entrada - Entrada de log
 */
function almacenarEnBuffer(entrada) {
    bufferLogs.push(entrada);
    if (bufferLogs.length > MAX_BUFFER_SIZE) {
        bufferLogs.shift();
    }
}

/**
 * Formatea los argumentos adicionales para el log
 * @param {Array} args - Argumentos adicionales
 * @returns {string} Argumentos formateados
 */
function formatearArgs(args) {
    if (!args || args.length === 0) return '';
    
    return args.map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' | ');
}

/**
 * Función principal de logging
 * @param {string} nivel - Nivel del log
 * @param {string} mensaje - Mensaje principal
 * @param {...any} args - Argumentos adicionales
 */
function log(nivel, mensaje, ...args) {
    if (!debeLoguear(nivel)) return;
    
    const timestamp = formatearTimestamp();
    const prefijo = PREFIJOS[nivel] || '';
    const contexto = contextoActual;
    
    const entrada = {
        timestamp,
        nivel,
        contexto,
        mensaje,
        args: args.length > 0 ? args : undefined
    };
    
    almacenarEnBuffer(entrada);
    
    // Construir mensaje para consola
    const mensajeFormateado = `${prefijo} [${timestamp}] [${contexto}] ${mensaje}`;
    
    // Método de consola según nivel
    const metodoConsola = {
        [LOG_LEVELS.DEBUG]: 'debug',
        [LOG_LEVELS.INFO]: 'info',
        [LOG_LEVELS.WARN]: 'warn',
        [LOG_LEVELS.ERROR]: 'error'
    }[nivel] || 'log';
    
    // Loguear con o sin estilos
    if (coloresHabilitados && ESTILOS[nivel]) {
        console[metodoConsola](`%c${mensajeFormateado}`, ESTILOS[nivel], ...args);
    } else {
        console[metodoConsola](mensajeFormateado, ...args);
    }
}

/**
 * Logger principal exportado
 */
const logger = {
    /**
     * Log de nivel debug
     * @param {string} mensaje - Mensaje
     * @param {...any} args - Argumentos adicionales
     */
    debug(mensaje, ...args) {
        log(LOG_LEVELS.DEBUG, mensaje, ...args);
    },
    
    /**
     * Log de nivel info
     * @param {string} mensaje - Mensaje
     * @param {...any} args - Argumentos adicionales
     */
    info(mensaje, ...args) {
        log(LOG_LEVELS.INFO, mensaje, ...args);
    },
    
    /**
     * Log de nivel warn
     * @param {string} mensaje - Mensaje
     * @param {...any} args - Argumentos adicionales
     */
    warn(mensaje, ...args) {
        log(LOG_LEVELS.WARN, mensaje, ...args);
    },
    
    /**
     * Log de nivel error
     * @param {string} mensaje - Mensaje
     * @param {...any} args - Argumentos adicionales
     */
    error(mensaje, ...args) {
        log(LOG_LEVELS.ERROR, mensaje, ...args);
    },
    
    /**
     * Log de nivel success (usa INFO con formato especial)
     * @param {string} mensaje - Mensaje
     * @param {...any} args - Argumentos adicionales
     */
    success(mensaje, ...args) {
        // Success usa INFO pero con un prefijo especial
        const mensajeConFormato = `✅ ${mensaje}`;
        log(LOG_LEVELS.INFO, mensajeConFormato, ...args);
    },
    
    /**
     * Establece el nivel mínimo de logging
     * @param {string} nivel - Nuevo nivel
     */
    setNivel(nivel) {
        if (PRIORIDAD_NIVELES.hasOwnProperty(nivel)) {
            nivelActual = nivel;
            this.info(`Nivel de log cambiado a: ${nivel}`);
        } else {
            this.warn(`Nivel de log inválido: ${nivel}`);
        }
    },
    
    /**
     * Obtiene el nivel actual de logging
     * @returns {string} Nivel actual
     */
    getNivel() {
        return nivelActual;
    },
    
    /**
     * Establece el contexto para los logs
     * @param {string} contexto - Nuevo contexto
     */
    setContexto(contexto) {
        contextoActual = contexto || 'GLOBAL';
    },
    
    /**
     * Obtiene el contexto actual
     * @returns {string} Contexto actual
     */
    getContexto() {
        return contextoActual;
    },
    
    /**
     * Habilita o deshabilita colores en consola
     * @param {boolean} habilitado - Estado de colores
     */
    setColores(habilitado) {
        coloresHabilitados = Boolean(habilitado);
    },
    
    /**
     * Obtiene los logs almacenados en el buffer
     * @param {number} [cantidad] - Cantidad de logs a obtener (últimos N)
     * @returns {Array<Object>} Array de logs
     */
    getBuffer(cantidad) {
        if (cantidad && cantidad > 0) {
            return bufferLogs.slice(-cantidad);
        }
        return [...bufferLogs];
    },
    
    /**
     * Limpia el buffer de logs
     */
    limpiarBuffer() {
        bufferLogs.length = 0;
        this.debug('Buffer de logs limpiado');
    },
    
    /**
     * Exporta los logs del buffer en formato JSON
     * @returns {string} Logs en formato JSON
     */
    exportarJSON() {
        return JSON.stringify(bufferLogs, null, 2);
    },
    
    /**
     * Crea un logger con contexto específico
     * @param {string} contexto - Contexto del logger hijo
     * @returns {Object} Logger con contexto fijo
     */
    crearLoggerConContexto(contexto) {
        return {
            debug: (mensaje, ...args) => {
                const contextoOriginal = contextoActual;
                contextoActual = contexto;
                log(LOG_LEVELS.DEBUG, mensaje, ...args);
                contextoActual = contextoOriginal;
            },
            info: (mensaje, ...args) => {
                const contextoOriginal = contextoActual;
                contextoActual = contexto;
                log(LOG_LEVELS.INFO, mensaje, ...args);
                contextoActual = contextoOriginal;
            },
            warn: (mensaje, ...args) => {
                const contextoOriginal = contextoActual;
                contextoActual = contexto;
                log(LOG_LEVELS.WARN, mensaje, ...args);
                contextoActual = contextoOriginal;
            },
            error: (mensaje, ...args) => {
                const contextoOriginal = contextoActual;
                contextoActual = contexto;
                log(LOG_LEVELS.ERROR, mensaje, ...args);
                contextoActual = contextoOriginal;
            }
        };
    },
    
    /**
     * Agrupa logs relacionados
     * @param {string} titulo - Título del grupo
     */
    grupoInicio(titulo) {
        console.group(`📁 ${titulo}`);
    },
    
    /**
     * Finaliza un grupo de logs
     */
    grupoFin() {
        console.groupEnd();
    },
    
    /**
     * Mide el tiempo de ejecución
     * @param {string} etiqueta - Etiqueta del timer
     */
    tiempoInicio(etiqueta) {
        console.time(`⏱️ ${etiqueta}`);
    },
    
    /**
     * Finaliza medición de tiempo
     * @param {string} etiqueta - Etiqueta del timer
     */
    tiempoFin(etiqueta) {
        console.timeEnd(`⏱️ ${etiqueta}`);
    },
    
    /**
     * Muestra una tabla en consola
     * @param {Array|Object} datos - Datos a mostrar
     */
    tabla(datos) {
        console.table(datos);
    }
};

export default logger;
