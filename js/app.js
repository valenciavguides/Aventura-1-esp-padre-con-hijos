/**
 * Módulo principal de la aplicación
 * @module App
 * @version 1.0.0
 */

import { TIPOS_MENSAJE, MODOS } from './constants.js';
import logger from './logger.js';
import { enviarMensaje, registrarControlador, iniciarHeartbeat } from './mensajeria.js';
import { CONFIG } from './config.js';
import { generarIdUnico } from './utils.js';
import { promesasPendientes } from './monitoreo.js';

import { invalidarTamañoMapa, diagnosticarMapa, isMapInitialized } from './funciones-mapa.js';

// ============================================================
// NOTA: El objeto 'estado' ha sido movido a codigo-padre.html
// siguiendo el patrón arquitectónico donde cada componente
// (padre o hijo) mantiene su propio estado local.
// ============================================================

// Funci�n para limpiar historial de monitoreo
function limpiarHistorialMonitoreo(estado) {
    const maxItems = estado.monitoreo.historial.maxItems;
    estado.monitoreo.historial.eventos = estado.monitoreo.historial.eventos.slice(-maxItems);
    estado.monitoreo.historial.metricas = estado.monitoreo.historial.metricas.slice(-maxItems);
    estado.monitoreo.historial.errores = estado.monitoreo.historial.errores.slice(-maxItems);
    logger.debug(`Historial de monitoreo limpiado a ${maxItems} elementos`);
}

// Funci�n para limpiar promesas pendientes expiradas
function limpiarPromesasPendientes() {
    const ttl = 60000; // Ajustado a 60 segundos
    const now = Date.now();
    for (const [id, promise] of promesasPendientes) {
        if (now - promise.timestamp > ttl) {
            promesasPendientes.delete(id);
        }
    }
}

// Intervalo separado para limpiar promesas pendientes cada 30s (sincronizado)
setInterval(() => {
    limpiarPromesasPendientes();
}, 30000);  // Sincronizado con mensajeria.js

// ==================== FUNCIONES AUXILIARES ====================

/**
 * Calcula la distancia entre dos puntos geogr�ficos usando la f�rmula de Haversine
 * @private
 * @param {number} lat1 - Latitud del primer punto
 * @param {number} lon1 - Longitud del primer punto
 * @param {number} lat2 - Latitud del segundo punto
 * @param {number} lon2 - Longitud del segundo punto
 * @returns {number} Distancia en metros
 */
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radio de la Tierra en metros
    const f1 = lat1 * Math.PI / 180; // φ, λ en radianes
    const f2 = lat2 * Math.PI / 180;
    const df = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(df / 2) * Math.sin(df / 2) +
              Math.cos(f1) * Math.cos(f2) *
              Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // en metros
}

/**
 * Genera datos hist�ricos de ejemplo para estad�sticas
 * @private
 * @returns {Object} Datos hist�ricos simulados
 */
function generarDatosHistoricos() {
    const datos = [];
    for (let hora = 0; hora < 24; hora++) {
        const esHoraPunta = (hora >= 7 && hora < 10) || (hora >= 17 && hora < 20);
        const base = esHoraPunta ? 40 : 10;
        const variacion = Math.floor(Math.random() * 30);
        
        datos.push({
            hora: `${hora}:00`,
            pasajeros: base + variacion,
            retrasoPromedio: Math.floor(Math.random() * 5) + (esHoraPunta ? 3 : 1)
        });
    }
    return datos;
}

/**
 * Genera estad�sticas para una parada espec�fica
 * @private
 * @param {string} paradaId - ID de la parada
 * @returns {Promise<Object>} Estad�sticas de la parada
 */
async function generarEstadisticasParada(paradaId) {
    // Esta es una implementaci�n de ejemplo que deber�a ser reemplazada
    // por una consulta a la base de datos o servicio de an�lisis
    
    // Simular una peque�a demora de procesamiento
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    
    // Generar algunas estad�sticas de ejemplo
    const ahora = new Date();
    const hora = ahora.getHours();
    const esHoraPunta = (hora >= 7 && hora < 10) || (hora >= 17 && hora < 20);
    
    return {
        totalConsultas: 100 + Math.floor(Math.random() * 1000),
        consultasUltimaHora: 5 + Math.floor(Math.random() * 20),
        nivelOcupacion: esHoraPunta 
            ? 70 + Math.floor(Math.random() * 30) // 70-100% en hora punta
            : 20 + Math.floor(Math.random() * 50), // 20-70% en hora valle
        popularidad: 3 + Math.floor(Math.random() * 5), // 3-7
        frecuenciaMedia: esHoraPunta ? '5-10 min' : '10-20 min',
        ultimaActualizacion: ahora.toISOString(),
        historico: {
            lunes: generarDatosHistoricos(),
            martes: generarDatosHistoricos(),
            miercoles: generarDatosHistoricos(),
            jueves: generarDatosHistoricos(),
            viernes: generarDatosHistoricos(),
            sabado: generarDatosHistoricos(),
            domingo: generarDatosHistoricos()
        }
    };
}

/**
 * Obtiene las pr�ximas llegadas de transporte para una parada
 * @private
 * @param {string} paradaId - ID de la parada
 * @param {number} limite - N�mero m�ximo de llegadas a devolver
 * @returns {Promise<Array>} Lista de pr�ximas llegadas
 */
async function obtenerProximasLlegadas(paradaId, limite = 5) {
    // Esta es una implementaci�n de ejemplo que deber�a ser reemplazada
    // por una llamada al servicio de tiempos real o base de datos
    
    // Simular una peque�a demora de red
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    // Generar algunas llegadas de ejemplo
    const ahora = new Date();
    const minutos = ahora.getMinutes();
    const llegadas = [];
    
    // Generar entre 2 y 5 llegadas
    const numLlegadas = 2 + Math.floor(Math.random() * 4);
    
    for (let i = 0; i < numLlegadas && i < limite; i++) {
        const minutosAdelanto = 2 + i * (3 + Math.floor(Math.random() * 5));
        const tiempoLlegada = new Date(ahora);
        tiempoLlegada.setMinutes(minutos + minutosAdelanto);
        
        llegadas.push({
            rutaId: `R${100 + i}`,
            nombreRuta: `L�nea ${100 + i}`,
            destino: i % 2 === 0 ? 'Centro' : 'Periferia',
            tiempoEstimado: minutosAdelanto,
            horaProgramada: tiempoLlegada.toISOString(),
            estado: minutosAdelanto <= 5 ? 'inminente' : 'programado',
            tiempoRestante: `${minutosAdelanto} min`,
            _enlace: `/api/rutas/R${100 + i}/tiempos?parada=${paradaId}`
        });
    }
    
    // Ordenar por tiempo de llegada
    return llegadas.sort((a, b) => a.tiempoEstimado - b.tiempoEstimado);
}

/**
 * Agrupa paradas que est�n dentro de un radio determinado
 * @private
 * @param {Array<Object>} paradas - Lista de paradas a agrupar
 * @param {number} radioMetros - Radio m�ximo en metros para considerar paradas como cercanas
 * @returns {Array<Object>} Lista de paradas agrupadas
 */
function agruparParadasCercanas(paradas, radioMetros) {
    const procesadas = new Set();
    const resultado = [];
    
    for (let i = 0; i < paradas.length; i++) {
        if (procesadas.has(i)) continue;
        
        const paradaActual = paradas[i];
        const grupo = [i];
        
        // Buscar paradas cercanas a la parada actual
        for (let j = i + 1; j < paradas.length; j++) {
            if (procesadas.has(j)) continue;
            
            const otraParada = paradas[j];
            const distancia = calcularDistancia(
                paradaActual.ubicacion.lat,
                paradaActual.ubicacion.lng,
                otraParada.ubicacion.lat,
                otraParada.ubicacion.lng
            );
            
            if (distancia <= radioMetros) {
                grupo.push(j);
                procesadas.add(j);
            }
        }
        
        // Si solo hay una parada en el grupo, a�adirla tal cual
        if (grupo.length === 1) {
            resultado.push(paradaActual);
        } else {
            // Calcular el centroide del grupo
            let sumLat = 0, sumLng = 0;
            const idsGrupo = [];
            
            grupo.forEach(idx => {
                const p = paradas[idx];
                sumLat += p.ubicacion.lat;
                sumLng += p.ubicacion.lng;
                idsGrupo.push(p.id);
            });
            
            // Crear una nueva parada que representa el grupo
            const centroideLat = sumLat / grupo.length;
            const centroideLng = sumLng / grupo.length;
            
            // Encontrar la parada m�s cercana al centroide para usar sus metadatos
            let paradaMasCercana = paradas[grupo[0]];
            let distanciaMinima = calcularDistancia(
                centroideLat, centroideLng,
                paradaMasCercana.ubicacion.lat, paradaMasCercana.ubicacion.lng
            );
            
            for (let k = 1; k < grupo.length; k++) {
                const p = paradas[grupo[k]];
                const d = calcularDistancia(
                    centroideLat, centroideLng,
                    p.ubicacion.lat, p.ubicacion.lng
                );
                
                if (d < distanciaMinima) {
                    distanciaMinima = d;
                    paradaMasCercana = p;
                }
            }
            
            // A�adir la parada agrupada al resultado
            resultado.push({
                ...paradaMasCercana,
                id: `grupo_${idsGrupo.join('_')}`,
                nombre: `Grupo de ${grupo.length} paradas`,
                ubicacion: {
                    lat: centroideLat,
                    lng: centroideLng
                },
                grupo: {
                    ids: idsGrupo,
                    cantidad: grupo.length,
                    radio: distanciaMinima * 2 // Di�metro del grupo
                },
                cantidadParadas: grupo.length
            });
        }
        
        procesadas.add(i);
    }
    
    return resultado;
}

// ============================================================
// NOTA: La función inicializar() ha sido movida a codigo-padre.html
// siguiendo el patrón arquitectónico donde cada componente (padre o hijo)
// tiene sus controladores y lógica de inicialización en su propio archivo HTML.
// Las siguientes funciones export se mantienen como utilidades para el padre.
// ============================================================

/**
 * Actualiza la interfaz de modo para todos los hijos inicializados
 * @param {Object} estado - Estado global de la aplicación
 * @param {string} modo - Nuevo modo ('casa' o 'aventura')
 */
export async function actualizarInterfazModo(estado, modo) {
    for (const hijoId of estado.hijosInicializados) {
        try {
            await enviarMensaje({
                destino: hijoId,
                tipo: TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO,
                origen: 'padre',
                datos: { modo }
            });
        } catch (error) {
            logger.error(`Error al actualizar modo en ${hijoId}:`, error);
        }
    }
}

/**
 * Notifica un error al sistema.
 * @param {string} codigo - C�digo de error.
 * @param {Error} error - Objeto de error.
 * @param {Object} [contexto] - Contexto adicional del error.
 */
export function notificarError(codigo, error, contexto = {}) {
    logger.error('Error cr�tico:', error);
    enviarMensaje({
        destino: 'padre',
        tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
        origen: 'padre',
        datos: {
            codigo,
            mensaje: error.message,
            stack: error.stack,
            contexto,
            timestamp: new Date().toISOString()
        }
    }).catch(err => logger.error('Error al notificar error:', err));
}

/**
 * Env�a un mensaje para cambiar el modo de la aplicaci�n
 * @param {string} nuevoModo - Nuevo modo ('casa' o 'aventura')
 * @param {string} origen - Origen del cambio
 * @returns {Promise<Object>} Resultado de la operaci�n
 */
export async function enviarCambioModo(nuevoModo, origen = 'app') {
    if (nuevoModo !== MODOS.CASA && nuevoModo !== MODOS.AVENTURA) {
        throw new Error(`Modo inv�lido: ${nuevoModo}`);
    }
    
    return await enviarMensaje({
        destino: CONFIG.IFRAME_ID,
        tipo: TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO,
        origen: 'padre',
        datos: {
            modo: nuevoModo,
            origen,
            timestamp: new Date().toISOString()
        }
    });
}

/**
 * Valida el mensaje de cambio de modo.
 * @param {Object} mensaje - Mensaje recibido.
 * @returns {boolean} - True si el mensaje es v�lido, lanza un error si no lo es.
 */
function validarCambioModoMensaje(mensaje) {
    if (!mensaje || typeof mensaje !== 'object') {
        throw new Error('Mensaje de cambio de modo no v�lido: debe ser un objeto.');
    }

    const { modo } = mensaje.datos || {};

    if (!modo) {
        throw new Error(`Modo no v�lido: ${modo}`);
    }
    
    // Compara con constantes para mayor compatibilidad
    const modoLowerCase = typeof modo === 'string' ? modo.toLowerCase() : modo;
    if (modoLowerCase !== MODOS.CASA && modoLowerCase !== MODOS.AVENTURA) {
        throw new Error(`Modo no v�lido: ${modo}`);
    }

    return true;
}

// Constantes para los modos de operación del sistema (diferentes a MODOS de constants.js que son 'casa'/'aventura')
const MODOS_OPERACION = {
    normal: {
        nombre: 'Normal',
        descripcion: 'Modo de funcionamiento est�ndar',
        puedeCambiar: true
    },
    mantenimiento: {
        nombre: 'Mantenimiento',
        descripcion: 'Modo para realizar tareas de mantenimiento',
        puedeCambiar: true,
        requiereAutenticacion: true
    },
    depuracion: {
        nombre: 'Depuraci�n',
        descripcion: 'Modo para depuraci�n con logs detallados',
        puedeCambiar: true,
        requiereAutenticacion: true
    },
    emergencia: {
        nombre: 'Emergencia',
        descripcion: 'Modo para situaciones de emergencia',
        puedeCambiar: true,
        requiereAutenticacion: true
    }
};

/**
 * Maneja los cambios de modo en la aplicaci�n.
 * Este controlador se encarga de:
 * - Procesar solicitudes de cambio de modo
 * - Validar la transici�n de modos
 * - Actualizar el estado global
 * - Notificar a los componentes afectados
 * 
 * @param {Object} mensaje - El mensaje de cambio de modo
 * @param {string} mensaje.origen - Origen del mensaje
 * @param {Object} estado - Estado global de la aplicación
 * @param {string} mensaje.mensajeId - ID �nico del mensaje
 * @param {Object} mensaje.datos - Datos del cambio de modo
 * @param {string} mensaje.datos.modo - Nuevo modo a establecer
 * @param {Object} [mensaje.datos.opciones] - Opciones adicionales para el cambio de modo
 * @param {string} [mensaje.datos.motivo] - Raz�n del cambio de modo
 * @returns {Promise<Object>} Resultado de la operaci�n
 */
export async function manejarCambioModo(estado, mensaje) {
    const logPrefix = `[SISTEMA.CAMBIO_MODO][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    // 1. Validaci�n inicial del mensaje
    if (!mensaje?.datos) {
        const errorMsg = 'Mensaje de cambio de modo inv�lido: datos faltantes';
        logger.error(`${logPrefix} ${errorMsg}`, { mensajeId });
        return { exito: false, error: errorMsg };
    }

    const { modo, opciones = {}, motivo = 'no especificado' } = mensaje.datos;
    const modosValidos = Object.keys(MODOS);

    try {
        // 2. Validar modo solicitado
        if (!modo || !modosValidos.includes(modo)) {
            const errorMsg = `Modo inv�lido: '${modo}'. V�lidos: ${modosValidos.join(', ')}`;
            logger.warn(`${logPrefix} ${errorMsg}`, { modo, mensajeId });
            return { exito: false, error: errorMsg };
        }

        // 3. Validar transici�n de modos
        const modoActual = estado.modo?.actual || 'normal';
        if (modo === modoActual) {
            logger.info(`${logPrefix} El modo ya est� establecido a '${modo}'`, { mensajeId });
            return { exito: true, cambiado: false, modoActual };
        }

        // 4. Registrar evento de cambio de modo
        const eventoCambioModo = {
            modoAnterior: modoActual,
            modoNuevo: modo,
            timestamp,
            origen: mensaje.origen,
            motivo,
            opciones
        };

        registrarEvento('CAMBIO_MODO', eventoCambioModo);

        // 5. Validar permisos (si es necesario)
        if (MODOS[modo].requiereAutenticacion) {
            const tienePermisos = await validarPermisosCambioModo(mensaje.origen, modo);
            if (!tienePermisos) {
                const errorMsg = 'No tiene permisos para cambiar a este modo';
                logger.warn(`${logPrefix} ${errorMsg}`, { origen: mensaje.origen, modo });
                return { exito: false, error: errorMsg };
            }
        }

        // 6. Notificar inicio del cambio de modo
        logger.info(`${logPrefix} Iniciando cambio de modo '${modoActual}' a '${modo}'`, {
            motivo,
            origen: mensaje.origen,
            timestamp: new Date(timestamp).toISOString()
        });

        // 7. Bloquear cambios concurrentes
        if (estado.sistema?.cambiandoModo) {
            const errorMsg = 'Ya hay un cambio de modo en curso';
            logger.warn(`${logPrefix} ${errorMsg}`, { mensajeId });
            return { exito: false, error: errorMsg };
        }

        // Marcar que estamos cambiando de modo
        estado.sistema = estado.sistema || {};
        estado.sistema.cambiandoModo = true;

        try {
            // 8. Notificar a los componentes del cambio inminente
            await notificarCambioModoInminente(modoActual, modo, motivo);

            // 9. Actualizar el estado global
            estado.modo = estado.modo || {};
            estado.modo.anterior = modoActual;
            estado.modo.actual = modo;
            estado.modo.ultimoCambio = {
                timestamp,
                origen: mensaje.origen,
                motivo,
                opciones
            };

            // 10. Actualizar interfaz y limpiar recursos seg�n el modo
            await actualizarInterfazModo(modo);
            await limpiarRecursosPorModo(modo, opciones);

            // 11. Notificar a los componentes del cambio completado
            await notificarCambioModoCompletado(modoActual, modo, motivo);

            // 12. Registrar �xito
            logger.info(`${logPrefix} Cambio de modo completado exitosamente`, {
                modoAnterior: modoActual,
                modoNuevo: modo,
                duracion: `${Date.now() - timestamp}ms`
            });

            return { 
                exito: true, 
                cambiado: true,
                modoAnterior: modoActual, 
                modoActual: modo,
                timestamp
            };

        } catch (errorCambio) {
            const errorMsg = `Error durante el cambio de modo: ${errorCambio.message}`;
            logger.error(`${logPrefix} ${errorMsg}`, {
                error: errorCambio,
                stack: errorCambio.stack,
                modoActual,
                modoSolicitado: modo
            });

            // Intentar restaurar el estado anterior
            try {
                await restaurarEstadoModoAnterior(modoActual, modo, errorMsg);
            } catch (errorRestauracion) {
                logger.error(`${logPrefix} Error al restaurar el modo anterior: ${errorRestauracion.message}`, {
                    error: errorRestauracion,
                    modoActual,
                    modoFallido: modo
                });
            }

            return { 
                exito: false, 
                error: errorMsg,
                modoActual: estado.modo?.actual,
                modoAnterior: modoActual
            };
        } finally {
            // Asegurarse de desbloquear el cambio de modo
            if (estado.sistema) {
                estado.sistema.cambiandoModo = false;
            }
        }

    } catch (error) {
        const errorMsg = `Error al procesar el cambio de modo: ${error.message}`;
        logger.error(`${logPrefix} ${errorMsg}`, {
            error: error.message,
            stack: error.stack,
            modoSolicitado: modo,
            mensajeOriginal: mensaje
        });

        // Notificar error sin causar bucle
        try {
            await enviarMensaje({
                destino: mensaje?.origen || 'sistema',
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                mensajeId: generarIdUnico(),
                timestamp: Date.now(),
                datos: {
                    codigo: 'ERROR_CAMBIO_MODO',
                    mensaje: errorMsg,
                    detalles: error.message,
                    modoSolicitado: modo,
                    mensajeOriginal: mensaje
                }
            });
        } catch (errorNotificacion) {
            logger.error(`${logPrefix} Error al notificar fallo: ${errorNotificacion.message}`, {
                error: errorNotificacion
            });
        }

        return { 
            exito: false, 
            error: errorMsg,
            modoActual: estado.modo?.actual
        };
    }
}

/**
 * Valida los permisos para cambiar a un modo espec�fico
 * @private
 */
async function validarPermisosCambioModo(origen, modo) {
    // Implementar l�gica de validaci�n de permisos
    // Por ejemplo, verificar roles, tokens, etc.
    return true; // Temporal: siempre permite el cambio
}

/**
 * Notifica a los componentes sobre un cambio de modo inminente
 * @private
 */
async function notificarCambioModoInminente(modoAnterior, modoNuevo, motivo) {
    // Notificar a los componentes
    await enviarMensaje({
        tipo: TIPOS_MENSAJE.SISTEMA.NOTIFICACION,
        origen: 'sistema',
        mensajeId: generarIdUnico(),
        timestamp: Date.now(),
        datos: {
            tipo: 'cambio_modo_iniciado',
            modoAnterior,
            modoNuevo,
            motivo,
            timestamp: Date.now()
        }
    });
}

/**
 * Notifica a los componentes que el cambio de modo se complet�
 * @private
 */
async function notificarCambioModoCompletado(modoAnterior, modoNuevo, motivo) {
    // Notificar a los componentes
    await enviarMensaje({
        tipo: TIPOS_MENSAJE.SISTEMA.NOTIFICACION,
        origen: 'sistema',
        mensajeId: generarIdUnico(),
        timestamp: Date.now(),
        datos: {
            tipo: 'cambio_modo_completado',
            modoAnterior,
            modoActual: modoNuevo,
            motivo,
            timestamp: Date.now()
        }
    });
}

/**
 * Limpia recursos espec�ficos seg�n el modo
 * @private
 * @param {Object} estado - Estado global de la aplicación
 */
async function limpiarRecursosPorModo(estado, modo, opciones = {}) {
    try {
        // Limpieza autom�tica del mapa si est� disponible
        if (window.funcionesMapa?.limpiarPorEstado) {
            const limpiado = await window.funcionesMapa.limpiarPorEstado({
                modo: modo,
                paradaActual: estado.paradaActual,
                tramoActual: null,
                ...opciones
            });
            
            if (limpiado) {
                logger.debug(`Limpieza autom�tica del mapa ejecutada por cambio a modo ${modo}`);
            }
        }
        
        // Aqu� se pueden agregar m�s limpiezas espec�ficas por modo
        if (modo === 'mantenimiento') {
            // Limpiezas espec�ficas para modo mantenimiento
        } else if (modo === 'depuracion') {
            // Limpiezas espec�ficas para modo depuraci�n
        }
        
    } catch (error) {
        logger.error('Error en limpieza de recursos por modo:', {
            error: error.message,
            stack: error.stack,
            modo
        });
        throw error; // Relanzar para manejarlo en el flujo principal
    }
}

/**
 * Restaura el estado anterior despu�s de un fallo en el cambio de modo
 * @private
 * @param {Object} estado - Estado global de la aplicación
 */
async function restaurarEstadoModoAnterior(estado, modoAnterior, modoFallido, motivo) {
    // Restaurar el modo anterior
    if (estado.modo) {
        estado.modo.actual = modoAnterior;
        estado.modo.anterior = modoFallido;
    }
    
    // Notificar a los componentes
    await enviarMensaje({
        tipo: TIPOS_MENSAJE.SISTEMA.NOTIFICACION,
        origen: 'sistema',
        mensajeId: generarIdUnico(),
        timestamp: Date.now(),
        datos: {
            tipo: 'restauracion_modo',
            modoRestaurado: modoAnterior,
            modoFallido,
            motivo,
            timestamp: Date.now()
        }
    });
    
    // Actualizar la interfaz
    await actualizarInterfazModo(modoAnterior);
    
    logger.warn(`Modo restaurado a '${modoAnterior}' despu�s de fallo al cambiar a '${modoFallido}'`, {
        motivo
    });
}

/**
 * Funci�n para registrar un evento personalizado en el sistema de monitoreo
 * @param {string} tipo - Tipo de evento
 * @param {Object} datos - Datos del evento
 * @param {string} [nivel='info'] - Nivel de severidad ('debug', 'info', 'warn', 'error')
 * @returns {string} ID del evento registrado
 */
export function registrarEvento(tipo, datos = {}, nivel = 'info') {
    const mensaje = `Evento: ${tipo}, Nivel: ${nivel}, Datos: ${JSON.stringify(datos)}`;
    switch (nivel) {
        case 'debug':
            logger.debug(mensaje);
            break;
        case 'info':
            logger.info(mensaje);
            break;
        case 'warn':
            logger.warn(mensaje);
            break;
        case 'error':
            logger.error(mensaje);
            break;
    }
}

/**
 * Registra una m�trica de rendimiento
 * @param {Object} estado - Estado global de la aplicación
 * @param {string} nombre - Nombre de la m�trica
 * @param {number} valor - Valor de la m�trica
 * @param {string} [unidad='ms'] - Unidad de medida
 */
export function registrarMetrica(estado, nombre, valor, unidad = 'ms') {
    if (!estado?.monitoreo?.config?.habilitado || !estado?.monitoreo?.config?.rastrearRendimiento) {
        return;
    }
    
    try {
        const metrica = {
            nombre,
            valor,
            unidad,
            timestamp: new Date().toISOString()
        };
        
        // Actualizar m�tricas espec�ficas
        if (nombre === 'tiempo_respuesta') {
            estado.monitoreo.metricas.solicitudes++;
            estado.monitoreo.metricas.tiempoTotalRespuesta += valor;
            estado.monitoreo.metricas.tiempoRespuestaPromedio = estado.monitoreo.metricas.tiempoTotalRespuesta / estado.monitoreo.metricas.solicitudes;
            
            // Alerta si se supera el umbral
            if (valor > estado.monitoreo.config.umbralAlerta.tiempoRespuesta) {
                registrarEvento('tiempo_respuesta_elevado', {
                    valor,
                    umbral: estado.monitoreo.config.umbralAlerta.tiempoRespuesta,
                    metrica
                }, 'warn');
            }
        } else if (nombre === 'uso_memoria') {
            estado.monitoreo.metricas.usoMemoria = valor;
            
            // Alerta si se supera el umbral de memoria
            if (valor > estado.monitoreo.config.umbralAlerta.usoMemoria) {
                registrarEvento('uso_memoria_elevado', {
                    valor,
                    umbral: estado.monitoreo.config.umbralAlerta.usoMemoria,
                    timestamp: new Date().toISOString()
                }, 'warn');
            }
        }
        
        // Mantener un historial de m�tricas
        estado.monitoreo.historial.metricas.push(metrica);
    } catch (error) {
        console.error('Error al registrar m�trica:', error);
    }
}

/**
 * Obtiene el estado actual del sistema de monitoreo
 * @param {Object} estado - Estado global de la aplicación
 * @returns {Object} Estado actual del monitoreo
 */
export function obtenerEstadoMonitoreo(estado) {
    return {
        metricas: estado?.monitoreo?.metricas || {},
        config: { ...(estado?.monitoreo?.config || {}) },
        totalEventos: estado?.monitoreo?.historial?.eventos?.length || 0,
        totalErrores: estado?.monitoreo?.historial?.errores?.length || 0,
    };
}

// Inicializar monitoreo de memoria si est� disponible (optimized for mobile)
if (window.performance && window.performance.memory) {
    const intervaloMemoria = esMovil ? 300000 : 60000; // 5 min m�vil, 1 min desktop
    setInterval(() => {
        const memory = window.performance.memory;
        const usoMemoria = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
        registrarMetrica('uso_memoria', usoMemoria, '%');
    }, intervaloMemoria);
}

// Exponer funciones de monitoreo globalmente
if (typeof window !== 'undefined') {
    window.registrarEvento = registrarEvento;
    window.registrarMetrica = registrarMetrica;
    window.notificarError = notificarError;
    window.obtenerEstadoMonitoreo = obtenerEstadoMonitoreo;
    
    // Registrar evento de inicializaci�n
    window.addEventListener('DOMContentLoaded', () => {
        registrarEvento('app_inicializada', { 
            version: '1.0.0',
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString()
        }, 'info');
    });
}

// Inicializar monitoreo de eventos de navegaci�n
if (window.performance) {
    // Registrar m�tricas de carga de p�gina
    window.addEventListener('load', () => {
        const memory = window.performance.memory;
        const usoMemoria = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
        registrarMetrica('uso_memoria', usoMemoria, '%');
        
        const timing = window.performance.timing;
        const tiempoCarga = timing.loadEventEnd - timing.navigationStart;
        registrarMetrica('tiempo_carga_pagina', tiempoCarga);
        
        // Registrar evento de carga completa
        registrarEvento('pagina_cargada', {
            tiempoCarga,
            url: window.location.href,
            userAgent: navigator.userAgent
        });
    });
}

/**
 * Env�a una confirmaci�n a un hijo espec�fico.
 * @param {string} hijoId - ID del hijo al que se enviar� la confirmaci�n.
 * @returns {Promise<void>}
 */
export async function enviarConfirmacionAHijo(hijoId, mensajeId) {
    try {
        await enviarMensaje({
            destino: hijoId,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'padre',
            datos: {
                mensajeId,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error enviando confirmaci�n', error);
    }
}

/**
 * Env�a el estado global a todos los hijos inicializados y verifica confirmaciones.
 * @param {Object} estado - Estado global de la aplicación
 */
export async function enviarEstadoGlobal(estado) {
    try {
        const estadoGlobal = {
            modo: estado.modo,
            paradaActual: estado.paradaActual,
            monitoreo: estado.monitoreo,
        };

        const hijosSinConfirmar = new Set(estado.hijosInicializados);

        for (const hijoId of estado.hijosInicializados) {
            try {
                await enviarMensaje({
                    destino: hijoId,
                    tipo: TIPOS_MENSAJE.SISTEMA.ESTADO,
                    origen: 'padre',
                    datos: {
                        modo: estado.modo,
                        paradaActual: estado.paradaActual,
                        timestamp: new Date().toISOString()
                    }
                });
                hijosSinConfirmar.delete(hijoId);
                logger.info(`Estado global confirmado por ${hijoId}`);
            } catch (error) {
                logger.error(`Error al enviar estado global a ${hijoId}:`, error);
            }
        }

        if (hijosSinConfirmar.size > 0) {
            logger.warn(`Los siguientes hijos no confirmaron el estado global: ${Array.from(hijosSinConfirmar).join(', ')}`);
        }
    } catch (error) {
        logger.error('Error al enviar estado global a los hijos:', error);
    }
}

// Registrar controlador global para respuestas de parada
// CONTROLADOR DATOS.RESPUESTA_PARADA movido a utils.js (FASE 10)

// ==================== CONTROLADORES DE AUDIO ====================
// Los controladores AUDIO están implementados directamente en Av1_audio_esp.html (hijo3)
// con patrón REQUEST/RESPONSE bidireccional:
// - AUDIO.REPRODUCIR_REQUEST/RESPONSE
// - AUDIO.PAUSA_REQUEST/RESPONSE  
// - AUDIO.CONTROL_REQUEST/RESPONSE
// - AUDIO.FIN_REPRODUCCION (evento)
// - AUDIO.ERROR (evento)
// - AUDIO.ESTADO_ACTUALIZADO (evento)


// ==================== CONTROLADORES DE NAVEGACI�N MOVIDOS A funciones-mapa.js ====================
// Los siguientes 5 controladores han sido movidos a funciones-mapa.js:
// - NAVEGACION.ACTUALIZAR_POSICION (l�neas ~3884-4204)
// - NAVEGACION.CENTRAR_EN_UBICACION (l�neas ~4205-4428)
// - NAVEGACION.MOSTRAR_MAPA_COMPLETO (l�neas ~4429-4644)
// - NAVEGACION.MOSTRAR_MAPA_JPG (l�neas ~4645-4890)
// - NAVEGACION.ESTADO_MAPA (l�neas ~6612-6889)
// Total: ~2,728 l�neas eliminadas de app.js y movidas a funciones-mapa.js
// ==========================================================================================

// ===== CONTROLADOR CONTROL.HABILITAR INCORRECTO ELIMINADO =====
// Este controlador ten�a etiqueta CONTROL.HABILITAR pero l�gica de ACTUALIZAR_POSICION
// Controlador eliminado (l�neas 2986-3330, ~345 l�neas)
// Inclu�a 3 funciones auxiliares: verificarProximidadAPuntosInteres, buscarPuntosInteresCercanos, calcularDistancia
// ==================================================================

// ===== CONTROLADORES CONTROL MOVIDOS =====
// Movidos a modo-handler.js (FASE 5, ~743 l�neas)
// 4 controladores con 2 funciones auxiliares:
//   1. HABILITAR (191 l�neas)
//   2. DESHABILITAR (97 l�neas)  
//   3. CAMBIAR_MODO (227 l�neas)
//   4. ESTADO (208 l�neas)
//   + obtenerDetallesComponente (20 l�neas)
//   + verificarEstadoHijo (18 l�neas)
// ============================================

// ===== CONTROLADOR UI.NOTIFICACION MOVIDO =====
// Movido a utils.js (FASE 6, ~257 l�neas)
// Gestiona notificaciones en la interfaz con validaci�n completa
// ================================================

// ===== CONTROLADOR UI.MODAL MOVIDO =====
// Movido a utils.js (FASE 6, ~287 l�neas con funci�n auxiliar manejarInteraccionModal)
// Gestiona di�logos modales: confirmaciones, formularios, contenido personalizado
// ============================================

// ===== CONTROLADOR UI.ACCION_USUARIO MOVIDO =====
// Movido a utils.js (FASE 6, ~27 l�neas con funciones auxiliares)
// Incluye: manejarInteraccionAlerta, manejarInteraccionNotificacion
// ============================================

// ===== CONTROLADOR UI.ALERTA MOVIDO =====
// Movido a utils.js (FASE 6, ~277 l�neas)
// Gestiona alertas del sistema con validaci�n completa
// ============================================

// ?? NOTA: Segundo controlador UI.ACCION_USUARIO duplicado eliminado (exist�a aqu�)
// Ahora consolidado en el controlador principal movido a utils.js (FASE 6)

// ?? NOTA: Funciones auxiliares manejarInteraccionAlerta y manejarInteraccionNotificacion movidas
// a utils.js junto con el controlador UI.ACCION_USUARIO (FASE 6)

// ?? NOTA: Tercer controlador UI.ACCION_USUARIO duplicado eliminado (exist�a aqu�)
// Ahora consolidado en el controlador principal movido a utils.js (FASE 6)

// ===== CONTROLADOR RETO.MOSTRAR MOVIDO =====
// Movido a validacion.js (FASE 7, ~256 l�neas con funci�n auxiliar)
// Gestiona visualizaci�n de retos en la interfaz
// Incluye funci�n auxiliar: verificarRestriccionesMostrarReto
// ============================================

// ===== CONTROLADOR RETO.OCULTAR MOVIDO =====
// Movido a validacion.js (FASE 7, ~258 l�neas con funciones auxiliares)
// Gestiona ocultaci�n de retos en la interfaz
// Incluye funciones auxiliares: verificarRestriccionesOcultarReto, notificarRetoCompletadoExitosamente
// ============================================

// ===== CONTROLADOR RETO.COMPLETADO MOVIDO =====
// Movido a validacion.js (FASE 7, ~263 l�neas con funciones auxiliares)
// Gestiona finalizaci�n exitosa de retos en el sistema
// Incluye funciones auxiliares: manejarSiguienteAccionDespuesDeReto, otorgarRecompensa
// ============================================

// ===== CONTROLADOR UI.CLOSE_MENUS MOVIDO =====
// Movido a utils.js (FASE 6, ~152 l�neas)
// Gestiona cierre de men�s de la interfaz
// ============================================

// ===== CONTROLADOR UI.ACTUALIZACION MOVIDO =====
// Movido a utils.js (FASE 6, ~277 l�neas)
// Gestiona actualizaciones din�micas de la interfaz
// ============================================

// ===== CONTROLADOR SISTEMA.ERROR MOVIDO =====
// Movido a monitoreo.js (FASE 2, ~258 l�neas incluyendo funci�n notificarErrorCritico)
// ============================================

// ?? NOTA: Controlador SISTEMA.ESTADO duplicado eliminado (exist�a en l�nea 1517)
// El controlador principal se encuentra en la l�nea ~1517 con implementaci�n m�s completa

// ===== CONTROLADOR SISTEMA.NOTIFICACION MOVIDO =====
// Movido a monitoreo.js (FASE 2, ~358 l�neas incluyendo 3 funciones auxiliares)
// Funciones auxiliares: obtenerDireccionIP, registrarAccionImportante
// ====================================================

// ===== CONTROLADOR SISTEMA.INICIALIZACION MOVIDO =====
// Movido a monitoreo.js (FASE 2, ~715 l�neas con JSDoc extensa)
// Incluye gesti�n completa de ciclo de vida de inicializaci�n de componentes:
// - Validaci�n de mensajes y par�metros
// - Gesti�n de dependencias entre componentes
// - Manejo de timeouts y reintentos autom�ticos
// - Notificaciones a componentes dependientes
// - Registro detallado de m�tricas de rendimiento
// ======================================================

/**
 * Maneja la confirmaci�n de inicializaci�n de componentes.
 * Este controlador procesa las notificaciones de finalizaci�n de inicializaci�n
 * de componentes, actualizando su estado y coordinando las acciones posteriores.
 * 
 * @param {Object} mensaje - Mensaje de confirmaci�n
 * @param {string} mensaje.origen - ID del componente que env�a la confirmaci�n
 * @param {Object} mensaje.datos - Datos de confirmaci�n
 * @param {string} mensaje.datos.componenteId - ID del componente inicializado
 * @param {string} mensaje.datos.estado - Estado de la inicializaci�n ('inicializado', 'error', etc.)
 * @param {number} [mensaje.datos.timestamp] - Marca de tiempo de la inicializaci�n
 * @param {string} [mensaje.datos.mensajeId] - ID del mensaje original (opcional)
 * @param {Object} [mensaje.datos.metricas] - M�tricas de rendimiento de la inicializaci�n
 * @param {Object} [mensaje.datos.detalles] - Detalles adicionales de la inicializaci�n
 */
// CONTROLADOR SISTEMA.INICIALIZACION_COMPLETADA movido a monitoreo.js (FASE 10)

// CONTROLADOR SISTEMA.COMPONENTE_INICIALIZADO movido a monitoreo.js (FASE 10)

// CONTROLADOR SISTEMA.INICIALIZACION_FINALIZADA movido a monitoreo.js (FASE 10)

// Add handlers for data messages
/**
 * Maneja las respuestas de datos de una parada espec�fica.
 * Este controlador procesa la informaci�n detallada de una parada recibida
 * de un componente del sistema, como el m�dulo de datos o un servicio externo.
 * 
 * @param {Object} mensaje - Mensaje con los datos de la parada
 * @param {string} mensaje.origen - ID del componente que env�a la respuesta
 * @param {Object} mensaje.datos - Datos de la parada
 * @param {string} mensaje.datos.paradaId - Identificador �nico de la parada
 * @param {string} mensaje.datos.nombre - Nombre de la parada
 * @param {Object} mensaje.datos.ubicacion - Coordenadas de ubicaci�n {lat: number, lng: number}
 * @param {Array<Object>} [mensaje.datos.rutas] - Rutas que pasan por esta parada
 * @param {Object} [mensaje.datos.metadatos] - Metadatos adicionales de la parada
 * @param {string} [mensaje.datos.estado] - Estado actual de la parada
 * @param {string} [mensaje.datos.mensajeId] - ID del mensaje original que solicit� los datos
 */
registrarControlador (TIPOS_MENSAJE.DATOS.RESPUESTA_PARADA, async (mensaje) => {
    const logPrefix = `[RESPUESTA_PARADA][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    
    try {
        // 1. Validaci�n del mensaje
        if (!mensaje?.origen) {
            logger.warn(`${logPrefix} Mensaje sin origen, ignorando`);
            return;
        }

        const { paradaId, nombre, ubicacion, rutas = [], metadatos = {}, estado = 'activa', mensajeId } = mensaje.datos || {};
        
        // 2. Validaci�n de campos obligatorios
        if (!paradaId) {
            const errorMsg = 'Falta el campo obligatorio: paradaId';
            logger.warn(`${logPrefix} ${errorMsg}`);
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                datos: {
                    error: errorMsg,
                    mensajeId: mensaje.mensajeId,
                    timestamp,
                    campoFaltante: 'paradaId'
                }
            });
            return;
        }

        // 3. Validaci�n de ubicaci�n
        if (!ubicacion || typeof ubicacion.lat !== 'number' || typeof ubicacion.lng !== 'number') {
            const errorMsg = 'Ubicaci�n de parada inv�lida o faltante';
            logger.warn(`${logPrefix} ${errorMsg}`, { paradaId });
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                datos: {
                    error: errorMsg,
                    mensajeId: mensaje.mensajeId,
                    timestamp,
                    campoFaltante: 'ubicacion'
                }
            });
            return;
        }

        // 4. Procesar la informaci�n de la parada
        try {
            // Aqu� ir�a la l�gica para procesar los datos de la parada
            // Por ejemplo, actualizar el estado de la aplicaci�n o el almacenamiento local
            
            // Ejemplo: Actualizar el estado global de paradas
            if (!estadoParadas) {
                estadoParadas = new Map();
            }
            
            const datosParada = {
                id: paradaId,
                nombre: nombre || `Parada ${paradaId}`,
                ubicacion,
                rutas,
                metadatos,
                estado,
                ultimaActualizacion: timestamp,
                origen: mensaje.origen
            };
            
            estadoParadas.set(paradaId, datosParada);
            
            // 5. Registrar en el logger
            logger.info(`${logPrefix} Datos de parada actualizados`, {
                paradaId,
                nombre: datosParada.nombre,
                totalRutas: rutas.length,
                estado
            });
            
            // 6. Notificar a otros componentes si es necesario
            if (mensaje.datos?.notificarActualizacion !== false) {
                await enviarMensaje({
                    tipo: TIPOS_MENSAJE.DATOS.ACTUALIZACION_PARADA,
                    datos: {
                        paradaId,
                        timestamp,
                        origen: 'sistema',
                        accion: 'actualizacion',
                        datos: datosParada
                    },
                    broadcast: true
                });
            }
            
            // 7. Responder con confirmaci�n si se solicit�
            if (mensajeId) {
                await enviarMensaje({
                    destino: mensaje.origen,
                    tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
                    datos: {
                        mensajeOriginalId: mensajeId,
                        timestamp,
                        estado: 'procesado',
                        paradaId,
                        totalRutas: rutas.length
                    }
                });
            }
            
        } catch (procesarError) {
            const errorMsg = `Error al procesar datos de parada: ${procesarError.message}`;
            logger.error(`${logPrefix} ${errorMsg}`, {
                paradaId,
                error: procesarError
            });
            
            throw new Error(errorMsg);
        }
        
    } catch (error) {
        const errorMsg = `Error en manejo de RESPUESTA_PARADA: ${error.message}`;
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

// Confirmado: No hay dependencias de generarHashContenido, configurarUtils, registrarListener, removerListener o removerTodosLosListeners.

// ============================================================
// NOTA: La inicialización de la aplicación se realiza en codigo-padre.html
// La función inicializar() fue eliminada - la inicialización ahora es inline en Script 1
// ============================================================

// Add: Logic to handle connection loss
/**
 * Maneja la pérdida de conexión
 * @param {Object} estado - Estado global de la aplicación
 */
function manejarPerdidaConexion(estado) {
    estado.conectado = false;
    logger.warn('Conexi�n perdida, pausando operaciones');
    // Pause operations, e.g., stop sending messages
}

/**
 * Maneja la reconexión
 * @param {Object} estado - Estado global de la aplicación
 */
function manejarReconexion(estado) {
    estado.conectado = true;
    logger.info('Conexi�n restablecida, reanudando operaciones');
    // Resume operations
}

// Detect connection loss (simplified example)
window.addEventListener('offline', () => manejarPerdidaConexion(window.estadoPadre));
window.addEventListener('online', () => manejarReconexion(window.estadoPadre));

// ADVERTENCIA IMPORTANTE:
// No usar window.addEventListener('unload', ...) ni window.addEventListener('beforeunload', ...)
// en ning�n archivo propio ni de terceros. Estos eventos est�n obsoletos y bloqueados por pol�ticas modernas de navegador.
// Usar siempre 'pagehide' para limpieza de recursos y memoria.
// Revisar cualquier librer�a externa antes de integrarla para evitar estos listeners.

// Limpieza agresiva de globales al descargar la p�gina
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        try {
            // Verificar promesas pendientes antes de limpiar
            if (promesasPendientes.size > 0) {
                logger.warn(`Hay ${promesasPendientes.size} promesas pendientes al descargar la p�gina`);
                // Limpiar promesas pendientes
                promesasPendientes.clear();
            }
            // Limpiar globales de la aplicaci�n agresivamente
            if (window.registrarEvento) delete window.registrarEvento;
            if (window.registrarMetrica) delete window.registrarMetrica;
            if (window.notificarError) delete window.notificarError;
            if (window.obtenerEstadoMonitoreo) delete window.obtenerEstadoMonitoreo;
            
            // Limpiar estado global de la aplicaci�n
            if (window.estado) delete window.estado;
            
            // Limpiar promesas pendientes
            promesasPendientes.clear();
            
            // Limpiar estado de coordinaci�n
            if (window.estadoCoordinacion) {
                window.estadoCoordinacion.solicitudesPendientes.clear();
                window.estadoCoordinacion.datosCache.clear();
                window.estadoCoordinacion.coordinacionesActivas.clear();
                delete window.estadoCoordinacion;
            }
            
            // Limpiar arrays globales
            if (window.AVENTURA_PARADAS) delete window.AVENTURA_PARADAS;
            if (window.puntosRuta) delete window.puntosRuta;
            if (window.CoordenadasParadas) delete window.CoordenadasParadas;
            
            // Limpiar estado de hijos
            if (window.estadoHijos) delete window.estadoHijos;
            
            // Limpiar intervalos
            if (window.intervaloReconciliacion) {
                clearInterval(window.intervaloReconciliacion);
                delete window.intervaloReconciliacion;
            }
            
            logger.info('Limpieza agresiva de globales de la aplicaci�n completada');
        } catch (error) {
            // Logging m�nimo durante pagehide para evitar errores
            console.warn('Error en limpieza agresiva de la aplicaci�n:', error.message);
        }
    });
}

/**
 * SISTEMA DE COORDINACI�N CENTRALIZADA
 * Funciones para orquestar la comunicaci�n entre componentes hijos
 */

/**
 * Estado de coordinaci�n entre componentes
 */
const estadoCoordinacion = {
    solicitudesPendientes: new Map(), // id_solicitud -> { componente, tipo_datos, timestamp, resolve, reject }
    datosCache: new Map(), // componente_tipo -> { datos, timestamp, ttl }
    coordinacionesActivas: new Set(), // ids de coordinaciones en progreso
    tiempoEsperaMax: 5000, // 5 segundos m�ximo para respuestas
    cacheTTL: 30000 // 30 segundos de vida �til del cache
};

/**
 * Solicita datos espec�ficos a un componente hijo
 * @param {string} componenteId - ID del componente hijo
 * @param {string} tipoDatos - Tipo de datos solicitados ('coordenadas', 'audio', 'reto', etc.)
 * @param {Object} parametros - Par�metros adicionales para la solicitud
 * @returns {Promise<Object>} Datos del componente
 */
export async function solicitarDatosAHijo(componenteId, tipoDatos, parametros = {}) {
    const idSolicitud = `solicitud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise(async (resolve, reject) => {
        try {
            // Verificar si los datos est�n en cache y son v�lidos
            const claveCache = `${componenteId}_${tipoDatos}`;
            const datosCache = estadoCoordinacion.datosCache.get(claveCache);

            if (datosCache && (Date.now() - datosCache.timestamp) < estadoCoordinacion.cacheTTL) {
                logger.debug(`Usando datos cacheados para ${claveCache}`);
                resolve(datosCache.datos);
                return;
            }

            // Configurar timeout para la solicitud
            const timeout = setTimeout(() => {
                estadoCoordinacion.solicitudesPendientes.delete(idSolicitud);
                reject(new Error(`Timeout esperando respuesta de ${componenteId} para ${tipoDatos}`));
            }, estadoCoordinacion.tiempoEsperaMax);

            // Registrar solicitud pendiente
            estadoCoordinacion.solicitudesPendientes.set(idSolicitud, {
                componente: componenteId,
                tipoDatos,
                timestamp: Date.now(),
                resolve,
                reject,
                timeout
            });

            // Enviar solicitud al componente
            await enviarMensaje(componenteId, TIPOS_MENSAJE.COORDINACION.SOLICITAR_DATOS_HIJO, {
                idSolicitud,
                tipoDatos,
                parametros,
                timestamp: new Date().toISOString()
            });

            logger.debug(`Solicitud enviada a ${componenteId} para ${tipoDatos} (ID: ${idSolicitud})`);

        } catch (error) {
            logger.error(`Error solicitando datos a ${componenteId}:`, error);
            reject(error);
        }
    });
}

/**
 * Coordina una acci�n entre m�ltiples componentes
 * @param {string} idCoordinacion - ID �nico de la coordinaci�n
 * @param {Array<Object>} acciones - Array de acciones a coordinar
 * @param {Object} opciones - Opciones de coordinaci�n
 * @returns {Promise<Object>} Resultado de la coordinaci�n
 */
export async function coordinarAccion(idCoordinacion, acciones, opciones = {}) {
    if (estadoCoordinacion.coordinacionesActivas.has(idCoordinacion)) {
        throw new Error(`Coordinaci�n ${idCoordinacion} ya est� activa`);
    }

    estadoCoordinacion.coordinacionesActivas.add(idCoordinacion);

    try {
        logger.info(`Iniciando coordinaci�n ${idCoordinacion} con ${acciones.length} acciones`);

        const resultados = [];
        const errores = [];

        // Ejecutar acciones en secuencia o paralelo seg�n opciones
        const modoEjecucion = opciones.modo || 'paralelo';

        if (modoEjecucion === 'secuencial') {
            for (const accion of acciones) {
                try {
                    const resultado = await ejecutarAccionCoordinada(accion);
                    resultados.push(resultado);
                } catch (error) {
                    errores.push({ accion, error: error.message });
                    if (opciones.detenerEnError !== false) break;
                }
            }
        } else {
            // Paralelo por defecto
            const promesas = acciones.map(accion => ejecutarAccionCoordinada(accion));
            const resultadosParalelos = await Promise.allSettled(promesas);

            resultadosParalelos.forEach((resultado, index) => {
                if (resultado.status === 'fulfilled') {
                    resultados.push(resultado.value);
                } else {
                    errores.push({
                        accion: acciones[index],
                        error: resultado.reason.message
                    });
                }
            });
        }

        const resultadoFinal = {
            idCoordinacion,
            exito: errores.length === 0,
            resultados,
            errores,
            timestamp: new Date().toISOString()
        };

        logger.info(`Coordinaci�n ${idCoordinacion} completada: ${resultados.length} exitosos, ${errores.length} errores`);
        return resultadoFinal;

    } finally {
        estadoCoordinacion.coordinacionesActivas.delete(idCoordinacion);
    }
}

/**
 * Limpia el cache de datos expirados
 */
export function limpiarCacheCoordinacion() {
    const ahora = Date.now();
    let eliminados = 0;

    for (const [clave, datos] of estadoCoordinacion.datosCache) {
        if ((ahora - datos.timestamp) > estadoCoordinacion.cacheTTL) {
            estadoCoordinacion.datosCache.delete(clave);
            eliminados++;
        }
    }

    if (eliminados > 0) {
        logger.debug(`Cache de coordinaci�n limpiado: ${eliminados} entradas expiradas`);
    }
}

// Limpiar cache peri�dicamente (optimized for mobile)
const intervaloCache = esMovil ? estadoCoordinacion.cacheTTL * 2 : estadoCoordinacion.cacheTTL / 2; // 1 min m�vil, 15 seg desktop
setInterval(limpiarCacheCoordinacion, intervaloCache);

// ===== CONTROLADOR COORDINACION.RESPUESTA_DATOS_HIJO MOVIDO =====
// Movido a mensajeria.js (FASE 8, ~34 l�neas con funci�n auxiliar procesarRespuestaDatosHijo)
// Procesa respuestas de datos de componentes hijo
// ================================================================

// ===== CONTROLADOR COORDINACION.ESTADO_COORDINACION MOVIDO =====
// Movido a mensajeria.js (FASE 8, ~14 l�neas con funci�n auxiliar obtenerEstadoCoordinacion)
// Consulta estado del sistema de coordinaci�n
// ================================================================

// ===== CONTROLADOR COORDINACION.SOLICITAR_DATOS_HIJO MOVIDO =====
// Movido a mensajeria.js (FASE 8, ~213 l�neas)
// Maneja solicitudes de datos a componentes hijo
// Gestiona timeouts, reintentos y respuestas agregadas
// ================================================================

// ===== CONTROLADOR COORDINACION.COORDINAR_ACCION MOVIDO =====
// Movido a mensajeria.js (FASE 8, ~234 l�neas)
// Coordina acciones entre m�ltiples componentes
// Orquesta acciones sincronizadas con manejo de dependencias y rollback transaccional
// ================================================================

// ===== CONTROLADOR COORDINACION.SINCRONIZAR_COMPONENTES MOVIDO =====
// Movido a mensajeria.js (FASE 8, ~221 l�neas)
// Sincroniza estado entre componentes
// Soporta estrategias: propagaci�n, consolidaci�n y resoluci�n de conflictos
// ================================================================

/**
 * Maneja las respuestas de datos de m�ltiples paradas (PUSH NOTIFICATION).
 * Este controlador procesa la informaci�n de varias paradas recibidas
 * de un componente del sistema, como el m�dulo de datos o un servicio externo.
 * 
 * ?? IMPORTANTE: Este es un controlador de PUSH (no request/response).
 * Se usa cuando el padre o un servicio ENV�A actualizaciones de paradas de forma
 * as�ncrona (no solicitadas), como notificaciones de cambios.
 * 
 * ?? DIFERENCIA con SOLICITAR_PARADAS:
 * - SOLICITAR_PARADAS: Request/Response s�ncrono (hijo pide ? padre responde con return)
 * - RESPUESTA_PARADAS: Push notification (padre env�a update ? hijos reciben y procesan)
 * 
 * @param {Object} mensaje - Mensaje con los datos de las paradas
 * @param {string} mensaje.origen - ID del componente que env�a la respuesta
 * @param {Object} mensaje.datos - Datos de las paradas
 * @param {Array<Object>} mensaje.datos.paradas - Lista de objetos de paradas
 * @param {string} mensaje.datos.paradas[].paradaId - Identificador �nico de la parada
 * @param {string} [mensaje.datos.paradas[].nombre] - Nombre de la parada
 * @param {Object} mensaje.datos.paradas[].ubicacion - Coordenadas de ubicaci�n {lat: number, lng: number}
 * @param {Array<Object>} [mensaje.datos.paradas[].rutas] - Rutas que pasan por esta parada
 * @param {Object} [mensaje.datos.paradas[].metadatos] - Metadatos adicionales de la parada
 * @param {string} [mensaje.datos.paradas[].estado] - Estado de la parada
 * @param {Object} [mensaje.datos.metadatos] - Metadatos adicionales del conjunto de paradas
 * @param {string} [mensaje.datos.estado] - Estado general del conjunto de paradas
 * @param {string} [mensaje.datos.mensajeId] - ID del mensaje original que solicit� los datos
 * @param {boolean} [mensaje.datos.actualizacionParcial=false] - Indica si es una actualizaci�n parcial
 * @param {boolean} [mensaje.datos.notificarSistema=true] - Si se debe notificar a otros componentes
 * @param {boolean} [mensaje.datos.requiereConfirmacion=true] - Si se requiere confirmaci�n de recepci�n
 * 
 * @example
 * // USO: Enviar actualizaci�n desde el padre
 * enviarMensaje({
 *     tipo: TIPOS_MENSAJE.DATOS.RESPUESTA_PARADAS,
 *     destino: 'broadcast', // O un hijo espec�fico
 *     datos: {
 *         paradas: [...],
 *         actualizacionParcial: false,
 *         notificarSistema: true
 *     }
 * });
 */
// CONTROLADOR DATOS.RESPUESTA_PARADAS movido a utils.js (FASE 10)

/**
 * Maneja las solicitudes de datos de paradas.
 * Este controlador procesa las solicitudes de datos de paradas y devuelve la informaci�n solicitada
 * seg�n los criterios de filtrado proporcionados.
 * 
 * ?? IMPORTANTE: Este controlador usa patr�n Request/Response DIRECTO (return).
 * La respuesta NO viene en .datos, viene directamente en el objeto de respuesta.
 * 
 * @param {Object} mensaje - Mensaje de solicitud de paradas
 * @param {string} mensaje.origen - ID del componente que realiza la solicitud
 * @param {Object} mensaje.datos - Par�metros de la solicitud
 * @param {string} [mensaje.datos.filtro] - Filtro opcional para buscar paradas por nombre o ID
 * @param {Object} [mensaje.datos.rango] - Rango geogr�fico opcional para filtrar paradas
 * @param {number} mensaje.datos.rango.lat - Latitud central
 * @param {number} mensaje.datos.rango.lng - Longitud central
 * @param {number} [mensaje.datos.rango.radio=1000] - Radio en metros (por defecto 1km)
 * @param {Array<string>} [mensaje.datos.campos] - Campos espec�ficos a devolver (por defecto todos)
 * @param {number} [mensaje.datos.limite=100] - N�mero m�ximo de resultados a devolver
 * @param {boolean} [mensaje.datos.soloActivas=true] - Si es true, solo devuelve paradas activas
 * @param {string} [mensaje.datos.ordenPor='nombre'] - Campo por el que ordenar los resultados
 * @param {string} [mensaje.datos.orden='asc'] - Orden de clasificaci�n ('asc' o 'desc')
 * @param {boolean} [mensaje.datos.incluirEstadisticas=false] - Si incluir estad�sticas de los resultados
 * 
 * @returns {Promise<Object>} Objeto con los resultados (DIRECTO, sin .datos)
 * @returns {number} return.total - Total de paradas encontradas
 * @returns {Array<Object>} return.paradas - Array de objetos de paradas
 * @returns {Object} [return.estadisticas] - Estad�sticas si se solicitaron
 * @returns {Object} return.metadatos - Metadatos de la respuesta
 * 
 * @example
 * // USO CORRECTO:
 * const respuesta = await enviarMensaje({
 *     tipo: TIPOS_MENSAJE.DATOS.SOLICITAR_PARADAS,
 *     datos: {}
 * });
 * // ? CORRECTO: respuesta.paradas
 * if (respuesta && respuesta.paradas) {
 *     console.log(respuesta.paradas);
 * }
 * // ? INCORRECTO: respuesta.datos.paradas (NO existe)
 */
// CONTROLADOR DATOS.SOLICITAR_PARADAS movido a utils.js (FASE 10)

