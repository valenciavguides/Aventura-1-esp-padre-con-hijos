/**
 * Módulo de mensajería para comunicación entre componentes
 * @module Mensajeria
 * @version 4.0.0
 * @description Sistema centralizado de mensajería para comunicación entre iframes
 * con manejo de errores, reintentos, validación de mensajes y limpieza de recursos.
 */

import { CONFIG_MENSAJERIA, TIPOS_MENSAJE } from './constants.js';
// NOTA: No importar desde utils.js para evitar dependencia circular
// import { generarIdUnico } from './utils.js'; // ❌ Causa dependencia circular
import logger from './logger.js';

// Detect mobile devices for optimizations
const esMovil = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// ================== UTILIDADES INTERNAS =====================

/**
 * Genera un ID único para mensajes
 * @returns {string} ID único
 * @private
 */
function generarIdUnico() {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ================== MENSAJERÍA CENTRALIZADA =====================

// Estado global de la mensajería (usando configuración centralizada)
const estadoMensajeria = {
    ...CONFIG_MENSAJERIA.ESTADO_INICIAL,
    heartbeat: {
        activo: false,
        hijosConectados: new Set(),
        ultimoHeartbeat: new Map(),
        timeoutsHeartbeat: new Map(),
        intervalo: 5000,
        timer: null
    }
};

// ================== FUNCIONES PRINCIPALES CENTRALIZADAS =====================

/**
 * Valida que un destino sea válido (existe como iframe o es 'padre')
 * @param {string} destino - ID del destino a validar
 * @returns {boolean} true si el destino es válido
 */
function validarDestino(destino) {
    if (!destino || typeof destino !== 'string') {
        return false;
    }
    
    // 'padre' siempre es válido (desde hijo o para comunicación interna del padre)
    if (destino === 'padre') {
        return true;
    }
    
    // Verificar si existe un iframe con ese ID
    const iframe = document.getElementById(destino);
    return iframe !== null && iframe.contentWindow !== null;
}

/**
 * Inicializa el sistema de mensajería para el componente.
 * @param {Object} config - Configuración de inicialización
 * @param {string} [config.rol] - Rol del componente: 'padre' o 'hijo'
 * @param {string} [config.iframeId] - ID del iframe (para hijos)
 * @param {string} [config.componenteId] - ID del componente lógico
 * @param {string} [config.idComponente] - Alias de componenteId
 * @param {boolean} [config.debug] - Modo debug
 * @param {string} [config.estado] - Estado inicial (obsoleto, se mantiene por compatibilidad)
 * @returns {Promise<void>}
 */
export async function inicializarMensajeria(config = {}) {
    try {
        // Detectar rol automáticamente si no se proporciona
        const rol = config.rol || (window.parent === window ? 'padre' : 'hijo');
        
        // Asignar configuración al estado
        estadoMensajeria.rol = rol;
        estadoMensajeria.iframeId = config.iframeId || null;
        estadoMensajeria.componenteId = config.componenteId || config.idComponente || config.iframeId || (rol === 'padre' ? 'padre' : null);
        estadoMensajeria.debug = config.debug || false;
        estadoMensajeria.inicializado = true;

        if (estadoMensajeria.debug) {
            console.log(`[MENSAJERIA] Inicializado - Rol: ${rol}, ID: ${estadoMensajeria.componenteId || estadoMensajeria.iframeId || 'desconocido'}`);
        }

        return Promise.resolve();
    } catch (error) {
        console.error('[MENSAJERIA] Error durante inicialización:', error);
        throw error;
    }
}

/**
 * Envía un mensaje a un destino específico.
 * @param {Object} params - Parámetros del mensaje.
 * @param {string} params.tipo - Tipo de mensaje.
 * @param {string} params.origen - Origen del mensaje.
 * @param {string} params.destino - Destino del mensaje.
 * @param {Object} [params.datos={}] - Datos del mensaje.
 * @param {string} [params.version='1.0.0'] - Versión del mensaje.
 */
export function enviarMensaje({ tipo, origen, destino, datos = {}, version = '1.0.0' }) {
    if (!tipo || !origen || !destino) {
        throw new Error('Campos obligatorios faltantes para enviarMensaje: tipo, origen y destino son obligatorios');
    }

    if (!validarDestino(destino)) {
        const errorMsg = destino === 'funciones-mapa'
            ? `Destino 'funciones-mapa' no válido. Los mensajes GPS ahora se manejan directamente llamando a las funciones de funciones-mapa.js desde el padre.`
            : `Destino no válido: ${destino}`;
        throw new Error(errorMsg);
    }

    // Validación específica para mensajes de consulta
    if (tipo === TIPOS_MENSAJE.NAVEGACION.SOLICITAR_COORDENADAS ||
        tipo === TIPOS_MENSAJE.AUDIO.SOLICITAR_AUDIO ||
        tipo === TIPOS_MENSAJE.DATOS.SOLICITAR_RETO) {
        
        if (!datos.paradaId) {
            throw new Error(`Mensaje de consulta ${tipo} requiere 'paradaId' en datos`);
        }
        if (!datos.tipoConsulta) {
            throw new Error(`Mensaje de consulta ${tipo} requiere 'tipoConsulta' en datos`);
        }
    }

    const mensaje = {
        id: generarIdUnico(),
        tipo,
        origen,
        destino,
        datos,
        version,
        timestamp: new Date().toISOString()
    };

    // Determinar el destino del mensaje
    let targetWindow;
    const origenSeguro = window.location.origin;

    if (destino === 'padre') {
        // Comunicación hijo → padre: usar window.parent
        // O padre → padre (comunicación interna): usar window
        if (window.parent === window) {
            // Ya estamos en el padre, usar window para comunicación interna
            targetWindow = window;
        } else {
            targetWindow = window.parent;
        }
    } else {
        // Comunicación padre → hijo: usar iframe
        const iframe = document.getElementById(destino);
        if (!iframe || !iframe.contentWindow) {
            throw new Error(`Destino ${destino} no encontrado o no accesible`);
        }
        targetWindow = iframe.contentWindow;
    }

    // Enviar el mensaje al destino correspondiente
    console.log(`📤 [MENSAJERIA] Enviando mensaje - tipo: ${mensaje.tipo}, origen: ${mensaje.origen}, destino: ${mensaje.destino}`);
    targetWindow.postMessage(mensaje, origenSeguro);
}

/**
 * Envía un mensaje y espera confirmación con timeout.
 * @param {Object} params - Parámetros del mensaje (mismos que enviarMensaje)
 * @param {number} [params.timeout=10000] - Timeout en milisegundos
 * @returns {Promise<Object>} Promesa que resuelve con la respuesta
 */
export function enviarMensajeConConfirmacion({ tipo, origen, destino, datos = {}, version = '1.0.0', timeout = 10000 }) {
    return new Promise((resolve, reject) => {
        const mensajeId = generarIdUnico();
        
        // Configurar timeout
        const timer = setTimeout(() => {
            estadoMensajeria.manejadores.delete(`${tipo}_RESPONSE_${mensajeId}`);
            reject(new Error(`Timeout esperando confirmación de ${destino} para mensaje ${tipo}`));
        }, timeout);
        
        // Registrar handler temporal para la respuesta
        const handleResponse = (respuesta) => {
            clearTimeout(timer);
            estadoMensajeria.manejadores.delete(`${tipo}_RESPONSE_${mensajeId}`);
            resolve(respuesta.datos);
        };
        
        estadoMensajeria.manejadores.set(`${tipo}_RESPONSE_${mensajeId}`, handleResponse);
        
        // Enviar mensaje
        try {
            enviarMensaje({ tipo, origen, destino, datos: { ...datos, mensajeId }, version });
        } catch (error) {
            clearTimeout(timer);
            estadoMensajeria.manejadores.delete(`${tipo}_RESPONSE_${mensajeId}`);
            reject(error);
        }
    });
}

/**
 * Registra un controlador para un tipo de mensaje específico.
 * @param {string} tipo - Tipo de mensaje.
 * @param {Function} callback - Función que manejará el mensaje.
 */
export function registrarControlador(tipo, callback) {
    if (!tipo || typeof callback !== 'function') {
        throw new Error('Tipo de mensaje y callback son obligatorios para registrar un controlador');
    }

    estadoMensajeria.manejadores.set(tipo, callback);
}

/**
 * Maneja mensajes entrantes.
 * @param {MessageEvent} event - Evento de mensaje.
 */
function manejarMensajeEntrante(event) {
    // Validar el origen del mensaje para seguridad
    const origenEsperado = window.location.origin;
    if (event.origin !== origenEsperado) {
        console.warn(`Mensaje rechazado de origen no confiable: ${event.origin}`);
        return;
    }

    const mensaje = event.data;

    // Filtrar mensajes que no son del sistema (ej: extensiones del navegador)
    if (!mensaje || typeof mensaje !== 'object' || !mensaje.tipo || !mensaje.origen || !mensaje.destino) {
        // Ignorar silenciosamente mensajes no relacionados con el sistema
        return;
    }
    
    console.log(`📥 [MENSAJERIA] Mensaje recibido - tipo: ${mensaje.tipo}, origen: ${mensaje.origen}, destino: ${mensaje.destino}`);

    // Verificar que el mensaje está destinado a este componente
    const idComponenteActual = estadoMensajeria.componenteId || estadoMensajeria.iframeId;
    if (mensaje.destino !== idComponenteActual && mensaje.destino !== 'broadcast') {
        // Ignorar mensajes no destinados a este componente (excepto broadcasts)
        console.log(`🚫 [MENSAJERIA] Mensaje ignorado - destino: ${mensaje.destino}, actual: ${idComponenteActual}, tipo: ${mensaje.tipo}`);
        return;
    }
    
    console.log(`✅ [MENSAJERIA] Mensaje aceptado - destino: ${mensaje.destino}, tipo: ${mensaje.tipo}, origen: ${mensaje.origen}`);    if (!estadoMensajeria.manejadores.has(mensaje.tipo)) {
        console.warn('Mensaje no reconocido o sin controlador registrado:', mensaje);
        return;
    }

    const controlador = estadoMensajeria.manejadores.get(mensaje.tipo);
    try {
        controlador(mensaje);
    } catch (error) {
        console.error(`Error manejando mensaje de tipo ${mensaje.tipo}:`, error);
    }
}

// Registrar el listener global para mensajes entrantes
window.addEventListener('message', manejarMensajeEntrante);

/**
 * Inicia el sistema de heartbeat para monitorear conectividad con hijos.
 * @param {number} [intervalo] - Intervalo en milisegundos entre heartbeats (opcional, por defecto usa configuración)
 */
export function iniciarHeartbeat(intervalo) {
    if (estadoMensajeria.rol !== 'padre') {
        throw new Error('El sistema de heartbeat solo puede iniciarse en el componente padre');
    }

    if (estadoMensajeria.heartbeat.activo) {
        console.warn('El sistema de heartbeat ya está activo');
        return;
    }

    // Usar intervalo personalizado si se proporciona
    if (intervalo && typeof intervalo === 'number' && intervalo > 0) {
        estadoMensajeria.heartbeat.intervalo = intervalo;
    }

    estadoMensajeria.heartbeat.activo = true;
    let heartbeatPausado = false;

    const enviarHeartbeat = () => {
        // Pausar heartbeat si la página está oculta
        if (document.hidden || heartbeatPausado) {
            return;
        }

        // Usar heartbeat.hijosConectados en vez de hijosConectados directamente
        estadoMensajeria.heartbeat.hijosConectados.forEach(hijoId => {
            enviarMensaje({
                tipo: TIPOS_MENSAJE.SISTEMA.HEARTBEAT,
                origen: 'padre',
                destino: hijoId,
                datos: { mensajeId: generarIdUnico() }
            }).catch(error => console.error(`Error enviando heartbeat a ${hijoId}:`, error));
        });
    };

    // Pausar/reanudar heartbeat según visibilidad
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.debug('[Heartbeat] Pausado (página oculta)');
            heartbeatPausado = true;
        } else {
            console.debug('[Heartbeat] Reanudado (página visible)');
            heartbeatPausado = false;
            // Enviar heartbeat inmediatamente al reanudar
            enviarHeartbeat();
        }
    });

    estadoMensajeria.heartbeat.timer = setInterval(enviarHeartbeat, estadoMensajeria.heartbeat.intervalo);
    enviarHeartbeat();
}

/**
 * Detiene el sistema de heartbeat
 */
export function detenerHeartbeat() {
    if (estadoMensajeria.heartbeat.timer) {
        clearInterval(estadoMensajeria.heartbeat.timer);
        estadoMensajeria.heartbeat.timer = null;
        estadoMensajeria.heartbeat.activo = false;
    }
}

// ================== CONTROLADORES DE COORDINACION =====================

/**
 * Procesa respuesta de datos de un componente hijo
 * @param {Object} mensaje - Mensaje de respuesta
 */
export async function procesarRespuestaDatosHijo(mensaje) {
    const { idSolicitud, datos, exito, error } = mensaje.datos || {};

    if (!idSolicitud || !estadoCoordinacion.solicitudesPendientes.has(idSolicitud)) {
        logger.warn(`Respuesta inesperada o solicitud no encontrada: ${idSolicitud}`);
        return;
    }

    const solicitud = estadoCoordinacion.solicitudesPendientes.get(idSolicitud);
    clearTimeout(solicitud.timeout);
    estadoCoordinacion.solicitudesPendientes.delete(idSolicitud);

    try {
        if (exito && datos) {
            // Cachear los datos
            const claveCache = `${solicitud.componente}_${solicitud.tipoDatos}`;
            estadoCoordinacion.datosCache.set(claveCache, {
                datos,
                timestamp: Date.now()
            });

            logger.debug(`Datos cacheados para ${claveCache}`);
            solicitud.resolve(datos);
        } else {
            solicitud.reject(new Error(error || 'Error en respuesta del componente'));
        }
    } catch (error) {
        logger.error('Error procesando respuesta de datos:', error);
        solicitud.reject(error);
    }
}

/**
 * Controlador para respuestas de datos de componentes hijo.
 * Procesa las respuestas a solicitudes de información previamente realizadas,
 * gestionando el cache y resolviendo las promesas pendientes.
 */
registrarControlador(TIPOS_MENSAJE.COORDINACION.RESPUESTA_DATOS_HIJO, procesarRespuestaDatosHijo);

/**
 * Obtiene el estado actual del sistema de coordinación
 * @returns {Object} Estado de coordinación
 */
export function obtenerEstadoCoordinacion() {
    return {
        solicitudesPendientes: estadoCoordinacion.solicitudesPendientes.size,
        datosCache: estadoCoordinacion.datosCache.size,
        coordinacionesActivas: estadoCoordinacion.coordinacionesActivas.size,
        tiempoEsperaMax: estadoCoordinacion.tiempoEsperaMax,
        cacheTTL: estadoCoordinacion.cacheTTL
    };
}

/**
 * Controlador para consultar el estado del sistema de coordinación.
 * Proporciona información sobre solicitudes pendientes, cache, coordinaciones activas
 * y configuración del sistema.
 */
registrarControlador(TIPOS_MENSAJE.COORDINACION.ESTADO_COORDINACION, async (mensaje) => {
    const estadoCoord = obtenerEstadoCoordinacion();
    return {
        estado: estadoCoord,
        timestamp: new Date().toISOString()
    };
});

/**
 * Maneja las solicitudes de datos a componentes hijo.
 * Este controlador coordina las peticiones de información a diferentes componentes,
 * gestionando timeouts, reintentos y respuestas agregadas.
 * 
 * @param {Object} mensaje - Mensaje de solicitud de datos
 * @param {string} mensaje.origen - Origen del mensaje (componente solicitante)
 * @param {Object} mensaje.datos - Datos de la solicitud
 * @param {string|Array<string>} mensaje.datos.hijo - ID del hijo o array de IDs de hijos a consultar
 * @param {string} mensaje.datos.tipoInfo - Tipo de información solicitada ('estado', 'datos', 'configuracion', etc.)
 * @param {Object} [mensaje.datos.parametros] - Parámetros adicionales para la solicitud
 * @param {number} [mensaje.datos.timeout=5000] - Timeout en ms para la respuesta
 * @param {boolean} [mensaje.datos.permitirParcial=false] - Si se permiten respuestas parciales en caso de múltiples hijos
 * @param {string} [mensaje.mensajeId] - ID único del mensaje para seguimiento
 */
registrarControlador(TIPOS_MENSAJE.COORDINACION.SOLICITAR_DATOS_HIJO, async (mensaje) => {
    const logPrefix = `[COORDINACION.SOLICITAR_DATOS_HIJO][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje sin origen, ignorando solicitud de datos hijo';
            logger.warn(`${logPrefix} ${errorMsg}`);
            return;
        }

        if (!mensaje?.datos?.hijo) {
            const errorMsg = 'Hijo no especificado en la solicitud';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId });
            throw new Error(errorMsg);
        }

        const { 
            hijo, 
            tipoInfo = 'estado', 
            parametros = {}, 
            timeout = 5000,
            permitirParcial = false
        } = mensaje.datos;

        logger.info(`${logPrefix} Solicitando datos tipo '${tipoInfo}' a hijo(s)`, { 
            mensajeId,
            hijo: Array.isArray(hijo) ? hijo.join(', ') : hijo,
            tipoInfo,
            timeout
        });

        // 2. Normalizar hijos a array
        const hijos = Array.isArray(hijo) ? hijo : [hijo];
        
        // 3. Validar que los hijos existen y están activos
        const hijosValidos = hijos.filter(hijoId => {
            const iframe = document.getElementById(hijoId);
            if (!iframe) {
                logger.warn(`${logPrefix} Hijo '${hijoId}' no encontrado en el DOM`);
                return false;
            }
            return true;
        });

        if (hijosValidos.length === 0) {
            const errorMsg = 'Ninguno de los hijos especificados es válido';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId, hijos });
            throw new Error(errorMsg);
        }

        // 4. Enviar solicitudes a cada hijo
        const solicitudes = hijosValidos.map(async hijoId => {
            const solicitudId = generarIdUnico();
            
            try {
                logger.debug(`${logPrefix} Enviando solicitud a hijo '${hijoId}'`, { 
                    solicitudId, 
                    tipoInfo 
                });

                // Enviar solicitud con timeout
                const respuesta = await Promise.race([
                    enviarMensajeConConfirmacion({
                        destino: hijoId,
                        tipo: TIPOS_MENSAJE.DATOS.SOLICITAR_DATOS,
                        origen: 'coordinador',
                        mensajeId: solicitudId,
                        datos: {
                            tipoInfo,
                            parametros,
                            solicitudOriginalId: mensajeId,
                            timeout
                        }
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`Timeout esperando respuesta de ${hijoId}`)), timeout)
                    )
                ]);

                return {
                    hijoId,
                    exito: true,
                    datos: respuesta,
                    timestamp: Date.now()
                };
                
            } catch (error) {
                logger.error(`${logPrefix} Error al solicitar datos a hijo '${hijoId}': ${error.message}`, error);
                
                return {
                    hijoId,
                    exito: false,
                    error: error.message,
                    timestamp: Date.now()
                };
            }
        });

        // 5. Esperar respuestas
        const respuestas = await Promise.all(solicitudes);

        // 6. Analizar resultados
        const exitosas = respuestas.filter(r => r.exito);
        const fallidas = respuestas.filter(r => !r.exito);

        if (exitosas.length === 0 && !permitirParcial) {
            const errorMsg = 'Todas las solicitudes a hijos fallaron';
            logger.error(`${logPrefix} ${errorMsg}`, { 
                mensajeId, 
                respuestas 
            });
            throw new Error(errorMsg);
        }

        // 7. Preparar respuesta agregada
        const respuestaAgregada = {
            exitosas: exitosas.map(r => ({
                hijoId: r.hijoId,
                datos: r.datos,
                timestamp: r.timestamp
            })),
            fallidas: fallidas.map(r => ({
                hijoId: r.hijoId,
                error: r.error,
                timestamp: r.timestamp
            })),
            total: respuestas.length,
            exitosos: exitosas.length,
            fallidos: fallidas.length,
            parcial: fallidas.length > 0,
            tipoInfo
        };

        // 8. Actualizar caché de coordinación
        exitosas.forEach(respuesta => {
            const cacheKey = `${respuesta.hijoId}:${tipoInfo}`;
            estadoCoordinacion.cacheRespuestas.set(cacheKey, {
                datos: respuesta.datos,
                timestamp: respuesta.timestamp,
                ttl: estadoCoordinacion.cacheTTL
            });
        });

        // 9. Enviar respuesta al solicitante
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.COORDINACION.RESPUESTA_DATOS_HIJO,
            origen: 'coordinador',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                timestamp: Date.now(),
                respuesta: respuestaAgregada
            }
        });

        logger.info(`${logPrefix} Solicitud completada`, { 
            mensajeId,
            exitosos: exitosas.length,
            fallidos: fallidas.length
        });

        return respuestaAgregada;
        
    } catch (error) {
        const errorNoManejado = `Error no manejado en SOLICITAR_DATOS_HIJO: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar error al origen
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    origen: 'coordinador',
                    mensajeId: generarIdUnico(),
                    datos: {
                        error: errorNoManejado,
                        mensajeOriginalId: mensajeId,
                        timestamp: Date.now(),
                        tipo: 'ERROR_SOLICITAR_DATOS_HIJO',
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
 * Maneja la coordinación de acciones entre múltiples componentes.
 * Este controlador orquesta acciones sincronizadas entre diferentes componentes,
 * asegurando que se ejecuten en el orden correcto y manejando dependencias.
 * 
 * @param {Object} mensaje - Mensaje de coordinación de acción
 * @param {string} mensaje.origen - Origen del mensaje
 * @param {Object} mensaje.datos - Datos de la acción a coordinar
 * @param {string} mensaje.datos.accion - Tipo de acción a coordinar
 * @param {Array<Object>} mensaje.datos.participantes - Lista de componentes participantes
 * @param {string} mensaje.datos.participantes[].componenteId - ID del componente
 * @param {string} mensaje.datos.participantes[].rol - Rol en la coordinación ('iniciador', 'ejecutor', 'observador')
 * @param {Object} [mensaje.datos.participantes[].parametros] - Parámetros específicos del participante
 * @param {Array<string>} [mensaje.datos.dependencias] - IDs de componentes que deben estar listos primero
 * @param {boolean} [mensaje.datos.transaccional=false] - Si la acción es transaccional (all-or-nothing)
 * @param {number} [mensaje.datos.timeout=10000] - Timeout para la coordinación en ms
 * @param {string} [mensaje.mensajeId] - ID único del mensaje
 */
registrarControlador(TIPOS_MENSAJE.COORDINACION.COORDINAR_ACCION, async (mensaje) => {
    const logPrefix = `[COORDINACION.COORDINAR_ACCION][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje sin origen, ignorando coordinación';
            logger.warn(`${logPrefix} ${errorMsg}`);
            return;
        }

        if (!mensaje?.datos?.accion) {
            const errorMsg = 'Acción no especificada';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId });
            throw new Error(errorMsg);
        }

        if (!mensaje?.datos?.participantes || !Array.isArray(mensaje.datos.participantes)) {
            const errorMsg = 'Participantes no especificados o inválidos';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId });
            throw new Error(errorMsg);
        }

        const { 
            accion, 
            participantes, 
            dependencias = [], 
            transaccional = false,
            timeout = 10000
        } = mensaje.datos;

        logger.info(`${logPrefix} Coordinando acción '${accion}' con ${participantes.length} participantes`, { 
            mensajeId,
            accion,
            participantes: participantes.map(p => p.componenteId),
            transaccional
        });

        // 2. Validar dependencias primero
        if (dependencias.length > 0) {
            logger.debug(`${logPrefix} Verificando ${dependencias.length} dependencias`, { dependencias });
            
            for (const depId of dependencias) {
                const iframe = document.getElementById(depId);
                if (!iframe) {
                    throw new Error(`Dependencia '${depId}' no encontrada`);
                }
                
                // Verificar que la dependencia está lista
                try {
                    await enviarMensajeConConfirmacion({
                        destino: depId,
                        tipo: TIPOS_MENSAJE.SISTEMA.PING,
                        origen: 'coordinador',
                        mensajeId: generarIdUnico()
                    }, 2000);
                } catch (error) {
                    throw new Error(`Dependencia '${depId}' no responde: ${error.message}`);
                }
            }
        }

        // 3. Notificar a participantes sobre la acción coordinada
        const notificaciones = participantes.map(async (participante) => {
            const { componenteId, rol, parametros = {} } = participante;
            
            try {
                logger.debug(`${logPrefix} Notificando a '${componenteId}' (rol: ${rol})`, { 
                    componenteId, 
                    rol 
                });

                const respuesta = await Promise.race([
                    enviarMensajeConConfirmacion({
                        destino: componenteId,
                        tipo: TIPOS_MENSAJE.CONTROL.EJECUTAR,
                        origen: 'coordinador',
                        mensajeId: generarIdUnico(),
                        datos: {
                            accion,
                            rol,
                            parametros,
                            coordinacionId: mensajeId,
                            timestamp
                        }
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`Timeout en ${componenteId}`)), timeout)
                    )
                ]);

                return {
                    componenteId,
                    exito: true,
                    respuesta,
                    timestamp: Date.now()
                };
                
            } catch (error) {
                logger.error(`${logPrefix} Error en participante '${componenteId}': ${error.message}`, error);
                
                return {
                    componenteId,
                    exito: false,
                    error: error.message,
                    timestamp: Date.now()
                };
            }
        });

        // 4. Esperar respuestas de todos los participantes
        const resultados = await Promise.all(notificaciones);

        // 5. Analizar resultados
        const exitosos = resultados.filter(r => r.exito);
        const fallidos = resultados.filter(r => !r.exito);

        // 6. Manejar modo transaccional
        if (transaccional && fallidos.length > 0) {
            logger.error(`${logPrefix} Coordinación transaccional falló, revertiendo`, { 
                mensajeId,
                fallidos: fallidos.map(f => f.componenteId)
            });

            // Enviar rollback a participantes exitosos
            await Promise.all(exitosos.map(resultado => 
                enviarMensaje({
                    destino: resultado.componenteId,
                    tipo: TIPOS_MENSAJE.CONTROL.ROLLBACK,
                    origen: 'coordinador',
                    mensajeId: generarIdUnico(),
                    datos: {
                        coordinacionId: mensajeId,
                        motivo: 'fallo_en_participante',
                        fallos: fallidos
                    }
                })
            ));

            throw new Error(`Coordinación transaccional falló: ${fallidos.length} participantes fallaron`);
        }

        // 7. Preparar respuesta
        const respuestaCoordinacion = {
            accion,
            total: resultados.length,
            exitosos: exitosos.length,
            fallidos: fallidos.length,
            exitoso: fallidos.length === 0,
            parcial: fallidos.length > 0 && exitosos.length > 0,
            resultados: resultados.map(r => ({
                componenteId: r.componenteId,
                exito: r.exito,
                error: r.error,
                timestamp: r.timestamp
            })),
            timestamp: Date.now()
        };

        // 8. Notificar resultado al solicitante
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'coordinador',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                coordinacion: respuestaCoordinacion
            }
        });

        // 9. Notificar a observadores si los hay
        const observadores = participantes.filter(p => p.rol === 'observador');
        if (observadores.length > 0) {
            await Promise.all(observadores.map(obs => 
                enviarMensaje({
                    destino: obs.componenteId,
                    tipo: TIPOS_MENSAJE.COORDINACION.ESTADO_COORDINACION,
                    origen: 'coordinador',
                    mensajeId: generarIdUnico(),
                    datos: {
                        coordinacionId: mensajeId,
                        estado: respuestaCoordinacion
                    }
                })
            ));
        }

        logger.info(`${logPrefix} Coordinación completada`, { 
            mensajeId,
            accion,
            exitoso: respuestaCoordinacion.exitoso
        });

        return respuestaCoordinacion;
        
    } catch (error) {
        const errorNoManejado = `Error no manejado en COORDINAR_ACCION: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar error al origen
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    origen: 'coordinador',
                    mensajeId: generarIdUnico(),
                    datos: {
                        error: errorNoManejado,
                        mensajeOriginalId: mensajeId,
                        timestamp: Date.now(),
                        tipo: 'ERROR_COORDINAR_ACCION',
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
 * Maneja la sincronización de estado entre componentes.
 * Este controlador asegura que múltiples componentes mantengan estados consistentes,
 * propagando cambios y resolviendo conflictos.
 * 
 * @param {Object} mensaje - Mensaje de sincronización
 * @param {string} mensaje.origen - Origen del mensaje
 * @param {Object} mensaje.datos - Datos de sincronización
 * @param {Array<string>} mensaje.datos.componentes - IDs de componentes a sincronizar
 * @param {string} mensaje.datos.estadoTipo - Tipo de estado a sincronizar
 * @param {Object} [mensaje.datos.estadoReferencia] - Estado de referencia a propagar
 * @param {string} [mensaje.datos.estrategia='propagacion'] - Estrategia: 'propagacion', 'consolidacion', 'resolucion'
 * @param {boolean} [mensaje.datos.forzar=false] - Forzar sincronización ignorando conflictos
 * @param {number} [mensaje.datos.timeout=8000] - Timeout para la sincronización
 * @param {string} [mensaje.mensajeId] - ID único del mensaje
 */
registrarControlador(TIPOS_MENSAJE.COORDINACION.SINCRONIZAR_COMPONENTES, async (mensaje) => {
    const logPrefix = `[COORDINACION.SINCRONIZAR_COMPONENTES][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje sin origen, ignorando sincronización';
            logger.warn(`${logPrefix} ${errorMsg}`);
            return;
        }

        if (!mensaje?.datos?.componentes || !Array.isArray(mensaje.datos.componentes)) {
            const errorMsg = 'Componentes no especificados o inválidos';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId });
            throw new Error(errorMsg);
        }

        if (!mensaje?.datos?.estadoTipo) {
            const errorMsg = 'Tipo de estado no especificado';
            logger.error(`${logPrefix} ${errorMsg}`, { mensajeId });
            throw new Error(errorMsg);
        }

        const { 
            componentes, 
            estadoTipo, 
            estadoReferencia = null, 
            estrategia = 'propagacion',
            forzar = false,
            timeout = 8000
        } = mensaje.datos;

        logger.info(`${logPrefix} Sincronizando estado '${estadoTipo}' entre ${componentes.length} componentes`, { 
            mensajeId,
            componentes,
            estrategia
        });

        // 2. Validar que los componentes existen
        const componentesValidos = componentes.filter(compId => {
            const iframe = document.getElementById(compId);
            if (!iframe) {
                logger.warn(`${logPrefix} Componente '${compId}' no encontrado`);
                return false;
            }
            return true;
        });

        if (componentesValidos.length === 0) {
            throw new Error('Ningún componente válido para sincronizar');
        }

        let resultadoSincronizacion;

        // 3. Ejecutar según estrategia
        switch (estrategia) {
            case 'propagacion':
                // Propagar estado de referencia a todos los componentes
                if (!estadoReferencia) {
                    throw new Error('Estado de referencia requerido para estrategia de propagación');
                }

                resultadoSincronizacion = await Promise.all(componentesValidos.map(async compId => {
                    try {
                        await Promise.race([
                            enviarMensajeConConfirmacion({
                                destino: compId,
                                tipo: TIPOS_MENSAJE.SISTEMA.ESTADO,
                                origen: 'coordinador',
                                mensajeId: generarIdUnico(),
                                datos: {
                                    estadoTipo,
                                    estado: estadoReferencia,
                                    forzar,
                                    sincronizacionId: mensajeId
                                }
                            }),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error(`Timeout en ${compId}`)), timeout)
                            )
                        ]);

                        return { componenteId: compId, exito: true };
                    } catch (error) {
                        logger.error(`${logPrefix} Error sincronizando '${compId}': ${error.message}`);
                        return { componenteId: compId, exito: false, error: error.message };
                    }
                }));
                break;

            case 'consolidacion':
                // Obtener estados de todos y consolidar
                const estadosActuales = await Promise.all(componentesValidos.map(async compId => {
                    try {
                        const respuesta = await Promise.race([
                            enviarMensajeConConfirmacion({
                                destino: compId,
                                tipo: TIPOS_MENSAJE.DATOS.SOLICITAR_DATOS,
                                origen: 'coordinador',
                                mensajeId: generarIdUnico(),
                                datos: { tipoInfo: estadoTipo }
                            }),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error(`Timeout en ${compId}`)), timeout)
                            )
                        ]);

                        return { componenteId: compId, exito: true, estado: respuesta };
                    } catch (error) {
                        return { componenteId: compId, exito: false, error: error.message };
                    }
                }));

                // Consolidar estados (estrategia simple: mayoría gana)
                const estadosExitosos = estadosActuales.filter(e => e.exito);
                if (estadosExitosos.length === 0) {
                    throw new Error('No se pudo obtener ningún estado para consolidar');
                }

                // Por ahora, tomar el estado más reciente como referencia
                const estadoConsolidado = estadosExitosos.reduce((prev, current) => {
                    return (current.estado.timestamp > prev.estado.timestamp) ? current : prev;
                }).estado;

                // Propagar estado consolidado
                resultadoSincronizacion = await Promise.all(componentesValidos.map(async compId => {
                    try {
                        await enviarMensaje({
                            destino: compId,
                            tipo: TIPOS_MENSAJE.SISTEMA.ESTADO,
                            origen: 'coordinador',
                            mensajeId: generarIdUnico(),
                            datos: {
                                estadoTipo,
                                estado: estadoConsolidado,
                                sincronizacionId: mensajeId
                            }
                        });

                        return { componenteId: compId, exito: true };
                    } catch (error) {
                        return { componenteId: compId, exito: false, error: error.message };
                    }
                }));
                break;

            case 'resolucion':
                // Resolver conflictos entre componentes
                logger.info(`${logPrefix} Estrategia de resolución no implementada completamente, usando propagación`);
                resultadoSincronizacion = [{ mensaje: 'Estrategia en desarrollo' }];
                break;

            default:
                throw new Error(`Estrategia desconocida: ${estrategia}`);
        }

        // 4. Analizar resultados
        const exitosos = resultadoSincronizacion.filter(r => r.exito);
        const fallidos = resultadoSincronizacion.filter(r => !r.exito);

        const respuesta = {
            estadoTipo,
            estrategia,
            total: componentesValidos.length,
            exitosos: exitosos.length,
            fallidos: fallidos.length,
            exitoso: fallidos.length === 0,
            componentes: resultadoSincronizacion,
            timestamp: Date.now()
        };

        // 5. Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'coordinador',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                sincronizacion: respuesta
            }
        });

        logger.info(`${logPrefix} Sincronización completada`, { 
            mensajeId,
            exitosos: exitosos.length,
            fallidos: fallidos.length
        });

        return respuesta;
        
    } catch (error) {
        const errorNoManejado = `Error no manejado en SINCRONIZAR_COMPONENTES: ${error.message}`;
        logger.error(`${logPrefix} ${errorNoManejado}`, error);
        
        try {
            // Notificar error al origen
            if (mensaje?.origen) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                    origen: 'coordinador',
                    mensajeId: generarIdUnico(),
                    datos: {
                        error: errorNoManejado,
                        mensajeOriginalId: mensajeId,
                        timestamp: Date.now(),
                        tipo: 'ERROR_SINCRONIZAR_COMPONENTES',
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

export { estadoMensajeria };
