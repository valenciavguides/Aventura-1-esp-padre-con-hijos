/**
 * @fileoverview Sistema de validación para ValenciaVGuides
 * @version 2.0.0
 * 
 * Proporciona funciones de validación para datos, mensajes y parámetros.
 */

import { TIPOS_MENSAJE, ERRORES } from './constants.js';

/**
 * Validadores disponibles por tipo
 * @type {Object<string, Function>}
 */
const validadores = {
    string: (valor) => typeof valor === 'string',
    number: (valor) => typeof valor === 'number' && !isNaN(valor),
    boolean: (valor) => typeof valor === 'boolean',
    array: (valor) => Array.isArray(valor),
    object: (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor),
    function: (valor) => typeof valor === 'function',
    
    // Validadores específicos
    email: (valor) => typeof valor === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor),
    url: (valor) => {
        try {
            new URL(valor);
            return true;
        } catch {
            return false;
        }
    },
    coordenadas: (valor) => {
        if (!valor || typeof valor !== 'object') return false;
        const { lat, lng, latitude, longitude } = valor;
        const latVal = lat !== undefined ? lat : latitude;
        const lngVal = lng !== undefined ? lng : longitude;
        return typeof latVal === 'number' && typeof lngVal === 'number' &&
               latVal >= -90 && latVal <= 90 &&
               lngVal >= -180 && lngVal <= 180;
    },
    tipoMensaje: (valor) => typeof valor === 'string' && Object.values(TIPOS_MENSAJE).includes(valor),
    idUnico: (valor) => typeof valor === 'string' && valor.length > 0 && /^[a-zA-Z0-9_-]+$/.test(valor),
    positivo: (valor) => typeof valor === 'number' && valor > 0,
    noNegativo: (valor) => typeof valor === 'number' && valor >= 0,
    noVacio: (valor) => {
        if (typeof valor === 'string') return valor.trim().length > 0;
        if (Array.isArray(valor)) return valor.length > 0;
        if (typeof valor === 'object' && valor !== null) return Object.keys(valor).length > 0;
        return valor !== null && valor !== undefined;
    }
};

/**
 * Valida un dato según su tipo esperado
 * @param {*} valor - Valor a validar
 * @param {string} tipo - Tipo esperado
 * @param {Object} [opciones] - Opciones adicionales
 * @param {boolean} [opciones.requerido=true] - Si el valor es requerido
 * @param {*} [opciones.defecto] - Valor por defecto si no pasa validación
 * @param {Function} [opciones.transformar] - Función para transformar el valor
 * @param {number} [opciones.min] - Valor mínimo (para números/strings/arrays)
 * @param {number} [opciones.max] - Valor máximo
 * @returns {Object} Resultado de validación { valido, valor, error }
 */
export function validarDato(valor, tipo, opciones = {}) {
    const { requerido = true, defecto, transformar, min, max } = opciones;
    
    // Verificar si está vacío
    const estaVacio = valor === null || valor === undefined || 
                      (typeof valor === 'string' && valor.trim() === '');
    
    if (estaVacio) {
        if (!requerido) {
            return {
                valido: true,
                valor: defecto !== undefined ? defecto : valor,
                error: null
            };
        }
        return {
            valido: false,
            valor,
            error: `El valor es requerido`
        };
    }
    
    // Obtener validador
    const validador = validadores[tipo];
    if (!validador) {
        return {
            valido: false,
            valor,
            error: `Tipo de validación desconocido: ${tipo}`
        };
    }
    
    // Validar tipo
    if (!validador(valor)) {
        return {
            valido: false,
            valor,
            error: `Se esperaba tipo "${tipo}"`
        };
    }
    
    // Validar min/max
    if (min !== undefined || max !== undefined) {
        let longitudValor;
        if (typeof valor === 'number') {
            longitudValor = valor;
        } else if (typeof valor === 'string' || Array.isArray(valor)) {
            longitudValor = valor.length;
        }
        
        if (longitudValor !== undefined) {
            if (min !== undefined && longitudValor < min) {
                return {
                    valido: false,
                    valor,
                    error: `El valor debe ser al menos ${min}`
                };
            }
            if (max !== undefined && longitudValor > max) {
                return {
                    valido: false,
                    valor,
                    error: `El valor debe ser como máximo ${max}`
                };
            }
        }
    }
    
    // Transformar si es necesario
    let valorFinal = valor;
    if (transformar && typeof transformar === 'function') {
        try {
            valorFinal = transformar(valor);
        } catch (e) {
            return {
                valido: false,
                valor,
                error: `Error al transformar valor: ${e.message}`
            };
        }
    }
    
    return {
        valido: true,
        valor: valorFinal,
        error: null
    };
}

/**
 * Valida un mensaje del sistema
 * @param {Object} mensaje - Mensaje a validar
 * @returns {Object} Resultado { valido, errores }
 */
export function validarMensaje(mensaje) {
    const errores = [];
    
    if (!mensaje || typeof mensaje !== 'object') {
        return { valido: false, errores: ['El mensaje debe ser un objeto'] };
    }
    
    // Validar tipo
    if (!mensaje.tipo) {
        errores.push('El mensaje debe tener un tipo');
    } else if (!validadores.tipoMensaje(mensaje.tipo)) {
        // Permitir tipos custom que empiecen con ciertos prefijos
        const prefijosPermitidos = ['CUSTOM_', 'TEST_', 'DEBUG_'];
        const esCustom = prefijosPermitidos.some(p => mensaje.tipo.startsWith(p));
        if (!esCustom) {
            errores.push(`Tipo de mensaje no reconocido: ${mensaje.tipo}`);
        }
    }
    
    // Validar timestamp
    if (mensaje.timestamp && typeof mensaje.timestamp !== 'number') {
        errores.push('El timestamp debe ser un número');
    }
    
    // Validar id si existe
    if (mensaje.id && typeof mensaje.id !== 'string') {
        errores.push('El id del mensaje debe ser un string');
    }
    
    return {
        valido: errores.length === 0,
        errores
    };
}

/**
 * Valida coordenadas geográficas
 * @param {Object} coords - Coordenadas a validar
 * @returns {Object} Resultado { valido, error, coordenadas }
 */
export function validarCoordenadas(coords) {
    if (!coords || typeof coords !== 'object') {
        return { valido: false, error: 'Coordenadas inválidas', coordenadas: null };
    }
    
    const lat = coords.lat !== undefined ? coords.lat : coords.latitude;
    const lng = coords.lng !== undefined ? coords.lng : coords.longitude;
    
    if (typeof lat !== 'number' || typeof lng !== 'number') {
        return { valido: false, error: 'Latitud y longitud deben ser números', coordenadas: null };
    }
    
    if (lat < -90 || lat > 90) {
        return { valido: false, error: 'Latitud fuera de rango (-90 a 90)', coordenadas: null };
    }
    
    if (lng < -180 || lng > 180) {
        return { valido: false, error: 'Longitud fuera de rango (-180 a 180)', coordenadas: null };
    }
    
    // Verificar que no sean coordenadas nulas (0,0)
    if (lat === 0 && lng === 0) {
        return { valido: false, error: 'Coordenadas en origen (posible error)', coordenadas: null };
    }
    
    return {
        valido: true,
        error: null,
        coordenadas: { lat, lng }
    };
}

/**
 * Valida los datos de una parada
 * @param {Object} parada - Parada a validar
 * @returns {Object} Resultado { valido, errores, parada }
 */
export function validarParada(parada) {
    const errores = [];
    
    if (!parada || typeof parada !== 'object') {
        return { valido: false, errores: ['La parada debe ser un objeto'], parada: null };
    }
    
    // ID es requerido
    if (!parada.id && !parada.ID && !parada.parada_id) {
        errores.push('La parada debe tener un ID');
    }
    
    // Coordenadas opcionales pero si existen deben ser válidas
    if (parada.coordenadas || parada.coords) {
        const validacionCoords = validarCoordenadas(parada.coordenadas || parada.coords);
        if (!validacionCoords.valido) {
            errores.push(`Coordenadas inválidas: ${validacionCoords.error}`);
        }
    }
    
    return {
        valido: errores.length === 0,
        errores,
        parada: errores.length === 0 ? parada : null
    };
}

/**
 * Valida un objeto según un schema
 * @param {Object} objeto - Objeto a validar
 * @param {Object} schema - Schema de validación
 * @returns {Object} Resultado { valido, errores, datos }
 */
export function validarSchema(objeto, schema) {
    const errores = [];
    const datos = {};
    
    if (!objeto || typeof objeto !== 'object') {
        return { valido: false, errores: ['Se esperaba un objeto'], datos: null };
    }
    
    for (const [campo, reglas] of Object.entries(schema)) {
        const valor = objeto[campo];
        const { tipo, requerido = true, defecto, min, max, validar: validadorCustom } = reglas;
        
        // Validación básica
        const resultado = validarDato(valor, tipo, { requerido, defecto, min, max });
        
        if (!resultado.valido) {
            errores.push(`${campo}: ${resultado.error}`);
        } else if (validadorCustom && typeof validadorCustom === 'function') {
            // Validador custom adicional
            const errorCustom = validadorCustom(resultado.valor);
            if (errorCustom) {
                errores.push(`${campo}: ${errorCustom}`);
            } else {
                datos[campo] = resultado.valor;
            }
        } else {
            datos[campo] = resultado.valor;
        }
    }
    
    return {
        valido: errores.length === 0,
        errores,
        datos: errores.length === 0 ? datos : null
    };
}

/**
 * Sanitiza un string para prevenir XSS
 * @param {string} str - String a sanitizar
 * @returns {string} String sanitizado
 */
export function sanitizarString(str) {
    if (typeof str !== 'string') return '';
    
    const mapa = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    
    return str.replace(/[&<>"'/]/g, char => mapa[char]);
}

/**
 * Sanitiza un objeto recursivamente
 * @param {Object} obj - Objeto a sanitizar
 * @returns {Object} Objeto sanitizado
 */
export function sanitizarObjeto(obj) {
    if (typeof obj === 'string') {
        return sanitizarString(obj);
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizarObjeto(item));
    }
    
    if (obj !== null && typeof obj === 'object') {
        const resultado = {};
        for (const [key, value] of Object.entries(obj)) {
            resultado[sanitizarString(key)] = sanitizarObjeto(value);
        }
        return resultado;
    }
    
    return obj;
}

/**
 * Registra un validador personalizado
 * @param {string} nombre - Nombre del validador
 * @param {Function} fn - Función validadora
 */
export function registrarValidador(nombre, fn) {
    if (typeof nombre !== 'string' || typeof fn !== 'function') {
        throw new Error('Nombre debe ser string y fn debe ser función');
    }
    validadores[nombre] = fn;
}

// Exponer para debugging
if (typeof window !== 'undefined') {
    window.__vv_validacion = {
        validarDato,
        validarMensaje,
        validarCoordenadas,
        validarParada,
        validarSchema,
        sanitizarString,
        sanitizarObjeto,
        registrarValidador
    };
}

export default {
    validarDato,
    validarMensaje,
    validarCoordenadas,
    validarParada,
    validarSchema,
    sanitizarString,
    sanitizarObjeto,
    registrarValidador
};
