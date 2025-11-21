/**
 * Módulo para validación centralizada en la aplicación
 * @module Validacion
 * @version 2.0.0
 * @description Proporciona funciones de validación reutilizables
 * para formularios, entradas de usuario y estructuras de datos.
 */

import logger from './logger.js';
import { TIPOS_MENSAJE } from './constants.js';

/**
 * Errores de validación estándar
 * @readonly
 * @enum {string}
 */
export const ERRORES_VALIDACION = {
    CAMPO_REQUERIDO: 'Este campo es obligatorio',
    FORMATO_INVALIDO: 'El formato no es válido',
    LONGITUD_MINIMA: 'El texto es demasiado corto',
    LONGITUD_MAXIMA: 'El texto es demasiado largo',
    VALOR_MINIMO: 'El valor es menor que el mínimo permitido',
    VALOR_MAXIMO: 'El valor es mayor que el máximo permitido',
    EMAIL_INVALIDO: 'El correo electrónico no es válido',
    URL_INVALIDA: 'La URL no es válida',
    FECHA_INVALIDA: 'La fecha no es válida',
    PATRON_NO_COINCIDE: 'El valor no cumple con el formato requerido'
};

/**
 * Expresiones regulares comunes
 */
export const PATRONES = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    TELEFONO: /^\+?[\d\s-]{6,15}$/,
    CODIGO_POSTAL: /^\d{5}(-\d{4})?$/, // Código postal español
    URL: /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?$/,
    SOLO_TEXTO: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/
};

/**
 * Valida un campo de texto contra una expresión regular
 * @param {HTMLInputElement} campo - Elemento de entrada a validar
 * @param {Object} opciones - Opciones de validación
 * @param {RegExp} [opciones.patron] - Expresión regular para validar
 * @param {boolean} [opciones.requerido=true] - Si el campo es obligatorio
 * @param {number} [opciones.minLongitud] - Longitud mínima permitida
 * @param {number} [opciones.maxLongitud] - Longitud máxima permitida
 * @param {string} [opciones.mensajeError] - Mensaje de error personalizado
 * @returns {{valido: boolean, error?: string}} Resultado de la validación
 */
export function validarCampoTexto(campo, { 
    patron, 
    requerido = true, 
    minLongitud, 
    maxLongitud, 
    mensajeError 
} = {}) {
    try {
        // Validar parámetros
        if (!(campo instanceof HTMLInputElement) && !(campo instanceof HTMLTextAreaElement)) {
            throw new Error('El campo debe ser un elemento de entrada de texto');
        }

        const valor = campo.value.trim();
        
        // Validar campo requerido
        if (requerido && !valor) {
            return {
                valido: false,
                error: mensajeError || ERRORES_VALIDACION.CAMPO_REQUERIDO
            };
        }

        // Validar longitud mínima
        if (minLongitud !== undefined && valor.length < minLongitud) {
            return {
                valido: false,
                error: mensajeError || `${ERRORES_VALIDACION.LONGITUD_MINIMA} (mínimo ${minLongitud} caracteres)`
            };
        }

        // Validar longitud máxima
        if (maxLongitud !== undefined && valor.length > maxLongitud) {
            return {
                valido: false,
                error: mensajeError || `${ERRORES_VALIDACION.LONGITUD_MAXIMA} (máximo ${maxLongitud} caracteres)`
            };
        }

        // Validar patrón
        if (patron && valor && !patron.test(valor)) {
            return {
                valido: false,
                error: mensajeError || ERRORES_VALIDACION.PATRON_NO_COINCIDE
            };
        }

        return { valido: true };
    } catch (error) {
        logger.error('Error en validarCampoTexto', { error, campo });
        return {
            valido: false,
            error: 'Error al validar el campo'
        };
    }
}

/**
 * Valida un formulario completo
 * @param {HTMLFormElement} formulario - Formulario a validar
 * @param {Object} validaciones - Objeto con las validaciones por campo
 * @returns {{valido: boolean, errores: Object.<string, string>}} Resultado de la validación
 */
export function validarFormulario(formulario, validaciones) {
    const errores = {};
    let esValido = true;

    try {
        if (!(formulario instanceof HTMLFormElement)) {
            throw new Error('El formulario debe ser un elemento HTMLFormElement');
        }

        // Validar cada campo del formulario
        Object.entries(validaciones).forEach(([nombreCampo, opciones]) => {
            const campo = formulario.elements[nombreCampo];
            
            if (!campo) {
                logger.warn(`Campo no encontrado: ${nombreCampo}`);
                return;
            }

            const resultado = validarCampoTexto(campo, opciones);
            
            if (!resultado.valido) {
                esValido = false;
                errores[nombreCampo] = resultado.error;
                
                // Establecer mensaje de validación personalizado
                campo.setCustomValidity(resultado.error);
                campo.reportValidity();
            } else {
                // Limpiar mensaje de validación si el campo es válido
                campo.setCustomValidity('');
            }
        });

        return { valido: esValido, errores };
    } catch (error) {
        logger.error('Error en validarFormulario', { error, formulario });
        return {
            valido: false,
            errores: { _error: 'Error al validar el formulario' }
        };
    }
}

/**
 * Registra validaciones en un formulario existente.
 * @param {HTMLFormElement} formulario - Formulario a validar.
 * @param {Array<{ campoId: string, regex: RegExp, mensajeError: string }>} validaciones - Reglas de validación.
 * @returns {boolean} - True si las validaciones se registraron correctamente, false en caso contrario.
 */
export function registrarValidacionesFormulario(formulario, validaciones) {
    if (!formulario || !(formulario instanceof HTMLFormElement)) {
        logger.error('El formulario proporcionado no es válido.');
        return false;
    }

    if (!Array.isArray(validaciones)) {
        logger.error('Las validaciones deben ser un array.');
        return false;
    }

    validaciones.forEach(({ campoId, regex, mensajeError }) => {
        const campo = formulario.querySelector(`#${campoId}`);
        if (campo) {
            campo.addEventListener('input', () => validarCampoTexto(campo, regex, mensajeError));
        } else {
            logger.warn(`Campo con ID "${campoId}" no encontrado en el formulario.`);
        }
    });

    return true;
}

/**
 * Valida coordenadas geográficas (latitud y longitud)
 * @param {Object} coordenadas - Objeto con latitud y longitud
 * @param {number} coordenadas.lat - Latitud en grados decimales
 * @param {number} coordenadas.lng - Longitud en grados decimales (también acepta 'lon')
 * @returns {boolean} True si las coordenadas son válidas
 */
export function validarCoordenadas(coordenadas) {
    if (!coordenadas || typeof coordenadas !== 'object') {
        return false;
    }

    const lat = coordenadas.lat;
    const lng = coordenadas.lng || coordenadas.lon;

    // Verificar que lat y lng sean números
    if (typeof lat !== 'number' || typeof lng !== 'number') {
        return false;
    }

    // Verificar que no sean NaN
    if (isNaN(lat) || isNaN(lng)) {
        return false;
    }

    // Verificar rangos geográficos
    // Latitud: -90 a 90 grados
    if (lat < -90 || lat > 90) {
        return false;
    }

    // Longitud: -180 a 180 grados
    if (lng < -180 || lng > 180) {
        return false;
    }

    return true;
}

