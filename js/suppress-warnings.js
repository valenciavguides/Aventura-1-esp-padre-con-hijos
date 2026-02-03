/**
 * @fileoverview Supresión de advertencias innecesarias en consola
 * @version 1.0.0
 * 
 * Este script debe cargarse lo más temprano posible para
 * filtrar mensajes de advertencia no relevantes de la consola.
 */

(function() {
    'use strict';
    
    // Guardar referencias originales
    const originalWarn = console.warn;
    const originalError = console.error;
    
    /**
     * Patrones de advertencias a suprimir
     * @type {Array<RegExp>}
     */
    const patronesSuprimir = [
        // Advertencias de Mapbox que no afectan funcionalidad
        /mapbox-gl/i,
        /This page appears to be missing CSS/i,
        
        // Advertencias de deprecación menores
        /Synchronous XMLHttpRequest/i,
        
        // Advertencias de fuentes
        /downloadable font/i,
        /Font.*failed to decode/i,
        
        // Advertencias de third-party que no controlamos
        /third-party cookie/i,
        /SameSite cookie/i,
        
        // Advertencias de desarrollo
        /DevTools/i,
        /Source map/i
    ];
    
    /**
     * Patrones de errores a suprimir (solo errores conocidos no críticos)
     * @type {Array<RegExp>}
     */
    const patronesErrorSuprimir = [
        // Errores de recursos que fallan silenciosamente
        /Failed to load resource.*favicon/i,
        
        // Errores de CORS conocidos y manejados
        /CORS.*blocked/i
    ];
    
    /**
     * Verifica si un mensaje debe ser suprimido
     * @param {Array<RegExp>} patrones - Patrones a verificar
     * @param {Array} args - Argumentos del mensaje
     * @returns {boolean} True si debe suprimirse
     */
    const debeSuprimir = function(patrones, args) {
        const mensaje = args.map(arg => {
            if (typeof arg === 'string') return arg;
            if (arg instanceof Error) return arg.message;
            try {
                return JSON.stringify(arg);
            } catch {
                return String(arg);
            }
        }).join(' ');
        
        return patrones.some(patron => patron.test(mensaje));
    };
    
    /**
     * Wrapper para console.warn
     */
    console.warn = function(...args) {
        if (!debeSuprimir(patronesSuprimir, args)) {
            originalWarn.apply(console, args);
        }
    };
    
    /**
     * Wrapper para console.error (solo suprime errores conocidos no críticos)
     */
    console.error = function(...args) {
        if (!debeSuprimir(patronesErrorSuprimir, args)) {
            originalError.apply(console, args);
        }
    };
    
    // Log de inicialización (usando original para asegurar que se muestre)
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        originalWarn.call(console, '[suppress-warnings] Filtro de advertencias activo');
    }
    
    // Exponer función para restaurar consola original si es necesario
    if (typeof window !== 'undefined') {
        window.__vv_restaurarConsola = function() {
            console.warn = originalWarn;
            console.error = originalError;
            console.log('[suppress-warnings] Consola restaurada');
        };
    }
})();
