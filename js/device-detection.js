import logger from './logger.js';

/**
 * Detecta si el dispositivo actual es móvil
 * @returns {boolean} True si es un dispositivo móvil
 */
export const esMovil = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

/**
 * Detecta si el dispositivo es específicamente un teléfono móvil (excluyendo tablets)
 * @returns {boolean} True si es un teléfono móvil
 */
export function esTelefonoMovil() {
    const ua = navigator.userAgent;

    // Excluir tablets y otros dispositivos no móviles
    if (ua.includes('iPad') || ua.includes('Tablet') || ua.includes('PlayBook')) {
        return false;
    }

    // Detectar teléfonos móviles específicos
    const esTelefono = /Android.*Mobile|iPhone|IEMobile|Windows Phone|BlackBerry|Opera Mini/i.test(ua);

    // Verificar tamaño de pantalla típico de móviles (menos de 768px de ancho)
    const anchoPantalla = window.screen.width;
    const altoPantalla = window.screen.height;
    const minDimension = Math.min(anchoPantalla, altoPantalla);

    // Los teléfonos móviles típicamente tienen una dimensión menor a 768px
    const esPantallaMovil = minDimension < 768;

    // Verificar si tiene capacidades de orientación (los móviles las tienen)
    const tieneOrientacion = typeof screen !== 'undefined' && screen.orientation;

    return esTelefono || (esPantallaMovil && tieneOrientacion);
}

/**
 * Obtiene información detallada del dispositivo
 * @returns {Object} Información del dispositivo
 */
export function obtenerInfoDispositivo() {
    return {
        esMovil,
        userAgent: navigator.userAgent,
        plataforma: navigator.platform,
        navegador: detectarNavegador(),
        pantalla: {
            ancho: window.screen.width,
            alto: window.screen.height,
            ratio: window.devicePixelRatio || 1
        }
    };
}

/**
 * Detecta el navegador actual
 * @private
 * @returns {string} Nombre del navegador
 */
function detectarNavegador() {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
    return 'Desconocido';
}

/**
 * Verifica si el dispositivo tiene suficiente memoria
 * @param {number} [minimoMB=500] - Memoria mínima requerida en MB
 * @returns {boolean} True si tiene suficiente memoria
 */
export function tieneSuficienteMemoria(minimoMB = 500) {
    if (navigator.deviceMemory) {
        return navigator.deviceMemory * 1024 >= minimoMB;
    }
    // Asumir que tiene suficiente si no podemos detectar
    return true;
}

export default { esMovil, esTelefonoMovil, obtenerInfoDispositivo, tieneSuficienteMemoria };
