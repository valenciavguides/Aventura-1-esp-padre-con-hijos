/**
 * @fileoverview Configuración centralizada para ValenciaVGuides
 * @version 2.0.0
 * 
 * Define todas las constantes de configuración del sistema,
 * incluyendo timeouts, URLs, límites y parámetros de comportamiento.
 */

import { MODOS, LOG_LEVELS } from './constants.js';

/**
 * Mapeo de tipos de consulta por hijo
 * Usado para especificar el tipo de datos esperados en comunicaciones con iframes hijo
 * @type {Object<string, string>}
 */
export const MAPA_TIPOS_HIJO = {
    hijo2: 'COORDENADAS',
    hijo3: 'AUDIO',
    hijo4: 'RETO',
    hijo5: 'CASA'
};

/**
 * Configuración principal del sistema
 * @type {Object}
 */
export const CONFIG = {
    /**
     * Configuración de versión
     */
    VERSION: '2.0.0',
    BUILD_DATE: '2024-01-15',
    
    /**
     * Configuración de debugging
     */
    DEBUG: {
        HABILITADO: true,
        NIVEL_LOG: LOG_LEVELS.DEBUG,
        MOSTRAR_TIMESTAMPS: true,
        MOSTRAR_CONTEXTO: true,
        PERSISTIR_LOGS: false
    },
    
    /**
     * Configuración del sistema de mensajería
     */
    MENSAJERIA: {
        /** Timeout por defecto para mensajes con confirmación (ms) */
        TIMEOUT_CONFIRMACION: 5000,
        
        /** Timeout extendido para operaciones complejas (ms) */
        TIMEOUT_EXTENDIDO: 10000,
        
        /** Timeout rápido para operaciones simples (ms) */
        TIMEOUT_RAPIDO: 2000,
        
        /** Número máximo de reintentos para mensajes */
        MAX_REINTENTOS: 3,
        
        /** Intervalo base entre reintentos (ms) */
        INTERVALO_REINTENTO: 1000,
        
        /** Factor de backoff exponencial */
        BACKOFF_FACTOR: 1.5,
        
        /** Tamaño máximo del buffer de mensajes pendientes */
        MAX_BUFFER_MENSAJES: 100,
        
        /** TTL por defecto para mensajes en cola (ms) */
        TTL_MENSAJE: 30000,
        
        /** Intervalo de limpieza de mensajes expirados (ms) */
        INTERVALO_LIMPIEZA: 10000,
        
        /** Alias TIMEOUTS para compatibilidad con codigo-padre.html */
        TIMEOUTS: {
            CONFIRMACION: 5000,
            EXTENDIDO: 10000,
            RAPIDO: 2000
        }
    },
    
    /**
     * Configuración del GPS y localización
     */
    GPS: {
        /** Habilitar alta precisión */
        ALTA_PRECISION: true,
        
        /** Timeout para obtener posición (ms) */
        TIMEOUT: 15000,
        
        /** Edad máxima de posición en caché (ms) */
        MAX_EDAD_CACHE: 5000,
        
        /** Intervalo de actualización de posición (ms) */
        INTERVALO_ACTUALIZACION: 3000,
        
        /** Distancia mínima para considerar movimiento (metros) */
        DISTANCIA_MINIMA: 5,
        
        /** Radio de proximidad para puntos de interés (metros) */
        RADIO_PROXIMIDAD: 20,
        
        /** Radio extendido para búsqueda amplia (metros) */
        RADIO_EXTENDIDO: 50,
        
        /** Precisión mínima aceptable (metros) */
        PRECISION_MINIMA: 30,
        
        /** Número de muestras para promediar posición */
        MUESTRAS_PROMEDIO: 3
    },
    
    /**
     * Configuración de audio
     */
    AUDIO: {
        /** Volumen por defecto (0-1) */
        VOLUMEN_DEFECTO: 0.8,
        
        /** Duración de fade in/out (ms) */
        DURACION_FADE: 500,
        
        /** Intervalo de actualización de progreso (ms) */
        INTERVALO_PROGRESO: 250,
        
        /** Precargar audios al inicio */
        PRECARGA: true,
        
        /** Número máximo de audios en caché */
        MAX_CACHE: 10,
        
        /** Formatos soportados en orden de preferencia */
        FORMATOS: ['mp3', 'ogg', 'wav']
    },
    
    /**
     * Configuración de la interfaz de usuario
     */
    UI: {
        /** Duración de animaciones (ms) */
        DURACION_ANIMACION: 300,
        
        /** Debounce para eventos de scroll (ms) */
        DEBOUNCE_SCROLL: 100,
        
        /** Debounce para eventos de resize (ms) */
        DEBOUNCE_RESIZE: 150,
        
        /** Tiempo mínimo de visualización de loading (ms) */
        MIN_TIEMPO_LOADING: 500,
        
        /** Breakpoints responsive */
        BREAKPOINTS: {
            MOBILE: 480,
            TABLET: 768,
            DESKTOP: 1024,
            LARGE: 1440
        }
    },
    
    /**
     * Configuración de mapa
     */
    MAPA: {
        /** Zoom inicial */
        ZOOM_INICIAL: 15,
        
        /** Zoom mínimo permitido */
        ZOOM_MIN: 12,
        
        /** Zoom máximo permitido */
        ZOOM_MAX: 19,
        
        /** Zoom para centrar en punto */
        ZOOM_CENTRADO: 17,
        
        /** Centro por defecto (Valencia) */
        CENTRO_DEFECTO: {
            lat: 39.4699,
            lng: -0.3763
        },
        
        /** Estilo del mapa */
        ESTILO: 'mapbox://styles/mapbox/streets-v11',
        
        /** Duración de animación de vuelo (ms) */
        DURACION_VUELO: 1500
    },
    
    /**
     * Configuración de aventuras
     */
    AVENTURAS: {
        /** Modo por defecto */
        MODO_DEFECTO: MODOS.MANUAL,
        
        /** Tiempo máximo de aventura (ms) */
        TIEMPO_MAXIMO: 3600000, // 1 hora
        
        /** Intervalo de auto-guardado (ms) */
        INTERVALO_AUTOGUARDADO: 60000,
        
        /** Número mínimo de paradas */
        MIN_PARADAS: 3,
        
        /** Número máximo de paradas */
        MAX_PARADAS: 20
    },
    
    /**
     * Configuración de retos
     */
    RETOS: {
        /** Tiempo por defecto para completar reto (ms) */
        TIEMPO_LIMITE: 300000, // 5 minutos
        
        /** Puntos por reto completado */
        PUNTOS_COMPLETADO: 100,
        
        /** Bonus por tiempo récord */
        BONUS_TIEMPO: 50,
        
        /** Penalización por pista usada */
        PENALIZACION_PISTA: 25
    },
    
    /**
     * Configuración de almacenamiento
     */
    STORAGE: {
        /** Prefijo para claves de localStorage */
        PREFIJO: 'vvguides_',
        
        /** TTL por defecto para datos en caché (ms) */
        TTL_CACHE: 86400000, // 24 horas
        
        /** Límite de tamaño de localStorage (bytes) */
        LIMITE_TAMANO: 5242880 // 5MB
    },
    
    /**
     * Configuración de red
     */
    RED: {
        /** Timeout para peticiones HTTP (ms) */
        TIMEOUT_HTTP: 10000,
        
        /** Número de reintentos para peticiones fallidas */
        REINTENTOS_HTTP: 2,
        
        /** Intervalo entre reintentos (ms) */
        INTERVALO_REINTENTO_HTTP: 1000,
        
        /** URL base de la API */
        API_BASE_URL: '',
        
        /** Habilitar modo offline */
        MODO_OFFLINE: true
    },
    
    /**
     * Configuración de iframes hijos
     */
    HIJOS: {
        /** Tiempo de espera para inicialización (ms) */
        TIMEOUT_INIT: 10000,
        
        /** Intervalo de heartbeat (ms) */
        INTERVALO_HEARTBEAT: 5000,
        
        /** Número de heartbeats fallidos para considerar desconexión */
        MAX_HEARTBEATS_FALLIDOS: 3,
        
        /** Reintentar conexión automáticamente */
        AUTO_RECONECTAR: true,
        
        /** Intervalo de reconexión (ms) */
        INTERVALO_RECONEXION: 3000
    },
    
    /**
     * Configuración de monitoreo
     */
    MONITOREO: {
        /** Habilitar métricas */
        METRICAS_HABILITADAS: true,
        
        /** Intervalo de recolección de métricas (ms) */
        INTERVALO_METRICAS: 30000,
        
        /** Umbral de memoria para alertas (bytes) */
        UMBRAL_MEMORIA: 52428800, // 50MB
        
        /** Umbral de mensajes pendientes para alertas */
        UMBRAL_MENSAJES_PENDIENTES: 50
    }
};

/**
 * Función para obtener configuración con valor por defecto
 * @param {string} ruta - Ruta de la configuración (ej: 'GPS.TIMEOUT')
 * @param {*} defecto - Valor por defecto si no existe
 * @returns {*} Valor de configuración
 */
export function getConfig(ruta, defecto = null) {
    const partes = ruta.split('.');
    let valor = CONFIG;
    
    for (const parte of partes) {
        if (valor && typeof valor === 'object' && parte in valor) {
            valor = valor[parte];
        } else {
            return defecto;
        }
    }
    
    return valor;
}

/**
 * Función para actualizar configuración en runtime
 * @param {string} ruta - Ruta de la configuración
 * @param {*} nuevoValor - Nuevo valor
 * @returns {boolean} True si se actualizó correctamente
 */
export function setConfig(ruta, nuevoValor) {
    const partes = ruta.split('.');
    let obj = CONFIG;
    
    for (let i = 0; i < partes.length - 1; i++) {
        if (obj && typeof obj === 'object' && partes[i] in obj) {
            obj = obj[partes[i]];
        } else {
            return false;
        }
    }
    
    const ultimaParte = partes[partes.length - 1];
    if (obj && typeof obj === 'object' && ultimaParte in obj) {
        obj[ultimaParte] = nuevoValor;
        return true;
    }
    
    return false;
}

/**
 * Exporta la configuración para depuración
 * @returns {string} Configuración en formato JSON
 */
export function exportarConfig() {
    return JSON.stringify(CONFIG, null, 2);
}

export default CONFIG;
