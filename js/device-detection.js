/**
 * @fileoverview Detección de dispositivos para ValenciaVGuides
 * @version 2.0.0
 * 
 * Proporciona funciones para detectar el tipo de dispositivo,
 * sistema operativo y capacidades del navegador.
 */

/**
 * Cache de detecciones para evitar recálculos
 * @type {Object}
 */
const cache = {
    esMovil: null,
    esTelefonoMovil: null,
    esTablet: null,
    esIOS: null,
    esAndroid: null,
    navegador: null,
    soportaTactil: null
};

/**
 * Obtiene el User Agent del navegador
 * @returns {string} User Agent
 */
function getUserAgent() {
    return navigator.userAgent || navigator.vendor || window.opera || '';
}

/**
 * Detecta si el dispositivo es móvil (incluye tablets)
 * @returns {boolean} True si es dispositivo móvil
 */
export function esMovil() {
    if (cache.esMovil !== null) {
        return cache.esMovil;
    }
    
    const ua = getUserAgent().toLowerCase();
    
    // Patrones comunes de dispositivos móviles
    const patronesMovil = [
        /android/i,
        /webos/i,
        /iphone/i,
        /ipad/i,
        /ipod/i,
        /blackberry/i,
        /windows phone/i,
        /opera mini/i,
        /mobile/i,
        /tablet/i
    ];
    
    // Verificar por User Agent
    const esMovilPorUA = patronesMovil.some(patron => patron.test(ua));
    
    // Verificar por características de pantalla
    const esMovilPorPantalla = (
        window.innerWidth <= 1024 ||
        ('orientation' in window) ||
        ('ontouchstart' in window)
    );
    
    // Verificar por media queries
    const esMovilPorMedia = window.matchMedia && (
        window.matchMedia('(max-width: 1024px)').matches ||
        window.matchMedia('(pointer: coarse)').matches
    );
    
    cache.esMovil = esMovilPorUA || (esMovilPorPantalla && esMovilPorMedia);
    return cache.esMovil;
}

/**
 * Detecta si el dispositivo es específicamente un teléfono móvil (no tablet)
 * @returns {boolean} True si es teléfono móvil
 */
export function esTelefonoMovil() {
    if (cache.esTelefonoMovil !== null) {
        return cache.esTelefonoMovil;
    }
    
    const ua = getUserAgent().toLowerCase();
    
    // Patrones específicos de teléfonos
    const patronesTelefono = [
        /iphone/i,
        /android.*mobile/i,
        /windows phone/i,
        /blackberry/i,
        /opera mini/i,
        /mobile/i
    ];
    
    // Excluir tablets conocidas
    const esTablet = (
        /ipad/i.test(ua) ||
        (/android/i.test(ua) && !/mobile/i.test(ua)) ||
        /tablet/i.test(ua)
    );
    
    // Verificar por tamaño de pantalla típico de teléfonos
    const esTamanoTelefono = window.innerWidth <= 768;
    
    // Es teléfono si coincide con patrón Y no es tablet Y tiene tamaño apropiado
    const esTelefono = patronesTelefono.some(patron => patron.test(ua)) && !esTablet;
    
    cache.esTelefonoMovil = esTelefono || (esMovil() && esTamanoTelefono && !esTablet);
    return cache.esTelefonoMovil;
}

/**
 * Detecta si el dispositivo es una tablet
 * @returns {boolean} True si es tablet
 */
export function esTablet() {
    if (cache.esTablet !== null) {
        return cache.esTablet;
    }
    
    const ua = getUserAgent().toLowerCase();
    
    // Patrones de tablets
    const patronesTablet = [
        /ipad/i,
        /tablet/i,
        /playbook/i,
        /silk/i
    ];
    
    // Android sin "mobile" suele ser tablet
    const esAndroidTablet = /android/i.test(ua) && !/mobile/i.test(ua);
    
    // Verificar por tamaño de pantalla típico de tablets
    const esTamanoTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
    
    cache.esTablet = patronesTablet.some(patron => patron.test(ua)) || 
                     esAndroidTablet || 
                     (esMovil() && esTamanoTablet);
    return cache.esTablet;
}

/**
 * Detecta si el dispositivo usa iOS
 * @returns {boolean} True si es iOS
 */
export function esIOS() {
    if (cache.esIOS !== null) {
        return cache.esIOS;
    }
    
    const ua = getUserAgent();
    
    cache.esIOS = /iPad|iPhone|iPod/.test(ua) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return cache.esIOS;
}

/**
 * Detecta si el dispositivo usa Android
 * @returns {boolean} True si es Android
 */
export function esAndroid() {
    if (cache.esAndroid !== null) {
        return cache.esAndroid;
    }
    
    cache.esAndroid = /Android/i.test(getUserAgent());
    return cache.esAndroid;
}

/**
 * Detecta el navegador actual
 * @returns {Object} Información del navegador
 */
export function detectarNavegador() {
    if (cache.navegador !== null) {
        return cache.navegador;
    }
    
    const ua = getUserAgent();
    let nombre = 'Desconocido';
    let version = '';
    
    // Chrome
    if (/Chrome/i.test(ua) && !/Chromium|Edge|OPR|Opera/i.test(ua)) {
        nombre = 'Chrome';
        const match = ua.match(/Chrome\/(\d+)/);
        version = match ? match[1] : '';
    }
    // Firefox
    else if (/Firefox/i.test(ua)) {
        nombre = 'Firefox';
        const match = ua.match(/Firefox\/(\d+)/);
        version = match ? match[1] : '';
    }
    // Safari
    else if (/Safari/i.test(ua) && !/Chrome|Chromium/i.test(ua)) {
        nombre = 'Safari';
        const match = ua.match(/Version\/(\d+)/);
        version = match ? match[1] : '';
    }
    // Edge
    else if (/Edg/i.test(ua)) {
        nombre = 'Edge';
        const match = ua.match(/Edg\/(\d+)/);
        version = match ? match[1] : '';
    }
    // Opera
    else if (/OPR|Opera/i.test(ua)) {
        nombre = 'Opera';
        const match = ua.match(/(?:OPR|Opera)\/(\d+)/);
        version = match ? match[1] : '';
    }
    // IE
    else if (/MSIE|Trident/i.test(ua)) {
        nombre = 'Internet Explorer';
        const match = ua.match(/(?:MSIE |rv:)(\d+)/);
        version = match ? match[1] : '';
    }
    
    cache.navegador = { nombre, version };
    return cache.navegador;
}

/**
 * Detecta si el dispositivo soporta eventos táctiles
 * @returns {boolean} True si soporta touch
 */
export function soportaTactil() {
    if (cache.soportaTactil !== null) {
        return cache.soportaTactil;
    }
    
    cache.soportaTactil = (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0
    );
    return cache.soportaTactil;
}

/**
 * Detecta si el dispositivo tiene giroscopio
 * @returns {boolean} True si tiene giroscopio
 */
export function tieneGiroscopio() {
    return 'DeviceOrientationEvent' in window;
}

/**
 * Detecta si el dispositivo tiene acelerómetro
 * @returns {boolean} True si tiene acelerómetro
 */
export function tieneAcelerometro() {
    return 'DeviceMotionEvent' in window;
}

/**
 * Detecta si el navegador soporta geolocalización
 * @returns {boolean} True si soporta geolocalización
 */
export function soportaGeolocalizacion() {
    return 'geolocation' in navigator;
}

/**
 * Detecta si el navegador soporta notificaciones
 * @returns {boolean} True si soporta notificaciones
 */
export function soportaNotificaciones() {
    return 'Notification' in window;
}

/**
 * Detecta si el navegador soporta Service Workers
 * @returns {boolean} True si soporta Service Workers
 */
export function soportaServiceWorkers() {
    return 'serviceWorker' in navigator;
}

/**
 * Detecta si está en modo standalone (PWA instalada)
 * @returns {boolean} True si es PWA instalada
 */
export function esPWAInstalada() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

/**
 * Obtiene información completa del dispositivo
 * @returns {Object} Información completa del dispositivo
 */
export function getInfoDispositivo() {
    return {
        esMovil: esMovil(),
        esTelefonoMovil: esTelefonoMovil(),
        esTablet: esTablet(),
        esIOS: esIOS(),
        esAndroid: esAndroid(),
        navegador: detectarNavegador(),
        soportaTactil: soportaTactil(),
        tieneGiroscopio: tieneGiroscopio(),
        tieneAcelerometro: tieneAcelerometro(),
        soportaGeolocalizacion: soportaGeolocalizacion(),
        soportaNotificaciones: soportaNotificaciones(),
        soportaServiceWorkers: soportaServiceWorkers(),
        esPWAInstalada: esPWAInstalada(),
        pantalla: {
            ancho: window.innerWidth,
            alto: window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1
        },
        conexion: navigator.connection ? {
            tipo: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink
        } : null
    };
}

/**
 * Limpia la caché de detecciones (útil para testing o cambios de orientación)
 */
export function limpiarCache() {
    Object.keys(cache).forEach(key => {
        cache[key] = null;
    });
}

// Escuchar cambios de orientación para invalidar cache
if (typeof window !== 'undefined') {
    window.addEventListener('orientationchange', () => {
        cache.esMovil = null;
        cache.esTelefonoMovil = null;
        cache.esTablet = null;
    });
    
    // Exponer para debugging
    window.__vv_deviceInfo = getInfoDispositivo;
}

export default {
    esMovil,
    esTelefonoMovil,
    esTablet,
    esIOS,
    esAndroid,
    detectarNavegador,
    soportaTactil,
    tieneGiroscopio,
    tieneAcelerometro,
    soportaGeolocalizacion,
    soportaNotificaciones,
    soportaServiceWorkers,
    esPWAInstalada,
    getInfoDispositivo,
    limpiarCache
};
