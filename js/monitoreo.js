/**
 * Módulo de Monitoreo y Telemetría
 * 
 * Este módulo proporciona funcionalidades para el monitoreo y análisis de eventos,
 * métricas de rendimiento y estado de la aplicación Valencia VGuides.
 * 
 * Características principales:
 * - Registro y agregación de eventos del sistema
 * - Recolección de métricas de rendimiento
 * - Monitoreo del estado de componentes
 * - Generación de reportes de uso
 * 
 * @module monitoreo
 * @version 1.0.0
 */

import { registrarControlador, enviarMensaje } from './mensajeria.js';

/**
 * Migrar registros tempranos desde el fallback global a la mensajería.
 * Ejecutar después de inicializar mensajería en el padre.
 */
export async function registrarControladoresMonitoreo() {
    try {
        const { registrarControlador } = await import('./mensajeria.js');
        if (globalThis.__vv_manejadores && globalThis.__vv_manejadores.size > 0) {
            globalThis.__vv_manejadores.forEach((cb, tipo) => {
                try { registrarControlador(tipo, cb); } catch (e) { console.warn('[MONITOREO] error registrando controlador', tipo, e); }
            });
            try { globalThis.__vv_manejadores.clear(); } catch (e) { /* ignore */ }
        }
        console.info('[MONITOREO][registrarControladores] Controladores migrados (si existían)');
    } catch (error) {
        console.warn('[MONITOREO][registrarControladores] No se pudo migrar controladores:', error.message);
    }
}
import { TIPOS_MENSAJE } from './constants.js';
import { generarIdUnico } from './utils.js';
import logger from './logger.js';

// ==================== Estado del Monitoreo ====================

/**
 * Estado global del sistema de monitoreo
 */
export const estadoMonitoreo = {
    inicializado: false,
    iniciado: Date.now(),
    eventos: [],
    metricas: new Map(),
    contadores: new Map(),
    ultimoReporte: null,
    configuracion: {
        maxEventos: 1000,
        maxMetricas: 500,
        intervaloReporte: 60000, // 1 minuto
        habilitado: true,
        niveles: {
            eventos: true,
            metricas: true,
            rendimiento: true,
            errores: true
        }
    }
};

// ==================== Funciones de Utilidad ====================

/**
 * Registra un evento en el sistema de monitoreo
 * @param {Object} evento - Evento a registrar
 * @returns {void}
 */
export function registrarEvento(evento) {
    if (!estadoMonitoreo.configuracion.habilitado || !estadoMonitoreo.configuracion.niveles.eventos) {
        return;
    }

    const eventoCompleto = {
        id: generarIdUnico(),
        timestamp: Date.now(),
        ...evento
    };

    estadoMonitoreo.eventos.unshift(eventoCompleto);

    // Limitar tamaño del array de eventos
    if (estadoMonitoreo.eventos.length > estadoMonitoreo.configuracion.maxEventos) {
        estadoMonitoreo.eventos = estadoMonitoreo.eventos.slice(0, estadoMonitoreo.configuracion.maxEventos);
    }

    logger.debug('[MONITOREO] Evento registrado', { eventoId: eventoCompleto.id, tipo: evento.tipo });
}

/**
 * Registra una métrica en el sistema de monitoreo
 * @param {string} nombre - Nombre de la métrica
 * @param {number} valor - Valor de la métrica
 * @param {Object} [metadatos] - Metadatos adicionales
 * @returns {void}
 */
export function registrarMetrica(nombre, valor, metadatos = {}) {
    if (!estadoMonitoreo.configuracion.habilitado || !estadoMonitoreo.configuracion.niveles.metricas) {
        return;
    }

    const metrica = {
        nombre,
        valor,
        timestamp: Date.now(),
        metadatos
    };

    if (!estadoMonitoreo.metricas.has(nombre)) {
        estadoMonitoreo.metricas.set(nombre, []);
    }

    const metricasNombre = estadoMonitoreo.metricas.get(nombre);
    metricasNombre.unshift(metrica);

    // Limitar tamaño del array de métricas por nombre
    if (metricasNombre.length > estadoMonitoreo.configuracion.maxMetricas) {
        estadoMonitoreo.metricas.set(nombre, metricasNombre.slice(0, estadoMonitoreo.configuracion.maxMetricas));
    }

    logger.debug('[MONITOREO] Métrica registrada', { nombre, valor });
}

/**
 * Incrementa un contador
 * @param {string} nombre - Nombre del contador
 * @param {number} [incremento=1] - Valor a incrementar
 * @returns {number} Nuevo valor del contador
 */
export function incrementarContador(nombre, incremento = 1) {
    const valorActual = estadoMonitoreo.contadores.get(nombre) || 0;
    const nuevoValor = valorActual + incremento;
    estadoMonitoreo.contadores.set(nombre, nuevoValor);
    return nuevoValor;
}

/**
 * Obtiene estadísticas de una métrica
 * @param {string} nombre - Nombre de la métrica
 * @returns {Object|null} Estadísticas o null si no existe
 */
export function obtenerEstadisticasMetrica(nombre) {
    const metricas = estadoMonitoreo.metricas.get(nombre);
    if (!metricas || metricas.length === 0) {
        return null;
    }

    const valores = metricas.map(m => m.valor);
    const suma = valores.reduce((acc, val) => acc + val, 0);
    const promedio = suma / valores.length;
    const min = Math.min(...valores);
    const max = Math.max(...valores);

    // Calcular mediana
    const valoresOrdenados = [...valores].sort((a, b) => a - b);
    const mediana = valoresOrdenados.length % 2 === 0
        ? (valoresOrdenados[valoresOrdenados.length / 2 - 1] + valoresOrdenados[valoresOrdenados.length / 2]) / 2
        : valoresOrdenados[Math.floor(valoresOrdenados.length / 2)];

    return {
        nombre,
        count: valores.length,
        suma,
        promedio,
        min,
        max,
        mediana,
        ultimo: valores[0],
        timestamp: Date.now()
    };
}

/**
 * Genera un reporte del sistema de monitoreo
 * @returns {Object} Reporte completo
 */
export function generarReporte() {
    const ahora = Date.now();
    const tiempoEjecucion = ahora - estadoMonitoreo.iniciado;

    // Estadísticas de eventos
    const eventosPorTipo = estadoMonitoreo.eventos.reduce((acc, evento) => {
        acc[evento.tipo] = (acc[evento.tipo] || 0) + 1;
        return acc;
    }, {});

    // Estadísticas de métricas
    const metricasEstadisticas = {};
    estadoMonitoreo.metricas.forEach((_, nombre) => {
        metricasEstadisticas[nombre] = obtenerEstadisticasMetrica(nombre);
    });

    // Contadores
    const contadores = {};
    estadoMonitoreo.contadores.forEach((valor, nombre) => {
        contadores[nombre] = valor;
    });

    const reporte = {
        timestamp: ahora,
        tiempoEjecucion,
        eventos: {
            total: estadoMonitoreo.eventos.length,
            porTipo: eventosPorTipo,
            ultimos: estadoMonitoreo.eventos.slice(0, 10)
        },
        metricas: metricasEstadisticas,
        contadores,
        sistema: {
            memoria: performance.memory ? {
                usada: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limite: performance.memory.jsHeapSizeLimit
            } : null,
            rendimiento: {
                navigationStart: performance.timing?.navigationStart,
                loadEventEnd: performance.timing?.loadEventEnd,
                tiempoCarga: performance.timing?.loadEventEnd 
                    ? performance.timing.loadEventEnd - performance.timing.navigationStart 
                    : null
            }
        }
    };

    estadoMonitoreo.ultimoReporte = reporte;
    return reporte;
}

/**
 * Limpia datos antiguos del sistema de monitoreo
 * @param {number} [maxEdad=3600000] - Edad máxima en ms (por defecto 1 hora)
 * @returns {Object} Resumen de limpieza
 */
export function limpiarDatosAntiguos(maxEdad = 3600000) {
    const ahora = Date.now();
    const corte = ahora - maxEdad;

    // Limpiar eventos antiguos
    const eventosAnteriores = estadoMonitoreo.eventos.length;
    estadoMonitoreo.eventos = estadoMonitoreo.eventos.filter(e => e.timestamp > corte);
    const eventosEliminados = eventosAnteriores - estadoMonitoreo.eventos.length;

    // Limpiar métricas antiguas
    let metricasEliminadas = 0;
    estadoMonitoreo.metricas.forEach((metricas, nombre) => {
        const metricasAnteriores = metricas.length;
        const metricasFiltradas = metricas.filter(m => m.timestamp > corte);
        estadoMonitoreo.metricas.set(nombre, metricasFiltradas);
        metricasEliminadas += metricasAnteriores - metricasFiltradas.length;
    });

    logger.info('[MONITOREO] Datos antiguos limpiados', {
        eventosEliminados,
        metricasEliminadas,
        maxEdad
    });

    return {
        eventosEliminados,
        metricasEliminadas,
        timestamp: ahora
    };
}

// ==================== Controladores de Mensajes ====================

/**
 * Maneja el registro de eventos del sistema.
 * Este controlador procesa eventos de diferentes componentes para análisis
 * y generación de reportes.
 * 
 * @param {Object} mensaje - Mensaje con datos del evento
 * @param {string} mensaje.origen - Origen del mensaje
 * @param {Object} mensaje.datos - Datos del evento
 * @param {string} mensaje.datos.tipo - Tipo de evento
 * @param {string} [mensaje.datos.categoria] - Categoría del evento
 * @param {string} [mensaje.datos.descripcion] - Descripción del evento
 * @param {Object} [mensaje.datos.datos] - Datos adicionales del evento
 * @param {string} [mensaje.datos.nivel='info'] - Nivel del evento ('debug', 'info', 'warn', 'error')
 * @param {string} [mensaje.mensajeId] - ID único del mensaje
 */
registrarControlador(TIPOS_MENSAJE.MONITOREO.EVENTO, async (mensaje) => {
    const logPrefix = `[MONITOREO.EVENTO][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje sin origen, ignorando evento';
            logger.warn(`${logPrefix} ${errorMsg}`);
            return;
        }

        if (!mensaje?.datos?.tipo) {
            const errorMsg = 'Evento sin tipo especificado';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId });
            throw new Error(errorMsg);
        }

        const { 
            tipo, 
            categoria = 'general', 
            descripcion = '', 
            datos = {}, 
            nivel = 'info' 
        } = mensaje.datos;

        logger.debug(`${logPrefix} Procesando evento tipo '${tipo}'`, { 
            mensajeId,
            tipo,
            categoria,
            nivel
        });

        // 2. Registrar el evento
        registrarEvento({
            tipo,
            categoria,
            descripcion,
            datos,
            nivel,
            origen: mensaje.origen,
            mensajeOriginalId: mensajeId
        });

        // 3. Incrementar contador de eventos
        incrementarContador(`eventos_${tipo}`);
        incrementarContador(`eventos_categoria_${categoria}`);
        incrementarContador(`eventos_total`);

        // 4. Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'monitoreo',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                timestamp,
                estado: 'procesado',
                eventoRegistrado: true
            }
        });

        logger.info(`${logPrefix} Evento registrado`, { tipo, categoria, nivel });
        
        return { exito: true };
        
    } catch (error) {
        const errorNoManejado = `Error no manejado en MONITOREO.EVENTO: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar error al origen
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    origen: 'monitoreo',
                    mensajeId: generarIdUnico(),
                    datos: {
                        error: errorNoManejado,
                        mensajeOriginalId: mensajeId,
                        timestamp: Date.now(),
                        tipo: 'ERROR_REGISTRO_EVENTO',
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    }
                });
            }
        } catch (nestedError) {
            logger.error(`${logPrefix} Error al notificar error: ${nestedError.message}`);
        }
        
        throw error;
    }
});

/**
 * Maneja el registro de métricas de rendimiento.
 * Este controlador procesa métricas numéricas del sistema para análisis
 * de rendimiento y generación de estadísticas.
 * 
 * @param {Object} mensaje - Mensaje con datos de la métrica
 * @param {string} mensaje.origen - Origen del mensaje
 * @param {Object} mensaje.datos - Datos de la métrica
 * @param {string} mensaje.datos.nombre - Nombre de la métrica
 * @param {number} mensaje.datos.valor - Valor de la métrica
 * @param {string} [mensaje.datos.unidad] - Unidad de medida
 * @param {Object} [mensaje.datos.metadatos] - Metadatos adicionales
 * @param {string} [mensaje.datos.categoria='rendimiento'] - Categoría de la métrica
 * @param {string} [mensaje.mensajeId] - ID único del mensaje
 */
registrarControlador(TIPOS_MENSAJE.MONITOREO.METRICA, async (mensaje) => {
    const logPrefix = `[MONITOREO.METRICA][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje sin origen, ignorando métrica';
            logger.warn(`${logPrefix} ${errorMsg}`);
            return;
        }

        if (!mensaje?.datos?.nombre) {
            const errorMsg = 'Métrica sin nombre especificado';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId });
            throw new Error(errorMsg);
        }

        if (mensaje?.datos?.valor === undefined || mensaje?.datos?.valor === null) {
            const errorMsg = 'Métrica sin valor especificado';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId });
            throw new Error(errorMsg);
        }

        const { 
            nombre, 
            valor, 
            unidad = '', 
            metadatos = {}, 
            categoria = 'rendimiento' 
        } = mensaje.datos;

        logger.debug(`${logPrefix} Procesando métrica '${nombre}' = ${valor}${unidad}`, { 
            mensajeId,
            nombre,
            valor,
            categoria
        });

        // 2. Validar que el valor es numérico
        if (typeof valor !== 'number' || isNaN(valor)) {
            throw new Error(`Valor de métrica inválido: ${valor}`);
        }

        // 3. Registrar la métrica
        registrarMetrica(nombre, valor, {
            unidad,
            categoria,
            origen: mensaje.origen,
            ...metadatos
        });

        // 4. Incrementar contador de métricas
        incrementarContador(`metricas_${nombre}`);
        incrementarContador(`metricas_total`);

        // 5. Obtener estadísticas actualizadas
        const estadisticas = obtenerEstadisticasMetrica(nombre);

        // 6. Enviar confirmación con estadísticas
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'monitoreo',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                timestamp,
                estado: 'procesado',
                metricaRegistrada: true,
                estadisticas
            }
        });

        logger.info(`${logPrefix} Métrica registrada`, { nombre, valor, unidad });
        
        return { exito: true, estadisticas };
        
    } catch (error) {
        const errorNoManejado = `Error no manejado en MONITOREO.METRICA: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar error al origen
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    origen: 'monitoreo',
                    mensajeId: generarIdUnico(),
                    datos: {
                        error: errorNoManejado,
                        mensajeOriginalId: mensajeId,
                        timestamp: Date.now(),
                        tipo: 'ERROR_REGISTRO_METRICA',
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    }
                });
            }
        } catch (nestedError) {
            logger.error(`${logPrefix} Error al notificar error: ${nestedError.message}`);
        }
        
        throw error;
    }
});

/**
 * Maneja la notificación de inicialización de la aplicación.
 * Este controlador registra el inicio del sistema y prepara el monitoreo.
 * 
 * @param {Object} mensaje - Mensaje de inicialización
 * @param {string} mensaje.origen - Origen del mensaje
 * @param {Object} [mensaje.datos] - Datos de inicialización
 * @param {string} [mensaje.datos.version] - Versión de la aplicación
 * @param {Object} [mensaje.datos.configuracion] - Configuración inicial
 * @param {string} [mensaje.mensajeId] - ID único del mensaje
 */
registrarControlador(TIPOS_MENSAJE.MONITOREO.APLICACION_INICIALIZADA, async (mensaje) => {
    const logPrefix = `[MONITOREO.APLICACION_INICIALIZADA][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Aplicación inicializada`, { 
            mensajeId,
            origen: mensaje.origen,
            datos: mensaje.datos
        });

        const { version, configuracion = {} } = mensaje.datos || {};

        // 1. Actualizar estado de inicialización
        estadoMonitoreo.inicializado = true;
        estadoMonitoreo.iniciado = timestamp;

        // 2. Registrar evento de inicialización
        registrarEvento({
            tipo: 'aplicacion_inicializada',
            categoria: 'sistema',
            descripcion: 'Aplicación iniciada correctamente',
            datos: {
                version,
                configuracion,
                timestamp
            },
            nivel: 'info',
            origen: mensaje.origen
        });

        // 3. Iniciar reporte periódico si está configurado
        if (estadoMonitoreo.configuracion.intervaloReporte > 0) {
            setInterval(() => {
                try {
                    const reporte = generarReporte();
                    logger.debug('[MONITOREO] Reporte periódico generado', {
                        eventos: reporte.eventos.total,
                        metricas: Object.keys(reporte.metricas).length
                    });
                } catch (error) {
                    logger.error('[MONITOREO] Error al generar reporte periódico', error);
                }
            }, estadoMonitoreo.configuracion.intervaloReporte);
        }

        // 4. Registrar métricas iniciales
        registrarMetrica('tiempo_inicio', timestamp);
        registrarMetrica('memoria_inicial', performance.memory?.usedJSHeapSize || 0, { unidad: 'bytes' });

        // 5. Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'monitoreo',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                timestamp,
                estado: 'procesado',
                monitoreoIniciado: true
            }
        });

        logger.info(`${logPrefix} Monitoreo inicializado correctamente`, { version });
        
        return { exito: true };
        
    } catch (error) {
        const errorNoManejado = `Error no manejado en MONITOREO.APLICACION_INICIALIZADA: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar error al origen
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    origen: 'monitoreo',
                    mensajeId: generarIdUnico(),
                    datos: {
                        error: errorNoManejado,
                        mensajeOriginalId: mensajeId,
                        timestamp: Date.now(),
                        tipo: 'ERROR_INICIALIZACION_MONITOREO',
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    }
                });
            }
        } catch (nestedError) {
            logger.error(`${logPrefix} Error al notificar error: ${nestedError.message}`);
        }
        
        throw error;
    }
});

/**
 * Maneja la notificación de inicialización del logger.
 * Este controlador registra la activación del sistema de logging.
 * 
 * @param {Object} mensaje - Mensaje de inicialización del logger
 * @param {string} mensaje.origen - Origen del mensaje
 * @param {Object} [mensaje.datos] - Datos de configuración del logger
 * @param {string} [mensaje.datos.nivel] - Nivel de logging configurado
 * @param {Array<string>} [mensaje.datos.transportes] - Transportes habilitados
 * @param {string} [mensaje.mensajeId] - ID único del mensaje
 */
registrarControlador(TIPOS_MENSAJE.MONITOREO.LOGGER_INICIALIZADO, async (mensaje) => {
    const logPrefix = `[MONITOREO.LOGGER_INICIALIZADO][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Logger inicializado`, { 
            mensajeId,
            origen: mensaje.origen,
            datos: mensaje.datos
        });

        const { nivel, transportes = [] } = mensaje.datos || {};

        // 1. Registrar evento de inicialización del logger
        registrarEvento({
            tipo: 'logger_inicializado',
            categoria: 'sistema',
            descripcion: 'Sistema de logging activado',
            datos: {
                nivel,
                transportes,
                timestamp
            },
            nivel: 'info',
            origen: mensaje.origen
        });

        // 2. Incrementar contador
        incrementarContador('logger_inicializaciones');

        // 3. Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'monitoreo',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                timestamp,
                estado: 'procesado',
                loggerRegistrado: true
            }
        });

        logger.info(`${logPrefix} Logger registrado en monitoreo`, { nivel, transportes });
        
        return { exito: true };
        
    } catch (error) {
        const errorNoManejado = `Error no manejado en MONITOREO.LOGGER_INICIALIZADO: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar error al origen
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    origen: 'monitoreo',
                    mensajeId: generarIdUnico(),
                    datos: {
                        error: errorNoManejado,
                        mensajeOriginalId: mensajeId,
                        timestamp: Date.now(),
                        tipo: 'ERROR_REGISTRO_LOGGER',
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    }
                });
            }
        } catch (nestedError) {
            logger.error(`${logPrefix} Error al notificar error: ${nestedError.message}`);
        }
        
        throw error;
    }
});

/**
 * Inicializa el módulo de monitoreo
 * @returns {boolean} true si se inicializó correctamente
 */
export function inicializarMonitoreo() {
    try {
        logger.info('[MONITOREO] Inicializando módulo de monitoreo');
        
        // Registrar evento de inicio
        registrarEvento({
            tipo: 'modulo_inicializado',
            categoria: 'sistema',
            descripcion: 'Módulo de monitoreo inicializado',
            datos: {},
            nivel: 'info',
            origen: 'monitoreo'
        });

        // Configurar limpieza automática de datos antiguos
        setInterval(() => {
            limpiarDatosAntiguos();
        }, 3600000); // Cada hora

        estadoMonitoreo.inicializado = true;
        
        logger.info('[MONITOREO] Módulo de monitoreo inicializado correctamente');
        return true;
        
    } catch (error) {
        logger.error('[MONITOREO] Error al inicializar módulo de monitoreo', error);
        return false;
    }
}

// Auto-inicialización al cargar el módulo
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        inicializarMonitoreo();
    });
}

logger.info('[MONITOREO] Módulo de monitoreo cargado');

// ==================== CONTROLADORES DE SISTEMA ====================

/**
 * Estado del sistema (para gestión de mensajes y componentes)
 */
const estadoSistema = {
    mensajesPendientes: {},
    hijos: {},
    hijosInicializados: new Set(),
    inicializacionPromises: new Map(),
    mensajeriaInicializada: false
};

/**
 * Promesas pendientes para sincronización de mensajes
 * @type {Map<string, {resolve: Function, reject: Function, timestamp: number}>}
 */
export const promesasPendientes = new Map();

/**
 * Calcula el tiempo de espera para el próximo reintento usando backoff exponencial
 * @private
 * @param {number} intento - Número de intento actual
 * @param {number} [base=1000] - Tiempo base en milisegundos
 * @param {number} [max=30000] - Tiempo máximo de espera en milisegundos
 * @returns {number} Tiempo de espera en milisegundos
 */
function calcularTiempoReintento(intento, base = 1000, max = 30000) {
    return Math.min(max, base * Math.pow(2, intento - 1));
}

/**
 * Controlador: SISTEMA.ACK
 * Maneja las confirmaciones de mensajes (acknowledgments)
 */
registrarControlador(TIPOS_MENSAJE.SISTEMA.ACK, async (mensaje) => {
    const logPrefix = `[SISTEMA.ACK][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();

    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            logger.warn(`${logPrefix} Mensaje ACK sin origen, ignorando`, { mensajeId });
            return;
        }

        // 2. Registrar recepción del ACK
        const idMensajeOriginal = mensaje.datos?.respuestaA || 'desconocido';
        logger.info(`${logPrefix} ACK recibido para mensaje ${idMensajeOriginal}`, {
            origen: mensaje.origen,
            timestamp: new Date(timestamp).toISOString(),
            datos: mensaje.datos
        });

        // 3. Actualizar estado del mensaje original si existe
        let tiempoRespuesta = null;
        if (estadoSistema.mensajesPendientes && estadoSistema.mensajesPendientes[idMensajeOriginal]) {
            tiempoRespuesta = timestamp - estadoSistema.mensajesPendientes[idMensajeOriginal].timestamp;
            
            // Registrar el tiempo de respuesta
            registrarEvento('TIEMPO_RESPUESTA', {
                mensajeId: idMensajeOriginal,
                origen: mensaje.origen,
                tiempoRespuesta,
                estado: mensaje.datos?.estado || 'recibido'
            });

            // Actualizar estado
            estadoSistema.mensajesPendientes[idMensajeOriginal] = {
                ...estadoSistema.mensajesPendientes[idMensajeOriginal],
                estado: 'confirmado',
                timestampRespuesta: timestamp,
                tiempoRespuesta,
                datosRespuesta: mensaje.datos
            };

            // Resolver la promesa pendiente si existe
            if (promesasPendientes.has(idMensajeOriginal)) {
                promesasPendientes.get(idMensajeOriginal).resolve({
                    exito: true,
                    mensaje: 'ACK recibido',
                    datos: mensaje.datos
                });
                promesasPendientes.delete(idMensajeOriginal);
            }
        }

        // 4. Registrar métrica de rendimiento
        registrarMetrica('tiempo_respuesta_ack', tiempoRespuesta || 0, 'ms');

    } catch (error) {
        const errorMsg = `Error al procesar ACK: ${error.message}`;
        logger.error(`${logPrefix} ${errorMsg}`, error);
        
        // Registrar el error
        registrarEvento('ERROR_PROCESAMIENTO_ACK', {
            mensajeId,
            error: errorMsg,
            stack: error.stack
        });
        
        // Rechazar la promesa pendiente si existe
        if (mensaje.datos?.respuestaA && promesasPendientes.has(mensaje.datos.respuestaA)) {
            promesasPendientes.get(mensaje.datos.respuestaA).reject(new Error(errorMsg));
            promesasPendientes.delete(mensaje.datos.respuestaA);
        }
    }
}, { id: 'sistema-ack-handler' });

/**
 * Controlador: SISTEMA.NACK
 * Maneja las notificaciones de rechazo de mensajes (negative acknowledgments)
 */
registrarControlador(TIPOS_MENSAJE.SISTEMA.NACK, async (mensaje) => {
    const logPrefix = `[SISTEMA.NACK][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();

    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            logger.warn(`${logPrefix} Mensaje NACK sin origen, ignorando`, { mensajeId });
            return;
        }

        // 2. Obtener información del mensaje original
        const idMensajeOriginal = mensaje.datos?.respuestaA || 'desconocido';
        const errorMsg = mensaje.datos?.error || 'Error desconocido';
        const codigoError = mensaje.datos?.codigo || 'NACK_SIN_CODIGO';
        
        // 3. Registrar el NACK
        logger.error(`${logPrefix} NACK recibido para mensaje ${idMensajeOriginal}`, {
            origen: mensaje.origen,
            timestamp: new Date(timestamp).toISOString(),
            error: errorMsg,
            codigo: codigoError,
            detalles: mensaje.datos?.detalles || {}
        });

        // 4. Actualizar estado del mensaje original si existe
        if (estadoSistema.mensajesPendientes && estadoSistema.mensajesPendientes[idMensajeOriginal]) {
            const tiempoRespuesta = timestamp - estadoSistema.mensajesPendientes[idMensajeOriginal].timestamp;
            
            // Registrar el fallo
            registrarEvento('MENSAJE_FALLIDO', {
                mensajeId: idMensajeOriginal,
                origen: mensaje.origen,
                tiempoRespuesta,
                error: errorMsg,
                codigo: codigoError,
                intento: estadoSistema.mensajesPendientes[idMensajeOriginal].intentos || 1
            });

            // Actualizar estado con información del error
            estadoSistema.mensajesPendientes[idMensajeOriginal] = {
                ...estadoSistema.mensajesPendientes[idMensajeOriginal],
                estado: 'fallido',
                timestampRespuesta: timestamp,
                tiempoRespuesta,
                error: {
                    mensaje: errorMsg,
                    codigo: codigoError,
                    detalles: mensaje.datos?.detalles || {}
                },
                ultimoIntento: timestamp,
                intentos: (estadoSistema.mensajesPendientes[idMensajeOriginal].intentos || 0) + 1
            };

            // 5. Manejar reintentos si corresponde
            const maxReintentos = estadoSistema.mensajesPendientes[idMensajeOriginal].maxReintentos || 0;
            const reintentosRestantes = maxReintentos - (estadoSistema.mensajesPendientes[idMensajeOriginal].intentos || 1);
            
            if (reintentosRestantes > 0) {
                const tiempoReintento = calcularTiempoReintento(
                    estadoSistema.mensajesPendientes[idMensajeOriginal].intentos || 1
                );
                
                logger.warn(`${logPrefix} Reintentando mensaje ${idMensajeOriginal} en ${tiempoReintento}ms (${reintentosRestantes} reintentos restantes)`);
                
                // Programar reintento
                setTimeout(() => {
                    const mensajeOriginal = estadoSistema.mensajesPendientes[idMensajeOriginal].mensaje;
                    if (mensajeOriginal) {
                        Promise.resolve(enviarMensaje({
                            ...mensajeOriginal,
                            mensajeId: generarIdUnico(),
                            datos: {
                                ...mensajeOriginal.datos,
                                esReintento: true,
                                reintentoNumero: (estadoSistema.mensajesPendientes[idMensajeOriginal].intentos || 1) + 1
                            }
                        })).catch(error => {
                            logger.error(`${logPrefix} Error al reintentar mensaje ${idMensajeOriginal}:`, error);
                        });
                    }
                }, tiempoReintento);
                
                return; // No marcar como fallido aún
            }
            
            // 6. Si no hay más reintentos, marcar como fallido permanentemente
            estadoSistema.mensajesPendientes[idMensajeOriginal].estado = 'fallido_permanentemente';
            
            // Notificar a los componentes interesados
            registrarEvento('MENSAJE_FALLIDO_PERMANENTEMENTE', {
                mensajeId: idMensajeOriginal,
                origen: mensaje.origen,
                error: errorMsg,
                codigo: codigoError,
                intentos: estadoSistema.mensajesPendientes[idMensajeOriginal].intentos || 1
            });
        }

        // 7. Rechazar la promesa pendiente si existe
        if (promesasPendientes.has(idMensajeOriginal)) {
            const error = new Error(`NACK recibido: ${errorMsg}`);
            error.codigo = codigoError;
            error.detalles = mensaje.datos?.detalles || {};
            
            promesasPendientes.get(idMensajeOriginal).reject(error);
            promesasPendientes.delete(idMensajeOriginal);
        }

        // 8. Registrar métrica de fallo
        registrarMetrica('errores_nack', 1, 'count', {
            codigo: codigoError,
            origen: mensaje.origen
        });

    } catch (error) {
        const errorMsg = `Error al procesar NACK: ${error.message}`;
        logger.error(`${logPrefix} ${errorMsg}`, error);
        
        // Registrar el error en el sistema de monitoreo
        registrarEvento('ERROR_PROCESAMIENTO_NACK', {
            mensajeId,
            error: errorMsg,
            stack: error.stack,
            mensajeOriginal: mensaje
        });
        
        // Si hay un mensaje original, rechazar su promesa pendiente
        if (mensaje.datos?.respuestaA && promesasPendientes.has(mensaje.datos.respuestaA)) {
            promesasPendientes.get(mensaje.datos.respuestaA).reject(error);
            promesasPendientes.delete(mensaje.datos.respuestaA);
        }
    }
}, { id: 'sistema-nack-handler' });

/**
 * Controlador: SISTEMA.CONFIRMACION
 * Maneja mensajes de confirmación del sistema
 */
registrarControlador(TIPOS_MENSAJE.SISTEMA.CONFIRMACION, async (mensaje) => {
    const logPrefix = `[SISTEMA.CONFIRMACION][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();

    try {
        if (!mensaje?.origen || !mensaje.datos) {
            logger.warn(`${logPrefix} Mensaje sin origen o datos`);
            return;
        }

        logger.info(`${logPrefix} Confirmación recibida`, {
            tipo: mensaje.datos.tipo || 'no_especificado',
            timestamp: new Date(timestamp).toISOString()
        });

        registrarEvento('CONFIRMACION_RECIBIDA', {
            origen: mensaje.origen,
            tipo: mensaje.datos.tipo,
            mensajeId,
            timestamp
        });

        // Procesar según el tipo de confirmación
        switch (mensaje.datos.tipo) {
            case 'inicializacion':
                if (estadoSistema.inicializacionPromises.has(mensaje.origen)) {
                    const promiseData = estadoSistema.inicializacionPromises.get(mensaje.origen);
                    if (promiseData) {
                        const { resolve, timeout } = promiseData;
                        clearTimeout(timeout);
                        estadoSistema.inicializacionPromises.delete(mensaje.origen);
                        resolve();
                    }
                }
                break;
            case 'operacion_completada':
                logger.info(`${logPrefix} Operación completada`, {
                    operacion: mensaje.datos.operacion,
                    resultado: mensaje.datos.resultado
                });
                break;
        }

        // Enviar ACK
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.ACK,
            origen: 'padre',
            mensajeId: generarIdUnico(),
            timestamp,
            datos: {
                tipo: 'confirmacion_recibida',
                mensajeOriginal: mensajeId,
                timestamp
            }
        });

    } catch (error) {
        logger.error(`${logPrefix} Error al procesar confirmación:`, error);
    }
}, { id: 'sistema-confirmacion-handler' });

/**
 * Controlador: SISTEMA.HIJO_FALLIDO
 * Maneja notificaciones de fallos en componentes hijos
 */
registrarControlador(TIPOS_MENSAJE.SISTEMA.HIJO_FALLIDO, async (mensaje) => {
    const logPrefix = `[SISTEMA.HIJO_FALLIDO][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    const maxReintentos = 5;
    
    try {
        if (!mensaje?.origen || !mensaje.datos) {
            logger.warn(`${logPrefix} Mensaje sin origen o datos`);
            return;
        }

        const {
            codigo = 'ERROR_DESCONOCIDO',
            mensaje: mensajeError = 'Error no especificado',
            severidad = 'medio',
            reintentable = true
        } = mensaje.datos || {};

        logger.error(`${logPrefix} Fallo reportado: ${codigo} - ${mensajeError}`, {
            severidad,
            reintentable
        });

        // Registrar evento de fallo
        registrarEvento('HIJO_FALLIDO', {
            origen: mensaje.origen,
            codigo,
            mensaje: mensajeError,
            timestamp,
            mensajeId,
            severidad,
            reintentable
        });

        // Registrar métricas
        registrarMetrica('errores_componentes', 1, 'count', {
            componente: mensaje.origen,
            codigo
        });

        // Actualizar estado del hijo
        const componenteActual = estadoSistema.hijos[mensaje.origen] || {
            id: mensaje.origen,
            estado: 'desconocido',
            intentosReconexion: 0
        };

        const totalErrores = (componenteActual.totalErrores || 0) + 1;
        
        estadoSistema.hijos[mensaje.origen] = {
            ...componenteActual,
            estado: 'error',
            ultimoError: {
                codigo,
                mensaje: mensajeError,
                timestamp,
                severidad
            },
            totalErrores,
            intentosReconexion: (componenteActual.intentosReconexion || 0) + (reintentable ? 1 : 0)
        };

        // Intentar recuperación automática si es reintentable
        if (reintentable && estadoSistema.hijos[mensaje.origen].intentosReconexion < maxReintentos) {
            const tiempoEspera = calcularTiempoReintento(
                estadoSistema.hijos[mensaje.origen].intentosReconexion
            );

            logger.info(`${logPrefix} Programando reintento en ${tiempoEspera}ms`);

            setTimeout(async () => {
                try {
                    await enviarMensaje({
                        tipo: TIPOS_MENSAJE.SISTEMA.REINTENTAR,
                        origen: 'sistema',
                        destino: mensaje.origen,
                        mensajeId: generarIdUnico(),
                        timestamp: Date.now(),
                        datos: {
                            mensajeOriginalId: mensajeId,
                            intento: estadoSistema.hijos[mensaje.origen].intentosReconexion
                        }
                    });
                } catch (errorReintento) {
                    logger.error(`${logPrefix} Error al enviar mensaje de reintento:`, errorReintento);
                }
            }, tiempoEspera);
        }

        // Notificar a otros componentes
        await enviarMensaje({
            tipo: TIPOS_MENSAJE.SISTEMA.NOTIFICACION,
            origen: 'sistema',
            destino: 'monitoreo',
            mensajeId: generarIdUnico(),
            timestamp,
            datos: {
                tipo: 'fallo_componente',
                componente: mensaje.origen,
                codigo,
                mensaje: mensajeError,
                timestamp
            }
        });

    } catch (error) {
        logger.error(`${logPrefix} Error al procesar HIJO_FALLIDO:`, error);
    }
}, { id: 'sistema-hijo-fallido-handler' });


// monitoreo.js debe solo OBSERVAR (registrarEvento) no CONTROLAR (registrarControlador).
// ================================================================================

/**
 * Notifica un error crítico a los administradores del sistema.
 * @private
 * @param {Object} params - Parámetros del error
 * @param {string} params.codigo - Código del error
 * @param {string} params.mensaje - Mensaje de error
 * @param {string} params.origen - Origen del error
 * @param {number} params.timestamp - Marca de tiempo del error
 * @param {Object} [params.contexto] - Contexto adicional
 */
async function notificarErrorCritico({ codigo, mensaje, origen, timestamp, contexto = {} }) {
    const notificacion = {
        destino: 'sistema-monitoreo',
        tipo: 'MONITOREO.ERROR_CRITICO',
        origen: 'manejador-errores',
        mensajeId: generarIdUnico(),
        timestamp,
        datos: {
            codigo,
            mensaje,
            origen,
            timestamp,
            contexto,
            nivel: 'critico'
        }
    };

    // Enviar notificación
    await enviarMensaje(notificacion);
    
    // Registrar en el historial de errores críticos
    estadoSistema.erroresCriticos = estadoSistema.erroresCriticos || [];
    estadoSistema.erroresCriticos.push({
        id: notificacion.mensajeId,
        timestamp,
        codigo,
        mensaje,
        origen
    });

    // Mantener solo los últimos 50 errores críticos
    if (estadoSistema.erroresCriticos.length > 50) {
        estadoSistema.erroresCriticos = estadoSistema.erroresCriticos.slice(-50);
    }
}

/**
 * Obtiene la dirección IP del cliente.
 * @private
 * @returns {string} Dirección IP o 'desconocida' si no se puede determinar
 */
function obtenerDireccionIP() {
    try {
        // En un entorno de navegador, esta información puede no estar disponible
        // o puede requerir configuración adicional del servidor
        if (typeof window !== 'undefined' && window.connection) {
            return window.connection.remoteAddress || 'desconocida';
        }
        return 'desconocida';
    } catch (error) {
        return 'error-obteniendo-ip';
    }
}

/**
 * Registra una acción importante para seguimiento.
 * @private
 * @param {Object} params - Parámetros de la acción
 */
function registrarAccionImportante({ id, accion, datos, notificacion }) {
    estadoSistema.accionesImportantes = estadoSistema.accionesImportantes || [];
    estadoSistema.accionesImportantes.push({
        id,
        accion,
        datos,
        notificacion,
        timestamp: Date.now(),
        estado: 'pendiente'
    });
    
    // Mantener un máximo de 50 acciones importantes
    if (estadoSistema.accionesImportantes.length > 50) {
        estadoSistema.accionesImportantes = estadoSistema.accionesImportantes.slice(-50);
    }
}

/**
 * Obtiene componentes que dependen del componente especificado.
 * @private
 * @param {string} componenteId - ID del componente
 * @returns {Array<string>} Lista de IDs de componentes dependientes
 */
function obtenerComponentesDependientes(componenteId) {
    const dependientes = [];
    
    if (estadoSistema.componentes) {
        Object.entries(estadoSistema.componentes).forEach(([id, componente]) => {
            if (componente.dependencias && componente.dependencias.includes(componenteId)) {
                dependientes.push(id);
            }
        });
    }
    
    return dependientes;
}

/**
 * Controlador: SISTEMA.ERROR
 * Maneja mensajes de error del sistema
 */
registrarControlador(TIPOS_MENSAJE.SISTEMA.ERROR, async (mensaje) => {
    const logPrefix = `[SISTEMA.ERROR][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje de error sin origen, no se puede procesar';
            logger.warn(`[SISTEMA.ERROR] ${errorMsg}`, { mensaje });
            return;
        }

        const { 
            mensaje: mensajeError, 
            error: errorMensaje,
            codigo = 'ERROR_DESCONOCIDO', 
            severidad = 'medio',
            contexto = {}
        } = mensaje.datos || {};

        const mensajeFinal = mensajeError || errorMensaje;

        if (!mensajeFinal) {
            logger.warn(`${logPrefix} Mensaje de error sin descripción`, { mensaje });
            return;
        }

        // 2. Registrar el error según su severidad
        const datosError = {
            mensajeId,
            origen: mensaje.origen,
            codigo,
            severidad,
            timestamp,
            contexto,
            stack: contexto.stack || new Error().stack
        };

        switch (severidad.toLowerCase()) {
            case 'bajo':
                logger.warn(`${logPrefix} ${mensajeFinal}`, datosError);
                break;
            case 'alto':
            case 'critico':
                logger.error(`${logPrefix} [${codigo}] ${mensajeFinal}`, datosError);
                
                // Para errores críticos, notificar a los administradores
                if (severidad.toLowerCase() === 'critico') {
                    try {
                        await notificarErrorCritico({
                            codigo,
                            mensaje: mensajeFinal,
                            origen: mensaje.origen,
                            timestamp,
                            contexto
                        });
                    } catch (notifError) {
                        logger.error(`${logPrefix} Error al notificar error crítico: ${notifError.message}`, {
                            errorOriginal: mensajeFinal,
                            errorNotificacion: notifError
                        });
                    }
                }
                break;
            case 'medio':
            default:
                logger.error(`${logPrefix} [${codigo}] ${mensajeFinal}`, datosError);
        }

        // 3. Actualizar el estado global con el error
        estadoSistema.errores = estadoSistema.errores || [];
        estadoSistema.errores.push({
            id: mensajeId,
            timestamp,
            origen: mensaje.origen,
            codigo,
            severidad,
            mensaje: mensajeError,
            contexto
        });

        // Mantener solo los últimos 100 errores
        if (estadoSistema.errores.length > 100) {
            estadoSistema.errores = estadoSistema.errores.slice(-100);
        }

        // 4. Error ya procesado y loggeado arriba
        // No se requiere notificación adicional de UI desde el contexto del padre

        // 5. Enviar confirmación al remitente
        if (mensaje.origen !== 'sistema') {
            try {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
                    origen: 'manejador-errores',
                    mensajeId: generarIdUnico(),
                    datos: {
                        mensajeOriginalId: mensajeId,
                        timestamp,
                        estado: 'procesado',
                        accion: 'error_procesado'
                    }
                });
            } catch (confirmError) {
                logger.error(`${logPrefix} Error al enviar confirmación: ${confirmError.message}`, {
                    errorOriginal: mensajeError,
                    errorConfirmacion: confirmError
                });
            }
        }

    } catch (error) {
        const errorNoManejado = `Error no manejado en SISTEMA.ERROR: ${error.message}`;
        logger.critical(`[SISTEMA.ERROR][CRITICO] ${errorNoManejado}`, {
            error,
            mensajeOriginal: mensaje,
            stack: error.stack
        });
        
        // Intentar notificar del error crítico
        try {
            await notificarErrorCritico({
                codigo: 'ERROR_EN_MANEJADOR_DE_ERRORES',
                mensaje: errorNoManejado,
                origen: 'sistema',
                timestamp: Date.now(),
                contexto: {
                    errorOriginal: mensaje,
                    errorManejador: error
                }
            });
        } catch (notifError) {
            // Si falla la notificación, no hay mucho más que podamos hacer
            console.error('Error crítico en el manejador de errores:', notifError);
        }
    }
});

/**
 * Controlador: SISTEMA.NOTIFICACION
 * Maneja notificaciones del sistema
 */
registrarControlador(TIPOS_MENSAJE.SISTEMA.NOTIFICACION, async (mensaje) => {
    const logPrefix = `[SISTEMA.NOTIFICACION][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            logger.warn(`${logPrefix} Notificación sin origen, ignorando`);
            return;
        }

        const { 
            titulo = 'Notificación',
            mensaje: contenido,
            tipo = 'info',
            duracion = 5000,
            accion,
            datosAccion = {},
            importante = false,
            metadata = {}
        } = mensaje.datos || {};

        // Validar campos requeridos
        if (!contenido) {
            logger.warn(`${logPrefix} Notificación sin contenido, ignorando`, { mensaje });
            return;
        }

        // Validar tipo de notificación
        const tiposValidos = ['info', 'exito', 'advertencia', 'error', 'carga'];
        const tipoNotificacion = tiposValidos.includes(tipo) ? tipo : 'info';

        // 2. Crear objeto de notificación normalizado
        const notificacion = {
            id: mensajeId,
            timestamp,
            origen: mensaje.origen,
            titulo,
            mensaje: contenido,
            tipo: tipoNotificacion,
            duracion: tipoNotificacion === 'error' ? Math.max(duracion, 10000) : duracion,
            accion,
            datosAccion,
            importante,
            estado: 'nueva',
            metadata: {
                ...metadata,
                ip: obtenerDireccionIP()
            }
        };

        logger.info(`${logPrefix} Procesando notificación`, { 
            mensajeId,
            tipo: tipoNotificacion,
            importante,
            origen: mensaje.origen
        });

        // 3. Registrar en el historial de notificaciones
        estadoSistema.notificaciones = estadoSistema.notificaciones || [];
        estadoSistema.notificaciones.push({
            ...notificacion,
            estado: 'enviada'
        });

        // Mantener un máximo de 100 notificaciones en el historial
        if (estadoSistema.notificaciones.length > 100) {
            estadoSistema.notificaciones = estadoSistema.notificaciones.slice(-100);
        }

        // 4. Determinar destinatarios
        const destinatarios = ['sistema-ui'];
        
        // Si es una notificación importante, asegurarse de que el usuario la vea
        if (importante) {
            // Forzar mostrar en la interfaz principal
            notificacion.importante = true;
            notificacion.duracion = 0; // No desaparecer automáticamente
            
            // Si hay una acción asociada, asegurarse de que el sistema de acciones la conozca
            if (accion) {
                registrarAccionImportante({
                    id: mensajeId,
                    accion,
                    datos: datosAccion,
                    notificacion: {
                        titulo,
                        mensaje: contenido,
                        tipo: tipoNotificacion
                    }
                });
            }
        }

        // 5. Enviar notificación a los componentes relevantes
        const envios = destinatarios.map(async destino => {
            try {
                await enviarMensaje({
                    destino,
                    tipo: 'UI.MOSTRAR_NOTIFICACION',
                    origen: 'sistema-notificaciones',
                    mensajeId: generarIdUnico(),
                    timestamp,
                    datos: notificacion
                });
                
                // Actualizar estado de la notificación
                const notifIndex = estadoSistema.notificaciones.findIndex(n => n.id === mensajeId);
                if (notifIndex !== -1) {
                    estadoSistema.notificaciones[notifIndex].estado = 'entregada';
                    estadoSistema.notificaciones[notifIndex].destinos = [
                        ...(estadoSistema.notificaciones[notifIndex].destinos || []),
                        { destino, estado: 'entregada', timestamp: Date.now() }
                    ];
                }
                
                return { destino, estado: 'entregada' };
            } catch (error) {
                logger.error(`${logPrefix} Error al enviar notificación a ${destino}`, {
                    error: error.message,
                    notificacionId: mensajeId
                });
                
                // Actualizar estado de error
                const notifIndex = estadoSistema.notificaciones.findIndex(n => n.id === mensajeId);
                if (notifIndex !== -1) {
                    estadoSistema.notificaciones[notifIndex].estado = 'error';
                    estadoSistema.notificaciones[notifIndex].error = error.message;
                    estadoSistema.notificaciones[notifIndex].destinos = [
                        ...(estadoSistema.notificaciones[notifIndex].destinos || []),
                        { 
                            destino, 
                            estado: 'error', 
                            timestamp: Date.now(),
                            error: error.message
                        }
                    ];
                }
                
                return { destino, estado: 'error', error: error.message };
            }
        });

        // Esperar a que se completen todos los envíos
        const resultados = await Promise.all(envios);
        
        // 6. Registrar resultado
        const entregadas = resultados.filter(r => r.estado === 'entregada').length;
        const errores = resultados.filter(r => r.estado === 'error');
        
        logger.info(`${logPrefix} Notificación procesada`, { 
            mensajeId,
            entregadas,
            errores: errores.length,
            detalles: resultados
        });

        // 7. Enviar confirmación al remitente
        if (mensaje.origen !== 'sistema') {
            try {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
                    origen: 'sistema-notificaciones',
                    mensajeId: generarIdUnico(),
                    timestamp: Date.now(),
                    datos: {
                        mensajeOriginalId: mensajeId,
                        estado: 'procesado',
                        accion: 'notificacion_procesada',
                        detalles: {
                            entregadas,
                            errores: errores.length,
                            notificacionId: mensajeId
                        }
                    }
                });
            } catch (confirmError) {
                logger.error(`${logPrefix} Error al enviar confirmación: ${confirmError.message}`, {
                    notificacionId: mensajeId,
                    error: confirmError
                });
            }
        }

    } catch (error) {
        const errorNoManejado = `Error no manejado en SISTEMA.NOTIFICACION: ${error.message}`;
        logger.error(`[SISTEMA.NOTIFICACION][CRITICO] ${errorNoManejado}`, {
            error: {
                mensaje: error.message,
                stack: error.stack,
                ...error
            },
            mensajeOriginal: mensaje
        });
        
        // Intentar notificar del error crítico
        try {
            await enviarMensaje({
                destino: 'sistema-monitoreo',
                tipo: 'MONITOREO.ERROR_CRITICO',
                origen: 'sistema-notificaciones',
                mensajeId: generarIdUnico(),
                timestamp: Date.now(),
                datos: {
                    codigo: 'ERROR_EN_NOTIFICACION',
                    mensaje: errorNoManejado,
                    origen: 'sistema',
                    contexto: {
                        errorOriginal: mensaje,
                        errorManejador: error
                    },
                    nivel: 'critico'
                }
            });
        } catch (notifError) {
            // Si falla la notificación, no hay mucho más que podamos hacer
            console.error('Error crítico en el manejador de notificaciones:', notifError);
        }
    }
});

/**
 * Controlador: SISTEMA.INICIALIZACION
 * Maneja la inicialización de componentes del sistema
 */
registrarControlador(TIPOS_MENSAJE.SISTEMA.INICIALIZACION, async (mensaje) => {
    const logPrefix = `[SISTEMA.INICIALIZACION][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    const metadata = {
        reintentar: true,
        maxReintentos: 3,
        ...(mensaje.metadata || {})
    };
    
    // Función para enviar respuesta de error estandarizada
    const enviarError = (codigo, mensajeError, detalles = {}) => {
        const errorData = {
            codigo,
            mensaje: mensajeError,
            mensajeOriginalId: mensajeId,
            timestamp: Date.now(),
            componenteId: mensaje?.datos?.componenteId,
            ...detalles
        };
        
        logger[codigo.startsWith('ERROR_CRITICO') ? 'error' : 'warn'](
            `${logPrefix} ${mensajeError}`, 
            { ...detalles, codigo, mensajeId }
        );
        
        return enviarMensaje({
            destino: mensaje?.origen || 'sistema-monitoreo',
            tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
            origen: 'sistema-inicializacion',
            mensajeId: generarIdUnico(),
            timestamp: Date.now(),
            datos: errorData
        });
    };
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            return enviarError(
                'ERROR_INICIALIZACION_SIN_ORIGEN',
                'Mensaje de inicialización sin origen',
                { severidad: 'alto' }
            );
        }

        // Extraer y validar parámetros con valores por defecto
        const { 
            componenteId, 
            config = {},
            version = '1.0.0',
            dependencias = [],
            timeout = 30000
        } = mensaje.datos || {};
        
        // 2. Validar parámetros obligatorios
        if (!componenteId) {
            return enviarError(
                'ERROR_COMPONENTE_ID_REQUERIDO',
                'Falta el identificador del componente (componenteId)',
                { origen: mensaje.origen, severidad: 'alto' }
            );
        }
        
        // Validar que el componente no esté ya inicializado
        if (estadoSistema.componentes?.[componenteId]?.estado === 'inicializado') {
            logger.debug(`${logPrefix} El componente ya está inicializado`, { componenteId });
            return; // No hacer nada si ya está inicializado
        }

        // 3. Registrar inicio de la inicialización con información detallada
        logger.info(`${logPrefix} Iniciando inicialización del componente`, { 
            componenteId,
            version,
            origen: mensaje.origen,
            tieneConfig: !!Object.keys(config).length,
            numDependencias: dependencias.length,
            mensajeId,
            metadata
        });

        // 4. Inicializar el estado del componente con estructura detallada
        estadoSistema.componentes = estadoSistema.componentes || {};
        const ahora = Date.now();
        const estadoComponente = {
            // Estado básico
            estado: 'inicializando',
            version,
            timestampInicio: ahora,
            timestampUltimaActualizacion: ahora,
            
            // Origen y configuración
            origen: mensaje.origen,
            config,
            dependencias,
            
            // Metadatos
            metadata: {
                ...metadata,
                ip: obtenerDireccionIP(),
                userAgent: navigator?.userAgent || 'desconocido'
            },
            
            // Métricas y seguimiento
            metricas: {
                intentosInicializacion: 1,
                ultimoError: null,
                ultimoExito: null,
                tiempoPromedioInicializacion: null,
                totalInicializaciones: 0,
                totalErrores: 0,
                
                // Historial de estados
                historialEstados: [{
                    estado: 'inicializando',
                    timestamp: ahora,
                    detalles: { fase: 'inicio' }
                }],
                
                // Estadísticas de rendimiento
                estadisticas: {
                    tiempoInicializacion: null,
                    memoriaInicial: null,
                    memoriaMaxima: null
                },
                
                // Dependencias
                dependenciasResueltas: {},
                dependenciasPendientes: [...dependencias]
            }
        };
        
        // Asignar el estado al componente
        estadoSistema.componentes[componenteId] = estadoComponente;

        // 5. Verificar dependencias con manejo mejorado
        const verificarDependencias = () => {
            return dependencias.reduce((result, depId) => {
                const dependencia = estadoSistema.componentes?.[depId];
                
                if (!dependencia) {
                    result.faltantes.push({ id: depId, razon: 'no_registrado' });
                } else if (dependencia.estado !== 'inicializado') {
                    const razon = dependencia.estado === 'error' ? 'con_error' : 'no_inicializado';
                    result.faltantes.push({ id: depId, razon, estado: dependencia.estado });
                } else {
                    estadoComponente.metricas.dependenciasResueltas[depId] = {
                        version: dependencia.version,
                        timestamp: dependencia.timestampInicializacion
                    };
                    result.disponibles.push(depId);
                }
                
                return result;
            }, { disponibles: [], faltantes: [] });
        };
        
        const { disponibles, faltantes } = verificarDependencias();
        
        // Si hay dependencias faltantes, manejarlas apropiadamente
        if (faltantes.length > 0) {
            const errorMsg = `Dependencias no disponibles: ${faltantes.map(d => `${d.id} (${d.razon})`).join(', ')}`;
            
            // Actualizar estado del componente
            estadoComponente.estado = 'error';
            estadoComponente.error = errorMsg;
            estadoComponente.metricas.ultimoError = {
                codigo: 'DEPENDENCIAS_NO_DISPONIBLES',
                mensaje: errorMsg,
                timestamp: Date.now(),
                detalles: { faltantes }
            };
            estadoComponente.metricas.historialEstados.push({
                estado: 'error',
                timestamp: Date.now(),
                motivo: errorMsg,
                detalles: { faltantes }
            });
            estadoComponente.metricas.totalErrores++;
            
            // Notificar error con más contexto
            return enviarError(
                'DEPENDENCIAS_NO_DISPONIBLES',
                errorMsg,
                { 
                    componenteId,
                    version,
                    dependenciasFaltantes: faltantes,
                    dependenciasDisponibles: disponibles,
                    severidad: 'alto',
                    accionRecomendada: 'Verificar que las dependencias estén correctamente inicializadas',
                    contexto: {
                        tiempoEspera: timeout,
                        timestampInicio: timestamp,
                        tiempoTranscurrido: Date.now() - timestamp
                    }
                }
            );
        }
        
        // 6. Ejecutar lógica de inicialización específica del componente con manejo de tiempo de espera
        try {
            logger.debug(`${logPrefix} Todas las dependencias disponibles, iniciando inicialización`, {
                componenteId,
                dependencias: disponibles,
                tiempoEspera: timeout
            });
            
            // Configurar timeout para la inicialización
            const inicializacionPromise = (async () => {
                // Aquí iría la lógica de inicialización específica
                // Por ejemplo: await inicializarComponente(componenteId, config);
                
                // Simular tiempo de inicialización (eliminar en producción)
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Simular error aleatorio para pruebas (eliminar en producción)
                if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
                    throw new Error('Error simulado durante la inicialización (solo en desarrollo)');
                }
                
                return { exito: true };
            })();
            
            // Aplicar timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(
                    () => reject(new Error(`Tiempo de espera agotado (${timeout}ms)`)), 
                    timeout
                )
            );
            
            // Esperar a que termine la inicialización o se agote el tiempo
            await Promise.race([inicializacionPromise, timeoutPromise]);
            
            // Si llegamos aquí, la inicialización fue exitosa
            const tiempoInicializacion = Date.now() - ahora;
            
            // 7. Actualizar estado a inicializado con métricas detalladas
            estadoComponente.estado = 'inicializado';
            estadoComponente.timestampInicializacion = Date.now();
            estadoComponente.timestampUltimaActualizacion = Date.now();
            estadoComponente.metricas.ultimoExito = {
                timestamp: Date.now(),
                tiempoInicializacion,
                memoria: performance?.memory?.usedJSHeapSize || null
            };
            estadoComponente.metricas.tiempoPromedioInicializacion = tiempoInicializacion;
            estadoComponente.metricas.totalInicializaciones = 1;
            estadoComponente.metricas.historialEstados.push({
                estado: 'inicializado',
                timestamp: Date.now(),
                detalles: { 
                    tiempoInicializacion,
                    memoria: performance?.memory?.usedJSHeapSize || null
                }
            });
            
            // Registrar éxito
            logger.info(`${logPrefix} Componente inicializado exitosamente`, { 
                componenteId,
                tiempoInicializacion,
                memoria: performance?.memory ? {
                    usedJSHeapSize: (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2) + ' MB',
                    totalJSHeapSize: (performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(2) + ' MB',
                    jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2) + ' MB'
                } : 'No disponible'
            });

            // 8. Notificar a componentes interesados de manera asíncrona
            const notificaciones = [];
            
            // Notificar al componente solicitante
            notificaciones.push(
                Promise.resolve(enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.INICIALIZACION_COMPLETADA,
                    origen: 'sistema-inicializacion',
                    mensajeId: generarIdUnico(),
                    timestamp: Date.now(),
                    datos: {
                        componenteId,
                        estado: 'inicializado',
                        timestamp: Date.now(),
                        mensajeOriginalId: mensajeId,
                        version,
                        config,
                        metricas: {
                            tiempoInicializacion,
                            memoria: performance?.memory?.usedJSHeapSize || null,
                            dependencias: estadoComponente.metricas.dependenciasResueltas
                        }
                    }
                })).catch(error => 
                    logger.error(`${logPrefix} Error al notificar al componente`, { 
                        componenteId, 
                        error: error.message 
                    })
                )
            );
            
            // Notificar al sistema de monitoreo
            notificaciones.push(
                Promise.resolve(enviarMensaje({
                    destino: 'sistema-monitoreo',
                    tipo: 'MONITOREO.COMPONENTE_INICIALIZADO',
                    origen: 'sistema-inicializacion',
                    mensajeId: generarIdUnico(),
                    timestamp: Date.now(),
                    datos: {
                        componenteId,
                        version,
                        tiempoInicializacion,
                        origen: mensaje.origen,
                        memoria: performance?.memory?.usedJSHeapSize || null,
                        dependencias: estadoComponente.metricas.dependenciasResueltas,
                        metadata: estadoComponente.metadata
                    }
                })).catch(error => 
                    logger.error(`${logPrefix} Error al notificar al sistema de monitoreo`, { 
                        componenteId, 
                        error: error.message 
                    })
                )
            );
            
            // Notificar a los componentes que dependen de este
            const dependientes = obtenerComponentesDependientes(componenteId);
            if (dependientes.length > 0) {
                logger.debug(`${logPrefix} Notificando a componentes dependientes`, { 
                    componenteId, 
                    dependientes 
                });
                
                notificaciones.push(
                    ...dependientes.map(depId => 
                        Promise.resolve(enviarMensaje({
                            destino: depId,
                            tipo: 'SISTEMA.DEPENDENCIA_DISPONIBLE',
                            origen: 'sistema-inicializacion',
                            mensajeId: generarIdUnico(),
                            timestamp: Date.now(),
                            datos: {
                                dependencia: componenteId,
                                version,
                                estado: 'disponible',
                                timestamp: Date.now()
                            }
                        })).catch(error => 
                            logger.warn(`${logPrefix} Error al notificar a componente dependiente`, { 
                                componenteId, 
                                dependiente: depId,
                                error: error.message 
                            })
                        )
                    )
                );
            }
            
            // Esperar a que todas las notificaciones se completen (sin bloquear)
            Promise.allSettled(notificaciones).then(resultados => {
                const exitosos = resultados.filter(r => r.status === 'fulfilled').length;
                const fallidos = resultados.length - exitosos;
                
                if (fallidos > 0) {
                    logger.warn(`${logPrefix} Algunas notificaciones fallaron`, { 
                        componenteId,
                        exitosos,
                        fallidos,
                        errores: resultados
                            .filter(r => r.status === 'rejected')
                            .map(r => r.reason?.message || 'Error desconocido')
                    });
                }
            });

        } catch (errorInicializacion) {
            // Manejo mejorado de errores con reintentos automáticos
            const esErrorTemporal = errorInicializacion.message.includes('tiempo de espera') || 
                                  errorInicializacion.message.includes('conectarse');
            
            const errorMsg = `Error durante la inicialización: ${errorInicializacion.message}`;
            const errorData = {
                codigo: esErrorTemporal ? 'ERROR_TEMPORAL_INICIALIZACION' : 'ERROR_INICIALIZACION',
                mensaje: errorMsg,
                timestamp: Date.now(),
                stack: process.env.NODE_ENV === 'development' ? errorInicializacion.stack : undefined,
                esRecuperable: esErrorTemporal,
                intentoActual: estadoComponente.metricas.intentosInicializacion,
                maxReintentos: metadata.maxReintentos
            };
            
            // Actualizar estado del componente
            estadoComponente.estado = esErrorTemporal ? 'reintentando' : 'error';
            estadoComponente.error = errorMsg;
            estadoComponente.metricas.ultimoError = errorData;
            estadoComponente.metricas.totalErrores++;
            estadoComponente.metricas.historialEstados.push({
                estado: esErrorTemporal ? 'reintentando' : 'error',
                timestamp: Date.now(),
                motivo: errorMsg,
                detalles: {
                    codigo: errorData.codigo,
                    esRecuperable: esErrorTemporal,
                    intento: estadoComponente.metricas.intentosInicializacion,
                    maxReintentos: metadata.maxReintentos
                }
            });
            
            // Manejar reintentos automáticos para errores temporales
            if (esErrorTemporal && 
                metadata.reintentar && 
                estadoComponente.metricas.intentosInicializacion < metadata.maxReintentos) {
                
                const tiempoEspera = Math.min(
                    1000 * Math.pow(2, estadoComponente.metricas.intentosInicializacion - 1),
                    30000 // Máximo 30 segundos entre reintentos
                );
                
                logger.warn(`${logPrefix} Reintentando inicialización (${estadoComponente.metricas.intentosInicializacion}/${metadata.maxReintentos})`, {
                    componenteId,
                    tiempoEspera,
                    error: errorInicializacion.message
                });
                
                // Incrementar contador de reintentos
                estadoComponente.metricas.intentosInicializacion++;
                
                // Programar reintento
                setTimeout(() => {
                    logger.info(`${logPrefix} Reintentando inicialización...`, { 
                        componenteId,
                        intento: estadoComponente.metricas.intentosInicializacion,
                        maxReintentos: metadata.maxReintentos
                    });
                    
                    // Volver a procesar el mensaje original
                    Promise.resolve(
                        registrarControlador.handlers[TIPOS_MENSAJE.SISTEMA.INICIALIZACION]
                            .fn({ ...mensaje, metadata: { ...metadata, esReintento: true } })
                    ).catch(error => 
                        logger.error(`${logPrefix} Error en reintento de inicialización`, { 
                            componenteId, 
                            error: error.message 
                        })
                    );
                }, tiempoEspera);
                
                return; // No notificar error todavía, estamos reintentando
            }
            
            // Si llegamos aquí, es un error fatal o se agotaron los reintentos
            logger.error(`${logPrefix} Error fatal en inicialización`, { 
                componenteId,
                error: errorInicializacion,
                stack: errorInicializacion.stack,
                intentos: estadoComponente.metricas.intentosInicializacion,
                maxReintentos: metadata.maxReintentos
            });
            
            // Notificar error con todos los detalles necesarios
            return enviarError(
                errorData.codigo,
                errorMsg,
                { 
                    componenteId,
                    version,
                    esRecuperable: esErrorTemporal,
                    intentos: estadoComponente.metricas.intentosInicializacion,
                    maxReintentos: metadata.maxReintentos,
                    contexto: {
                        tiempoEspera: timeout,
                        timestampInicio: timestamp,
                        tiempoTranscurrido: Date.now() - timestamp,
                        error: errorInicializacion.message,
                        stack: process.env.NODE_ENV === 'development' ? errorInicializacion.stack : undefined
                    },
                    accionRecomendada: esErrorTemporal ? 
                        'El sistema reintentará automáticamente. Verifique la conectividad si el problema persiste.' :
                        'Revise los logs del sistema y la configuración del componente.'
                }
            );
        }

    } catch (error) {
        const errorNoManejado = `Error no manejado en SISTEMA.INICIALIZACION: ${error.message}`;
        const componenteId = mensaje?.datos?.componenteId || 'desconocido';
        const errorId = generarIdUnico();
        const timestampError = Date.now();
        
        // Registrar el error con información detallada
        logger.critical(`[SISTEMA.INICIALIZACION][CRITICO][${errorId}] ${errorNoManejado}`, {
            error: {
                id: errorId,
                mensaje: error.message,
                stack: error.stack,
                nombre: error.name,
                ...(error.cause && { causa: error.cause }),
                ...(error.code && { codigo: error.code })
            },
            mensajeOriginal: {
                ...mensaje,
                // Evitar serialización circular
                datos: mensaje?.datos ? { 
                    ...mensaje.datos, 
                    config: mensaje.datos.config ? '[CONFIGURACION]' : undefined 
                } : undefined
            },
            componenteId,
            timestamp: timestampError,
            entorno: process.env.NODE_ENV || 'desarrollo',
            userAgent: navigator?.userAgent,
            url: window?.location?.href,
            memoria: performance?.memory ? {
                usedJSHeapSize: (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2) + ' MB',
                totalJSHeapSize: (performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(2) + ' MB',
                jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2) + ' MB'
            } : 'No disponible'
        });
        
        // Actualizar el estado del componente si es posible
        if (componenteId && estadoSistema.componentes?.[componenteId]) {
            const estadoComponente = estadoSistema.componentes[componenteId];
            estadoComponente.estado = 'error_critico';
            estadoComponente.error = errorNoManejado;
            estadoComponente.metricas = estadoComponente.metricas || {};
            estadoComponente.metricas.ultimoError = {
                id: errorId,
                codigo: 'ERROR_CRITICO_INICIALIZACION',
                mensaje: errorNoManejado,
                timestamp: timestampError,
                esCritico: true,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            };
            estadoComponente.metricas.historialEstados = estadoComponente.metricas.historialEstados || [];
            estadoComponente.metricas.historialEstados.push({
                estado: 'error_critico',
                timestamp: timestampError,
                motivo: errorNoManejado,
                detalles: {
                    errorId,
                    codigo: 'ERROR_CRITICO_INICIALIZACION',
                    esRecuperable: false
                }
            });
        }
        
        // Notificar error crítico al sistema de monitoreo
        try {
            const notificacionError = {
                destino: 'sistema-monitoreo',
                tipo: 'MONITOREO.ERROR_CRITICO',
                origen: 'sistema-inicializacion',
                mensajeId: generarIdUnico(),
                timestamp: timestampError,
                datos: {
                    id: errorId,
                    codigo: 'ERROR_CRITICO_INICIALIZACION',
                    mensaje: errorNoManejado,
                    origen: 'sistema',
                    nivel: 'critico',
                    timestamp: timestampError,
                    contexto: {
                        componenteId,
                        version: mensaje?.datos?.version,
                        entorno: process.env.NODE_ENV || 'desarrollo',
                        error: {
                            nombre: error.name,
                            mensaje: error.message,
                            ...(error.cause && { causa: error.cause }),
                            ...(error.code && { codigo: error.code }),
                            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                        },
                        mensajeOriginal: {
                            tipo: mensaje?.tipo,
                            origen: mensaje?.origen,
                            destino: mensaje?.destino,
                            mensajeId: mensaje?.mensajeId,
                            timestamp: mensaje?.timestamp
                        },
                        estadoSistema: {
                            memoria: performance?.memory ? {
                                usedJSHeapSize: performance.memory.usedJSHeapSize,
                                totalJSHeapSize: performance.memory.totalJSHeapSize,
                                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                            } : null,
                            timestamp: Date.now(),
                            userAgent: navigator?.userAgent,
                            url: window?.location?.href,
                            online: navigator?.onLine,
                            hardwareConcurrency: navigator?.hardwareConcurrency,
                            deviceMemory: navigator?.deviceMemory
                        }
                    },
                    accionRecomendada: [
                        'Revisar los logs del sistema para obtener más detalles',
                        'Verificar la conectividad de red si es un error de tiempo de espera',
                        'Validar la configuración del componente',
                        'Reiniciar el componente o la aplicación si es necesario'
                    ]
                }
            };
            
            // Enviar notificación de error (sin esperar respuesta)
            Promise.resolve(enviarMensaje(notificacionError)).catch(notifError => 
                console.error('Error al notificar error crítico:', notifError)
            );
            
        } catch (notifError) {
            console.error('Error crítico en el manejador de inicialización:', notifError);
            
            // Último recurso: intentar registrar el error en localStorage si está disponible
            try {
                const erroresPrevios = JSON.parse(localStorage.getItem('errores_criticos') || '[]');
                erroresPrevios.push({
                    id: errorId,
                    timestamp: timestampError,
                    error: {
                        mensaje: error.message,
                        stack: error.stack,
                        nombre: error.name
                    },
                    componenteId,
                    mensajeOriginal: {
                        tipo: mensaje?.tipo,
                        origen: mensaje?.origen,
                        destino: mensaje?.destino,
                        mensajeId: mensaje?.mensajeId
                    }
                });
                
                // Mantener solo los últimos 10 errores
                if (erroresPrevios.length > 10) {
                    erroresPrevios.shift();
                }
                
                localStorage.setItem('errores_criticos', JSON.stringify(erroresPrevios));
            } catch (storageError) {
                console.error('No se pudo guardar el error en localStorage:', storageError);
            }
        }
    }
});

registrarControlador(TIPOS_MENSAJE.SISTEMA.INICIALIZACION_COMPLETADA, async (mensaje) => {
    const logPrefix = `[SISTEMA.INICIALIZACION_COMPLETADA][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje de confirmación sin origen';
            logger.warn(`${logPrefix} ${errorMsg}`);
            
            return enviarMensaje({
                destino: 'sistema-monitoreo',
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                origen: 'sistema-inicializacion',
                mensajeId: generarIdUnico(),
                timestamp,
                datos: {
                    codigo: 'ERROR_CONFIRMACION_SIN_ORIGEN',
                    mensaje: errorMsg,
                    severidad: 'alto',
                    contexto: { mensajeId }
                }
            });
        }

        const { 
            componenteId, 
            estado = 'desconocido',
            timestamp: timestampInicializacion = timestamp,
            metricas = {},
            detalles = {},
            mensajeId: mensajeOriginalId
        } = mensaje.datos || {};

        // 2. Validación de parámetros obligatorios
        if (!componenteId) {
            const errorMsg = 'Falta el identificador del componente (componenteId)';
            logger.warn(`${logPrefix} ${errorMsg}`, { origen: mensaje.origen });
            
            return enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                origen: 'sistema-inicializacion',
                mensajeId: generarIdUnico(),
                timestamp,
                datos: {
                    codigo: 'ERROR_COMPONENTE_ID_REQUERIDO',
                    mensaje: errorMsg,
                    mensajeOriginalId: mensajeId,
                    contexto: { origen: mensaje.origen }
                }
            });
        }

        // 3. Validar estado
        const estadosValidos = ['inicializado', 'error', 'advertencia', 'pendiente', 'en_progreso'];
        const estadoNormalizado = estadosValidos.includes(estado) ? estado : 'desconocido';

        // 4. Actualizar el estado del componente
        estadoSistemaGlobal.componentes = estadoSistemaGlobal.componentes || {};
        const componente = estadoSistemaGlobal.componentes[componenteId] || {
            id: componenteId,
            estado: 'desconocido',
            metricas: {},
            historialEstados: []
        };

        // 5. Registrar el cambio de estado
        const estadoAnterior = componente.estado;
        componente.estado = estadoNormalizado;
        componente.timestampUltimaActualizacion = timestamp;
        componente.ultimoEstado = {
            estado: estadoNormalizado,
            timestamp,
            origen: mensaje.origen,
            detalles
        };

        // 6. Actualizar métricas
        if (Object.keys(metricas).length > 0) {
            componente.metricas = {
                ...componente.metricas,
                ...metricas,
                ultimaActualizacion: timestamp
            };
        }

        // 7. Registrar en el historial
        componente.historialEstados = componente.historialEstados || [];
        componente.historialEstados.push({
            estado: estadoNormalizado,
            timestamp,
            origen: mensaje.origen,
            detalles: Object.keys(detalles).length > 0 ? detalles : undefined
        });

        // 8. Limitar el tamaño del historial
        if (componente.historialEstados.length > 50) {
            componente.historialEstados = componente.historialEstados.slice(-50);
        }

        // 9. Guardar el componente actualizado
        estadoSistemaGlobal.componentes[componenteId] = componente;

        logger.info(`${logPrefix} Estado del componente actualizado`, { 
            componenteId,
            estadoAnterior,
            estadoNuevo: estadoNormalizado,
            tiempoInicializacion: timestamp - (timestampInicializacion || timestamp),
            tieneMetricas: Object.keys(metricas).length > 0,
            tieneDetalles: Object.keys(detalles).length > 0
        });

        // 10. Manejar el estado específico
        switch (estadoNormalizado) {
            case 'inicializado':
                await manejarInicializacionExitosa({
                    componenteId,
                    origen: mensaje.origen,
                    timestamp,
                    mensajeId,
                    mensajeOriginalId,
                    detalles,
                    metricas
                });
                break;
                
            case 'error':
                await manejarErrorInicializacion({
                    componenteId,
                    origen: mensaje.origen,
                    timestamp,
                    mensajeId,
                    mensajeOriginalId,
                    detalles,
                    metricas
                });
                break;
                
            default:
                logger.debug(`${logPrefix} Estado no manejado específicamente: ${estadoNormalizado}`);
        }

        // 11. Confirmar recepción si hay un mensaje original
        if (mensajeOriginalId) {
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
                origen: 'sistema-inicializacion',
                mensajeId: generarIdUnico(),
                timestamp: Date.now(),
                datos: {
                    mensajeOriginalId: mensajeId,
                    estado: 'procesado',
                    accion: 'confirmacion_inicializacion_procesada',
                    componenteId,
                    estadoActual: estadoNormalizado
                }
            });
        }

    } catch (error) {
        const errorNoManejado = `Error no manejado en SISTEMA.INICIALIZACION_COMPLETADA: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, {
            error: {
                mensaje: error.message,
                stack: error.stack,
                ...error
            },
            mensajeOriginal: {
                origen: mensaje?.origen,
                componenteId: mensaje?.datos?.componenteId,
                estado: mensaje?.datos?.estado
            }
        });
        
        // Notificar error crítico
        try {
            await enviarMensaje({
                destino: 'sistema-monitoreo',
                tipo: 'MONITOREO.ERROR_CRITICO',
                origen: 'sistema-inicializacion',
                mensajeId: generarIdUnico(),
                timestamp: Date.now(),
                datos: {
                    codigo: 'ERROR_PROCESANDO_CONFIRMACION',
                    mensaje: errorNoManejado,
                    origen: 'sistema',
                    contexto: {
                        errorOriginal: mensaje,
                        errorManejador: error,
                        componenteId: mensaje?.datos?.componenteId
                    },
                    nivel: 'alto'
                }
            });
        } catch (notifError) {
            console.error('Error crítico al notificar error en confirmación:', notifError);
        }
    }
});

/**
 * Maneja una inicialización exitosa de un componente.
 * @private
 * @param {Object} params - Parámetros de inicialización
 */
async function manejarInicializacionExitosa({
    componenteId,
    origen,
    timestamp,
    mensajeId,
    mensajeOriginalId,
    detalles = {},
    metricas = {}
}) {
    const logPrefix = `[MANEJADOR_INICIALIZACION_EXITOSA][${componenteId}]`;
    
    try {
        // 1. Registrar en el logger
        logger.info(`${logPrefix} Componente inicializado exitosamente`, {
            origen,
            tiempoInicializacion: metricas.tiempoInicializacion || 'desconocido',
            detalles: Object.keys(detalles),
            metricas: Object.keys(metricas)
        });

        // 2. Notificar a los componentes interesados
        await Promise.all([
            // Notificar al sistema de monitoreo
            enviarMensaje({
                destino: 'sistema-monitoreo',
                tipo: 'MONITOREO.COMPONENTE_INICIALIZADO',
                origen: 'sistema-inicializacion',
                mensajeId: generarIdUnico(),
                timestamp,
                datos: {
                    componenteId,
                    origen,
                    timestamp,
                    mensajeOriginalId: mensajeId,
                    detalles,
                    metricas
                }
            }),
            
            // Notificar a los componentes que dependen de este
            notificarDependencias(componenteId, {
                estado: 'inicializado',
                origen,
                timestamp,
                detalles
            })
        ]);

    } catch (error) {
        logger.error(`${logPrefix} Error al manejar inicialización exitosa`, {
            error: error.message,
            stack: error.stack,
            componenteId,
            origen
        });
        throw error;
    }
}

/**
 * Maneja un error durante la inicialización de un componente.
 * @private
 * @param {Object} params - Parámetros del error
 */
async function manejarErrorInicializacion({
    componenteId,
    origen,
    timestamp,
    mensajeId,
    mensajeOriginalId,
    detalles = {},
    metricas = {}
}) {
    const logPrefix = `[MANEJADOR_ERROR_INICIALIZACION][${componenteId}]`;
    
    try {
        const errorMsg = detalles.mensaje || 'Error desconocido durante la inicialización';
        const codigoError = detalles.codigo || 'ERROR_INICIALIZACION_DESCONOCIDO';
        
        // 1. Registrar en el logger
        logger.error(`${logPrefix} Error en inicialización: ${errorMsg}`, {
            origen,
            codigo: codigoError,
            detalles,
            metricas
        });

        // 2. Notificar a los componentes interesados
        await Promise.all([
            // Notificar al sistema de monitoreo
            enviarMensaje({
                destino: 'sistema-monitoreo',
                tipo: 'MONITOREO.ERROR_INICIALIZACION',
                origen: 'sistema-inicializacion',
                mensajeId: generarIdUnico(),
                timestamp,
                datos: {
                    componenteId,
                    origen,
                    timestamp,
                    codigo: codigoError,
                    mensaje: errorMsg,
                    mensajeOriginalId: mensajeId,
                    detalles,
                    metricas
                }
            }),
            
            // Notificar a los componentes que dependen de este
            notificarDependencias(componenteId, {
                estado: 'error',
                origen,
                timestamp,
                error: { codigo: codigoError, mensaje: errorMsg },
                detalles
            })
        ]);

    } catch (error) {
        logger.error(`${logPrefix} Error al manejar error de inicialización`, {
            error: error.message,
            stack: error.stack,
            componenteId,
            origen,
            errorOriginal: detalles
        });
        throw error;
    }
}

/**
 * Notifica a los componentes que dependen del componente especificado.
 * @private
 * @param {string} componenteId - ID del componente
 * @param {Object} estado - Estado actual del componente
 */
async function notificarDependencias(componenteId, estado) {
    // Implementar lógica para encontrar y notificar a los componentes dependientes
    // Esto podría consultar un registro de dependencias o usar un patrón de publicación/suscripción
    
    // Ejemplo simplificado:
    const dependientes = obtenerComponentesDependientes(componenteId);
    
    if (dependientes.length === 0) {
        return;
    }
    
    logger.debug(`[NOTIFICAR_DEPENDENCIAS] Notificando a ${dependientes.length} dependientes de ${componenteId}`);
    
    await Promise.all(
        dependientes.map(dependiente => 
            enviarMensaje({
                destino: dependiente,
                tipo: 'SISTEMA.ESTADO_COMPONENTE_ACTUALIZADO',
                origen: 'sistema-inicializacion',
                mensajeId: generarIdUnico(),
                timestamp: Date.now(),
                datos: {
                    componenteOrigen: componenteId,
                    estado: estado.estado,
                    timestamp: estado.timestamp,
                    detalles: estado.detalles
                }
            }).catch(error => 
                logger.error(`Error notificando a dependiente ${dependiente}: ${error.message}`)
            )
        )
    );
}

/**
 * Controlador para el mensaje SISTEMA.COMPONENTE_INICIALIZADO.
 * Registra cuando un componente se inicializa y mantiene su información en el estado global.
 */
registrarControlador(TIPOS_MENSAJE.SISTEMA.COMPONENTE_INICIALIZADO, async (mensaje) => {
    const logPrefix = `[SISTEMA.COMPONENTE_INICIALIZADO][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje de componente inicializado sin origen';
            logger.warn(`${logPrefix} ${errorMsg}`);
            
            return enviarMensaje({
                destino: 'sistema-monitoreo',
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                origen: 'sistema-inicializacion',
                mensajeId: generarIdUnico(),
                timestamp,
                datos: {
                    codigo: 'ERROR_COMPONENTE_SIN_ORIGEN',
                    mensaje: errorMsg,
                    severidad: 'alto',
                    contexto: { mensajeId }
                }
            });
        }

        const { 
            componenteId, 
            capacidades = {},
            metadatos = {},
            version = '1.0.0',
            dependencias = [],
            estadisticas = {},
            notificarSistema = false,
            mensaje: mensajeEstado = 'Componente inicializado correctamente'
        } = mensaje.datos || {};

        // 2. Validación de parámetros obligatorios
        if (!componenteId) {
            const errorMsg = 'Falta el identificador del componente (componenteId)';
            logger.warn(`${logPrefix} ${errorMsg}`, { origen: mensaje.origen });
            
            return enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                origen: 'sistema-inicializacion',
                mensajeId: generarIdUnico(),
                timestamp,
                datos: {
                    codigo: 'ERROR_COMPONENTE_ID_REQUERIDO',
                    mensaje: errorMsg,
                    mensajeOriginalId: mensajeId,
                    contexto: { origen: mensaje.origen }
                }
            });
        }

        // 3. Inicializar el registro de componentes si no existe
        estadoSistemaGlobal.componentesInicializados = estadoSistemaGlobal.componentesInicializados || {};
        
        // 4. Crear o actualizar la información del componente
        const infoComponente = {
            id: componenteId,
            origen: mensaje.origen,
            version,
            timestampInicializacion: timestamp,
            timestampUltimaActualizacion: timestamp,
            estado: 'activo',
            capacidades: normalizarCapacidades(capacidades),
            metadatos: normalizarMetadatos(metadatos),
            dependencias,
            estadisticas: {
                tiempoInicializacion: estadisticas.tiempoInicializacion || 0,
                memoriaInicial: estadisticas.memoriaInicial || 0,
                ...estadisticas
            },
            metricas: {
                estado: 'activo',
                ultimoLatido: timestamp,
                errores: 0,
                solicitudes: 0
            },
            historial: [
                {
                    evento: 'inicializado',
                    timestamp,
                    estado: 'completado',
                    detalles: { origen: mensaje.origen }
                }
            ]
        };

        // 5. Registrar en el estado global
        estadoSistemaGlobal.componentesInicializados[componenteId] = infoComponente;

        // 6. Registrar en el logger
        logger.info(`${logPrefix} Componente inicializado exitosamente`, { 
            componenteId,
            version,
            numCapacidades: Object.keys(capacidades).length,
            numMetadatos: Object.keys(metadatos).length,
            tieneDependencias: dependencias.length > 0
        });

        // 7. Notificar a los componentes interesados
        const notificaciones = [];
        
        // Notificar al sistema si es requerido
        if (notificarSistema) {
            notificaciones.push(
                enviarMensaje({
                    tipo: TIPOS_MENSAJE.SISTEMA.ESTADO,
                    origen: 'sistema-inicializacion',
                    mensajeId: generarIdUnico(),
                    timestamp,
                    broadcast: true,
                    datos: {
                        evento: 'componente_inicializado',
                        componenteId,
                        timestamp,
                        origen: mensaje.origen,
                        version,
                        datos: {
                            estado: 'activo',
                            capacidades: Object.keys(capacidades),
                            metadatos: Object.keys(metadatos),
                            tieneDependencias: dependencias.length > 0
                        }
                    }
                }).catch(error => 
                    logger.error(`${logPrefix} Error al notificar al sistema: ${error.message}`)
                )
            );
        }

        // Notificar a los componentes dependientes
        if (dependencias.length > 0) {
            notificaciones.push(
                notificarDependientes(componenteId, {
                    evento: 'dependencia_inicializada',
                    componenteId,
                    timestamp,
                    version,
                    capacidades: Object.keys(capacidades)
                }).catch(error =>
                    logger.error(`${logPrefix} Error notificando a dependientes: ${error.message}`)
                )
            );
        }

        // 8. Enviar confirmación al componente
        notificaciones.push(
            enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
                origen: 'sistema-inicializacion',
                mensajeId: generarIdUnico(),
                timestamp: Date.now(),
                datos: {
                    mensajeOriginalId: mensajeId,
                    timestamp: Date.now(),
                    estado: 'procesado',
                    accion: 'confirmacion_inicializacion_recibida',
                    componenteId,
                    detalles: {
                        notificacionesEnviadas: notificaciones.length - 1 // Restamos 1 por la confirmación
                    }
                }
            }).catch(error =>
                logger.error(`${logPrefix} Error enviando confirmación: ${error.message}`)
            )
        );

        // Esperar a que todas las notificaciones se completen
        await Promise.all(notificaciones);

        logger.debug(`${logPrefix} Procesamiento completado`, {
            componenteId,
            notificacionesEnviadas: notificaciones.length
        });

    } catch (error) {
        const errorNoManejado = `Error no manejado en SISTEMA.COMPONENTE_INICIALIZADO: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, {
            error: {
                mensaje: error.message,
                stack: error.stack,
                ...error
            },
            mensajeOriginal: {
                origen: mensaje?.origen,
                componenteId: mensaje?.datos?.componenteId
            }
        });
        
        // Notificar error crítico
        try {
            await enviarMensaje({
                destino: mensaje?.origen || 'sistema-monitoreo',
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                origen: 'sistema-inicializacion',
                mensajeId: generarIdUnico(),
                timestamp: Date.now(),
                datos: {
                    codigo: 'ERROR_PROCESANDO_INICIALIZACION',
                    mensaje: errorNoManejado,
                    mensajeOriginalId: mensajeId,
                    componenteId: mensaje?.datos?.componenteId,
                    contexto: {
                        error: error.message,
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    },
                    nivel: 'alto'
                }
            });
        } catch (notifError) {
            console.error('Error crítico al notificar error en inicialización:', notifError);
        }
        
        // Relanzar el error para que pueda ser manejado por otros mecanismos
        throw error;
    }
});

/**
 * Normaliza las capacidades de un componente.
 * @private
 * @param {Object} capacidades - Capacidades del componente
 * @returns {Object} Capacidades normalizadas
 */
function normalizarCapacidades(capacidades = {}) {
    // Implementar lógica de normalización si es necesario
    return { ...capacidades };
}

/**
 * Normaliza los metadatos de un componente.
 * @private
 * @param {Object} metadatos - Metadatos del componente
 * @returns {Object} Metadatos normalizados
 */
function normalizarMetadatos(metadatos = {}) {
    // Implementar lógica de normalización si es necesario
    return { ...metadatos };
}

/**
 * Notifica a los componentes dependientes sobre un cambio de estado.
 * @private
 * @param {string} componenteId - ID del componente
 * @param {Object} datos - Datos a enviar a los dependientes
 * @returns {Promise<void>}
 */
async function notificarDependientes(componenteId, datos) {
    const dependientes = obtenerComponentesDependientes(componenteId);
    
    if (dependientes.length === 0) {
        return;
    }
    
    logger.debug(`[NOTIFICAR_DEPENDIENTES] Notificando a ${dependientes.length} dependientes de ${componenteId}`);
    
    await Promise.all(
        dependientes.map(dependiente => 
            Promise.resolve(enviarMensaje({
                destino: dependiente,
                tipo: 'SISTEMA.ESTADO_COMPONENTE_ACTUALIZADO',
                origen: 'sistema-inicializacion',
                mensajeId: generarIdUnico(),
                timestamp: Date.now(),
                datos: {
                    ...datos,
                    componenteOrigen: componenteId,
                    timestamp: Date.now()
                }
            })).catch(error => 
                logger.error(`Error notificando a dependiente ${dependiente}: ${error.message}`)
            )
        )
    );
}

/**
 * Controlador para el mensaje SISTEMA.INICIALIZACION_FINALIZADA.
 * Procesa la notificación de que la inicialización del sistema ha finalizado completamente.
 */
registrarControlador(TIPOS_MENSAJE.SISTEMA.INICIALIZACION_FINALIZADA, async (mensaje) => {
    const logPrefix = `[SISTEMA.INICIALIZACION_FINALIZADA][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje de inicialización finalizada sin origen';
            logger.warn(`${logPrefix} ${errorMsg}`);
            return;
        }

        // 2. Extraer y validar datos del mensaje
        const { 
            componentesInicializados = [], 
            estadoSistema = {},
            exito = true,
            mensaje: mensajeEstado = exito ? 'Inicialización completada con éxito' : 'Error en inicialización',
            metricas = {},
            notificarSistema = true,
            requiereConfirmacion = true
        } = mensaje.datos || {};

        // 3. Validar tipos de datos
        if (!Array.isArray(componentesInicializados)) {
            throw new Error('componentesInicializados debe ser un array');
        }
        if (typeof estadoSistema !== 'object' || estadoSistema === null) {
            throw new Error('estadoSistema debe ser un objeto');
        }

        // 4. Registrar el estado de inicialización
        logger.info(`${logPrefix} Procesando notificación de inicialización finalizada`, {
            exito,
            totalComponentes: componentesInicializados.length,
            mensaje: mensajeEstado
        });

        // 5. Actualizar estado global del sistema
        if (typeof estadoSistemaGlobal === 'undefined') {
            // Estado inicial
            estadoSistemaGlobal = {
                estado: exito ? 'activo' : 'error',
                ultimaActualizacion: timestamp,
                componentesInicializados: new Set(componentesInicializados),
                detalles: {
                    ...estadoSistema,
                    inicioSistema: estadoSistema.inicioSistema || timestamp,
                    version: estadoSistema.version || '1.0.0',
                    entorno: estadoSistema.entorno || 'desarrollo'
                },
                metricas: {
                    tiempoInicio: metricas.tiempoInicio || timestamp,
                    tiempoTotal: metricas.tiempoTotal || 0,
                    ...metricas
                },
                historial: [],
                dependencias: {},
                errores: []
            };
        } else {
            // Actualizar estado existente
            estadoSistemaGlobal.estado = exito ? 'activo' : 'error';
            estadoSistemaGlobal.ultimaActualizacion = timestamp;
            
            // Actualizar componentes inicializados
            componentesInicializados.forEach(id => {
                if (id) estadoSistemaGlobal.componentesInicializados.add(id);
            });
            
            // Fusionar detalles manteniendo valores existentes
            estadoSistemaGlobal.detalles = {
                ...estadoSistemaGlobal.detalles,
                ...estadoSistema,
                // No sobrescribir estos campos si ya existen
                inicioSistema: estadoSistemaGlobal.detalles.inicioSistema || estadoSistema.inicioSistema || timestamp,
                version: estadoSistemaGlobal.detalles.version || estadoSistema.version || '1.0.0',
                entorno: estadoSistemaGlobal.detalles.entorno || estadoSistema.entorno || 'desarrollo'
            };
            
            // Actualizar métricas
            estadoSistemaGlobal.metricas = {
                ...estadoSistemaGlobal.metricas,
                ...metricas,
                tiempoTotal: metricas.tiempoTotal || (timestamp - (estadoSistemaGlobal.metricas?.tiempoInicio || timestamp))
            };
            
            // Registrar error si la inicialización falló
            if (!exito) {
                const errorEntry = {
                    timestamp,
                    origen: mensaje.origen,
                    mensaje: mensajeEstado,
                    detalles: estadoSistema.error || {}
                };
                estadoSistemaGlobal.errores.unshift(errorEntry);
                // Mantener un máximo de errores
                if (estadoSistemaGlobal.errores.length > 50) {
                    estadoSistemaGlobal.errores = estadoSistemaGlobal.errores.slice(0, 50);
                }
            }
        }

        // 6. Registrar en el historial
        const entradaHistorial = {
            timestamp,
            origen: mensaje.origen,
            exito,
            mensaje: mensajeEstado,
            totalComponentes: estadoSistemaGlobal.componentesInicializados.size
        };
        
        estadoSistemaGlobal.historial.unshift(entradaHistorial);
        // Mantener un tamaño máximo de historial
        if (estadoSistemaGlobal.historial.length > 50) {
            estadoSistemaGlobal.historial = estadoSistemaGlobal.historial.slice(0, 50);
        }

        // 7. Registrar en el logger con nivel apropiado
        const logMethod = exito ? 'info' : 'warn';
        logger[logMethod](`${logPrefix} ${mensajeEstado}`, {
            totalComponentes: estadoSistemaGlobal.componentesInicializados.size,
            estado: estadoSistemaGlobal.estado,
            detalles: estadoSistema,
            mensajeId
        });

        // 8. Notificar a otros componentes del sistema si es necesario
        if (notificarSistema) {
            try {
                await enviarMensaje({
                    tipo: TIPOS_MENSAJE.SISTEMA.ESTADO,
                    origen: 'sistema',
                    destino: 'todos',
                    datos: {
                        evento: 'inicializacion_finalizada',
                        timestamp,
                        datos: {
                            exito,
                            mensaje: mensajeEstado,
                            totalComponentes: estadoSistemaGlobal.componentesInicializados.size,
                            estado: estadoSistemaGlobal.estado
                        }
                    }
                });
            } catch (errorNotificacion) {
                logger.error(`${logPrefix} Error al notificar inicialización finalizada:`, errorNotificacion);
            }
        }

        // 6. Confirmar recepción al componente que envió la notificación
        if (mensaje.datos?.requiereConfirmacion !== false) {
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
                datos: {
                    mensajeOriginalId: mensaje.mensajeId,
                    timestamp,
                    estado: 'procesado',
                    totalComponentes: estadoSistemaGlobal.componentesInicializados.size
                }
            });
        }

    } catch (error) {
        const errorMsg = `Error procesando notificación de inicialización finalizada: ${error.message}`;
        logger.error(`${logPrefix} ${errorMsg}`, error);
        
        try {
            // Intentar notificar el error de manera segura
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

logger.info('[MONITOREO] Controladores SISTEMA registrados correctamente');

