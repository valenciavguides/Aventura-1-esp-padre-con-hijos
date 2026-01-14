/**
 * Basic utilities that don't depend on mensajeria
 * @module BasicUtils
 */

// Convert to global module to avoid ES6 import issues
(function() {
    'use strict';

/**
 * Generates a unique ID
 * @returns {string} Unique ID
 */
function generarIdUnico() {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Gets the parent ID
 * @returns {string} Parent ID
 */
function getPadreId() {
    try {
        if (typeof window !== 'undefined') {
            if (window.CONFIG_PADRE && window.CONFIG_PADRE.ID) return window.CONFIG_PADRE.ID;
            // Do not rely on CONFIG_PADRE_LOCAL alias; prefer canonical CONFIG_PADRE
            if (window.Config && window.Config.ID_PADRE) return window.Config.ID_PADRE;
        }
    } catch (e) {
        // ignore
    }
    return 'padre';
}

/**
 * Adjusts timeout based on connection
 * @param {number} timeoutBase - Base timeout
 * @returns {number} Adjusted timeout
 */
function ajustarTimeoutPorConexion(timeoutBase) {
    const multiplicador = calcularMultiplicadorTimeoutConexion();
    const timeoutAjustado = Math.round(timeoutBase * multiplicador);
    return timeoutAjustado;
}

/**
 * Calculates timeout multiplier based on connection
 * @returns {number} Multiplier
 */
function calcularMultiplicadorTimeoutConexion() {
    try {
        if (typeof navigator !== 'undefined' && navigator.connection) {
            const connection = navigator.connection;
            if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                return 3.0;
            } else if (connection.effectiveType === '3g') {
                return 2.0;
            }
        }
    } catch (e) {
        // ignore
    }
    return 1.0;
}

// ================== EXPORTACIONES GLOBALES ==================
window.basicUtils = {
    generarIdUnico,
    getPadreId,
    ajustarTimeoutPorConexion
};

})(); // End of IIFE
