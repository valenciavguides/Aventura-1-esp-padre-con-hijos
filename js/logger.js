/**
 * Módulo de logging centralizado para toda la aplicación.
 * @module Logger
 * @version 4.0.0
 * @description Sistema de logging unificado con soporte para:
 * - Niveles de log configurables
 * - Colores personalizables
 * - Envío de logs al servidor (opcional)
 * - Filtrado por nivel
 * - Historial en memoria
 */

import { LOG_LEVELS, TTL_LIMPIEZA } from './constants.js';

import { esMovil } from './device-detection.js';

/**
 * Colores por defecto para la consola
 * @type {Object.<string, string>}
 */
const DEFAULT_COLORS = {
    debug: '#9E9E9E',  // Gris
    info: '#2196F3',   // Azul
    success: '#4CAF50', // Verde
    warn: '#FFC107',   // Amarillo
    error: '#F44336'   // Rojo
};

/**
 * Clase Logger para manejo centralizado de logs
 */
class Logger {
    /**
     * Crea una instancia de Logger
     * @param {Object} options - Opciones de configuración
     * @param {string} [options.level='info'] - Nivel mínimo de log
     * @param {boolean} [options.console=true] - Habilitar logs en consola
     * @param {boolean} [options.server=false] - Enviar logs al servidor
     * @param {number} [options.maxHistory=100] - Máximo número de logs en historial
     */
    constructor(options = {}) {
        this.options = {
            level: options.level || 'info',
            console: options.console !== false,
            server: options.server || false,
            maxHistory: options.maxHistory || 100
        };
        
        this.history = [];
        this.LEVELS = { ...LOG_LEVELS };
        this.COLORS = { ...DEFAULT_COLORS, ...(options.colors || {}) };
        this.currentLevel = this.LEVELS[this.options.level.toUpperCase()] || this.LEVELS.INFO;
        // Optimización móvil: Historial reducido (25 vs 100)
        this.maxHistory = esMovil ? 25 : 100;
    }

    /**
     * Configura el logger
     * @param {Object} options - Opciones de configuración
     */
    configure(options) {
        Object.assign(this.options, options);
        if (options.level) {
            this.currentLevel = this.LEVELS[options.level.toUpperCase()] || this.LEVELS.INFO;
        }
    }

    /**
     * Registra un mensaje de depuración
     * @param {string} message - Mensaje a registrar
     * @param {Object} [data] - Datos adicionales
     */
    debug(message, data) {
        this._log('debug', message, data);
    }

    /**
     * Registra un mensaje informativo
     * @param {string} message - Mensaje a registrar
     * @param {Object} [data] - Datos adicionales
     */
    info(message, data) {
        this._log('info', message, data);
    }

    /**
     * Registra un mensaje de éxito
     * @param {string} message - Mensaje a registrar
     * @param {Object} [data] - Datos adicionales
     */
    success(message, data) {
        this._log('success', `${message}`, data);
    }

    /**
     * Registra una advertencia
     * @param {string} message - Mensaje de advertencia
     * @param {Error|Object} [error] - Error o datos adicionales
     */
    warn(message, error) {
        this._log('warn', message, error);
    }

    /**
     * Registra una advertencia de deprecación (semántica especial)
     * @param {string} message - Mensaje de deprecación
     * @param {Object} [data] - Datos adicionales
     */
    deprecate(message, data) {
        this._log('warn', `[DEPRECATION] ${message}`, data);
    }

    /**
     * Registra un error
     * @param {string} message - Mensaje de error
     * @param {Error|Object} [error] - Error o datos adicionales
     */
    error(message, error) {
        this._log('error', message, error);
    }

    /**
     * Método interno para registrar logs
     * @private
     */
    _log(level, message, data) {
        const levelValue = this.LEVELS[level.toUpperCase()];
        if (levelValue < this.currentLevel) return;

        // Optimización móvil: Saltar debug en móvil para reducir RAM
        if (esMovil && level === 'debug') return;

        const timestamp = new Date().toISOString();
        const logEntry = { level, message, timestamp, data };

        // Añadir al historial
        this.history.push(logEntry);
        // Optimización móvil: Limpiar historial más agresivamente
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        // Mostrar en consola si está habilitado
        if (this.options.console) {
            const color = this.COLORS[level] || '#000000';
            const style = `color: ${color}; font-weight: bold`;
            
            console[level === 'success' ? 'info' : level](`%c[${timestamp}] ${level.toUpperCase()}: ${message}`, style);
            
            if (data) {
                if (data instanceof Error) {
                    console.error(data);
                } else if (typeof data === 'object') {
                    console.dir(data, { depth: null, colors: true });
                } else {
                    console.log(data);
                }
            }
        }

        // Enviar al servidor si está habilitado
        if (this.options.server && this._sendToServer) {
            this._sendToServer(logEntry);
        }
    }

    /**
     * Inicializa el sistema de mensajería
     * @param {Object} messaging - Funciones de mensajería
     */
    initializeMessaging(messaging) {
        this.messaging = messaging;
        this.info('Sistema de mensajería inicializado en el logger');
        
        // Configurar envío de errores críticos al servidor
        if (this.messaging.enviarMensaje) {
            this._sendToServer = (logEntry) => {
                if (logEntry.level === 'error') {
                    Promise.resolve(this.messaging.enviarMensaje('servidor', 'LOG_ERROR', logEntry))
                        .catch(err => console.error('Error al enviar log al servidor:', err));
                }
            };
        }
    }

    /**
     * Obtiene el historial de logs
     * @returns {Array} Historial de logs
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Limpia el historial de logs
     */
    clearHistory() {
        this.history = [];
    }
}

const logger = new Logger({
    maxHistory: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 25 : 100
});
export default logger;

// ✅ PROBLEMA 26: Usar TTL centralizado de constants.js
// Optimización móvil: TTL más agresivo (5min móvil vs 1min desktop)
setInterval(() => {
    // ...existing code...
}, esMovil ? TTL_LIMPIEZA.LOGGER.MOVIL : TTL_LIMPIEZA.LOGGER.DESKTOP);
