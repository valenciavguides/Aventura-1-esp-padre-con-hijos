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
    ID_PADRE: 'codigo-padre', // Confirmado: ID coincide con el iframe real del padre
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
        }
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
    }
};

// Cambiar las exportaciones para usar CommonJS si ES6 no es compatible
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.Config = CONFIG;
}

// Mapa centralizado de tipos de datos por hijo para consultas homogéneas
export const MAPA_TIPOS_HIJO = {
    'hijo2': 'COORDENADAS',
    'hijo3': 'AUDIO', 
    'hijo4': 'RETOS',
    'hijo5-casa': 'PARADAS'
};
