/**
 * Utilidades generales para la aplicación
 * @module Utils
 * @version 1.2.0
 */

import logger from './logger.js';
import { CSS_CLASES, MODOS, ERRORES, TIPOS_MENSAJE } from './constants.js';
import { promesasPendientes } from './monitoreo.js';

// Proveer un fallback seguro para `registrarControlador` durante la
// evaluación del módulo. Algunos módulos registran controladores en
// top-level antes de que `mensajeria.js` esté totalmente inicializado
// (imports circulares). Para evitar `ReferenceError: registrarControlador is not defined`
// almacenamos las registraciones tempranas en `globalThis.__vv_manejadores`, que
// `mensajeria.js` migrará a su Map interno cuando se inicialice.
if (typeof registrarControlador === 'undefined') {
    try {
        if (!globalThis.__vv_manejadores) globalThis.__vv_manejadores = new Map();
    } catch (e) {
        // En entornos muy restringidos, aseguramos la existencia del objeto
        globalThis.__vv_manejadores = new Map();
    }

    /* eslint-disable no-var */
    var registrarControlador = function(tipo, callback) {
        if (!globalThis.__vv_manejadores) globalThis.__vv_manejadores = new Map();
        try {
            globalThis.__vv_manejadores.set(tipo, callback);
        } catch (err) {
            // No bloqueamos la evaluación si algo falla aquí
            console.warn('[UTILS] Fallback registrarControlador failed:', err);
        }
    };
    /* eslint-enable no-var */
}

/**
 * Clase personalizada para errores de la aplicación
 * @extends Error
 */
class AppError extends Error {
    /**
     * Crea un nuevo error de la aplicación
     * @param {string} message - Mensaje de error
     * @param {Object} options - Opciones adicionales
     * @param {number} options.codigo - Código de error
     * @param {string} options.nivel - Nivel de error (error, warning, info)
     * @param {Object} options.detalles - Detalles adicionales del error
     * @param {Error} options.causa - Error original que causó este error
     */
    constructor(message, { codigo = 0, nivel = 'error', detalles = null, causa = null } = {}) {
        super(message);
        this.name = this.constructor.name;
        this.codigo = codigo;
        this.nivel = nivel;
        this.detalles = detalles;
        this.causa = causa;
        this.timestamp = new Date().toISOString();
        
        // Mantener un stack trace adecuado
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    
    /**
     * Convierte el error a un objeto plano para registro
     * @returns {Object} Representación del error como objeto
     */
    toJSON() {
        return {
            nombre: this.name,
            mensaje: this.message,
            codigo: this.codigo,
            nivel: this.nivel,
            timestamp: this.timestamp,
            detalles: this.detalles,
            causa: this.causa ? {
                nombre: this.causa.name,
                mensaje: this.causa.message,
                stack: this.causa.stack
            } : null,
            stack: this.stack
        };
    }
}

/**
 * Wrapper for async functions to handle errors consistently
 * @param {Function} fn - The async function to wrap
 * @returns {Function} Wrapped function with error handling
 */
export function asyncHandler(fn) {
    return async function(...args) {
        try {
            return await fn(...args);
        } catch (error) {
            logger.error(`Error en ${fn.name || 'función asíncrona'}:`, error);
            
            // Add additional context to the error
            const contextualizedError = new Error(`Error en ${fn.name || 'función asíncrona'}: ${error.message}`);
            contextualizedError.originalError = error;
            contextualizedError.args = args;
            
            // Re-throw the error with added context
            throw contextualizedError;
        }
    };
}

/**
 * Validates the parameters against a schema
 * @param {Object} params - The parameters to validate
 * @param {Object} schema - The schema to validate against
 * @param {string} [context] - The context for error messages
 * @returns {Object} - Validation result with valido and error properties
 */
export function validarParametros(params, schema, context = '') {
    try {
        // Handle null or undefined params
        if (params === null || params === undefined) {
            return {
                valido: false,
                error: `${context ? context + ': ' : ''}Los parámetros no pueden ser null o undefined`
            };
        }
        
        // Validate each parameter against the schema
        for (const key in schema) {
            const fieldSchema = schema[key];
            let value = params[key];
            
            // If the field is required and missing
            if (fieldSchema.requerido && (value === undefined || value === null)) {
                return {
                    valido: false,
                    error: `${context ? context + ': ' : ''}Parámetro requerido faltante: ${key}`
                };
            }
            
            // If field is not required and missing, use default value if available
            if ((value === undefined || value === null) && !fieldSchema.requerido) {
                if ('valorPorDefecto' in fieldSchema) {
                    value = fieldSchema.valorPorDefecto;
                    params[key] = value; // Update the params object with the default value
                }
                continue; // Skip further validation for this field
            }
            
            // Check type if the value is defined
            if (value !== undefined && value !== null) {
                // Type validation
                const expectedType = fieldSchema.tipo;
                let actualType = typeof value;
                
                // Special handling for arrays
                if (Array.isArray(value)) {
                    actualType = 'array';
                }
                
                if (expectedType && actualType !== expectedType && 
                    !(expectedType === 'array' && Array.isArray(value))) {
                    return {
                        valido: false,
                        error: `${context ? context + ': ' : ''}Tipo inválido para ${key}, se esperaba ${expectedType} pero se recibió ${actualType}`
                    };
                }
                
                // Custom validation function
                if (fieldSchema.validar && typeof fieldSchema.validar === 'function') {
                    if (!fieldSchema.validar(value)) {
                        return {
                            valido: false,
                            error: `${context ? context + ': ' : ''}Validación personalizada fallida para ${key}`
                        };
                    }
                }
            }
        }
        
        return { valido: true };
    } catch (error) {
        return {
            valido: false,
            error: `${context ? context + ': ' : ''}Error durante la validación: ${error.message}`
        };
    }
}

/**
 * Maneja un error de manera consistente en toda la aplicación
 * @param {Error|string} error - Error a manejar o mensaje de error
 * @param {Object} options - Opciones adicionales
 * @param {string} options.context - Contexto donde ocurrió el error
 * @param {Object} options.detalles - Detalles adicionales del error
 * @param {string} options.nivel - Nivel de error (error, warning, info)
 * @param {Error} options.causa - Error original que causó este error
 * @throws {AppError} Siempre lanza un AppError
 */
export function manejarError(error, { context = '', detalles = null, nivel = 'error', causa = null } = {}) {
    let errorParaLanzar;
    
    // Si ya es un AppError, simplemente lo propagamos
    if (error instanceof AppError) {
        errorParaLanzar = error;
    } 
    // Si es un Error estándar, lo convertimos a AppError
    else if (error instanceof Error) {
        errorParaLanzar = new AppError(error.message, {
            causa: error,
            nivel,
            detalles: detalles || { stack: error.stack }
        });
    }
    // Si es un string, lo convertimos a Error
    else if (typeof error === 'string') {
        errorParaLanzar = new AppError(error, { nivel, detalles, causa });
    }
    // Cualquier otro caso
    else {
        errorParaLanzar = new AppError('Error desconocido', { 
            nivel: 'error', 
            detalles: { error: String(error) },
            causa: error
        });
    }
    
    // Añadir contexto si se proporciona
    if (context) {
        errorParaLanzar.contexto = context;
    }
    
    // Registrar el error según su nivel
    switch (errorParaLanzar.nivel) {
        case 'warning':
            logger.warn(`[${context}] ${errorParaLanzar.message}`, { error: errorParaLanzar.toJSON() });
            break;
        case 'info':
            logger.info(`[${context}] ${errorParaLanzar.message}`, { error: errorParaLanzar.toJSON() });
            break;
        case 'debug':
            logger.debug(`[${context}] ${errorParaLanzar.message}`, { error: errorParaLanzar.toJSON() });
            break;
        default: // error
            logger.error(`[${context}] ${errorParaLanzar.message}`, { error: errorParaLanzar.toJSON() });
    }
    
    // Lanzar el error para que pueda ser manejado por el llamador
    throw errorParaLanzar;
}

/**
 * Crea un error de validación
 * @param {string} tipo - Tipo de error de validación (ej: 'DATOS_INVALIDOS')
 * @param {Object} [detalles] - Detalles adicionales del error
 * @param {string} [context] - Contexto donde ocurrió el error
 * @throws {AppError} Error de validación
 */
export function errorValidacion(tipo, detalles = null, context = '') {
    const errorInfo = ERRORES.VALIDACION[tipo] || {
        codigo: 1000,
        mensaje: 'Error de validación',
        nivel: 'error'
    };
    
    throw new AppError(errorInfo.mensaje, {
        codigo: errorInfo.codigo,
        nivel: errorInfo.nivel || 'error',
        detalles: { ...detalles, tipoError: tipo },
        context
    });
}

/**
 * Sanitiza datos de entrada en mensajes, removiendo scripts y caracteres peligrosos
 * @param {any} entrada - Datos a sanitizar
 * @returns {any} Datos sanitizados
 */
export function sanitizarEntrada(entrada) {
    if (typeof entrada === 'string') {
        return entrada
            // Remover scripts
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            // Remover iframes
            .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
            // Remover otros tags peligrosos
            .replace(/<(embed|object|applet|meta|link|style)[^>]*>.*?<\/\1>/gi, '')
            // Remover javascript: protocol
            .replace(/javascript:/gi, '')
            // Remover data: protocol (puede contener scripts)
            .replace(/data:text\/html/gi, '')
            // Remover event handlers
            .replace(/on\w+\s*=/gi, '')
            // Remover expresiones eval
            .replace(/eval\s*\(/gi, '')
            // Remover import statements
            .replace(/import\s*\(/gi, '')
            // Limpiar caracteres de control
            .replace(/[\x00-\x1F\x7F]/g, '');
    }
    
    if (Array.isArray(entrada)) {
        return entrada.map(item => sanitizarEntrada(item));
    }
    
    if (entrada && typeof entrada === 'object') {
        const resultado = {};
        for (const [key, value] of Object.entries(entrada)) {
            // Sanitizar tanto la clave como el valor
            const keySanitizada = typeof key === 'string' ? sanitizarEntrada(key) : key;
            resultado[keySanitizada] = sanitizarEntrada(value);
        }
        return resultado;
    }
    
    return entrada;
}

/**
 * Genera un ID único basado en la fecha y un valor aleatorio.
 * @returns {string} ID único.
 */
export function generarIdUnico() {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Normaliza un objeto de parada/tramo a la forma canónica usada por la app.
 * - No muta el objeto original; devuelve una copia o `null` si es inválido.
 * - Deriva `id` a partir de `id || parada_id || tramo_id || padreid`.
 * - Conserva los campos originales y añade `_normalizado: true`.
 * @param {any} item - Objeto potencial de parada/tramo
 * @returns {Object|null} Objeto normalizado o null si no es válido
 */
export function normalizarParada(item) {
    try {
        if (!item || typeof item !== 'object') return null;

        // Derivar id canónico
        let id = null;
        if (typeof item.id === 'string' && item.id.trim() !== '') id = item.id.trim();
        else if (typeof item.parada_id === 'string' && item.parada_id.trim() !== '') id = item.parada_id.trim();
        else if (typeof item.tramo_id === 'string' && item.tramo_id.trim() !== '') id = item.tramo_id.trim();
        else if (typeof item.padreid === 'string' && item.padreid.trim() !== '') {
            // eliminar prefijo 'padre-' si existe
            id = item.padreid.trim().replace(/^padre-/, '');
        }

        if (!id) {
            // No hay id derivable, considerar inválido
            logger.warn('[UTILS] normalizarParada: elemento sin id derivable, será descartado', item);
            return null;
        }

        const tipo = item.tipo || (item.tramo_id ? 'tramo' : (item.parada_id ? 'parada' : undefined));

        // Normalizar coordenadas si se encuentran en campos latitud/longitud
        const salida = Object.assign({}, item);
        salida.id = id;
        if (!salida.tipo && tipo) salida.tipo = tipo;

        if ((salida.latitud !== undefined && salida.longitud !== undefined) &&
            (!salida.lat || !salida.lng)) {
            const lat = Number(salida.latitud);
            const lng = Number(salida.longitud);
            if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                salida.lat = lat;
                salida.lng = lng;
            }
        }

        salida._normalizado = true;
        return salida;
    } catch (error) {
        logger.error('[UTILS] normalizarParada: error normalizando elemento', error, item);
        return null;
    }
}

/**
 * Normaliza un array de paradas/tramos. Devuelve array con elementos válidos.
 * @param {any} arr - Array potencial de paradas
 * @returns {Array} Array normalizado (vacío si entrada inválida)
 */
export function normalizarParadas(arr) {
    try {
        if (!Array.isArray(arr)) {
            logger.warn('[UTILS] normalizarParadas: entrada no es un array');
            return [];
        }

        const resultado = [];
        let descartados = 0;
        for (let i = 0; i < arr.length; i++) {
            const n = normalizarParada(arr[i]);
            if (n) resultado.push(n);
            else {
                descartados += 1;
                logger.debug('[UTILS] normalizarParadas: elemento descartado en índice', i);
            }
        }

        // Deduplicar por id (mantener primer encuentro)
        const vistos = new Set();
        const dedup = [];
        for (const el of resultado) {
            if (vistos.has(el.id)) continue;
            vistos.add(el.id);
            dedup.push(el);
        }

        // Emitir evento con número de elementos descartados para monitoreo (si aplica)
        try {
            if (typeof window !== 'undefined' && window && typeof window.dispatchEvent === 'function' && descartados > 0) {
                window.dispatchEvent(new CustomEvent('vv:paradas:descartadas', { detail: { descartadas: descartados } }));
            }
        } catch (err) {
            logger.debug('[UTILS] normalizarParadas: no se pudo emitir evento de descartes', err);
        }

        return dedup;
    } catch (error) {
        logger.error('[UTILS] normalizarParadas: error procesando array', error);
        return [];
    }
}

// ============================================================
// CONTROLADORES DE MENSAJERÍA UI
// ============================================================

/**
 * Maneja las notificaciones del usuario en la interfaz.
 * Este controlador gestiona la visualización de mensajes de notificación al usuario,
 * incluyendo mensajes informativos, de éxito, advertencias y errores.
 * 
 * @param {Object} mensaje - Mensaje recibido
 * @param {string} mensaje.origen - Origen del mensaje
 * @param {Object} mensaje.datos - Datos de la notificación
 * @param {string} mensaje.datos.titulo - Título de la notificación
 * @param {string} mensaje.datos.mensaje - Contenido del mensaje
 * @param {string} [mensaje.datos.tipo='info'] - Tipo de notificación (info, exito, advertencia, error)
 * @param {number} [mensaje.datos.duracion=5000] - Duración en milisegundos (0 para permanente)
 * @param {Array} [mensaje.datos.acciones=[]] - Acciones disponibles como botones
 * @param {boolean} [mensaje.datos.cerrable=true] - Si la notificación puede ser cerrada por el usuario
 * @param {string} [mensaje.datos.id] - ID único para notificaciones actualizables
 * @param {boolean} [mensaje.datos.reemplazar=false] - Si es true, reemplaza notificaciones con el mismo ID
 * @param {string} [mensaje.mensajeId] - ID único del mensaje para seguimiento
 * @returns {Promise<void>}
 */
registrarControlador(TIPOS_MENSAJE.UI.NOTIFICACION, async (mensaje) => {
    const logPrefix = `[UI.NOTIFICACION][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            logger.warn(`${logPrefix} Mensaje sin origen, ignorando notificación`);
            return;
        }

        const { 
            titulo, 
            mensaje: contenido, 
            tipo = 'info', 
            duracion = 5000, 
            acciones = [],
            cerrable = true,
            id = generarIdUnico(),
            reemplazar = false,
            metadata = {}
        } = mensaje.datos || {};

        // 2. Validar parámetros requeridos
        if (!contenido) {
            const errorMsg = 'Falta el contenido del mensaje de notificación';
            logger.warn(`${logPrefix} ${errorMsg}`);
            
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp,
                datos: {
                    codigo: 'PARAMETROS_INVALIDOS',
                    mensaje: errorMsg,
                    detalles: {
                        parametrosRequeridos: ['mensaje'],
                        parametrosRecibidos: Object.keys(mensaje.datos || {})
                    },
                    severidad: 'advertencia'
                }
            });
            return;
        }

        // 3. Validar tipo de notificación
        const tiposValidos = ['info', 'exito', 'advertencia', 'error', 'carga'];
        if (!tiposValidos.includes(tipo)) {
            const errorMsg = `Tipo de notificación no válido: ${tipo}`;
            logger.warn(`${logPrefix} ${errorMsg}`, { tipo, tiposValidos });
            
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp,
                datos: {
                    codigo: 'TIPO_INVALIDO',
                    mensaje: errorMsg,
                    detalles: {
                        tipoRecibido: tipo,
                        tiposValidos
                    },
                    severidad: 'advertencia'
                }
            });
            return;
        }

        // 4. Validar acciones
        const accionesValidadas = [];
        if (Array.isArray(acciones)) {
            for (const [index, accion] of acciones.entries()) {
                if (typeof accion === 'string') {
                    accionesValidadas.push({
                        id: `accion-${index}`,
                        texto: accion,
                        tipo: 'default'
                    });
                } else if (accion && typeof accion === 'object' && accion.texto) {
                    accionesValidadas.push({
                        id: accion.id || `accion-${index}`,
                        texto: accion.texto,
                        tipo: accion.tipo || 'default',
                        icono: accion.icono,
                        peligroso: accion.peligroso || false,
                        datos: accion.datos
                    });
                }
            }
        }

        // 5. Crear objeto de notificación
        const notificacion = {
            id,
            titulo,
            mensaje: contenido,
            tipo,
            duracion: Math.max(0, parseInt(duracion, 10) || 5000),
            acciones: accionesValidadas,
            cerrable,
            timestamp,
            origen: mensaje.origen,
            metadata: {
                ...metadata,
                mensajeOriginalId: mensajeId
            }
        };

        // 6. Registrar evento de notificación
        registrarEvento('MOSTRAR_NOTIFICACION', {
            id,
            tipo,
            origen: mensaje.origen,
            duracion: notificacion.duracion,
            tieneAcciones: accionesValidadas.length > 0
        });

        // 7. Enviar notificación al sistema de UI (hijo1)
        try {
            // 7.1. Verificar si ya existe una notificación con el mismo ID
            if (reemplazar) {
                await enviarMensaje({
                    destino: 'hijo1',
                    tipo: TIPOS_MENSAJE.UI.NOTIFICACION,
                    origen: 'sistema',
                    mensajeId: generarIdUnico(),
                    mensajeOriginalId: mensajeId,
                    timestamp,
                    datos: {
                        accion: 'reemplazar',
                        id,
                        notificacion
                    }
                });
            } else {
                await enviarMensaje({
                    destino: 'hijo1',
                    tipo: TIPOS_MENSAJE.UI.NOTIFICACION,
                    origen: 'sistema',
                    mensajeId: generarIdUnico(),
                    mensajeOriginalId: mensajeId,
                    timestamp,
                    datos: {
                        accion: 'mostrar',
                        notificacion
                    }
                });
            }

            // 7.2. Confirmación al emisor original
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp,
                datos: {
                    accion: 'NOTIFICACION_MOSTRADA',
                    id,
                    timestamp,
                    detalles: {
                        duracion: notificacion.duracion
                    }
                }
            });

            logger.info(`${logPrefix} Notificación mostrada: ${titulo || 'Sin título'}`, {
                tipo,
                duracion: notificacion.duracion,
                id,
                tieneAcciones: accionesValidadas.length > 0
            });

        } catch (error) {
            const errorProcesamiento = `Error al mostrar la notificación: ${error.message}`;
            logger.error(`${logPrefix} ${errorProcesamiento}`, error);
            
            // Notificar el error al emisor original
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp: Date.now(),
                datos: {
                    codigo: 'ERROR_MOSTRAR_NOTIFICACION',
                    mensaje: 'No se pudo mostrar la notificación',
                    detalles: error.message,
                    id,
                    severidad: 'error'
                }
            });
        }

    } catch (error) {
        const errorNoManejado = `Error no manejado en UI.NOTIFICACION: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar el error al emisor original si es posible
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    mensajeId: generarIdUnico(),
                    mensajeOriginalId: mensajeId,
                    timestamp: Date.now(),
                    datos: {
                        codigo: 'ERROR_INTERNO',
                        mensaje: 'Error interno al procesar la notificación',
                        detalles: error.message,
                        severidad: 'error',
                        stack: error.stack
                    }
                });
            }
        } catch (errorNotificacion) {
            logger.error(`${logPrefix} Error al notificar error: ${errorNotificacion.message}`, errorNotificacion);
        }
    }
});

/**
 * Maneja los diálogos modales en la interfaz de usuario.
 * Este controlador gestiona la visualización y control de ventanas modales,
 * incluyendo confirmaciones, formularios y contenido personalizado.
 * 
 * @param {Object} mensaje - Mensaje recibido
 * @param {string} mensaje.origen - Origen del mensaje
 * @param {Object} mensaje.datos - Datos del modal
 * @param {string} mensaje.datos.tipo - Tipo de modal (confirmacion, formulario, personalizado, etc.)
 * @param {string} mensaje.datos.titulo - Título del modal
 * @param {string|Object} mensaje.datos.contenido - Contenido del modal (texto o componente)
 * @param {Array} [mensaje.datos.acciones=[]] - Acciones disponibles en el modal
 * @param {Object} [mensaje.datos.config={}] - Configuración adicional del modal
 * @param {string} [mensaje.mensajeId] - ID único del mensaje para seguimiento
 * @returns {Promise<void>}
 */
registrarControlador(TIPOS_MENSAJE.UI.MODAL, async (mensaje) => {
    const logPrefix = `[UI.MODAL][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje.mensajeId || generarIdUnico();
    const modalId = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            logger.warn(`${logPrefix} Mensaje sin origen, ignorando solicitud de modal`);
            return;
        }

        const { 
            tipo = 'informacion',
            titulo = '',
            contenido = '',
            acciones = [],
            config = {},
            datos = {}
        } = mensaje.datos || {};

        // 2. Validar parámetros requeridos
        if (!contenido && !acciones.length) {
            const errorMsg = 'El modal debe tener contenido o al menos una acción';
            logger.warn(`${logPrefix} ${errorMsg}`);
            
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp,
                datos: {
                    codigo: 'PARAMETROS_INVALIDOS',
                    mensaje: errorMsg,
                    detalles: {
                        parametrosRequeridos: ['contenido o acciones'],
                        parametrosRecibidos: Object.keys(mensaje.datos || {})
                    },
                    severidad: 'advertencia'
                }
            });
            return;
        }

        // 3. Validar tipo de modal
        const tiposValidos = ['informacion', 'confirmacion', 'formulario', 'personalizado', 'error', 'advertencia', 'exito'];
        if (!tiposValidos.includes(tipo)) {
            const errorMsg = `Tipo de modal no válido: ${tipo}`;
            logger.warn(`${logPrefix} ${errorMsg}`, { tipo, tiposValidos });
            
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp,
                datos: {
                    codigo: 'TIPO_INVALIDO',
                    mensaje: errorMsg,
                    detalles: {
                        tipoRecibido: tipo,
                        tiposValidos
                    },
                    severidad: 'advertencia'
                }
            });
            return;
        }

        // 4. Validar y formatear acciones
        const accionesValidadas = [];
        if (Array.isArray(acciones)) {
            for (const [index, accion] of acciones.entries()) {
                if (typeof accion === 'string') {
                    accionesValidadas.push({
                        id: `accion-${index}`,
                        texto: accion,
                        tipo: 'secundario',
                        cierra: true,
                        datos: {}
                    });
                } else if (accion && typeof accion === 'object' && accion.texto) {
                    accionesValidadas.push({
                        id: accion.id || `accion-${index}`,
                        texto: accion.texto,
                        tipo: accion.tipo || 'secundario',
                        cierra: accion.cierra !== false, // Por defecto cierra el modal
                        icono: accion.icono,
                        peligroso: accion.peligroso || false,
                        deshabilitado: accion.deshabilitado || false,
                        datos: accion.datos || {}
                    });
                }
            }
        }

        // 5. Configuración por defecto del modal
        const configuracion = {
            cerrable: config.cerrable !== false, // Por defecto es cerrable
            cerrarConEscape: config.cerrarConEscape !== false, // Por defecto se cierra con Escape
            cerrarAlHacerClickAfuera: config.cerrarAlHacerClickAfuera !== false, // Por defecto se cierra al hacer click fuera
            tamaño: config.tamaño || 'medio', // 'pequeño', 'medio', 'grande', 'completo'
            estilo: config.estilo || {}, // Estilos CSS personalizados
            ...config
        };

        // 6. Crear objeto de modal
        const modal = {
            id: modalId,
            tipo,
            titulo,
            contenido,
            acciones: accionesValidadas,
            config: configuracion,
            datos,
            timestamp,
            origen: mensaje.origen,
            metadata: {
                mensajeOriginalId: mensajeId,
                ...(config.metadata || {})
            }
        };

        // 7. Registrar evento de apertura de modal
        registrarEvento('MOSTRAR_MODAL', {
            id: modalId,
            tipo,
            origen: mensaje.origen,
            tieneAcciones: accionesValidadas.length > 0,
            config: configuracion
        });

        // 8. Enviar comando para mostrar el modal al sistema de UI (hijo1)
        try {
            await enviarMensaje({
                destino: 'hijo1',
                tipo: TIPOS_MENSAJE.UI.MODAL,
                origen: 'sistema',
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp,
                datos: {
                    accion: 'mostrar',
                    modal
                }
            });

            // 9. Confirmación al emisor original
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp,
                datos: {
                    accion: 'MOSTRAR_MODAL',
                    id: modalId,
                    tipo,
                    timestamp,
                    detalles: {
                        tieneContenido: !!contenido,
                        numAcciones: accionesValidadas.length
                    }
                }
            });

            logger.info(`${logPrefix} Modal mostrado: ${titulo || 'Sin título'}`, {
                tipo,
                id: modalId,
                tieneContenido: !!contenido,
                numAcciones: accionesValidadas.length
            });

        } catch (error) {
            const errorProcesamiento = `Error al mostrar el modal: ${error.message}`;
            logger.error(`${logPrefix} ${errorProcesamiento}`, error);
            
            // Notificar el error al emisor original
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp: Date.now(),
                datos: {
                    codigo: 'ERROR_MOSTRAR_MODAL',
                    mensaje: 'No se pudo mostrar el modal',
                    detalles: error.message,
                    id: modalId,
                    severidad: 'error',
                    stack: error.stack
                }
            });
        }

    } catch (error) {
        const errorNoManejado = `Error no manejado en UI.MODAL: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar el error al emisor original si es posible
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    mensajeId: generarIdUnico(),
                    mensajeOriginalId: mensajeId,
                    timestamp: Date.now(),
                    datos: {
                        codigo: 'ERROR_INTERNO',
                        mensaje: 'Error interno al procesar la solicitud de modal',
                        detalles: error.message,
                        severidad: 'error',
                        stack: error.stack
                    }
                });
            }
        } catch (errorNotificacion) {
            logger.error(`${logPrefix} Error al notificar error: ${errorNotificacion.message}`, errorNotificacion);
        }
    }
});

/**
 * Maneja las interacciones del usuario con los modales.
 * @private
 * @param {Object} interaccion - Datos de la interacción
 * @param {string} interaccion.id - ID del modal
 * @param {string} interaccion.accion - Tipo de interacción ('cerrar', 'confirmar', 'accion')
 * @param {string} [interaccion.accionId] - ID de la acción si aplica
 * @param {Object} [interaccion.datos] - Datos adicionales de la interacción
 */
async function manejarInteraccionModal(interaccion) {
    const { id, accion, accionId, datos = {} } = interaccion;
    const logPrefix = `[UI.MODAL][INTERACCION][${id}]`;
    
    try {
        // Registrar la interacción
        registrarEvento('INTERACCION_MODAL', {
            id,
            accion,
            accionId,
            timestamp: Date.now(),
            datos
        });

        // Si hay un origen, notificar la interacción
        if (datos.origen) {
            await enviarMensaje({
                destino: datos.origen,
                tipo: TIPOS_MENSAJE.UI.ACCION_USUARIO,
                mensajeId: generarIdUnico(),
                timestamp: Date.now(),
                datos: {
                    tipo: 'MODAL_INTERACCION',
                    modalId: id,
                    accion,
                    accionId,
                    datos: datos.datosAccion || {}
                }
            });
        }

        logger.debug(`${logPrefix} Interacción registrada`, { accion, accionId });
    } catch (error) {
        logger.error(`${logPrefix} Error al procesar interacción: ${error.message}`, error);
    }
}

// Mantén solo la limpieza de utilidades propias
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        try {
            // Limpiar configuración
            if (window.Config) delete window.Config;
            
            logger.info('Limpieza agresiva de globales de utilidades completada');
        } catch (error) {
            // Logging mínimo durante pagehide para evitar errores
            console.warn('Error en limpieza agresiva de utilidades:', error.message);
        }
    });
}

// ============================================
// ===== CONTROLADOR UI.ACCION_USUARIO =====
// ============================================

/**
 * Maneja las interacciones del usuario con las alertas.
 * @private
 * @param {Object} interaccion - Datos de la interacción
 * @param {string} interaccion.id - ID de la alerta
 * @param {string} interaccion.accion - Tipo de interacción
 * @param {string} [interaccion.accionId] - ID de la acción si aplica
 * @param {Object} [interaccion.datos] - Datos adicionales de la interacción
 */
async function manejarInteraccionAlerta(interaccion) {
    const { id, accion, accionId, datos = {} } = interaccion;
    const logPrefix = `[UI.ALERTA][INTERACCION][${id}]`;
    
    try {
        // Registrar la interacción
        registrarEvento('INTERACCION_ALERTA', {
            id,
            accion,
            accionId,
            timestamp: Date.now(),
            datos
        });

        // Si hay un origen, notificar la interacción
        if (datos.origen) {
            await enviarMensaje({
                destino: datos.origen,
                tipo: TIPOS_MENSAJE.UI.ACCION_USUARIO,
                mensajeId: generarIdUnico(),
                timestamp: Date.now(),
                datos: {
                    tipo: 'ALERTA_INTERACCION',
                    alertaId: id,
                    accion,
                    accionId,
                    datos: datos.datosAccion || {}
                }
            });
        }

        logger.debug(`${logPrefix} Interacción registrada`, { accion, accionId });
    } catch (error) {
        logger.error(`${logPrefix} Error al procesar interacción: ${error.message}`, error);
    }
}

/**
 * Maneja las interacciones del usuario con las notificaciones.
 * @private
 * @param {Object} interaccion - Datos de la interacción
 * @param {string} interaccion.id - ID de la notificación
 * @param {string} interaccion.accion - Tipo de interacción ('cerrar', 'click', 'accion')
 * @param {string} [interaccion.accionId] - ID de la acción si aplica
 * @param {Object} [interaccion.datos] - Datos adicionales de la interacción
 */
async function manejarInteraccionNotificacion(interaccion) {
    const { id, accion, accionId, datos = {} } = interaccion;
    const logPrefix = `[UI.NOTIFICACION][INTERACCION][${id}]`;
    
    try {
        // Registrar la interacción
        registrarEvento('INTERACCION_NOTIFICACION', {
            id,
            accion,
            accionId,
            timestamp: Date.now()
        });

        // Si hay una acción específica, notificar al origen original
        if (accion === 'accion' && datos.origen) {
            await enviarMensaje({
                destino: datos.origen,
                tipo: TIPOS_MENSAJE.UI.ACCION_USUARIO,
                mensajeId: generarIdUnico(),
                timestamp: Date.now(),
                datos: {
                    tipo: 'NOTIFICACION_ACCION',
                    notificacionId: id,
                    accionId,
                    datos: datos.datosAccion || {}
                }
            });
        }

        logger.debug(`${logPrefix} Interacción registrada`, { accion, accionId });
    } catch (error) {
        logger.error(`${logPrefix} Error al procesar interacción: ${error.message}`, error);
    }
}

/**
 * Controlador consolidado para todas las acciones de usuario.
 * Maneja diferentes tipos de interacciones del usuario con la interfaz.
 * @param {Object} mensaje - Mensaje de acción de usuario
 * @param {Object} mensaje.datos - Datos de la acción
 * @param {string} mensaje.datos.tipo - Tipo de acción (MODAL_INTERACCION, ALERTA_INTERACCION, NOTIFICACION_INTERACCION)
 * @param {string} mensaje.datos.accion - Tipo de acción alternativo para compatibilidad (mostrar-imagen, reproducir-video, etc.)
 */
registrarControlador(TIPOS_MENSAJE.UI.ACCION_USUARIO, async (mensaje) => {
    const { tipo, accion } = mensaje.datos || {};
    
    // Usar tipo primero, luego accion para compatibilidad
    const tipoAccion = tipo || accion;
    
    console.log('🔥 [UTILS][UI.ACCION_USUARIO] MENSAJE RECIBIDO:', mensaje);
    console.log('🔥 [UTILS][UI.ACCION_USUARIO] TIPO/ACCION:', tipoAccion);
    
    try {
        switch (tipoAccion) {
            case 'MODAL_INTERACCION':
                await manejarInteraccionModal(mensaje.datos);
                break;
            case 'ALERTA_INTERACCION':
                await manejarInteraccionAlerta(mensaje.datos);
                break;
            case 'NOTIFICACION_INTERACCION':
                await manejarInteraccionNotificacion(mensaje.datos);
                break;
            case 'mostrar-imagen':
                console.log('🔥 [UTILS][UI.ACCION_USUARIO] EJECUTANDO mostrar-imagen');
                await manejarMostrarImagen(mensaje.datos);
                break;
            case 'reproducir-video':
                console.log('🔥 [UTILS][UI.ACCION_USUARIO] EJECUTANDO reproducir-video');
                await manejarReproducirVideo(mensaje.datos);
                break;
            case 'backdrop_click':
                console.log('🔥 [UTILS][UI.ACCION_USUARIO] EJECUTANDO backdrop_click');
                if (typeof window.ocultarHijo4 === 'function') {
                    window.ocultarHijo4();
                }
                break;
            default:
                logger.warn(`[UI.ACCION_USUARIO] Tipo de acción desconocido: ${tipoAccion}`);
        }
    } catch (error) {
        logger.error(`[UI.ACCION_USUARIO] Error al procesar acción: ${error.message}`, error);
    }
});

/**
 * Maneja la acción de mostrar imagen
 */
async function manejarMostrarImagen(datos) {
    const { paradaActual, urlImagen, nombre, sinContenido, mensajeError } = datos || {};
    
    console.log('🔥 [UTILS][MOSTRAR_IMAGEN] Datos recibidos:', {
        paradaActual,
        urlImagen,
        nombre,
        sinContenido,
        mensajeError
    });
    
    try {
        if (typeof window.mostrarImagenOverlay === 'function') {
            if (sinContenido) {
                console.log('🔥 [UTILS][MOSTRAR_IMAGEN] Llamando con mensaje de error');
                window.mostrarImagenOverlay(null, nombre || `Imagen ${paradaActual}`, mensajeError);
            } else {
                console.log('🔥 [UTILS][MOSTRAR_IMAGEN] Llamando con imagen:', urlImagen);
                window.mostrarImagenOverlay(urlImagen, nombre || `Imagen ${paradaActual}`);
            }
        } else {
            console.error('🔥 [UTILS][MOSTRAR_IMAGEN] window.mostrarImagenOverlay no está disponible');
        }
    } catch (error) {
        console.error('🔥 [UTILS][MOSTRAR_IMAGEN] Error:', error);
    }
}

/**
 * Maneja la acción de reproducir video
 */
async function manejarReproducirVideo(datos) {
    const { paradaActual, urlVideo, nombre, sinContenido, mensajeError } = datos || {};
    
    console.log('🔥 [UTILS][REPRODUCIR_VIDEO] Datos recibidos:', {
        paradaActual,
        urlVideo,
        nombre,
        sinContenido,
        mensajeError
    });
    
    try {
        if (typeof window.mostrarVideoOverlay === 'function') {
            if (sinContenido) {
                console.log('🔥 [UTILS][REPRODUCIR_VIDEO] Llamando con mensaje de error');
                window.mostrarVideoOverlay(null, nombre || `Video ${paradaActual}`, mensajeError);
            } else {
                console.log('🔥 [UTILS][REPRODUCIR_VIDEO] Llamando con video:', urlVideo);
                window.mostrarVideoOverlay(urlVideo, nombre || `Video ${paradaActual}`);
            }
        } else {
            console.error('🔥 [UTILS][REPRODUCIR_VIDEO] window.mostrarVideoOverlay no está disponible');
        }
    } catch (error) {
        console.error('🔥 [UTILS][REPRODUCIR_VIDEO] Error:', error);
    }
}

// ============================================
// ===== CONTROLADOR UI.ALERTA =====
// ============================================

/**
 * Maneja las alertas del usuario en la interfaz.
 * Este controlador gestiona la visualización de mensajes de alerta al usuario,
 * diseñados para mensajes importantes que requieren atención inmediata.
 * 
 * @param {Object} mensaje - Mensaje recibido
 * @param {string} mensaje.origen - Origen del mensaje
 * @param {Object} mensaje.datos - Datos de la alerta
 * @param {string} mensaje.datos.titulo - Título de la alerta
 * @param {string} mensaje.datos.mensaje - Contenido del mensaje de alerta
 * @param {string} [mensaje.datos.tipo='advertencia'] - Tipo de alerta (exito, informacion, advertencia, error)
 * @param {Array} [mensaje.datos.acciones=['Aceptar']] - Texto de los botones de acción
 * @param {boolean} [mensaje.datos.cerrable=true] - Si la alerta puede ser cerrada por el usuario
 * @param {number} [mensaje.datos.timeout=0] - Tiempo en ms para cierre automático (0 = no se cierra automáticamente)
 * @param {string} [mensaje.mensajeId] - ID único del mensaje para seguimiento
 * @returns {Promise<void>}
 */
registrarControlador(TIPOS_MENSAJE.UI.ALERTA, async (mensaje) => {
    const logPrefix = `[UI.ALERTA][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje.mensajeId || generarIdUnico();
    const alertaId = `alerta-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            logger.warn(`${logPrefix} Mensaje sin origen, ignorando alerta`);
            return;
        }

        const { 
            titulo = 'Atención',
            mensaje: contenido = '',
            tipo = 'advertencia',
            acciones = ['Aceptar'],
            cerrable = true,
            timeout = 0,
            datos = {}
        } = mensaje.datos || {};

        // 2. Validar parámetros requeridos
        if (!contenido) {
            const errorMsg = 'Falta el contenido del mensaje de alerta';
            logger.warn(`${logPrefix} ${errorMsg}`);
            
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp,
                datos: {
                    codigo: 'PARAMETROS_INVALIDOS',
                    mensaje: errorMsg,
                    detalles: {
                        parametrosRequeridos: ['mensaje'],
                        parametrosRecibidos: Object.keys(mensaje.datos || {})
                    },
                    severidad: 'advertencia'
                }
            });
            return;
        }

        // 3. Validar tipo de alerta
        const tiposValidos = ['exito', 'informacion', 'advertencia', 'error'];
        if (!tiposValidos.includes(tipo)) {
            const errorMsg = `Tipo de alerta no válido: ${tipo}`;
            logger.warn(`${logPrefix} ${errorMsg}`, { tipo, tiposValidos });
            
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp,
                datos: {
                    codigo: 'TIPO_INVALIDO',
                    mensaje: errorMsg,
                    detalles: {
                        tipoRecibido: tipo,
                        tiposValidos
                    },
                    severidad: 'advertencia'
                }
            });
            return;
        }

        // 4. Validar y formatear acciones
        const accionesValidadas = [];
        if (Array.isArray(acciones)) {
            acciones.forEach((accion, index) => {
                if (typeof accion === 'string') {
                    accionesValidadas.push({
                        id: `accion-${index}`,
                        texto: accion,
                        tipo: tipo === 'error' ? 'peligroso' : 'primario',
                        valorPorDefecto: index === 0
                    });
                } else if (accion && typeof accion === 'object') {
                    accionesValidadas.push({
                        id: accion.id || `accion-${index}`,
                        texto: accion.texto || `Acción ${index + 1}`,
                        tipo: accion.tipo || (tipo === 'error' ? 'peligroso' : 'primario'),
                        valorPorDefecto: accion.valorPorDefecto !== undefined ? accion.valorPorDefecto : index === 0,
                        icono: accion.icono,
                        deshabilitado: accion.deshabilitado || false,
                        datos: accion.datos || {}
                    });
                }
            });
        }

        // Si no hay acciones, agregar una por defecto
        if (accionesValidadas.length === 0) {
            accionesValidadas.push({
                id: 'aceptar',
                texto: 'Aceptar',
                tipo: 'primario',
                valorPorDefecto: true
            });
        }

        // 5. Crear objeto de alerta
        const alerta = {
            id: alertaId,
            titulo,
            mensaje: contenido,
            tipo,
            acciones: accionesValidadas,
            cerrable,
            timeout: Math.max(0, parseInt(timeout, 10) || 0),
            timestamp,
            origen: mensaje.origen,
            metadata: {
                mensajeOriginalId: mensajeId,
                ...(datos.metadata || {})
            },
            datos: {
                ...datos,
                metadata: undefined // No incluir metadata dos veces
            }
        };

        // 6. Registrar evento de alerta
        registrarEvento('MOSTRAR_ALERTA', {
            id: alertaId,
            tipo,
            origen: mensaje.origen,
            tieneAcciones: accionesValidadas.length > 0,
            timeout: alerta.timeout
        });

        // 7. Enviar comando para mostrar la alerta al sistema de UI (hijo1)
        try {
            await enviarMensaje({
                destino: 'hijo1',
                tipo: TIPOS_MENSAJE.UI.ALERTA,
                origen: 'sistema',
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp,
                datos: {
                    accion: 'mostrar',
                    alerta
                }
            });

            // 8. Si hay un timeout configurado, programar el cierre automático
            if (alerta.timeout > 0) {
                setTimeout(async () => {
                    try {
                        await enviarMensaje({
                            destino: 'hijo1',
                            tipo: TIPOS_MENSAJE.UI.ALERTA,
                            origen: 'sistema',
                            mensajeId: generarIdUnico(),
                            timestamp: Date.now(),
                            datos: {
                                accion: 'cerrar',
                                id: alertaId,
                                razon: 'timeout',
                                accionSeleccionada: accionesValidadas.find(a => a.valorPorDefecto)?.id
                            }
                        });

                        // Notificar al origen que la alerta se cerró por timeout
                        if (mensaje?.origen) {
                            await enviarMensaje({
                                destino: mensaje.origen,
                                tipo: TIPOS_MENSAJE.UI.ACCION_USUARIO,
                                mensajeId: generarIdUnico(),
                                mensajeOriginalId: mensajeId,
                                timestamp: Date.now(),
                                datos: {
                                    tipo: 'ALERTA_CERRADA',
                                    alertaId,
                                    accion: 'timeout',
                                    accionId: accionesValidadas.find(a => a.valorPorDefecto)?.id,
                                    datos: {
                                        mensaje: 'La alerta se cerró automáticamente',
                                        timeout: alerta.timeout
                                    }
                                }
                            });
                        }
                    } catch (error) {
                        logger.error(`${logPrefix} Error al cerrar automáticamente la alerta: ${error.message}`, error);
                    }
                }, alerta.timeout);
            }

            // 9. Confirmación al emisor original
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp,
                datos: {
                    accion: 'ALERTA_MOSTRADA',
                    id: alertaId,
                    tipo,
                    timestamp,
                    detalles: {
                        tieneContenido: !!contenido,
                        numAcciones: accionesValidadas.length,
                        timeout: alerta.timeout > 0 ? alerta.timeout : null
                    }
                }
            });

            logger.info(`${logPrefix} Alerta mostrada: ${titulo || 'Sin título'}`, {
                tipo,
                id: alertaId,
                tieneContenido: !!contenido,
                numAcciones: accionesValidadas.length,
                timeout: alerta.timeout > 0 ? `${alerta.timeout}ms` : 'ninguno'
            });

        } catch (error) {
            const errorProcesamiento = `Error al mostrar la alerta: ${error.message}`;
            logger.error(`${logPrefix} ${errorProcesamiento}`, error);
            
            // Notificar el error al emisor original
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                mensajeId: generarIdUnico(),
                mensajeOriginalId: mensajeId,
                timestamp: Date.now(),
                datos: {
                    codigo: 'ERROR_MOSTRAR_ALERTA',
                    mensaje: 'No se pudo mostrar la alerta',
                    detalles: error.message,
                    id: alertaId,
                    severidad: 'error',
                    stack: error.stack
                }
            });
        }

    } catch (error) {
        const errorNoManejado = `Error no manejado en UI.ALERTA: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar el error al emisor original si es posible
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    mensajeId: generarIdUnico(),
                    mensajeOriginalId: mensajeId,
                    timestamp: Date.now(),
                    datos: {
                        codigo: 'ERROR_INTERNO',
                        mensaje: 'Error interno al procesar la solicitud de alerta',
                        detalles: error.message,
                        severidad: 'error',
                        stack: error.stack
                    }
                });
            }
        } catch (errorNotificacion) {
            logger.error(`${logPrefix} Error al notificar error: ${errorNotificacion.message}`, errorNotificacion);
        }
    }
});

// ============================================
// ===== CONTROLADOR UI.CLOSE_MENUS =====
// ============================================

/**
 * Maneja las solicitudes de cierre de menús en la interfaz de usuario.
 * Este controlador procesa las solicitudes para cerrar menús abiertos,
 * notificando a los componentes de menú correspondientes.
 * 
 * @param {Object} mensaje - Mensaje de cierre de menús
 * @param {string} mensaje.origen - Origen del mensaje (ej: 'sistema', 'hijo1', etc.)
 * @param {Object} [mensaje.datos] - Datos adicionales para el cierre
 * @param {string} [mensaje.datos.except] - Opcional. Nombre del menú que NO debe cerrarse
 * @param {string} [mensaje.mensajeId] - ID único del mensaje para seguimiento
 */
registrarControlador(TIPOS_MENSAJE.UI.CLOSE_MENUS, async (mensaje) => {
    const logPrefix = `[UI.CLOSE_MENUS][${mensaje?.origen || 'desconocido'}]`;

    try {
        // Solo registrar que se recibió el mensaje - los iframes se manejan solos
        logger.debug(`${logPrefix} Mensaje CLOSE_MENUS recibido de ${mensaje?.origen}`);

        // No hacer nada más - los iframes manejan su propio estado

    } catch (error) {
        logger.error(`${logPrefix} Error procesando CLOSE_MENUS:`, error);
    }
});

// ============================================
// ===== CONTROLADOR UI.ACTUALIZACION =====
// ============================================

/**
 * Maneja las actualizaciones de la interfaz de usuario.
 * Este controlador procesa las solicitudes de actualización del UI,
 * modificando elementos del DOM, actualizando estilos, o disparando animaciones
 * según el tipo de actualización solicitada.
 * 
 * @param {Object} mensaje - Mensaje de actualización UI
 * @param {string} mensaje.origen - Origen del mensaje (ej: 'hijo2', 'hijo3', 'sistema', etc.)
 * @param {Object} mensaje.datos - Datos de la actualización
 * @param {string} mensaje.datos.tipo - Tipo de actualización ('texto', 'estilo', 'clase', 'atributo', 'visibilidad', 'animacion', etc.)
 * @param {string} [mensaje.datos.selector] - Selector CSS del elemento a actualizar
 * @param {string} [mensaje.datos.elementoId] - ID del elemento a actualizar (alternativa a selector)
 * @param {*} mensaje.datos.valor - Nuevo valor a aplicar (depende del tipo)
 * @param {Object} [mensaje.datos.opciones] - Opciones adicionales según el tipo de actualización
 * @param {boolean} [mensaje.datos.transicion] - Si se debe aplicar transición CSS
 * @param {number} [mensaje.datos.duracion] - Duración de la transición en ms (por defecto 300)
 * @param {string} [mensaje.mensajeId] - ID único del mensaje para seguimiento
 */
registrarControlador(TIPOS_MENSAJE.UI.ACTUALIZACION, async (mensaje) => {
    const logPrefix = `[UI.ACTUALIZACION][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje sin origen, ignorando solicitud de actualización UI';
            logger.warn(`${logPrefix} ${errorMsg}`);
            return;
        }

        if (!mensaje?.datos?.tipo) {
            const errorMsg = 'Mensaje sin tipo de actualización especificado';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId, mensaje });
            throw new Error(errorMsg);
        }

        const { 
            tipo, 
            selector, 
            elementoId, 
            valor, 
            opciones = {},
            transicion = false,
            duracion = 300
        } = mensaje.datos;

        logger.info(`${logPrefix} Procesando actualización UI tipo '${tipo}'`, { 
            mensajeId,
            origen: mensaje.origen,
            tipo,
            selector,
            elementoId,
            transicion
        });

        // 2. Obtener el elemento a actualizar
        let elemento = null;
        if (elementoId) {
            elemento = document.getElementById(elementoId);
        } else if (selector) {
            elemento = document.querySelector(selector);
        }

        if (!elemento) {
            const errorMsg = `Elemento no encontrado: ${elementoId || selector}`;
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId, elementoId, selector });
            throw new Error(errorMsg);
        }

        // 3. Aplicar transición si se solicita
        if (transicion) {
            elemento.style.transition = `all ${duracion}ms ease-in-out`;
        }

        // 4. Procesar según el tipo de actualización
        let resultadoActualizacion = null;
        
        switch (tipo) {
            case 'texto':
                // Actualizar contenido de texto
                elemento.textContent = valor;
                resultadoActualizacion = { accion: 'texto_actualizado', elementoId: elemento.id };
                break;

            case 'html':
                // Actualizar contenido HTML (con sanitización básica)
                if (opciones.sanitizar !== false) {
                    // Sanitización básica: eliminar scripts
                    const valorSanitizado = String(valor).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                    elemento.innerHTML = valorSanitizado;
                } else {
                    elemento.innerHTML = valor;
                }
                resultadoActualizacion = { accion: 'html_actualizado', elementoId: elemento.id };
                break;

            case 'estilo':
                // Actualizar estilos CSS
                if (typeof valor === 'object') {
                    Object.entries(valor).forEach(([propiedad, valorEstilo]) => {
                        elemento.style[propiedad] = valorEstilo;
                    });
                } else if (opciones.propiedad) {
                    elemento.style[opciones.propiedad] = valor;
                }
                resultadoActualizacion = { accion: 'estilo_actualizado', elementoId: elemento.id };
                break;

            case 'clase':
                // Manipular clases CSS
                const accion = opciones.accion || 'add'; // 'add', 'remove', 'toggle', 'replace'
                switch (accion) {
                    case 'add':
                        elemento.classList.add(...(Array.isArray(valor) ? valor : [valor]));
                        break;
                    case 'remove':
                        elemento.classList.remove(...(Array.isArray(valor) ? valor : [valor]));
                        break;
                    case 'toggle':
                        elemento.classList.toggle(valor);
                        break;
                    case 'replace':
                        if (opciones.claseAnterior) {
                            elemento.classList.replace(opciones.claseAnterior, valor);
                        }
                        break;
                }
                resultadoActualizacion = { accion: `clase_${accion}`, elementoId: elemento.id, clases: Array.from(elemento.classList) };
                break;

            case 'atributo':
                // Actualizar atributos del elemento
                if (typeof valor === 'object') {
                    Object.entries(valor).forEach(([atributo, valorAtributo]) => {
                        elemento.setAttribute(atributo, valorAtributo);
                    });
                } else if (opciones.nombre) {
                    if (valor === null || valor === undefined) {
                        elemento.removeAttribute(opciones.nombre);
                    } else {
                        elemento.setAttribute(opciones.nombre, valor);
                    }
                }
                resultadoActualizacion = { accion: 'atributo_actualizado', elementoId: elemento.id };
                break;

            case 'visibilidad':
                // Controlar visibilidad del elemento
                const visibilidadAccion = valor || opciones.accion; // 'mostrar', 'ocultar', 'toggle'
                switch (visibilidadAccion) {
                    case 'mostrar':
                        elemento.style.display = opciones.display || 'block';
                        elemento.style.visibility = 'visible';
                        break;
                    case 'ocultar':
                        elemento.style.display = 'none';
                        elemento.style.visibility = 'hidden';
                        break;
                    case 'toggle':
                        elemento.style.display = elemento.style.display === 'none' ? (opciones.display || 'block') : 'none';
                        break;
                }
                resultadoActualizacion = { accion: `visibilidad_${visibilidadAccion}`, elementoId: elemento.id };
                break;

            case 'animacion':
                // Aplicar animación CSS
                elemento.style.animation = valor;
                if (opciones.claseAnimacion) {
                    elemento.classList.add(opciones.claseAnimacion);
                    // Remover clase después de la animación
                    setTimeout(() => {
                        elemento.classList.remove(opciones.claseAnimacion);
                    }, duracion);
                }
                resultadoActualizacion = { accion: 'animacion_aplicada', elementoId: elemento.id, animacion: valor };
                break;

            case 'propiedad':
                // Actualizar propiedades del elemento
                if (opciones.nombre) {
                    elemento[opciones.nombre] = valor;
                }
                resultadoActualizacion = { accion: 'propiedad_actualizada', elementoId: elemento.id, propiedad: opciones.nombre };
                break;

            case 'custom':
                // Ejecución de función personalizada desde opciones
                if (typeof opciones.funcion === 'function') {
                    resultadoActualizacion = await opciones.funcion(elemento, valor, opciones);
                } else {
                    logger.warn(`${logPrefix} Tipo 'custom' sin función definida`);
                }
                break;

            default:
                const errorMsg = `Tipo de actualización no soportado: ${tipo}`;
                logger.error(`${logPrefix} ${errorMsg}`, { mensajeId, tipo });
                throw new Error(errorMsg);
        }

        // 5. Remover transición temporal
        if (transicion) {
            setTimeout(() => {
                elemento.style.transition = '';
            }, duracion);
        }

        // 6. Actualizar estado global
        const estadoGlobal = typeof window !== 'undefined' && window.estadoPadre ? window.estadoPadre : {};
        
        if (estadoGlobal.ui !== undefined) {
            if (!estadoGlobal.ui) {
                estadoGlobal.ui = {};
            }
            if (!estadoGlobal.ui.ultimasActualizaciones) {
                estadoGlobal.ui.ultimasActualizaciones = [];
            }
            
            estadoGlobal.ui.ultimasActualizaciones.unshift({
                timestamp,
                origen: mensaje.origen,
                tipo,
                elementoId: elemento.id,
                selector,
                resultado: resultadoActualizacion
            });

            // Mantener solo las últimas 50 actualizaciones
            if (estadoGlobal.ui.ultimasActualizaciones.length > 50) {
                estadoGlobal.ui.ultimasActualizaciones = estadoGlobal.ui.ultimasActualizaciones.slice(0, 50);
            }
        }

        // 7. Enviar confirmación al solicitante
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'manejador_ui',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                timestamp,
                estado: 'procesado',
                accion: 'ui_actualizada',
                tipo,
                elementoId: elemento.id,
                resultado: resultadoActualizacion
            }
        });

        logger.info(`${logPrefix} Actualización UI completada exitosamente`, { 
            mensajeId,
            tipo,
            elementoId: elemento.id,
            resultado: resultadoActualizacion
        });

    } catch (error) {
        const errorNoManejado = `Error no manejado en UI.ACTUALIZACION: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar error al origen si es posible
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    origen: 'manejador_ui',
                    mensajeId: generarIdUnico(),
                    datos: {
                        error: errorNoManejado,
                        mensajeOriginalId: mensajeId,
                        timestamp: Date.now(),
                        tipo: 'ERROR_ACTUALIZACION_UI',
                        detalles: {
                            tipoActualizacion: mensaje?.datos?.tipo,
                            selector: mensaje?.datos?.selector,
                            elementoId: mensaje?.datos?.elementoId
                        },
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    }
                });
            }
        } catch (nestedError) {
            logger.error(`${logPrefix} Error al notificar error: ${nestedError.message}`);
        }
        
        // Relanzar para manejo externo
        throw error;
    }
});

/**
 * Controlador para el mensaje DATOS.RESPUESTA_PARADAS.
 * Maneja las respuestas de datos de múltiples paradas (PUSH NOTIFICATION).
 * Este es un controlador de PUSH (no request/response) que procesa actualizaciones asíncronas.
 */
registrarControlador(TIPOS_MENSAJE.DATOS.RESPUESTA_PARADAS, async (mensaje) => {
    const logPrefix = `[RESPUESTA_PARADAS][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje de respuesta de paradas sin origen';
            logger.warn(`${logPrefix} ${errorMsg}`);
            return;
        }

        const { 
            paradas = [], 
            metadatos = {}, 
            estado = 'activo', 
            mensajeId: mensajeOriginalId, 
            actualizacionParcial = false,
            notificarSistema = true,
            requiereConfirmacion = true
        } = mensaje.datos || {};
        
        // 2. Validación de campos obligatorios
        if (!Array.isArray(paradas)) {
            const errorMsg = 'El campo paradas debe ser un array';
            logger.warn(`${logPrefix} ${errorMsg}`);
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                datos: {
                    error: errorMsg,
                    mensajeId: mensaje.mensajeId,
                    timestamp,
                    tipo: 'VALIDACION'
                }
            });
            return;
        }

        logger.info(`${logPrefix} Procesando ${paradas.length} paradas`, {
            actualizacionParcial,
            origen: mensaje.origen
        });

        // 3. Inicializar el estado global si no existe
        if (!estado.paradas) {
            estado.paradas = new Map();
        } else if (!actualizacionParcial) {
            // Si no es una actualización parcial, limpiamos el estado anterior
            logger.debug(`${logPrefix} Limpiando estado anterior de paradas`);
            estado.paradas.clear();
        }

        // 4. Procesar cada parada
        const resultados = {
            total: paradas.length,
            exitosas: 0,
            fallidas: 0,
            errores: []
        };

        const paradasProcesadas = [];
        const ahora = Date.now();
        
        for (const [index, parada] of paradas.entries()) {
            try {
                // 4.1. Validar parada
                if (!parada?.paradaId) {
                    throw new Error('Falta el campo obligatorio: paradaId');
                }

                if (!parada.ubicacion || typeof parada.ubicacion.lat !== 'number' || typeof parada.ubicacion.lng !== 'number') {
                    throw new Error('Ubicación de parada inválida o faltante');
                }

                // 4.2. Preparar datos de la parada
                const datosParada = {
                    id: parada.paradaId,
                    nombre: parada.nombre || `Parada ${parada.paradaId}`,
                    ubicacion: {
                        lat: Number(parada.ubicacion.lat.toFixed(6)),
                        lng: Number(parada.ubicacion.lng.toFixed(6))
                    },
                    rutas: Array.isArray(parada.rutas) ? parada.rutas : [],
                    metadatos: { ...(parada.metadatos || {}) },
                    estado: parada.estado || 'activa',
                    ultimaActualizacion: ahora,
                    origen: mensaje.origen
                };

                // 4.3. Validar y normalizar datos adicionales
                if (parada.horario) {
                    datosParada.horario = validarYNormalizarHorario(parada.horario);
                }

                // 4.4. Almacenar la parada
                estado.paradas.set(parada.paradaId, datosParada);
                paradasProcesadas.push(datosParada);
                resultados.exitosas++;

                // 4.5. Notificar progreso para lotes grandes
                if (paradas.length > 50 && index > 0 && index % 10 === 0) {
                    const progreso = Math.round((index / paradas.length) * 100);
                    logger.debug(`${logPrefix} Progreso: ${progreso}% (${index}/${paradas.length})`);
                }

            } catch (error) {
                resultados.fallidas++;
                const errorInfo = {
                    indice: index,
                    paradaId: parada?.paradaId,
                    error: error.message
                };
                resultados.errores.push(errorInfo);
                
                logger.warn(`${logPrefix} Error procesando parada ${index}:`, errorInfo);
            }
        }

        // 5. Registrar resultados
        const tiempoProcesamiento = Date.now() - ahora;
        logger.info(`${logPrefix} Procesamiento completado`, {
            ...resultados,
            tiempoProcesamiento: `${tiempoProcesamiento}ms`,
            paradasPorSegundo: resultados.exitosas / (tiempoProcesamiento / 1000)
        });

        // 6. Notificar a otros componentes si es necesario
        if (notificarSistema && paradasProcesadas.length > 0) {
            try {
                await enviarMensaje({
                    tipo: TIPOS_MENSAJE.DATOS.ACTUALIZACION_PARADAS,
                    datos: {
                        total: paradasProcesadas.length,
                        actualizacionParcial,
                        timestamp: ahora,
                        origen: mensaje.origen,
                        estado: resultados.fallidas === 0 ? 'completo' : 'parcial',
                        resultados: {
                            exitosas: resultados.exitosas,
                            fallidas: resultados.fallidas
                        }
                    },
                    broadcast: true
                });
            } catch (error) {
                logger.error(`${logPrefix} Error al notificar actualización de paradas:`, error);
            }
        }

        // 7. Responder con confirmación si se solicitó
        if (requiereConfirmacion && mensajeOriginalId) {
            try {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
                    datos: {
                        mensajeOriginalId: mensajeOriginalId,
                        timestamp: ahora,
                        estado: resultados.fallidas === 0 ? 'completo' : 'parcial',
                        resultados: {
                            total: resultados.total,
                            exitosas: resultados.exitosas,
                            fallidas: resultados.fallidas,
                            errores: resultados.errores.slice(0, 10) // Limitar el número de errores en la respuesta
                        }
                    }
                });
            } catch (error) {
                logger.error(`${logPrefix} Error al enviar confirmación:`, error);
            }
        }

        return resultados;

    } catch (error) {
        const errorMsg = `Error en manejo de RESPUESTA_PARADAS: ${error.message}`;
        logger.error(`${logPrefix} ${errorMsg}`, error);
        
        try {
            // Notificar el error de manera segura
            await enviarMensaje({
                destino: mensaje?.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                datos: {
                    error: errorMsg,
                    mensajeId: mensaje?.mensajeId,
                    timestamp: Date.now(),
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }
            });
        } catch (nestedError) {
            logger.error(`${logPrefix} Error al notificar error: ${nestedError.message}`);
        }
        
        // Relanzar el error para que pueda ser manejado por otros mecanismos
        throw error;
    }
});

// Controlador DATOS.SOLICITAR_PARADAS en hijo2 (Av1-botones-coordenadas.html)

/**
 * Calcula un multiplicador de timeout basado en el tipo de conexión de red.
 * Ajusta los timeouts para conexiones lentas para mejorar la experiencia del usuario.
 *
 * @returns {number} Multiplicador de timeout (1.0 = normal, >1.0 = más tiempo)
 */
export function calcularMultiplicadorTimeoutConexion() {
    try {
        // Verificar si navigator.connection está disponible
        if (!navigator.connection) {
            logger.debug('[TIMEOUT] navigator.connection no disponible, usando multiplicador por defecto: 1.0');
            return 1.0;
        }

        const connection = navigator.connection;
        const effectiveType = connection.effectiveType || 'unknown';

        // Multiplicadores basados en el tipo de conexión
        const multiplicadores = {
            '4g': 1.0,      // Conexión rápida - timeout normal
            '3g': 1.5,      // Conexión media - 50% más tiempo
            '2g': 2.0,      // Conexión lenta - doble tiempo
            'slow-2g': 3.0, // Conexión muy lenta - triple tiempo
            'unknown': 1.5  // Desconocido - tiempo moderado
        };

        const multiplicador = multiplicadores[effectiveType] || multiplicadores.unknown;

        logger.debug(`[TIMEOUT] Tipo de conexión: ${effectiveType}, multiplicador: ${multiplicador}x`);
        return multiplicador;

    } catch (error) {
        logger.warn('[TIMEOUT] Error al calcular multiplicador de conexión:', error);
        return 1.5; // Multiplicador conservador por defecto
    }
}

/**
 * Ajusta un timeout base según la conexión de red actual.
 * @param {number} timeoutBase - Timeout base en milisegundos
 * @returns {number} Timeout ajustado
 */
export function ajustarTimeoutPorConexion(timeoutBase) {
    const multiplicador = calcularMultiplicadorTimeoutConexion();
    const timeoutAjustado = Math.round(timeoutBase * multiplicador);

    logger.debug(`[TIMEOUT] Timeout ajustado: ${timeoutBase}ms -> ${timeoutAjustado}ms (${multiplicador}x)`);
    return timeoutAjustado;
}

/**
 * Función para migrar controladores tempranos (fallback) hacia la mensajería
 * Debe invocarse desde el padre después de `await inicializarMensajeria()`.
 */
export async function registrarControladoresUtils() {
    try {
        const { registrarControlador } = await import('./mensajeria.js');
        if (globalThis.__vv_manejadores && globalThis.__vv_manejadores.size > 0) {
            globalThis.__vv_manejadores.forEach((cb, tipo) => {
                try { registrarControlador(tipo, cb); } catch (e) { console.warn('[UTILS] error registrando controlador', tipo, e); }
            });
            try { globalThis.__vv_manejadores.clear(); } catch (e) { /* ignore */ }
        }
        logger.info('[UTILS][registrarControladores] Controladores migrados (si existían)');
    } catch (error) {
        logger.warn('[UTILS][registrarControladores] No se pudo migrar controladores:', error.message);
    }
}
