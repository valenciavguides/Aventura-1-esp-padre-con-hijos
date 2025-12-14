/**
 * Configuración global de la aplicación
 * @module Config
 */

import { LOG_LEVELS } from './constants.js';

/**
 * Configuración de la aplicación
 */
export const CONFIG = {
    // Configuración general
    DEBUG: true,
    LOG_LEVEL: LOG_LEVELS.DEBUG,
    ID_PADRE: 'padre', // Canonical parent ID used across child messages
    IFRAME_ID: 'hijo4',
    
    // Configuración de iframes
    HIJOS: {
        HAMBURGUESA: { id: 'hijo1-hamburguesa', nombre: 'Menú Hamburguesa' },
        OPCIONES: { id: 'hijo1-opciones', nombre: 'Menú Opciones' },
        CASA: { id: 'hijo5-casa', nombre: 'Botón Casa' },
        COORDENADAS: { id: 'hijo2', nombre: 'Coordenadas' },
        AUDIO: { id: 'hijo3', nombre: 'Audio' },
        RETOS: { id: 'hijo4', nombre: 'Retos' } // Confirmado: ID coincide con el iframe real
    },
    
    // Configuración de mensajería
    MENSAJERIA: {
        // Configuración de reintentos
        REINTENTOS: {
            MAXIMOS: 3,
            TIEMPO_ESPERA: 1000,
            FACTOR: 2
        },
        
        // Límites de mensajería
        LIMITES: {
            MAX_MENSAJES_PADRE: 100,
            THROTTLE_TIMEOUT: 2000
        },
        
        // Tiempos de espera
        TIMEOUTS: {
            CONFIRMACION: 10000,  // Increased from 5000ms to 10000ms for initial messages
            RESPUESTA: 10000     // 10 segundos para respuesta
        },
        // Heartbeat pre-initialization: allow registering listeners and
        // preparing heartbeat state without starting the periodic pings.
        HEARTBEAT_PREWARM: {
            ENABLE: true,
            TIMEOUT_MS: 8000
        }
        ,
        // Cola de mensajería: behavior para reintentos (enqueue)
        QUEUE: {
            BASE_DELAY_MS: 3000,  // base backoff 3s
            MAX_DELAY_MS: 60000,  // máximo de backoff 60s
            MAX_RETRIES: 10,      // intentos antes de expirar
            TTL_MS: 15 * 60 * 1000 // TTL: 15 minutos
        }
        ,
        // Orígenes permitidos para mensajes (vacío => usar origin actual)
        ALLOWED_ORIGINS: []
    },
    
    // Configuración del mapa
    MAPA: {
        CENTER: [39.4699, -0.3763], // Valencia
        ZOOM: 13,
        MIN_ZOOM: 12,
        MAX_ZOOM: 18,
        ZOOM_CONTROL: true // Habilitado
    }
    ,
    // Configuración de GPS y tolerancias
    GPS: {
        ENABLE_HIGH_ACCURACY: true,
        TIMEOUT_MS: 15000,
        MAXIMUM_AGE_MS: 0,
        REJECT_ACCURACY_M: 5000,
        IDEAL_ACCURACY_M: 7,
        IMMEDIATE_ACCURACY_M: 15,
        SOFT_ACCURACY_M: 300,
        REQUIRED_CONSECUTIVE_GOOD: 2,
        BUFFER_SIZE: 3,
        WEAK_GPS_TIMEOUT_MS: 10000
        ,
        // Pre-warm / warmup configuration: when enabled, the parent may start
        // a low-power watchPosition to prime the geolocation subsystem so
        // switching to 'aventura' is faster and smoother.
        PREWARM: {
            ENABLE: true,
            TIMEOUT_MS: 15000,
            // Options used for the warmup watchPosition call (low accuracy / low power)
            WATCH_OPTIONS: {
                enableHighAccuracy: false,
                maximumAge: 300000,
                timeout: 20000
            }
            ,
            // Number of initial high-accuracy getCurrentPosition attempts to make
            HIGH_ACC_INIT_ATTEMPTS: 2,
            // Base timeout (ms) for initial attempts; subsequent attempts use backoff
            INIT_ATTEMPT_TIMEOUT_MS: 5000
        }
    }
    ,
    // Configuración de gestión de pendings en el padre
    PENDING: {
        TTL_MS: 10 * 60 * 1000, // TTL por defecto para pendings (10 minutos)
        OUT_OF_RANGE_M: 53, // distancia en metros que consideraremos fuera de rango
        OUT_OF_RANGE_GRACE_MS: 5 * 60 * 1000, // tiempo de gracia (5 minutos) fuera de rango antes de cancelar
        CLEANUP_INTERVAL_MS: 60 * 1000 // intervalo en ms para limpiar pendings stale (1 minuto)
    }
    ,
    // Configuración específica del sistema de monitoreo/notifications
    MONITOREO: {
        // Lista preferida (en orden) de IDs de iframes para enviar notificaciones de sistema.
        // Si ninguno existe, se usará 'broadcast' como fallback.
        // Se agrega 'sistema-ui' por defecto como destino prioritario centralizado.
        DESTINATARIOS_NOTIFICACION: ['sistema-ui', 'hijo1-opciones', 'hijo5-casa', 'broadcast']
    }
};

// Cambiar las exportaciones para usar CommonJS si ES6 no es compatible
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.Config = CONFIG;
}

// === CANONICAL PADRE ALIASING ===
// Normalize canonical parent ID and keep backward-compatible aliases
try {
    if (typeof window !== 'undefined') {
        // Ensure a canonical object for config on window
        window.Config = window.Config || CONFIG;
        // For code that expects an object named CONFIG_PADRE
        if (typeof window.CONFIG_PADRE === 'undefined') {
            window.CONFIG_PADRE = { ID: CONFIG.ID_PADRE };
        } else if (!window.CONFIG_PADRE.ID) {
            window.CONFIG_PADRE.ID = CONFIG.ID_PADRE;
        }
        // Keep CONFIG_PADRE_LOCAL as a strict alias for compatibility
        if (typeof window.CONFIG_PADRE_LOCAL === 'undefined') {
            window.CONFIG_PADRE_LOCAL = window.CONFIG_PADRE;
        } else if (window.CONFIG_PADRE_LOCAL !== window.CONFIG_PADRE) {
            // Make them identical to avoid divergence
            window.CONFIG_PADRE_LOCAL = window.CONFIG_PADRE;
        }
    }
} catch (err) {
    // Not fatal: continue without throwing in environments without window
}

// Export a convenience constant
export const PADRE_ID = CONFIG.ID_PADRE;

// Mapa centralizado de tipos de datos por hijo para consultas homogéneas
export const MAPA_TIPOS_HIJO = {
    'hijo2': 'COORDENADAS',
    'hijo3': 'AUDIO', 
    'hijo4': 'RETOS',
    'hijo5-casa': 'PARADAS'
};
