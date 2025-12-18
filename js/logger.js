
import { TTL_LIMPIEZA } from './constants.js';
import { CONFIG } from './config.js';

// Definir LOG_LEVELS localmente para evitar ReferenceError si el import falla
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

const DEFAULT_COLORS = {
    debug: '#9E9E9E',  // Gris
    info: '#2196F3',   // Azul
    success: '#4CAF50', // Verde
    warn: '#FFC107',   // Amarillo
    error: '#F44336'   // Rojo
};

// Definir esMovil localmente para evitar dependencias de import y ReferenceError
const esMovil = (typeof navigator !== 'undefined') && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const IS_PROD = (CONFIG && (CONFIG.ENTORNO === 'produccion' || CONFIG.ENTORNO === 'prod')) || (typeof window !== 'undefined' && window.location && window.location.hostname && !/localhost|127.0.0.1/.test(window.location.hostname));

const loggerDefaultOptions = {
    level: IS_PROD ? 'warn' : 'info',
    console: true,
    server: false,
    maxHistory: esMovil ? 25 : 100,
    colors: {}
};

class Logger {
    constructor(options = {}) {
        this.options = { ...loggerDefaultOptions, ...options };
        this.history = [];
        this.LEVELS = { ...LOG_LEVELS };
        this.COLORS = { ...DEFAULT_COLORS, ...this.options.colors };
        this.currentLevel = this.LEVELS[this.options.level.toUpperCase()] || this.LEVELS.INFO;
        this._sendToServer = null;
    }

    configure(options) {
        Object.assign(this.options, options);
        if (options.level) {
            this.currentLevel = this.LEVELS[options.level.toUpperCase()] || this.LEVELS.INFO;
        }
        if (options.colors) {
            this.COLORS = { ...DEFAULT_COLORS, ...options.colors };
        }
    }

    shouldLog(level) {
        const levelValue = this.LEVELS[level.toUpperCase()];
        if (IS_PROD && levelValue < this.LEVELS.ERROR) return false;
        return levelValue >= this.currentLevel;
    }

    _log(level, message, data) {
        const levelValue = this.LEVELS[level.toUpperCase()];
        if (levelValue < this.currentLevel) return;
        if (esMovil && level === 'debug') return;
        const timestamp = new Date().toISOString();
        const logEntry = { level, message, timestamp, data };
        this.history.push(logEntry);
        if (this.history.length > (this.options.maxHistory || 100)) {
            this.history.shift();
        }
        if (this.options.console) {
            const color = this.COLORS[level] || '#000000';
            const style = `color: ${color}; font-weight: bold`;
            try {
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
            } catch (e) {
                // fallback
                console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data);
            }
        }
        if (this.options.server && this._sendToServer) {
            this._sendToServer(logEntry);
        }
    }

    debug(message, data) { this._log('debug', message, data); }
    info(message, data) { this._log('info', message, data); }
    success(message, data) { this._log('success', message, data); }
    warn(message, error) { this._log('warn', message, error); }
    deprecate(message, data) { this._log('warn', `[DEPRECATION] ${message}`, data); }
    error(message, error) { this._log('error', message, error); }

    initializeMessaging(messaging) {
        this.messaging = messaging;
        this.info('Sistema de mensajería inicializado en el logger');
        if (this.messaging.enviarMensaje) {
            this._sendToServer = (logEntry) => {
                if (logEntry.level === 'error') {
                    Promise.resolve(this.messaging.enviarMensaje('servidor', 'LOG_ERROR', logEntry))
                        .catch(err => console.error('Error al enviar log al servidor:', err));
                }
            };
        }
    }

    getHistory() { return [...this.history]; }
    clearHistory() { this.history = []; }
}

const logger = new Logger();
export default logger;

// ✅ PROBLEMA 26: Usar TTL centralizado de constants.js
setInterval(() => {
    logger.clearHistory();
}, esMovil ? TTL_LIMPIEZA.LOGGER.MOVIL : TTL_LIMPIEZA.LOGGER.DESKTOP);
