/**
 * Módulo principal de la aplicación
 * @module App
 * @version 1.0.0
 */

import { TIPOS_MENSAJE, MODOS } from './constants.js';
import logger from './logger.js';
import { enviarMensaje, registrarControlador } from './mensajeria.js';
import { CONFIG } from './config.js';
import { generarIdUnico, getPadreId, canonicalizarModo } from './utils.js';
import { promesasPendientes, registrarMetrica as registrarMetricaMonitoreo } from './monitoreo.js';
import { esMovil } from './device-detection.js';

import { invalidarTamañoMapa, diagnosticarMapa, isMapInitialized } from './funciones-mapa.js';

/**
 * Migrar registros tempranos desde el fallback global a la mensajería.
 * Algunos módulos registran handlers antes de que `mensajeria` esté
 * completamente inicializada. Esta función re-aplica esas registraciones
 * al Map interno de `mensajeria` llamando a su `registrarControlador`.
 */
export async function registrarControladoresApp() {
    try {
        const { migrarManejadoresTempranos } = await import('./mensajeria.js');
        try {
            const migrated = migrarManejadoresTempranos();
            // Agregar verificación para evitar duplicados
            if (migrated && migrated.length > 0) {
                logger.info('[APP][registrarControladores] Controladores migrados (sin duplicados):', migrated.filter(m => !m.duplicado));
            } else {
                logger.debug('[APP][registrarControladores] No hay controladores tempranos para migrar');
            }
        } catch (e) {
            logger.warn('[APP][registrarControladores] Error migrando manejadores tempranos:', e && e.message);
        }
    } catch (error) {
        logger.warn('[APP][registrarControladores] No se pudo migrar controladores (import failed):', error.message);
    }
}

// Estado global en codigo-padre.html

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

// Helper: wrap a promise with a conservative timeout that resolves to null on timeout
function withTimeout(promise, ms = 5000, desc = 'operation') {
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => {
            logger.warn(`[withTimeout] ${desc} timed out after ${ms}ms`);
            resolve(null);
        }, ms))
    ]);
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
    if (!estado) return;
    if (!estado.hijosInicializados) estado.hijosInicializados = new Set();
    if (typeof estado.hijosInicializados[Symbol.iterator] !== 'function') {
        logger.warn('[actualizarInterfazModo] estado.hijosInicializados no es iterable');
        return;
    }

    const hijosList = Array.from(estado.hijosInicializados);
    logger.info(`[actualizarInterfazModo] Protocolo bidireccional: cambio de modo '${modo}' a ${hijosList.length} hijos`);

    // Mapas para rastrear respuestas
    const respuestasEntendido = new Map();
    const respuestasEfectuado = new Map();
    const mensajeId = `modo_${Date.now()}`;

    // Controladores temporales para las respuestas
    const controladorEntendido = registrarControladorSeguro(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO_ENTENDIDO, (msg) => {
        respuestasEntendido.set(msg.origen, { timestamp: Date.now(), datos: msg.datos });
        logger.debug(`[actualizarInterfazModo] ENTENDIDO recibido de ${msg.origen}`);
    });

    const controladorEfectuado = registrarControladorSeguro(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO_EFECTUADO, (msg) => {
        respuestasEfectuado.set(msg.origen, { timestamp: Date.now(), datos: msg.datos });
        logger.debug(`[actualizarInterfazModo] EFECTUADO recibido de ${msg.origen}`);
    });

    try {
        // 1. Enviar CAMBIO_MODO a todos los hijos
        logger.info(`[actualizarInterfazModo] Enviando CAMBIO_MODO a todos los hijos...`);
        const promesasEnvio = hijosList.map(hijoId => 
            enviarMensaje({
                destino: hijoId,
                tipo: TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO,
                origen: getPadreId(),
                datos: { modo, secuenciaCompleta: !!(estado && estado.todosHijosListos), mensajeId }
            }).catch(err => {
                logger.error(`[actualizarInterfazModo] Error enviando a ${hijoId}:`, err);
            })
        );
        await Promise.all(promesasEnvio);

        // 2. Esperar ENTENDIDO de todos (max 5s)
        logger.info(`[actualizarInterfazModo] Esperando ENTENDIDO de ${hijosList.length} hijos...`);
        await esperarRespuestas(respuestasEntendido, hijosList, 5000, 'ENTENDIDO');

        // 3. Esperar EFECTUADO de todos (max 10s)
        logger.info(`[actualizarInterfazModo] Esperando EFECTUADO de ${hijosList.length} hijos...`);
        await esperarRespuestas(respuestasEfectuado, hijosList, 10000, 'EFECTUADO');

        // 4. Enviar APLICADO a todos
        logger.info(`[actualizarInterfazModo] Enviando APLICADO a todos los hijos...`);
        const promesasAplicado = hijosList.map(hijoId =>
            enviarMensaje({
                destino: hijoId,
                tipo: TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO_APLICADO,
                origen: getPadreId(),
                datos: { modo, timestamp: Date.now(), mensajeId }
            }).catch(err => {
                logger.error(`[actualizarInterfazModo] Error enviando APLICADO a ${hijoId}:`, err);
            })
        );
        await Promise.all(promesasAplicado);

        logger.success(`[actualizarInterfazModo] ✅ Protocolo bidireccional completado para modo '${modo}'`);

    } finally {
        // Limpiar controladores temporales
        if (typeof controladorEntendido === 'function') controladorEntendido();
        if (typeof controladorEfectuado === 'function') controladorEfectuado();
    }
}

// Helper: esperar respuestas de todos los hijos con timeout
async function esperarRespuestas(mapaRespuestas, hijosEsperados, timeoutMs, tipoRespuesta) {
    const inicio = Date.now();
    const intervaloChequeo = 100; // Chequear cada 100ms
    
    while (Date.now() - inicio < timeoutMs) {
        // Verificar si todos respondieron
        const todosRespondieron = hijosEsperados.every(hijo => mapaRespuestas.has(hijo));
        if (todosRespondieron) {
            logger.info(`[esperarRespuestas] Todos los hijos respondieron ${tipoRespuesta} en ${Date.now() - inicio}ms`);
            return;
        }
        
        // Esperar un poco antes del siguiente chequeo
        await new Promise(resolve => setTimeout(resolve, intervaloChequeo));
    }
    
    // Timeout: reportar quiénes no respondieron
    const noRespondieron = hijosEsperados.filter(hijo => !mapaRespuestas.has(hijo));
    logger.warn(`[esperarRespuestas] Timeout esperando ${tipoRespuesta} de: ${noRespondieron.join(', ')}`);
}

// Agregar función auxiliar para reintentos con confirmación
async function enviarMensajeConReintento(mensaje, maxReintentos = 3) {
    for (let intento = 1; intento <= maxReintentos; intento++) {
        try {
            return await enviarMensajeConConfirmacion({
                tipo: mensaje.tipo,
                origen: mensaje.origen,
                destino: mensaje.destino,
                datos: mensaje.datos,
                timeout: 15000  // Aumentar timeout a 15 segundos
            });
        } catch (error) {
            if (intento === maxReintentos) throw error;
            logger.warn(`[APP] Reintento ${intento} para mensaje ${mensaje.tipo} a ${mensaje.destino}:`, error);
            await new Promise(resolve => setTimeout(resolve, 1000 * intento));  // Backoff exponencial
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
    try {
        const r = enviarMensaje({
            destino: getPadreId(),
            tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
            origen: getPadreId(),
            datos: {
                codigo,
                mensaje: error.message,
                stack: error.stack,
                contexto,
                timestamp: new Date().toISOString()
            }
        });
        if (r && typeof r.then === 'function') {
            r.catch(err => logger.error('Error al notificar error:', err));
        }
    } catch (err) {
        logger.error('Error al notificar error:', err);
    }
}

/**
 * Env�a un mensaje para cambiar el modo de la aplicaci�n
 * @param {string} nuevoModo - Nuevo modo ('casa' o 'aventura')
 * @param {string} origen - Origen del cambio
 * @returns {Promise<Object>} Resultado de la operaci�n
 */
export async function enviarCambioModo(nuevoModo, origen = 'app') {
    const modoCanonical = canonicalizarModo(nuevoModo);
    if (!modoCanonical) throw new Error(`Modo inv�lido: ${nuevoModo}`);

    return await enviarMensaje({
        destino: CONFIG.IFRAME_ID,
        tipo: TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO,
        origen: getPadreId(),
        datos: {
            modo: modoCanonical,
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
    const modoCanonical = canonicalizarModo(modo);
    if (!modoCanonical) {
        throw new Error(`Modo no v�lido: ${modo}`);
    }

    return true;
}

// Constantes para los modos de operación del sistema (diferentes a MODOS de constants.js que son 'casa'/'aventura')
const MODOS_OPERACION = {
    casa: {
        nombre: 'Casa',
        descripcion: 'Modo Casa (funcionamiento por defecto)',
        puedeCambiar: true
    },
    aventura: {
        nombre: 'Aventura',
        descripcion: 'Modo Aventura (usuario en ruta)',
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

    // Normalizar modo usando helper centralizado
    const modoNormalized = canonicalizarModo(modo); // 'casa'|'aventura' or null
    const modosKeys = Object.keys(MODOS); // ['CASA','AVENTURA']
    const modoKey = modosKeys.find(k => MODOS[k] === modoNormalized) || null;

    try {
        // 2. Validar modo solicitado (ahora normalizado)
        if (!modoNormalized) {
            const errorMsg = `Modo inv�lido: '${modo}'. V�lidos: ${modosKeys.join(', ')}`;
            logger.warn(`${logPrefix} ${errorMsg}`, { modo, mensajeId });
            return { exito: false, error: errorMsg };
        }

        // 3. Validar transici�n de modos
        const modoActual = estado.modo?.actual || MODOS.CASA;
        if (modoNormalized === modoActual) {
            logger.info(`${logPrefix} El modo ya est� establecido a '${modoNormalized}'`, { mensajeId });
            return { exito: true, cambiado: false, modoActual };
        }

        // 4. Registrar evento de cambio de modo
        const eventoCambioModo = {
            modoAnterior: modoActual,
            modoNuevo: modoNormalized,
            timestamp,
            origen: mensaje.origen,
            motivo,
            opciones
        };

        registrarEvento('CAMBIO_MODO', eventoCambioModo);

        // 5. Validar permisos (si es necesario) - comprobar en MODOS_OPERACION de forma segura
        // Buscar configuración de permisos en MODOS_OPERACION usando varias formas de key
        const permisoCfg = MODOS_OPERACION && (MODOS_OPERACION[modoNormalized] || MODOS_OPERACION[modoKey?.toLowerCase?.()] || MODOS_OPERACION[modoKey]);
        if (permisoCfg && permisoCfg.requiereAutenticacion) {
            const tienePermisos = await validarPermisosCambioModo(mensaje.origen, modoNormalized);
            if (!tienePermisos) {
                const errorMsg = 'No tiene permisos para cambiar a este modo';
                logger.warn(`${logPrefix} ${errorMsg}`, { origen: mensaje.origen, modo: modoNormalized });
                return { exito: false, error: errorMsg };
            }
        }

        // 6. Notificar inicio del cambio de modo
        logger.info(`${logPrefix} Iniciando cambio de modo '${modoActual}' a '${modoNormalized}'`, {
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

        // OPTIMISTIC UPDATE: actualizar estado de modo inmediatamente (normalizado)
        try {
            estado.modo = estado.modo || {};
            estado.modo.anterior = modoActual;
            estado.modo.actual = modoNormalized;
            estado.modo.ultimoCambio = {
                timestamp,
                origen: mensaje.origen,
                motivo,
                opciones
            };
        } catch (e) {
            logger.warn(`${logPrefix} No se pudo aplicar optimistic update:`, e && e.message);
        }

        // **NUEVO: Limpiar recursos inmediatamente después del cambio de modo**
        try {
            await limpiarRecursosPorModo(estado, modoNormalized, opciones);
            logger.info(`${logPrefix} Recursos limpiados inmediatamente después del cambio de modo`);
        } catch (errorLimpieza) {
            logger.warn(`${logPrefix} Error limpiando recursos:`, errorLimpieza);
            // No bloquear el cambio de modo por errores de limpieza
        }

        try {
            // 8. Notificar a los componentes del cambio inminente (no bloquear>5s)
            await withTimeout(notificarCambioModoInminente(modoActual, modoNormalized, motivo), 15000, 'notificarCambioModoInminente');

            // 8.1 Preparar pre-warm / pausar según el modo (usar valores normalizados)

            // 8.1 Preparar pre-warm / pausar según el modo (usar valores normalizados)
            try {
                const esAventura = (modoKey === 'AVENTURA') || (modoNormalized === MODOS.AVENTURA);
                const esCasa = (modoKey === 'CASA') || (modoNormalized === MODOS.CASA);

                // Si vamos a AVENTURA, precalentar subsistemas que reducen latencia
                if (esAventura) {
                    const cfgConfirmTimeout = (window.Config && window.Config.MENSAJERIA && window.Config.MENSAJERIA.TIMEOUTS && window.Config.MENSAJERIA.TIMEOUTS.CONFIRMACION) || 10000;
                    const promises = [];

                    try {
                        // Si el prewarm ya se inició en modo CASA y está pausado, no volver a reiniciarlo
                        if (estado.sistema?.prewarmIniciado && estado.sistema?.prewarmPausado) {
                            logger.debug('[APP][CAMBIO_MODO] Pre-warm detectado (iniciado en CASA), se reanudará en lugar de reiniciarse');
                        } else {
                            // Only pre-init heartbeat; GPS warmup removed
                            if (window.mensajeria && typeof window.mensajeria.preiniciarHeartbeat === 'function') {
                                promises.push(window.mensajeria.preiniciarHeartbeat());
                                logger.debug('[APP][CAMBIO_MODO] Pre-iniciando heartbeat en background (no estaba pre-iniciado)');
                            }
                            logger.debug('[APP][CAMBIO_MODO] GPS warmup disabled; skipping GPS prewarm');
                        }
                    } catch (e) { logger.warn('[APP][CAMBIO_MODO] Error lanzando prewarm inicial:', e); }

                    const hijosPromise = (window.mensajeria && typeof window.mensajeria.esperarHijosListos === 'function')
                        ? window.mensajeria.esperarHijosListos(cfgConfirmTimeout)
                        : Promise.resolve({ ready: true });

                    try {
                        const race = await Promise.race([
                            (async () => { await Promise.allSettled(promises); return hijosPromise; })(),
                            new Promise(resolve => setTimeout(() => resolve({ timeout: true }), cfgConfirmTimeout * 2))  // Timeout extendido
                        ]);

                        if (race && race.timeout) {
                            logger.info('[APP][CAMBIO_MODO] Pre-warm / HIJO_LISTO timed out; proceeding anyway');
                        } else {
                            logger.info('[APP][CAMBIO_MODO] Pre-warm and/or HIJO_LISTO completed or settled');
                        }

                        // Tras pre-warm o si estaba pre-iniciado, reanudar heartbeat e iniciar GPS aventura
                        try {
                            if (estado.sistema?.prewarmIniciado && estado.sistema?.prewarmPausado) {
                                // Reanudar desde estado preiniciado
                                if (window.mensajeria && typeof window.mensajeria.reanudarHeartbeat === 'function') {
                                    window.mensajeria.reanudarHeartbeat();
                                    logger.debug('[APP][CAMBIO_MODO] Heartbeat reanudado desde pre-warm en CASA');
                                }

                                // Start GPS adventure flow directly (warmup removed)
                                if (window.funcionesMapa && typeof window.funcionesMapa.iniciarGPSAventura === 'function') {
                                    await window.funcionesMapa.iniciarGPSAventura();
                                    logger.debug('[APP][CAMBIO_MODO] Iniciado GPS aventura (sin warmup)');
                                }

                                estado.sistema.prewarmPausado = false;
                            } else {
                                if (window.mensajeria && typeof window.mensajeria.reanudarHeartbeat === 'function') {
                                    window.mensajeria.reanudarHeartbeat();
                                    logger.debug('[APP][CAMBIO_MODO] Heartbeat reanudado tras pre-warm');
                                }
                                if (window.funcionesMapa && typeof window.funcionesMapa.iniciarGPSAventura === 'function') {
                                    await window.funcionesMapa.iniciarGPSAventura();
                                    logger.debug('[APP][CAMBIO_MODO] Iniciado GPS aventura tras pre-warm');
                                }

                                // Establecer parada por defecto "padre-P-0" y solicitar coordenadas a hijo2
                                try {
                                    if (window.AVENTURA_PARADAS && window.AVENTURA_PARADAS.length > 0) {
                                        const paradaDefecto = window.AVENTURA_PARADAS.find(p => p.padreid === 'padre-P-0') || window.AVENTURA_PARADAS[0];
                                        estado.paradaActual = paradaDefecto.padreid;
                                        estado.elementoActual = paradaDefecto;
                                        logger.info('[APP][CAMBIO_MODO] Establecida parada por defecto: padre-P-0');

                                        // Solicitar coordenadas a hijo2
                                        await enviarMensaje({
                                            tipo: TIPOS_MENSAJE.DATOS.COORDENADAS_PARADAS_REQUEST,
                                            origen: getPadreId(),
                                            destino: 'hijo2',
                                            datos: { paradaId: 'P-0', padreId: 'padre-P-0' }
                                        });
                                        logger.debug('[APP][CAMBIO_MODO] Solicitadas coordenadas de P-0 a hijo2');

                                        // Enviar cambio de parada a funciones-mapa
                                        await enviarMensaje({
                                            tipo: TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA,
                                            origen: getPadreId(),
                                            destino: 'funciones-mapa',
                                            datos: { paradaId: 'padre-P-0' }
                                        });
                                        logger.debug('[APP][CAMBIO_MODO] Enviado cambio de parada padre-P-0 a funciones-mapa');
                                    }
                                } catch (e) {
                                    logger.warn('[APP][CAMBIO_MODO] Error estableciendo parada por defecto:', e);
                                }
                                estado.sistema.prewarmPausado = false;
                                estado.sistema.prewarmIniciado = true;
                            }
                        } catch (e) { logger.warn('[APP][CAMBIO_MODO] Error reanudando/iniciando subsistemas tras pre-warm:', e); }
                    } catch (e) {
                        logger.warn('[APP][CAMBIO_MODO] Error esperando prewarm/hijosListos:', e);
                    }

                // Si volvemos a CASA, pausar heartbeat y detener warmup GPS para ahorrar recursos
                } else if (esCasa) {
                    // GPS warmup was removed, nothing to pause/stop here

                    try {
                        if (window.mensajeria && typeof window.mensajeria.pausarHeartbeat === 'function') {
                            window.mensajeria.pausarHeartbeat();
                            logger.debug('[APP][CAMBIO_MODO] Heartbeat pausado al cambiar a CASA');
                        }
                    } catch (e) { logger.warn('[APP][CAMBIO_MODO] Error pausando heartbeat al cambiar a CASA:', e); }

                    // Si no fue modificado arriba, asegurar que la bandera quede marcada como pausada
                    estado.sistema.prewarmPausado = estado.sistema.prewarmPausado || false;
                }
            } catch (e) {
                logger.warn('[APP][CAMBIO_MODO] Error en flujo de pre-warm:', e);
            }

                // (Estado ya actualizado de forma optimista antes) - asegurar campos mínimos
            estado.modo = estado.modo || {};
            estado.modo.anterior = estado.modo.anterior || modoActual;
            estado.modo.actual = estado.modo.actual || modoNormalized;
            estado.modo.ultimoCambio = estado.modo.ultimoCambio || {
                timestamp,
                origen: mensaje.origen,
                motivo,
                opciones
            };

            // 10. Actualizar interfaz según el modo (no bloquear>5s por interfaz)
            const hijosInicializados = estado.hijosInicializados ? Array.from(estado.hijosInicializados) : [];
            logger.info(`${logPrefix} Iniciando actualización de interfaz para ${hijosInicializados.length} hijos: ${hijosInicializados.join(', ')}`);
            await withTimeout(actualizarInterfazModo(estado, modoNormalized), 15000, 'actualizarInterfazModo');

            // 11. Notificar a los componentes del cambio completado (no bloquear>5s)
            await withTimeout(notificarCambioModoCompletado(modoActual, modoNormalized, motivo), 15000, 'notificarCambioModoCompletado');

            // 12. Registrar �xito
            logger.info(`${logPrefix} Cambio de modo completado exitosamente`, {
                modoAnterior: modoActual,
                modoNuevo: modoNormalized,
                duracion: `${Date.now() - timestamp}ms`
            });

            return { 
                exito: true, 
                cambiado: true,
                modoAnterior: modoActual, 
                modoActual: modoNormalized,
                timestamp
            };

        } catch (errorCambio) {
            const errorMsg = `Error durante el cambio de modo: ${errorCambio.message}`;
            logger.error(`${logPrefix} ${errorMsg}`, {
                error: errorCambio,
                stack: errorCambio.stack,
                modoActual,
                modoSolicitado: modoNormalized
            });

            // Intentar restaurar el estado anterior
            try {
                await restaurarEstadoModoAnterior(estado, modoActual, modo, errorMsg);
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
                origen: getPadreId(),
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
 * Inicia (idempotente) el pre-warm de subsistemas cuando la app está en modo CASA.
 * Pre-inicia (inicializa en background) GPS y Heartbeat pero los deja en estado pausado.
 * Esto permite reanudar rápidamente al cambiar a AVENTURA.
 */
export async function iniciarPrewarmEnCasa(estado = window.estadoPadre) {
    try {
        if (!estado) return { iniciado: false, motivo: 'estado no disponible' };
        const modoActual = estado.modo?.actual || MODOS.CASA;
        if (modoActual !== MODOS.CASA) return { iniciado: false, motivo: 'modo no es CASA' };

        estado.sistema = estado.sistema || {};
        if (estado.sistema.prewarmIniciado) {
            logger.debug('[APP][PREWARM] Ya iniciado previamente, omitiendo re-inicio');
            return { iniciado: true, motivo: 'ya_iniciado' };
        }

        // GPS warmup removed: only pre-initialize heartbeat here

        // Pre-iniciar heartbeat (preparado pero pausado)
        try {
            if (window.mensajeria && typeof window.mensajeria.preiniciarHeartbeat === 'function') {
                await withTimeout(window.mensajeria.preiniciarHeartbeat(), 5000, 'preiniciarHeartbeat');
                if (typeof window.mensajeria.pausarHeartbeat === 'function') {
                    window.mensajeria.pausarHeartbeat();
                }
                logger.info('[APP][PREWARM] Heartbeat pre-iniciado y pausado');
            }
        } catch (e) {
            logger.warn('[APP][PREWARM] Fallback: preiniciarHeartbeat falló, continuando sin prewarm');
        }

        estado.sistema.prewarmIniciado = true;
        estado.sistema.prewarmPausado = true;

        return { iniciado: true };
    } catch (err) {
        logger.warn('[APP][PREWARM] Error iniciando prewarm en CASA:', err);
        return { iniciado: false, motivo: err.message };
    }
}

// Auto-run seguro: si el estado del padre ya existe y está en CASA, iniciar pre-warm.
// Si no está disponible aún, comprobar periódicamente durante unos segundos.
if (typeof window !== 'undefined') {
    (async () => {
        try {
            const tryStart = async () => {
                if (window.estadoPadre && (window.estadoPadre.modo?.actual === MODOS.CASA || !window.estadoPadre.modo)) {
                    await iniciarPrewarmEnCasa(window.estadoPadre);
                    return true;
                }
                return false;
            };

            if (!(await tryStart())) {
                // Reintentar a intervalos cortos hasta 5s
                const maxRetries = 10;
                let attempts = 0;
                const iv = setInterval(async () => {
                    attempts++;
                    if (await tryStart() || attempts >= maxRetries) {
                        clearInterval(iv);
                    }
                }, 500);
            }
        } catch (e) {
            logger.warn('[APP][PREWARM] Auto-run prewarm falló:', e);
        }
    })();
}

/**
 * Valida los permisos para cambiar a un modo espec�fico
 * @private
 */
async function validarPermisosCambioModo(origen, modo) {
    // Implementar l�gica de validaci�n de permisos
    return true;
}

/**
 * Notifica a los componentes sobre un cambio de modo inminente
 * @private
 */
async function notificarCambioModoInminente(modoAnterior, modoNuevo, motivo) {
    logger.info(`[notificarCambioModoInminente] Notificando cambio inminente: ${modoAnterior} → ${modoNuevo} (motivo: ${motivo})`);
    // Notificar a los componentes
    await enviarMensaje({
        tipo: TIPOS_MENSAJE.SISTEMA.NOTIFICACION,
        origen: 'sistema',
        destino: 'broadcast',
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
    logger.debug(`[notificarCambioModoInminente] Notificación broadcast enviada`);
}

/**
 * Notifica a los componentes que el cambio de modo se complet�
 * @private
 */
async function notificarCambioModoCompletado(modoAnterior, modoNuevo, motivo) {
    logger.info(`[notificarCambioModoCompletado] Notificando cambio completado: ${modoAnterior} → ${modoNuevo} (motivo: ${motivo})`);
    // Notificar a los componentes
    await enviarMensaje({
        tipo: TIPOS_MENSAJE.SISTEMA.NOTIFICACION,
        origen: 'sistema',
        destino: 'broadcast',
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
    logger.debug(`[notificarCambioModoCompletado] Notificación broadcast enviada`);
}

/**
 * Limpia recursos espec�ficos seg�n el modo
 * @private
 * @param {Object} estado - Estado global de la aplicación
 */
async function limpiarRecursosPorModo(estado, modo, opciones = {}) {
    try {
        logger.info(`[APP][LIMPIAR_RECURSOS] Iniciando limpieza completa para cambio a modo '${modo}'`);
        // **NUEVO: Resetear estado de navegación para "empezar de nuevo"**
        logger.info(`[APP][LIMPIAR_RECURSOS] Reseteando estado para cambio a modo '${modo}'`);

        // Resetear selecciones previas
        estado.paradaActual = null;
        estado.tramoActual = null;
        estado.elementoActual = null;
        estado.siguiendoRuta = false;

        // Resetear estado GPS
        estado.gps = estado.gps || {};
        estado.gps.activo = false;
        estado.gps.posicionUsuario = null;
        estado.gps.watchId = null;

        // Resetear otros estados relacionados
        estado.retoActivo = false;
        estado.audioActivo = false;
        estado.ubicacionActiva = false;

        logger.debug(`[APP][LIMPIAR_RECURSOS] Estado de navegación reseteado`);

        // Limpiar mapa completamente
        if (window.funcionesMapa?.limpiarPorEstado) {
            // Esperar a que el mapa esté inicializado si no lo está
            if (!window.funcionesMapa.isMapInitialized || !window.funcionesMapa.isMapInitialized()) {
                logger.info(`[APP][LIMPIAR_RECURSOS] Mapa no inicializado, esperando...`);
                // Esperar hasta 5 segundos a que el mapa se inicialice
                await new Promise(resolve => {
                    const checkMap = () => {
                        if (window.funcionesMapa.isMapInitialized && window.funcionesMapa.isMapInitialized()) {
                            resolve();
                        } else {
                            setTimeout(checkMap, 100);
                        }
                    };
                    setTimeout(() => resolve(), 5000); // Timeout de 5 segundos
                    checkMap();
                });
            }

            const estadoLimpieza = {
                modo: modo,
                paradaActual: null,
                tramoActual: null,
                resetCompleto: true, // Flag para indicar reset completo
                ...opciones
            };

            logger.info(`[APP][LIMPIAR_RECURSOS] Llamando a limpiarPorEstado con resetCompleto: true`);
            const limpiado = await window.funcionesMapa.limpiarPorEstado(estadoLimpieza);

            if (limpiado) {
                logger.debug(`[APP][LIMPIAR_RECURSOS] Mapa limpiado completamente para modo ${modo}`);
            } else {
                logger.warn(`[APP][LIMPIAR_RECURSOS] limpiarPorEstado devolvió false`);
            }
        } else {
            logger.error(`[APP][LIMPIAR_RECURSOS] window.funcionesMapa.limpiarPorEstado no disponible`);
        }

        // Limpiar overlays activos (imágenes, videos)
        if (window.cerrarImagenOverlay) {
            try {
                window.cerrarImagenOverlay();
                logger.debug(`[APP][LIMPIAR_RECURSOS] Overlay de imagen cerrado`);
            } catch (e) {
                logger.warn(`[APP][LIMPIAR_RECURSOS] Error cerrando overlay de imagen:`, e);
            }
        }

        if (window.cerrarVideoOverlay) {
            try {
                window.cerrarVideoOverlay();
                logger.debug(`[APP][LIMPIAR_RECURSOS] Overlay de video cerrado`);
            } catch (e) {
                logger.warn(`[APP][LIMPIAR_RECURSOS] Error cerrando overlay de video:`, e);
            }
        }

        logger.info(`[APP][LIMPIAR_RECURSOS] Limpieza completa para modo ${modo} finalizada`);

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
    await actualizarInterfazModo(estado, modoAnterior);
    
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
/**
 * Registra una métrica utilizando una firma simple y consistente.
 * Nueva firma pública: `registrarMetrica(nombre, valor, metadatos = {})`
 * - `metadatos.unidad` : unidad legible (opcional)
 * - `metadatos.estado` : permitir pasar un `estado` explícito (útil en tests)
 * Compatibilidad: si se llama con la firma antigua (estado, nombre, valor, unidad)
 * se detecta y se comporta como antes.
 */
// Reexport registrarMetrica from the central `monitoreo` module for a single canonical implementation
export const registrarMetrica = registrarMetricaMonitoreo;

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
        // Preferir `window.registrarMetrica` cuando esté disponible (scripts globales)
        (typeof window !== 'undefined' && typeof window.registrarMetrica === 'function' ? window.registrarMetrica : registrarMetrica)(
            'uso_memoria', usoMemoria, { unidad: '%' }
        );
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

// Inicializar monitoreo de eventos de navegación usando solo la API moderna
function obtenerTiempoCargaPagina() {
    if (performance.getEntriesByType) {
        const [nav] = performance.getEntriesByType('navigation');
        if (nav && typeof nav.loadEventEnd === 'number') {
            return nav.loadEventEnd - nav.startTime;
        }
    }
    return null;
}

window.addEventListener('load', () => {
    if (window.performance && window.performance.memory) {
        const memory = window.performance.memory;
        const usoMemoria = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
        (typeof window !== 'undefined' && typeof window.registrarMetrica === 'function' ? window.registrarMetrica : registrarMetrica)('uso_memoria', usoMemoria, { unidad: '%' });
    }
    const tiempoCarga = obtenerTiempoCargaPagina();
    if (typeof tiempoCarga === 'number' && !isNaN(tiempoCarga)) {
        (typeof window !== 'undefined' && typeof window.registrarMetrica === 'function' ? window.registrarMetrica : registrarMetrica)('tiempo_carga_pagina', tiempoCarga);
    }
    registrarEvento('pagina_cargada', {
        tiempoCarga,
        url: window.location.href,
        userAgent: navigator.userAgent
    });
});

/**
 * Envía una confirmación a un hijo específico.
 * @param {string} hijoId - ID del hijo al que se enviará la confirmación.
 * @returns {Promise<void>}
 */
export async function enviarConfirmacionAHijo(hijoId, mensajeId) {
    try {
        await enviarMensaje({
            destino: hijoId,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: getPadreId(),
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
 * Envía el estado global a todos los hijos inicializados y verifica confirmaciones.
 * @param {Object} estado - Estado global de la aplicación
 */
export async function enviarEstadoGlobal(estado) {
    try {
        const estadoGlobal = {
            modo: estado.modo,
            paradaActual: estado.paradaActual,
            monitoreo: estado.monitoreo,
        };

        if (!estado) return;
        if (!estado.hijosInicializados) estado.hijosInicializados = new Set();
        if (typeof estado.hijosInicializados[Symbol.iterator] !== 'function') {
            logger.warn('estado.hijosInicializados no es iterable, omitiendo envio de estado global');
            return;
        }

        const hijosSinConfirmar = new Set(estado.hijosInicializados);

        for (const hijoId of estado.hijosInicializados) {
            try {
                await enviarMensaje({
                    destino: hijoId,
                    tipo: TIPOS_MENSAJE.SISTEMA.ESTADO,
                    origen: getPadreId(),
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

// Controladores AUDIO implementados en audio-hijo3.html (hijo3)
// Controladores NAVEGACIóN en funciones-mapa.js

/**
 * Maneja la confirmación de inicialización de componentes.
 * Este controlador procesa las notificaciones de finalización de inicialización
 * de componentes, actualizando su estado y coordinando las acciones posteriores.
 * 
 * @param {Object} mensaje - Mensaje de confirmación
 * @param {string} mensaje.origen - ID del componente que envía la confirmación
 * @param {Object} mensaje.datos - Datos de confirmación
 * @param {string} mensaje.datos.componenteId - ID del componente inicializado
 * @param {string} mensaje.datos.estado - Estado de la inicialización ('inicializado', 'error', etc.)
 * @param {number} [mensaje.datos.timestamp] - Marca de tiempo de la inicialización
 * @param {string} [mensaje.datos.mensajeId] - ID del mensaje original (opcional)
 * @param {Object} [mensaje.datos.metricas] - Métricas de rendimiento de la inicialización
 * @param {Object} [mensaje.datos.detalles] - Detalles adicionales de la inicialización
 */
// CONTROLADOR SISTEMA.INICIALIZACION_COMPLETADA movido a monitoreo.js (FASE 10)

// CONTROLADOR SISTEMA.COMPONENTE_INICIALIZADO movido a monitoreo.js (FASE 10)

// CONTROLADOR SISTEMA.INICIALIZACION_FINALIZADA movido a monitoreo.js (FASE 10)

// ❌ CONTROLADOR RESPUESTA_PARADA (singular) ELIMINADO - OBSOLETO
// El sistema actual usa RESPUESTA_PARADAS (plural) para recibir arrays completos
// y COORDENADAS_PARADAS_REQUEST/RESPONSE para solicitudes específicas

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
// en ningún archivo propio ni de terceros. Estos eventos están obsoletos y bloqueados por políticas modernas de navegador.
// Usar siempre 'pagehide' para limpieza de recursos y memoria.
// Revisar cualquier librería externa antes de integrarla para evitar estos listeners.

// Limpieza agresiva de globales al descargar la página
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        // En pagehide, evitar limpiar durante init
        if (window.estado?.sistema?.cambiandoModo) {
            logger.info('Init en curso, omitiendo limpieza agresiva');
            return;
        }
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
            logger.warn('Error en limpieza agresiva de la aplicación:', error.message);
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
 * Ejecuta una acción coordinada individual
 * @param {Object} accion - Acción a ejecutar
 * @returns {Promise<Object>} Resultado de la ejecución
 */
async function ejecutarAccionCoordinada(accion) {
    const { componente, tipo, datos } = accion;

    try {
        logger.debug(`Ejecutando acción coordinada para ${componente}: ${tipo}`);

        // Enviar mensaje al componente especificado
        const resultado = await enviarMensaje(componente, tipo, datos);

        logger.debug(`Acción coordinada completada para ${componente}`);
        return {
            componente,
            tipo,
            exito: true,
            resultado,
            timestamp: Date.now()
        };

    } catch (error) {
        logger.error(`Error ejecutando acción coordinada para ${componente}:`, error);
        throw {
            componente,
            tipo,
            exito: false,
            error: error.message,
            timestamp: Date.now()
        };
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
 * según los criterios de filtrado proporcionados.
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
 *     logger.debug(respuesta.paradas);
 * }
 * // ? INCORRECTO: respuesta.datos.paradas (NO existe)
 */
// CONTROLADOR DATOS.SOLICITAR_PARADAS movido a utils.js (FASE 10)

// --- Automatic resend logic for CAMBIO_MODO on NACK with esperarPermiso ---
// pendingModeChanges: hijoId -> { modo, datos, intentos, nextAttemptAt }
const pendingModeChanges = new Map();

// Backoff configuration
const MODE_RETRY_BASE_MS = 2000; // base backoff (2s)
const MODE_RETRY_MAX_MS = 60 * 1000; // max backoff (60s)
const MODE_RETRY_MAX_INTENTOS = 6; // max attempts before giving up

function _computeBackoff(attempt) {
    // exponential backoff with jitter
    const exp = Math.pow(2, Math.max(0, attempt - 1));
    const base = Math.min(MODE_RETRY_BASE_MS * exp, MODE_RETRY_MAX_MS);
    // Add small jitter +/-20%
    const jitter = base * (0.2 * (Math.random() - 0.5));
    return Math.round(base + jitter);
}

registrarControlador(TIPOS_MENSAJE.SISTEMA.NACK, async (mensaje) => {
    try {
        if (mensaje?.tipo === TIPOS_MENSAJE.SISTEMA.NACK && mensaje?.datos?.esperarPermiso && mensaje?.origen) {
            const hijoId = mensaje.origen;
            const modoRaw = mensaje.datos?.modoSolicitado || (mensaje.datos?.modo || null);
            const modo = canonicalizarModo(modoRaw);

            const existing = pendingModeChanges.get(hijoId) || { intentos: 0 };
            const intentos = Math.min((existing.intentos || 0) + 1, MODE_RETRY_MAX_INTENTOS);
            const nextAttemptAt = Date.now() + _computeBackoff(intentos);

            pendingModeChanges.set(hijoId, {
                modo,
                datos: mensaje.datos,
                intentos,
                nextAttemptAt
            });

            logger.info(`[APP][CAMBIO_MODO][RESEND] NACK con esperarPermiso de ${hijoId}, guardado intento=${intentos} nextAt=${new Date(nextAttemptAt).toISOString()}`);
        }
    } catch (e) {
        logger.warn('[APP][CAMBIO_MODO][RESEND] Error procesando NACK esperarPermiso:', e);
    }
});

registrarControlador(TIPOS_MENSAJE.SISTEMA.HIJO_LISTO, async (mensaje) => {
    try {
        const hijoId = mensaje?.origen;
        if (hijoId && pendingModeChanges.has(hijoId)) {
            const pending = pendingModeChanges.get(hijoId);
            logger.info(`[APP][CAMBIO_MODO][RESEND] HIJO_LISTO de ${hijoId}, reenviando CAMBIO_MODO pendiente (intentos=${pending.intentos})`);
            try {
                await enviarMensaje({
                    destino: hijoId,
                    tipo: TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO,
                    origen: getPadreId(),
                    datos: {
                        modo: pending.modo,
                        ...pending.datos,
                        secuenciaCompleta: true // Forzar bandera
                    }
                });
                pendingModeChanges.delete(hijoId);
            } catch (sendErr) {
                logger.warn(`[APP][CAMBIO_MODO][RESEND] Error reenviando CAMBIO_MODO a ${hijoId} tras HIJO_LISTO:`, sendErr);
                // update nextAttemptAt to retry later
                const intentos = Math.min((pending.intentos || 0) + 1, MODE_RETRY_MAX_INTENTOS);
                pendingModeChanges.set(hijoId, {
                    ...pending,
                    intentos,
                    nextAttemptAt: Date.now() + _computeBackoff(intentos)
                });
            }
        }
    } catch (e) {
        logger.warn('[APP][CAMBIO_MODO][RESEND] Error reenviando CAMBIO_MODO tras HIJO_LISTO:', e);
    }
});

// Background retry loop: periodically attempt to resend pending CAMBIO_MODO
setInterval(async () => {
    try {
        if (pendingModeChanges.size === 0) return;
        const now = Date.now();
        for (const [hijoId, pending] of Array.from(pendingModeChanges.entries())) {
            if (!pending || typeof pending.nextAttemptAt !== 'number') continue;
            if (now < pending.nextAttemptAt) continue; // not yet

            if ((pending.intentos || 0) >= MODE_RETRY_MAX_INTENTOS) {
                logger.error(`[APP][CAMBIO_MODO][RESEND] Máximo intentos alcanzado para ${hijoId}, abortando`);
                registrarEvento && typeof registrarEvento === 'function' && registrarEvento('CAMBIO_MODO_ABORTADO', { hijoId, intentos: pending.intentos, timestamp: now });
                pendingModeChanges.delete(hijoId);
                continue;
            }

            logger.info(`[APP][CAMBIO_MODO][RESEND] Intentando reenvío programado a ${hijoId} (intento ${pending.intentos + 1})`);
            try {
                await enviarMensaje({
                    destino: hijoId,
                    tipo: TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO,
                    origen: getPadreId(),
                    datos: {
                        modo: pending.modo,
                        ...pending.datos,
                        secuenciaCompleta: true
                    }
                });
                pendingModeChanges.delete(hijoId);
                registrarEvento && typeof registrarEvento === 'function' && registrarEvento('CAMBIO_MODO_REENVIADO', { hijoId, timestamp: Date.now() });
                logger.info(`[APP][CAMBIO_MODO][RESEND] Reenvío exitoso a ${hijoId}`);
            } catch (sendErr) {
                // increment attempts and schedule next
                const intentos = Math.min((pending.intentos || 0) + 1, MODE_RETRY_MAX_INTENTOS);
                const nextAttemptAt = Date.now() + _computeBackoff(intentos);
                pendingModeChanges.set(hijoId, {
                    ...pending,
                    intentos,
                    nextAttemptAt
                });
                logger.warn(`[APP][CAMBIO_MODO][RESEND] Reintento fallido para ${hijoId}, programado nextAt=${new Date(nextAttemptAt).toISOString()}`, sendErr);
            }
        }
    } catch (err) {
        logger.warn('[APP][CAMBIO_MODO][RESEND] Error en loop de reintentos:', err);
    }
}, 5000);

// Hacer funciones disponibles globalmente para compatibilidad con carga como script
window.manejarCambioModo = manejarCambioModo;
window.actualizarInterfazModo = actualizarInterfazModo;
window.notificarCambioModoInminente = notificarCambioModoInminente;
window.notificarCambioModoCompletado = notificarCambioModoCompletado;
