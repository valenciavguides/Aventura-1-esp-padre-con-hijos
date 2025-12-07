import logger from './logger.js';

/**
 * Detecta si el dispositivo actual es móvil
 * @returns {boolean} True si es un dispositivo móvil
 */
export const esMovil = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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

export default { esMovil, obtenerInfoDispositivo, tieneSuficienteMemoria };
