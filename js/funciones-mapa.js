/**
 * Módulo que maneja la visualización del mapa y la interacción con las paradas
 * Se comunica con el padre a través del sistema de mensajería
 */

// Importar mensajería y configuración
import { 
    enviarMensaje, 
    enviarMensajeConConfirmacion,
    registrarControlador
} from './mensajeria.js';
import { CONFIG, MAPA_TIPOS_HIJO } from './config.js';
import { TIPOS_MENSAJE, MODOS } from './constants.js';
import { validarCoordenadas } from './validacion.js';
import { generarIdUnico, manejarError } from './utils.js';
import logger from './logger.js';

/**
 * Calcula la distancia entre dos puntos geográficos usando la fórmula de Haversine
 * @param {number} lat1 - Latitud del primer punto
 * @param {number} lon1 - Longitud del primer punto
 * @param {number} lat2 - Latitud del segundo punto
 * @param {number} lon2 - Longitud del segundo punto
 * @returns {number} Distancia en metros
 */
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// Detección de dispositivo móvil (global para el módulo)
const esMovil = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Estado del módulo
let marcadoresParadas = new Map();
let marcadorDestino = null;
let marcadorParadaActual = null; // Marcador para la parada actualmente visitada
let marcadorPosicionActual = null; // Marcador para la posición GPS actual del usuario
let rutasTramos = [];
let rutasActivas = [];
let marcadorUsuario = null;
let _mapaInstance = null; // Instancia del mapa Leaflet
let _mapaOpciones = null; // Opciones del mapa

// Array de paradas locales
let arrayParadasLocal = [];

// Flag para evitar solicitudes duplicadas de datos de paradas
let datosParadasSolicitados = false;

// Estado del mapa
const estadoMapa = {
    modo: MODOS.CASA,
    posicionUsuario: null,
    gpsActivo: false,
    gpsPermisos: null, // null = desconocido, true = concedidos, false = denegados
    gpsPrecision: null, // Precisión actual del GPS en metros
    gpsError: null, // Último error GPS
    siguiendoRuta: false,
    paradaActual: null,
    tramoActual: null,
    timestamp: Date.now(),
    // Estado para consultas de cambio de parada
    consultaParadaPendiente: null, // { paradaId, origen, timestamp }
    esperandoCoordenadas: false,
    esperandoAudio: false,
    esperandoReto: false,
    datosRecopilados: {} // { coordenadas, audio, reto }
};

// Variables para GPS real (navigator.geolocation)
let gpsWatchId = null;
let gpsEstadoReal = {
    activo: false,
    permisos: null, // null = desconocido, true = concedidos, false = denegados
    precision: null,
    error: null,
    ultimaUbicacion: null
};

// Implementar limpieza automática cuando la página está oculta
let ultimaActividad = Date.now();
let intervaloLimpiezaAutomatica;

/**
 * Solicita los datos de paradas al padre si no están disponibles localmente
 * Evita solicitudes duplicadas usando la flag datosParadasSolicitados
 * @returns {Promise<void>}
 */
async function solicitarDatosParadas() {
    if (datosParadasSolicitados) {
        logger.debug('Datos de paradas ya solicitados anteriormente, omitiendo');
        return;
    }

    if (arrayParadasLocal.length > 0) {
        logger.debug('Datos de paradas ya disponibles localmente, omitiendo solicitud');
        return;
    }

    try {
        logger.info('Solicitando datos de paradas al padre...');
        datosParadasSolicitados = true;

        await enviarMensaje({
            destino: 'padre',
            tipo: TIPOS_MENSAJE.NAVEGACION.SOLICITAR_DATOS_PARADAS,
            origen: 'funciones-mapa',
            datos: {
                timestamp: Date.now(),
                razon: 'inicializacion_mapa'
            }
        });

        logger.debug('Solicitud de datos de paradas enviada exitosamente');
    } catch (error) {
        logger.error('Error al solicitar datos de paradas:', error);
        // Reset flag on error to allow retry
        datosParadasSolicitados = false;
    }
}

function actualizarUltimaActividad() {
    ultimaActividad = Date.now();
}

function limpiarRecursosInactivos() {
    const tiempoInactivo = Date.now() - ultimaActividad;

    // More aggressive timeout for mobile
    const tiempoLimite = esMovil ? 120000 : 300000; // 2 min móvil, 5 min desktop

    if (tiempoInactivo > tiempoLimite) {
        if (esMovil) {
            logger.debug('Aplicación móvil inactiva detectada, limpiando recursos agresivamente');
        } else {
            logger.info('Aplicación inactiva detectada, limpiando recursos del mapa');
        }

        limpiarRecursos();

        // Limpiar estado del mapa para ahorrar memoria
        estadoMapa.posicionUsuario = null;
        estadoMapa.paradaActual = null;
        estadoMapa.tramoActual = null;

        // Additional cleanup for mobile
        if (esMovil && _mapaInstance) {
            // Clear any cached markers or routes
            marcadoresParadas.clear();
            marcadorDestino = null;
            rutasTramos = [];
            rutasActivas = [];
            marcadorUsuario = null;
        }
    }
}

// Configurar listeners de actividad
if (typeof document !== 'undefined') {
    // Reduce event listeners for mobile (only essential ones)
    const eventosActividad = esMovil
        ? ['touchstart', 'click'] // Only touch and click for mobile
        : ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    eventosActividad.forEach(evento => {
        document.addEventListener(evento, actualizarUltimaActividad, { passive: true });
    });

    // Configurar limpieza automática (less frequent for mobile)
    const intervaloLimpiezaMs = esMovil ? 300000 : 120000; // 5 min móvil, 2 min desktop
    intervaloLimpiezaAutomatica = setInterval(limpiarRecursosInactivos, intervaloLimpiezaMs);
}

/**
 * Inicializa el servicio del mapa.
 * @param {Object} mapaInstance - Instancia del mapa de Leaflet.
 * @param {Object} [opciones={}] - Opciones de configuración.
 * @returns {boolean} True si la inicialización fue exitosa.
 */
export function inicializarServicioMapa(mapaInstance, opciones = {}) {
    if (!mapaInstance) {
        logger.error('No se proporcionó instancia del mapa');
        return false;
    }
    
    _mapaInstance = mapaInstance;
    _mapaOpciones = { ...opciones };
    
    // Inicializar array de paradas locales con datos del padre
    arrayParadasLocal = window.AVENTURA_PARADAS || [];
    
    logger.info('Servicio de mapa inicializado correctamente');
    
    return true;
}

/**
 * Verifica si el mapa está inicializado
 * @returns {boolean} True si el mapa está inicializado
 */
export function estaInicializado() {
    return _mapaInstance !== null;
}

/**
 * Ejecuta una operación en el mapa
 * @param {Function} operacion - Operación a ejecutar
 * @returns {Promise<any>} Resultado de la operación
 */
export async function ejecutarOperacionMapa(operacion) {
    return new Promise((resolve, reject) => {
        if (!_mapaInstance) {
            reject(new Error('Mapa no inicializado'));
            return;
        }
        
        try {
            const resultado = operacion(_mapaInstance);
            resolve(resultado);
        } catch (error) {
            logger.error('Error al ejecutar operación en el mapa', { 
                error: error.message, 
                stack: error.stack 
            });
            reject(error);
        }
    });
}

/**
 * Invalida el tamaño del mapa
 * @returns {Promise<boolean>} True si se realizó correctamente
 */
export async function invalidarTamañoMapa() {
    try {
        if (!_mapaInstance) {
            logger.warn('No se puede invalidar el tamaño: mapa no inicializado');
            return false;
        }
        
        await ejecutarOperacionMapa(mapa => {
            mapa.invalidateSize();
            return true;
        });
        
        logger.debug('Tamaño del mapa invalidado correctamente');
        return true;
    } catch (error) {
        logger.error('Error al invalidar tamaño del mapa', {
            error: error.message,
            stack: error.stack
        });
        return false;
    }
}

/**
 * Establece la vista del mapa
 * @param {Array|Object} center - Centro del mapa [lat, lng] or {lat, lng}
 * @param {number} zoom - Nivel de zoom
 * @param {Object} [opciones={}] - Opciones adicionales
 * @returns {Promise<boolean} True si se estableció correctamente
 */
export async function setMapView(center, zoom, opciones = {}) {
    try {
        if (!_mapaInstance) {
            console.warn('No se puede establecer vista: mapa no inicializado');
            return false;
        }
        
        if (!validarCoordenadas(center)) return false;
        
        let centerPoint;
        if (Array.isArray(center)) {
            centerPoint = center;
        } else if (center && typeof center === 'object' && 'lat' in center && 'lng' in center) {
            centerPoint = [center.lat, center.lng];
        } else {
            throw new Error('Centro inválido');
        }
        
        await ejecutarOperacionMapa(mapa => {
            mapa.setView(centerPoint, zoom, opciones);
            return true;
        });
        
        return true;
    } catch (error) {
        console.error('Error al establecer vista del mapa:', error);
        return false;
    }
}

/**
 * Obtiene el centro actual del mapa
 * @returns {Promise<{lat: number, lng: number, zoom: number}>} Coordenadas del centro
 */
export async function getMapCenter() {
    if (!_mapaInstance) {
        throw new Error('Servicio de mapa no inicializado');
    }
    
    return new Promise((resolve, reject) => {
        try {
            const center = _mapaInstance.getCenter();
            if (!validarCoordenadas({ lat: center.lat, lng: center.lng })) return null;
            resolve({ 
                lat: center.lat, 
                lng: center.lng, 
                zoom: _mapaInstance.getZoom() 
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Verifica si el servicio del mapa está inicializado
 * @returns {Promise<boolean>} - True si el servicio está inicializado
 */
export async function isMapInitialized() {
    return Promise.resolve(_mapaInstance !== null);
}

/**
 * Get current user position from GPS
 * @returns {Promise<{lat: number, lng: number, accuracy?: number, timestamp?: number} | null>}
 */
export async function getPosicionUsuario() {
    return Promise.resolve(estadoMapa.posicionUsuario);
}

/**
 * Wait for Leaflet (L) to be available globally
 * @returns {Promise<void>}
 */
function waitForLeaflet() {
    return new Promise((resolve, reject) => {
        const checkLeaflet = () => {
            if (typeof L !== 'undefined' && L.map) {
                resolve();
            } else {
                setTimeout(checkLeaflet, 100);
            }
        };
        
        // Timeout after 10 seconds
        setTimeout(() => {
            reject(new Error('Leaflet no se cargó en el tiempo esperado'));
        }, 10000);
        
        checkLeaflet();
    });
}

/**
 * Verifica y corrige problemas comunes con el contenedor del mapa.
 * @param {string} containerId - ID del contenedor del mapa.
 * @returns {HTMLElement|null} - El contenedor corregido o null si no se puede arreglar.
 */
export function verificarContenedorMapa(containerId = 'mapa') {
    let contenedor = document.getElementById(containerId);
    if (!contenedor) {
        logger.warn(`Contenedor con ID "${containerId}" no encontrado. Creando uno nuevo.`);
        contenedor = document.createElement('div');
        contenedor.id = containerId;
        contenedor.style.cssText = 'width: 100%; height: 400px; position: relative;';
        document.body.appendChild(contenedor);
    }

    if (contenedor.offsetWidth === 0 || contenedor.offsetHeight === 0) {
        contenedor.style.width = '100%';
        contenedor.style.height = '400px';
        logger.debug('Dimensiones del contenedor corregidas');
    }

    return contenedor;
}

/**
 * Inicializa el mapa y verifica el contenedor.
 * @param {Object} config - Configuración del mapa.
 * @returns {Promise<L.Map>} - Instancia del mapa.
 */
export async function inicializarMapa(config = {}) {
    // Wait for Leaflet to be available
    await waitForLeaflet();

    logger.info('Inicializando mapa...');
    const containerId = config.containerId || 'mapa';

    // Verificar y corregir el contenedor del mapa
    const mapContainer = verificarContenedorMapa(containerId);
    if (!mapContainer) {
        throw new Error(`No se pudo verificar/reparar el contenedor #${containerId}`);
    }

    // Check if map is already initialized via the service
    if (estaInicializado()) {
        logger.info('Usando instancia existente del mapa');
        return await ejecutarOperacionMapa(mapa => mapa);
    }

    // Create new map instance
    const mapa = L.map(containerId, {
        center: CONFIG.MAPA.CENTER,
        zoom: CONFIG.MAPA.ZOOM,
        minZoom: CONFIG.MAPA.MIN_ZOOM,
        maxZoom: CONFIG.MAPA.MAX_ZOOM,
        zoomControl: CONFIG.MAPA.ZOOM_CONTROL
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(mapa);

    // Registrar la instancia en el servicio
    inicializarServicioMapa(mapa, config);

    logger.info('Mapa inicializado correctamente');
    return mapa;
}

/**
 * Espera a que un elemento sea visible en el DOM
 * @param {string} selector - Selector del elemento a esperar
 * @param {number} [timeout=5000] - Tiempo máximo de espera en ms
 * @returns {Promise<HTMLElement>} El elemento cuando esté visible
 */
async function esperarElementoVisible(selector, timeout = 5000) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
            // First check if element already exists
        const checkNow = document.querySelector(selector);
        if (checkNow && checkNow.offsetParent !== null) {
            logger.debug(`Elemento ${selector} ya está disponible en el DOM`);
            return resolve(checkNow);
        }
        
        logger.debug(`Esperando elemento ${selector} (timeout: ${timeout}ms)...`);
        
        // Create a more robust checking mechanism
        const checkElement = () => {
            const element = document.querySelector(selector);
            const elapsed = Date.now() - startTime;
            
            // Element exists and is visible
            if (element && element.offsetParent !== null) {
                logger.debug(`Elemento ${selector} encontrado después de ${elapsed}ms`);
                return resolve(element);
            }
            
            // Element exists but may not be visible yet - force visibility
            if (element && elapsed > timeout / 2) {
                logger.warn(`Elemento ${selector} existe pero podría no ser visible. Forzando visibilidad...`);
                element.style.display = 'block';
                element.style.visibility = 'visible';
                element.style.opacity = '1';
                element.style.height = element.style.height || '400px';
                element.style.width = element.style.width || '100%';
                
                // Give a short delay to apply styles then resolve
                setTimeout(() => resolve(element), 100);
                return;
            }
            
            // Timeout reached
            if (elapsed >= timeout) {
                // Last chance: if element exists at all, force it and resolve
                const lastChance = document.querySelector(selector);
                if (lastChance) {
                    logger.warn(`Tiempo agotado pero elemento ${selector} existe. Forzando visibilidad como último recurso.`);
                    lastChance.style.display = 'block';
                    lastChance.style.visibility = 'visible';
                    lastChance.style.opacity = '1';
                    lastChance.style.height = lastChance.style.height || '400px';
                    lastChance.style.width = lastChance.style.width || '100%';
                    return resolve(lastChance);
                }
                
                // Create element as last resort if it doesn't exist at all
                if (selector === '#mapa') {
                    logger.warn(`Creando elemento ${selector} ya que no existe después de ${elapsed}ms`);
                    const newMap = document.createElement('div');
                    newMap.id = 'mapa';
                    newMap.style.width = '100%';
                    newMap.style.height = '400px';
                    newMap.style.display = 'block';
                    document.body.insertBefore(newMap, document.body.firstChild);
                    return resolve(newMap);
                }
                
                return reject(new Error(`Tiempo de espera agotado para el selector: ${selector} (${elapsed}ms)`));
            }
            
            // Continue checking
            requestAnimationFrame(checkElement);
        };
        
        checkElement();
    });
}

/**
 * Limpia los recursos del mapa.
 */
export function limpiarRecursos() {
    try {
        if (!_mapaInstance) {
            logger.warn('No se pueden limpiar los recursos: mapa no inicializado');
            return false;
        }

        // Limpiar marcadores de usuario
        if (marcadorUsuario) {
            _mapaInstance.removeLayer(marcadorUsuario);
            marcadorUsuario = null;
        }

        // Limpiar marcador de destino
        if (marcadorDestino) {
            _mapaInstance.removeLayer(marcadorDestino);
            marcadorDestino = null;
        }

        // Limpiar marcadores de paradas
        marcadoresParadas.forEach(marcador => _mapaInstance.removeLayer(marcador));
        marcadoresParadas.clear();

        // Limpiar rutas
        rutasTramos.forEach(ruta => _mapaInstance.removeLayer(ruta));
        rutasTramos = [];

        rutasActivas.forEach(ruta => _mapaInstance.removeLayer(ruta));
        rutasActivas = [];

        // Limpiar todas las capas adicionales del mapa (excepto la base)
        _mapaInstance.eachLayer((layer) => {
            if (layer !== _mapaInstance.getPane('tilePane') && layer !== _mapaInstance.getPane('overlayPane')) {
                // Solo remover capas que no sean la base del mapa
                if (layer.options && !layer.options.attribution) {
                    _mapaInstance.removeLayer(layer);
                }
            }
        });

        console.debug('Recursos del mapa limpiados completamente');
        return true;
    } catch (error) {
        console.error('Error al limpiar recursos del mapa:', error);
        return false;
    }
}

/**
 * Muestra todas las paradas en el mapa.
 * @param {Array} paradasExternas - Paradas proporcionadas externamente (opcional).
 */
export async function mostrarTodasLasParadas(paradasExternas) {
    try {
        if (paradasExternas) {
            arrayParadasLocal = paradasExternas;
        }

        // Si el mapa no está inicializado, esperar a que se inicialice
        if (!_mapaInstance) {
            logger.info('mostrarTodasLasParadas: mapa no inicializado, esperando inicialización...');

            // Esperar hasta 5 segundos por la inicialización del mapa
            const maxWaitTime = 5000;
            const checkInterval = 100;
            let waited = 0;

            while (!_mapaInstance && waited < maxWaitTime) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                waited += checkInterval;
            }

            // Si aún no está inicializado después de esperar, actualizar solo el array local
            if (!_mapaInstance) {
                logger.warn('mostrarTodasLasParadas: mapa no se inicializó después de esperar, solo se actualiza arrayParadasLocal');
                return false;
            }

            logger.info('mostrarTodasLasParadas: mapa inicializado, procediendo con la visualización');
        }

        marcadoresParadas.forEach(marcador => _mapaInstance.removeLayer(marcador));
        marcadoresParadas.clear();

        arrayParadasLocal.forEach(parada => {
            if (parada.coordenadas && validarCoordenadas(parada.coordenadas)) {
                const marcador = L.marker([parada.coordenadas.lat, parada.coordenadas.lng], {
                    title: parada.nombre || `Parada ${parada.id}`
                }).addTo(_mapaInstance);

                marcadoresParadas.set(parada.id, marcador);
            }
        });

        console.info(`Se han añadido ${marcadoresParadas.size} marcadores al mapa`);
        return true;
    } catch (error) {
        console.error('Error al mostrar todas las paradas:', error);
        return false;
    }
}

/**
 * Actualiza el marcador de la posición actual del usuario en el mapa.
 * @param {Object} coordenadas - Coordenadas {lat, lng, accuracy}.
 */
function actualizarPosicionUsuario(coordenadas) {
    try {
        validarCoordenadas(coordenadas);

        ejecutarOperacionMapa(mapa => {
            if (marcadorUsuario) {
                mapa.removeLayer(marcadorUsuario);
            }

            marcadorUsuario = L.circle([coordenadas.lat, coordenadas.lng], {
                radius: coordenadas.accuracy || 10,
                color: '#4285F4',
                fillColor: '#4285F4',
                fillOpacity: 0.5
            }).addTo(mapa);

            console.info('Posición del usuario actualizada');
        }).catch(error => {
            logger.error('Error al actualizar la posición del usuario:', error);
        });
    } catch (error) {
        logger.error('Error al actualizar la posición del usuario:', error);
    }
}

/**
 * Dibuja un tramo específico en el mapa.
 * @param {Object} tramo - Objeto tramo con inicio, fin y waypoints.
 * @param {boolean} destacado - Si es true, se muestra con énfasis.
 * @returns {L.Polyline} La polyline creada.
 */
function dibujarTramo(tramo, destacado = false) {
    try {
        if (!tramo || !tramo.inicio || !tramo.fin) {
            throw new Error('Datos del tramo incompletos.');
        }

        validarCoordenadas(tramo.inicio);
        validarCoordenadas(tramo.fin);

        const puntos = [tramo.inicio, ...(tramo.waypoints || []), tramo.fin].map(p => [p.lat, p.lng]);

        if (!_mapaInstance) {
            throw new Error('Mapa no inicializado');
        }

        const polyline = L.polyline(puntos, {
            color: destacado ? '#ff4500' : '#3388ff',
            weight: destacado ? 6 : 4,
            opacity: destacado ? 0.9 : 0.7
        }).addTo(_mapaInstance);

        return polyline;
    } catch (error) {
        console.error('Error al dibujar tramo:', error);
        return null;
    }
}

/**
 * Dibuja una ruta con marcadores en el mapa.
 * @param {Array} coordenadasHijo2 - Array de coordenadas con propiedades lat, lng.
 * @param {Object} opciones - Opciones adicionales para el dibujo.
 * @param {boolean} opciones.dibujarRuta - Si debe dibujar la polyline de la ruta (default: true en AVENTURA, false en CASA).
 */
export function dibujarRutaConMarcadores(coordenadasHijo2, opciones = {}) {
    try {
        if (!Array.isArray(coordenadasHijo2) || coordenadasHijo2.length === 0) {
            throw new Error('Coordenadas inválidas para dibujar ruta');
        }

        // Determinar si dibujar ruta basado en modo y opciones
        const modoActual = estadoMapa.modo || MODOS.CASA;
        const dibujarRuta = opciones.dibujarRuta !== undefined ? opciones.dibujarRuta : (modoActual === MODOS.AVENTURA);

        logger.debug('Dibujando ruta con marcadores', {
            puntos: coordenadasHijo2.length,
            modo: modoActual,
            dibujarRuta
        });

        // Limpiar ruta anterior
        limpiarRecursos();

        const puntos = coordenadasHijo2.map(coord => [coord.lat, coord.lng]);

        // Dibujar polyline de la ruta solo si está habilitado
        if (dibujarRuta) {
            const polyline = L.polyline(puntos, {
                color: '#0077ff',
                weight: 6,
                opacity: 0.8
            }).addTo(_mapaInstance);

            rutasActivas.push(polyline);
            logger.debug('Polyline de ruta dibujada');
        } else {
            logger.debug('Polyline omitida (modo casa o deshabilitado)');
        }

        // Crear iconos personalizados usando colores en lugar de archivos
        const crearIconoColoreado = (color) => {
            return L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
        };

        // Agregar marcadores en los puntos de inicio, fin y paradas intermedias
        coordenadasHijo2.forEach((coord, index) => {
            let markerColor = '#4CAF50'; // Verde por defecto
            let markerTitle = coord.nombre || `Punto ${index + 1}`;

            // Determinar color basado en el tipo de coordenada y posición
            if (coord.tipo === 'inicio') {
                markerColor = '#F44336'; // Rojo para inicio
                markerTitle = coord.nombre || 'Inicio';
            } else if (coord.tipo === 'parada') {
                markerColor = '#4CAF50'; // Verde para paradas
                markerTitle = coord.nombre || `Parada ${coord.id}`;
            } else if (coord.tipo === 'waypoint') {
                markerColor = '#FF9800'; // Naranja para waypoints
                markerTitle = coord.nombre || 'Waypoint';
            } else if (coord.tipo === 'tramo' && index === coordenadasHijo2.length - 1) {
                markerColor = '#2196F3'; // Azul para fin de tramo
                markerTitle = coord.nombre || 'Fin de tramo';
            } else if (coord.tipo === 'tramo') {
                markerColor = '#F44336'; // Rojo para inicio de tramo
                markerTitle = coord.nombre || 'Inicio de tramo';
            }

            const marker = L.marker([coord.lat, coord.lng], {
                icon: crearIconoColoreado(markerColor),
                title: markerTitle
            }).addTo(_mapaInstance);

            // Almacenar el marcador para poder limpiarlo después
            marcadoresParadas.set(`ruta-${index}`, marker);
        });

        logger.info('Ruta dibujada con éxito', { puntos: coordenadasHijo2.length });
        return true;
    } catch (error) {
        logger.error('Error al dibujar ruta con marcadores:', error);
        return false;
    }
}

/**
 * Maneja el mensaje para mostrar una ruta entre dos puntos.
 * @param {Object} mensaje - Mensaje con origen, destino, color, grosor o datos de tramo.
 * @returns {Object} Resultado de la operación
 */
function manejarMostrarRuta(mensaje) {
    try {
        // Validación de entrada
        if (!mensaje || !mensaje.datos) {
            throw new Error('Mensaje no válido para mostrar ruta');
        }

        const { tramo, origen, destino, color, grosor } = mensaje.datos || {};
        
        // Caso 1: Si tenemos datos de tramo
        if (tramo && tramo.inicio && tramo.fin) {
            if (!_mapaInstance) {
                throw new Error('Mapa no inicializado');
            }
            
            // Dibujar polyline del tramo
            const polyline = dibujarTramo(tramo, true);
            if (polyline) {
                console.info('Polyline dibujada en el mapa:', tramo);
                rutasActivas.push(polyline);
            } else {
                throw new Error('Error al dibujar la polyline en el mapa');
            }
            
            // Agregar marcadores si es necesario
            if (tramo.inicio) {
                L.marker([tramo.inicio.lat, tramo.inicio.lng], { 
                    icon: L.icon({ iconUrl: 'red-pin.png' }) 
                }).addTo(_mapaInstance);
            }
            
            if (tramo.fin) {
                L.marker([tramo.fin.lat, tramo.fin.lng], { 
                    icon: L.icon({ iconUrl: 'flag.png' }) 
                }).addTo(_mapaInstance);
            }
            
            return { 
                exito: true, 
                mensaje: 'Ruta de tramo mostrada correctamente',
                tipo: 'tramo'
            };
        }
        
        // Caso 2: Si tenemos origen y destino como coordenadas
        if (origen && destino) {
            // Validar que origen y destino son coordenadas válidas
            if (!origen.lat || !origen.lng || !destino.lat || !destino.lng) {
                throw new Error('Coordenadas de origen o destino incompletas');
            }

            if (!_mapaInstance) {
                throw new Error('Mapa no inicializado');
            }

            const polyline = L.polyline([origen, destino], {
                color: color || '#0077ff',
                weight: grosor || 6,
                opacity: 0.8
            }).addTo(_mapaInstance);

            rutasActivas.push(polyline);
            console.info('Ruta origen-destino mostrada en el mapa');
            
            return { 
                exito: true, 
                mensaje: 'Ruta origen-destino mostrada correctamente',
                tipo: 'origen-destino'
            };
        } 
        
        // Caso 3: No hay datos suficientes
        throw new Error('Datos insuficientes para mostrar ruta: se requiere tramo completo o par origen-destino');
        
    } catch (error) {
        logger.error(`Error en MOSTRAR_RUTA:`, error);
        manejarError(error, mensaje);
        return { exito: false, error: error.message };
    }
}

/**
 * Establece un destino en el mapa.
 * @param {Object} mensaje - Mensaje con datos de destino.
 * @returns {Object} Resultado de la operación.
 */
function manejarEstablecerDestino(mensaje) {
    try {
        // Validación de entrada
        if (!mensaje || !mensaje.datos) {
            throw new Error('Mensaje no válido para establecer destino');
        }

        const { destino, opciones } = mensaje.datos || {};
        
        // Validar que destino tiene coordenadas válidas
        if (!destino || !destino.lat || !destino.lng) {
            throw new Error('Destino inválido o sin coordenadas');
        }
        
        // Validar que el mapa esté inicializado
        if (!_mapaInstance) {
            throw new Error('Mapa no inicializado');
        }
        
        // Eliminar marcador anterior si existe
        if (marcadorDestino) {
            _mapaInstance.removeLayer(marcadorDestino);
        }
        
        // Crear nuevo marcador
        marcadorDestino = L.marker([destino.lat, destino.lng], {
            icon: L.icon({
                iconUrl: opciones?.iconUrl || 'destino-pin.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41]
            }),
            title: opciones?.titulo || 'Destino'
        }).addTo(_mapaInstance);
        
        // Si se solicita centrar el mapa en el destino
        if (opciones?.centrar) {
            _mapaInstance.setView([destino.lat, destino.lng], opciones.zoom || _mapaInstance.getZoom());
        }
        
        console.info(`Destino establecido en [${destino.lat}, ${destino.lng}]`);
        return { 
            exito: true, 
            mensaje: 'Destino establecido correctamente'
        };
    } catch (error) {
        console.error('Error al manejar establecer destino:', error);
        return { 
            exito: false,
            error: error.message 
        };
    }
}

/**
 * Actualiza la posición del usuario en el mapa.
 * @param {Object} mensaje - Mensaje con datos de posición.
 * @returns {Object} Resultado de la operación.
 */
function manejarActualizarPosicion(mensaje) {
    try {
        // Validación de entrada
        if (!mensaje || !mensaje.datos) {
            throw new Error('Mensaje no válido para actualizar posición');
        }

        const { posicion } = mensaje.datos || {};
        
        // Validar que posición tiene coordenadas válidas
        if (!posicion || !posicion.lat || !posicion.lng) {
            throw new Error('Posición inválida o sin coordenadas');
        }
        
        // Validar que el mapa esté inicializado
        if (!_mapaInstance) {
            throw new Error('Mapa no inicializado');
        }
        
        // Actualizar el punto del usuario
        actualizarPosicionUsuario({
            lat: posicion.lat,
            lng: posicion.lng,
            accuracy: posicion.accuracy || 10
        });
        
        // Actualizar estado interno
        estadoMapa.posicionUsuario = {
            lat: posicion.lat,
            lng: posicion.lng,
            accuracy: posicion.accuracy || 10,
            timestamp: Date.now()
        };
        
        // Validar rango para cada parada si hay posición actual
        if (estadoMapa.paradaActual) {
            const coordenadasParada = buscarCoordenadasParada(estadoMapa.paradaActual);
            if (coordenadasParada && validarRango(posicion, coordenadasParada)) {
                // Enviar NAVEGACION.LLEGADA_DETECTADA solo si está dentro del rango
                enviarMensaje({
                    destino: 'padre',
                    tipo: TIPOS_MENSAJE.NAVEGACION.LLEGADA_DETECTADA,
                    origen: 'mapa',
                    datos: { paradaId: estadoMapa.paradaActual, posicion }
                }).catch(error => logger.error('Error enviando llegada detectada:', error));
            } else if (coordenadasParada) {
                // Registrar evento si está fuera del rango
                logger.info(`Usuario fuera del rango de 20m para parada ${estadoMapa.paradaActual}`);
            }
        }
        
        // Si se solicita seguir al usuario, centrar el mapa
        if (estadoMapa.siguiendoRuta && mensaje.datos.centrar !== false) {
            _mapaInstance.setView([posicion.lat, posicion.lng], _mapaInstance.getZoom());
        }
        
        console.info(`Posición de usuario actualizada a [${posicion.lat}, ${posicion.lng}]`);
        return {
            exito: true,
            mensaje: 'Posición actualizada correctamente'
        };
    } catch (error) {
        logger.error(`Error en ACTUALIZAR_POSICION:`, error);
        manejarError(error, mensaje);
        return {
            exito: false,
            error: error.message
        };
    }
}

/**
 * Actualiza el marcador de una parada específica en el mapa.
 * @param {string} paradaId - ID de la parada a actualizar.
 * @param {Object} coordenadas - Nuevas coordenadas {lat, lng}.
 */
function actualizarMarcadorParada(paradaId, coordenadas) {
    try {
        if (!_mapaInstance) {
            throw new Error('Mapa no inicializado');
        }

        const marcador = marcadoresParadas.get(paradaId);
        if (marcador) {
            marcador.setLatLng([coordenadas.lat, coordenadas.lng]);
            console.info(`Marcador de parada ${paradaId} actualizado`);
        } else {
            console.warn(`No se encontró marcador para la parada ${paradaId}`);
        }
    } catch (error) {
        console.error('Error al actualizar marcador de parada:', error);
    }
}

/**
 * Limpia recursos del mapa basándose en el estado actual
 * @param {Object} nuevoEstado - Nuevo estado del mapa
 * @param {string} nuevoEstado.modo - Modo actual ('casa' o 'aventura')
 * @param {string|number} nuevoEstado.paradaActual - ID de la parada actual
 * @param {string|number} nuevoEstado.tramoActual - ID del tramo actual
 */
export function limpiarPorEstado(nuevoEstado) {
    try {
        if (!nuevoEstado) {
            logger.warn('limpiarPorEstado: Estado no proporcionado');
            return false;
        }

        const { modo, paradaActual, tramoActual } = nuevoEstado;
        let limpiado = false;

        // Limpieza por cambio de modo
        if (modo !== estadoMapa.modo) {
            if (modo === MODOS.CASA) {
                // En modo casa, limpiar todo para vista general
                limpiarRecursos();
                limpiado = true;
                logger.debug('Limpieza automática: Modo casa activado, recursos limpiados');
            } else if (modo === MODOS.AVENTURA) {
                // En modo aventura, mantener marcadores básicos pero limpiar rutas anteriores
                rutasActivas.forEach(ruta => {
                    if (_mapaInstance && _mapaInstance.removeLayer) {
                        _mapaInstance.removeLayer(ruta);
                    }
                });
                rutasActivas = [];
                limpiado = true;
                logger.debug('Limpieza automática: Modo aventura activado, rutas limpiadas');
            }
        }

        // Limpieza por cambio de parada
        if (paradaActual !== estadoMapa.paradaActual && paradaActual !== null) {
            // Limpiar marcadores de rutas anteriores (mantener marcadores de paradas)
            marcadoresParadas.forEach((marcador, id) => {
                if (id.startsWith('ruta-') && _mapaInstance && _mapaInstance.removeLayer) {
                    _mapaInstance.removeLayer(marcador);
                    marcadoresParadas.delete(id);
                }
            });
            limpiado = true;
            logger.debug(`Limpieza automática: Cambio de parada a ${paradaActual}, marcadores de ruta limpiados`);
        }

        // Limpieza por cambio de tramo
        if (tramoActual !== estadoMapa.tramoActual && tramoActual !== null) {
            // Limpiar rutas activas anteriores
            rutasActivas.forEach(ruta => {
                if (_mapaInstance && _mapaInstance.removeLayer) {
                    _mapaInstance.removeLayer(ruta);
                }
            });
            rutasActivas = [];
            limpiado = true;
            logger.debug(`Limpieza automática: Cambio de tramo a ${tramoActual}, rutas limpiadas`);
        }

        // Actualizar estado interno
        if (modo !== undefined) estadoMapa.modo = modo;
        if (paradaActual !== undefined) estadoMapa.paradaActual = paradaActual;
        if (tramoActual !== undefined) estadoMapa.tramoActual = tramoActual;
        estadoMapa.timestamp = Date.now();

        return limpiado;
    } catch (error) {
        logger.error('Error en limpiarPorEstado:', error);
        return false;
    }
}

/**
 * Maneja el cambio de parada en la navegación.
 * @param {Object} mensaje - Mensaje con datos de la nueva parada
 * @param {string} mensaje.origen - Origen del mensaje
 * @param {Object} mensaje.datos - Datos de la parada
 * @param {number} mensaje.datos.paradaId - ID de la nueva parada
 * @param {Object} [mensaje.datos.coordenadas] - Coordenadas de la parada {lat, lng}
 * @param {boolean} [mensaje.datos.centrarMapa] - Si se debe centrar el mapa en la parada
 * @returns {Object} Resultado de la operación
 */
async function manejarCambiarParada(mensaje) {
    const logPrefix = `[NAVEGACION.CAMBIAR_PARADA][${mensaje?.origen || 'desconocido'}]`;
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Procesando cambio de parada`, { mensajeId, datos: mensaje.datos });
        
        if (!mensaje?.datos?.paradaId) {
            throw new Error('ID de parada no especificado');
        }

        const { paradaId } = mensaje.datos;
        
        // Validar que el mapa esté inicializado
        if (!_mapaInstance) {
            throw new Error('Mapa no inicializado');
        }

        // Verificar si ya hay una consulta pendiente
        if (estadoMapa.consultaParadaPendiente) {
            logger.warn(`${logPrefix} Ya hay una consulta de parada pendiente, ignorando nueva solicitud`);
            return { exito: false, error: 'Consulta pendiente' };
        }

        // Validar que la parada existe en AVENTURA_PARADAS
        const paradaBase = window.AVENTURA_PARADAS?.find(p => p.padreid === paradaId);
        if (!paradaBase) {
            throw new Error(`Parada ${paradaId} no encontrada en datos base`);
        }

        // Registrar consulta pendiente
        estadoMapa.consultaParadaPendiente = {
            paradaId,
            origen: mensaje.origen,
            timestamp: Date.now(),
            mensajeId
        };
        estadoMapa.esperandoCoordenadas = true;
        estadoMapa.esperandoAudio = true;
        estadoMapa.esperandoReto = true;
        estadoMapa.datosRecopilados = {};

        logger.info(`${logPrefix} Iniciando consultas para parada ${paradaId}`);

        // Enviar consultas a hijos
        const consultas = [
            enviarConsultaCoordenadas(paradaId),
            enviarConsultaAudio(paradaId)
        ];

        // Solo enviar consulta de reto si es una parada (no tramo)
        if (paradaId.startsWith('P-') || paradaId.startsWith('padre-P-')) {
            consultas.push(enviarConsultaReto(paradaId));
        } else {
            // Para tramos, marcar reto como no disponible
            estadoMapa.esperandoReto = false;
            estadoMapa.datosRecopilados.reto = null;
            logger.debug(`${logPrefix} Saltando consulta de reto para tramo ${paradaId}`);
        }

        await Promise.all(consultas);

        logger.info(`${logPrefix} Consultas enviadas, esperando respuestas`);
        
        return { exito: true, estado: 'consultas_enviadas' };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al procesar cambio de parada: ${error.message}`, error);
        
        // Limpiar estado en caso de error
        estadoMapa.consultaParadaPendiente = null;
        estadoMapa.esperandoCoordenadas = false;
        estadoMapa.esperandoAudio = false;
        estadoMapa.esperandoReto = false;
        estadoMapa.datosRecopilados = {};
        
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                error: error.message,
                mensajeOriginalId: mensajeId,
                tipo: 'ERROR_CAMBIO_PARADA'
            }
        });
        
        return { exito: false, error: error.message };
    }
}

/**
 * Envía consulta de coordenadas a hijo2
 * @param {string} paradaId - ID de la parada
 */
async function enviarConsultaCoordenadas(paradaId) {
    const mensajeId = generarIdUnico();
    await enviarMensaje({
        destino: 'hijo2',
        tipo: TIPOS_MENSAJE.NAVEGACION.SOLICITAR_COORDENADAS,
        origen: 'padre',
        mensajeId,
        datos: { 
            paradaId,
            tipoConsulta: MAPA_TIPOS_HIJO['hijo2']
        }
    });
}

/**
 * Envía consulta de audio a hijo3
 * @param {string} paradaId - ID de la parada
 */
async function enviarConsultaAudio(paradaId) {
    const mensajeId = generarIdUnico();
    await enviarMensaje({
        destino: 'hijo3',
        tipo: TIPOS_MENSAJE.AUDIO.SOLICITAR_AUDIO,
        origen: 'padre',
        mensajeId,
        datos: { 
            paradaId,
            tipoConsulta: MAPA_TIPOS_HIJO['hijo3']
        }
    });
}

/**
 * Envía consulta de reto a hijo4
 * @param {string} paradaId - ID de la parada
 */
async function enviarConsultaReto(paradaId) {
    const mensajeId = generarIdUnico();
    await enviarMensaje({
        destino: 'hijo4',
        tipo: TIPOS_MENSAJE.DATOS.SOLICITAR_RETO,
        origen: 'padre',
        mensajeId,
        datos: { 
            paradaId,
            tipoConsulta: MAPA_TIPOS_HIJO['hijo4']
        }
    });
}

/**
 * Procesa respuestas de consultas y actualiza mapa cuando todas llegan
 */
async function procesarRespuestaConsulta(tipo, datos) {
    const logPrefix = `[PROCESAR_RESPUESTA][${tipo}]`;
    
    try {
        // Validar que los datos existen
        if (!datos || typeof datos !== 'object') {
            logger.error(`${logPrefix} Datos inválidos o nulos recibidos`, datos);
            return;
        }
        
        const { paradaId } = datos;
        
        // Verificar que hay consulta pendiente
        if (!estadoMapa.consultaParadaPendiente || estadoMapa.consultaParadaPendiente.paradaId !== paradaId) {
            logger.warn(`${logPrefix} Respuesta para parada no pendiente: ${paradaId}`);
            return;
        }
        
        // Almacenar datos según tipo
        switch (tipo) {
            case 'coordenadas':
                estadoMapa.datosRecopilados.coordenadas = datos;
                estadoMapa.esperandoCoordenadas = false;
                break;
            case 'audio':
                estadoMapa.datosRecopilados.audio = datos;
                estadoMapa.esperandoAudio = false;
                break;
            case 'reto':
                estadoMapa.datosRecopilados.reto = datos;
                estadoMapa.esperandoReto = false;
                break;
        }
        
        logger.info(`${logPrefix} Datos recopilados para ${paradaId}`);
        
        // Verificar si todas las respuestas llegaron
        if (!estadoMapa.esperandoCoordenadas && !estadoMapa.esperandoAudio && !estadoMapa.esperandoReto) {
            await completarCambioParada();
        }
        
    } catch (error) {
        logger.error(`${logPrefix} Error procesando respuesta:`, error);
    }
}

/**
 * Completa el cambio de parada cuando todas las consultas responden
 */
async function completarCambioParada() {
    const logPrefix = '[COMPLETAR_CAMBIO_PARADA]';
    
    try {
        const { paradaId, origen, mensajeId } = estadoMapa.consultaParadaPendiente;
        const { coordenadas, audio, reto } = estadoMapa.datosRecopilados;
        
        logger.info(`${logPrefix} Completando cambio de parada ${paradaId}`);
        
        // Actualizar marcador si hay coordenadas
        if (coordenadas && coordenadas.lat && coordenadas.lng) {
            if (marcadorParadaActual) {
                _mapaInstance.removeLayer(marcadorParadaActual);
            }
            
            marcadorParadaActual = L.marker([coordenadas.lat, coordenadas.lng], {
                icon: L.icon({
                    iconUrl: 'current-stop-pin.png',
                    iconSize: [35, 51],
                    iconAnchor: [17, 51],
                    popupAnchor: [0, -51]
                }),
                title: coordenadas.nombre || `Parada ${paradaId}`
            }).addTo(_mapaInstance);
            
            // Agregar popup con información
            const infoPopup = `<b>${coordenadas.nombre || `Parada ${paradaId}`}</b><br>ID: ${paradaId}`;
            marcadorParadaActual.bindPopup(infoPopup).openPopup();
            
            logger.info(`${logPrefix} Popup creado para parada: ${paradaId}`);
            
            _mapaInstance.setView([coordenadas.lat, coordenadas.lng], 16);
        }
        
        // Aquí se podría integrar reproducción de audio y mostrar reto
        // Por ahora, solo log
        if (audio) {
            logger.info(`${logPrefix} Audio disponible: ${audio.url || 'N/A'}`);
        }
        if (reto) {
            logger.info(`${logPrefix} Reto disponible: ${reto.pregunta || 'N/A'}`);
        }
        
        // Actualizar estado
        estadoMapa.paradaActual = paradaId;
        estadoMapa.timestamp = Date.now();
        
        // Confirmar a hijo5-casa
        await enviarMensaje({
            destino: origen,
            tipo: TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA_CONFIRMADO,
            origen: 'funciones-mapa',
            datos: {
                paradaId,
                mensajeOriginalId: mensajeId,
                coordenadas,
                audio: !!audio,
                reto: !!reto
            }
        });
        
        // Limpiar estado
        estadoMapa.consultaParadaPendiente = null;
        estadoMapa.datosRecopilados = {};
        
        logger.info(`${logPrefix} Cambio de parada completado exitosamente`);
        
    } catch (error) {
        logger.error(`${logPrefix} Error completando cambio de parada:`, error);
    }
}

/**
 * Maneja la actualización del estado de navegación.
 * @param {Object} mensaje - Mensaje con el nuevo estado
 * @returns {Object} Resultado de la operación
 */
async function manejarActualizarEstadoNavegacion(mensaje) {
    const logPrefix = `[NAVEGACION.ACTUALIZAR_ESTADO][${mensaje?.origen || 'desconocido'}]`;
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Actualizando estado de navegación`, { mensajeId, datos: mensaje.datos });
        
        if (!mensaje?.datos) {
            throw new Error('Datos de estado no especificados');
        }

        const { 
            estado, 
            paradaActual, 
            tramoActual, 
            distancia, 
            tiempoEstimado,
            posicionActual 
        } = mensaje.datos;

        // Actualizar estado interno del mapa
        if (estado !== undefined) estadoMapa.estado = estado;
        if (paradaActual !== undefined) estadoMapa.paradaActual = paradaActual;
        if (tramoActual !== undefined) estadoMapa.tramoActual = tramoActual;
        if (distancia !== undefined) estadoMapa.distancia = distancia;
        if (tiempoEstimado !== undefined) estadoMapa.tiempoEstimado = tiempoEstimado;
        estadoMapa.timestamp = Date.now();

        // Actualizar marcador de posición si se proporciona
        if (posicionActual && _mapaInstance) {
            if (marcadorPosicionActual) {
                marcadorPosicionActual.setLatLng([posicionActual.lat, posicionActual.lng]);
            } else {
                marcadorPosicionActual = L.marker([posicionActual.lat, posicionActual.lng], {
                    icon: L.icon({
                        iconUrl: 'user-position.png',
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                }).addTo(_mapaInstance);
            }
        }

        // Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                estadoMapa: { ...estadoMapa }
            }
        });

        logger.info(`${logPrefix} Estado de navegación actualizado`, { estadoMapa });
        
        return { exito: true, estadoMapa };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al actualizar estado: ${error.message}`, error);
        
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                error: error.message,
                mensajeOriginalId: mensajeId,
                tipo: 'ERROR_ACTUALIZAR_ESTADO'
            }
        });
        
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja el inicio de una sesión de navegación.
 * @param {Object} mensaje - Mensaje con datos de inicio
 * @returns {Object} Resultado de la operación
 */
async function manejarIniciarNavegacion(mensaje) {
    const logPrefix = `[NAVEGACION.INICIAR][${mensaje?.origen || 'desconocido'}]`;
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Iniciando navegación`, { mensajeId, datos: mensaje.datos });
        
        if (!_mapaInstance) {
            throw new Error('Mapa no inicializado');
        }

        const { paradaInicial, destino, modo = 'caminando', opciones = {} } = mensaje.datos || {};

        // Limpiar estado anterior
        limpiarPorEstado({ modo: estadoMapa.modo });

        // Configurar nueva navegación
        estadoMapa.estado = 'iniciando';
        estadoMapa.paradaActual = paradaInicial;
        estadoMapa.destino = destino;
        estadoMapa.modoNavegacion = modo;
        estadoMapa.timestamp = Date.now();
        estadoMapa.sesionId = generarIdUnico();

        // Si hay coordenadas de inicio, centrar mapa
        if (paradaInicial && arrayParadasLocal.length > 0) {
            const parada = arrayParadasLocal.find(p => p.id === paradaInicial || p.paradaId === paradaInicial || p.padreid === paradaInicial);
            if (parada) {
                _mapaInstance.setView([parada.lat, parada.lng], opciones.zoom || 15);
            }
        }

        // Notificar que la navegación está iniciando
        await enviarMensaje({
            destino: 'sistema',
            tipo: TIPOS_MENSAJE.NAVEGACION.INICIADA,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                sesionId: estadoMapa.sesionId,
                paradaInicial,
                destino,
                modo,
                timestamp: estadoMapa.timestamp
            }
        });

        // Enviar confirmación al origen
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                sesionId: estadoMapa.sesionId
            }
        });

        logger.info(`${logPrefix} Navegación iniciada`, { sesionId: estadoMapa.sesionId });
        
        return { exito: true, sesionId: estadoMapa.sesionId };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al iniciar navegación: ${error.message}`, error);
        
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                error: error.message,
                mensajeOriginalId: mensajeId,
                tipo: 'ERROR_INICIAR_NAVEGACION'
            }
        });
        
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja la notificación de navegación iniciada.
 * @param {Object} mensaje - Mensaje de confirmación
 * @returns {Object} Resultado de la operación
 */
async function manejarNavegacionIniciada(mensaje) {
    const logPrefix = `[NAVEGACION.INICIADA][${mensaje?.origen || 'desconocido'}]`;
    
    try {
        logger.info(`${logPrefix} Navegación confirmada como iniciada`, { datos: mensaje.datos });
        
        // Actualizar estado a activo
        estadoMapa.estado = 'activo';
        estadoMapa.timestamp = Date.now();

        return { exito: true };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al procesar navegación iniciada: ${error.message}`, error);
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja la cancelación de navegación.
 * @param {Object} mensaje - Mensaje de cancelación
 * @returns {Object} Resultado de la operación
 */
async function manejarNavegacionCancelada(mensaje) {
    const logPrefix = `[NAVEGACION.CANCELADA][${mensaje?.origen || 'desconocido'}]`;
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Procesando cancelación de navegación`, { mensajeId });
        
        const { motivo = 'usuario', sesionId } = mensaje.datos || {};

        // Validar sesión si se proporciona
        if (sesionId && estadoMapa.sesionId !== sesionId) {
            logger.warn(`${logPrefix} Sesión no coincide: ${sesionId} vs ${estadoMapa.sesionId}`);
        }

        // Limpiar rutas activas
        rutasActivas.forEach(ruta => {
            if (_mapaInstance && _mapaInstance.removeLayer) {
                _mapaInstance.removeLayer(ruta);
            }
        });
        rutasActivas = [];

        // Limpiar marcador de destino
        if (marcadorDestino && _mapaInstance) {
            _mapaInstance.removeLayer(marcadorDestino);
            marcadorDestino = null;
        }

        // Actualizar estado
        estadoMapa.estado = 'cancelado';
        estadoMapa.motivoCancelacion = motivo;
        estadoMapa.timestamp = Date.now();

        // Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                sesionId: estadoMapa.sesionId
            }
        });

        logger.info(`${logPrefix} Navegación cancelada`, { motivo, sesionId });
        
        return { exito: true };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al cancelar navegación: ${error.message}`, error);
        
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                error: error.message,
                mensajeOriginalId: mensajeId,
                tipo: 'ERROR_CANCELAR_NAVEGACION'
            }
        });
        
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja la confirmación de destino establecido.
 * @param {Object} mensaje - Mensaje de confirmación
 * @returns {Object} Resultado de la operación
 */
async function manejarDestinoEstablecido(mensaje) {
    const logPrefix = `[NAVEGACION.DESTINO_ESTABLECIDO][${mensaje?.origen || 'desconocido'}]`;
    
    try {
        logger.info(`${logPrefix} Destino confirmado como establecido`, { datos: mensaje.datos });
        
        const { destino, distancia, tiempoEstimado } = mensaje.datos || {};
        
        // Actualizar estado
        estadoMapa.destinoEstablecido = true;
        estadoMapa.destino = destino;
        if (distancia !== undefined) estadoMapa.distancia = distancia;
        if (tiempoEstimado !== undefined) estadoMapa.tiempoEstimado = tiempoEstimado;
        estadoMapa.timestamp = Date.now();

        return { exito: true };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al procesar destino establecido: ${error.message}`, error);
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja la detección de llegada a destino.
 * @param {Object} mensaje - Mensaje de llegada
 * @returns {Object} Resultado de la operación
 */
async function manejarLlegadaDetectada(mensaje) {
    const logPrefix = `[NAVEGACION.LLEGADA_DETECTADA][${mensaje?.origen || 'desconocido'}]`;
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Procesando llegada a destino`, { mensajeId, datos: mensaje.datos });
        
        const { paradaId, coordenadas, precision } = mensaje.datos || {};

        // Actualizar estado
        estadoMapa.estado = 'llegada';
        estadoMapa.ultimaLlegada = {
            paradaId,
            coordenadas,
            precision,
            timestamp: Date.now()
        };

        // Animar marcador de parada actual
        if (marcadorParadaActual) {
            // Añadir animación visual (pulse effect)
            const originalIcon = marcadorParadaActual.getIcon();
            marcadorParadaActual.setIcon(L.icon({
                ...originalIcon.options,
                className: 'arrival-pulse'
            }));

            // Restaurar después de 2 segundos
            setTimeout(() => {
                marcadorParadaActual.setIcon(originalIcon);
            }, 2000);
        }

        // Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                llegada: estadoMapa.ultimaLlegada
            }
        });

        logger.info(`${logPrefix} Llegada procesada`, { paradaId, coordenadas });
        
        return { exito: true, llegada: estadoMapa.ultimaLlegada };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al procesar llegada: ${error.message}`, error);
        
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                error: error.message,
                mensajeOriginalId: mensajeId,
                tipo: 'ERROR_LLEGADA_DETECTADA'
            }
        });
        
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja los errores de navegación reportados.
 * @param {Object} mensaje - Mensaje de error
 * @returns {Object} Resultado de la operación
 */
async function manejarErrorNavegacion(mensaje) {
    const logPrefix = `[NAVEGACION.ERROR][${mensaje?.origen || 'desconocido'}]`;
    
    try {
        logger.error(`${logPrefix} Error de navegación reportado`, { datos: mensaje.datos });
        
        const { error, codigo, severidad = 'medio', contexto } = mensaje.datos || {};

        // Registrar error en estado
        if (!estadoMapa.errores) {
            estadoMapa.errores = [];
        }

        estadoMapa.errores.push({
            error,
            codigo,
            severidad,
            contexto,
            timestamp: Date.now()
        });

        // Mantener solo los últimos 20 errores
        if (estadoMapa.errores.length > 20) {
            estadoMapa.errores = estadoMapa.errores.slice(-20);
        }

        // Si es error crítico, cancelar navegación
        if (severidad === 'critico') {
            logger.warn(`${logPrefix} Error crítico detectado, cancelando navegación`);
            await manejarNavegacionCancelada({
                origen: 'funciones-mapa',
                datos: { motivo: 'error_critico', error, codigo }
            });
        }

        return { exito: true };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al procesar error de navegación: ${error.message}`, error);
        return { exito: false, error: error.message };
    }
}

// ============================================
// FUNCIONES MANEJADORAS GPS
// ============================================

/**
 * Maneja actualizaciones de ubicación GPS y actualiza el marcador del usuario en el mapa.
 * @param {Object} mensaje - Mensaje con datos de ubicación GPS
 * @returns {Object} Resultado de la operación
 */
async function manejarUbicacionGPSActualizada(mensaje) {
    const logPrefix = `[GPS.UBICACION_ACTUALIZADA][${mensaje?.origen || 'desconocido'}]`;

    try {
        // Validación de datos
        if (!mensaje.datos || typeof mensaje.datos !== 'object') {
            logger.warn(`${logPrefix} Mensaje sin datos válidos`);
            return { exito: false, error: 'Datos inválidos' };
        }

        const { lat, lng, precision, timestamp } = mensaje.datos;

        if (!validarCoordenadas(lat, lng)) {
            logger.warn(`${logPrefix} Coordenadas GPS inválidas:`, { lat, lng });
            return { exito: false, error: 'Coordenadas inválidas' };
        }

        logger.debug(`${logPrefix} Ubicación GPS recibida:`, {
            lat: lat?.toFixed(6),
            lng: lng?.toFixed(6),
            precision: precision || 'N/A',
            timestamp: timestamp ? new Date(timestamp).toLocaleTimeString() : 'N/A'
        });

        // Actualizar estado del mapa
        estadoMapa.posicionUsuario = { lat, lng, precision, timestamp };
        estadoMapa.timestamp = Date.now();

        // Actualizar marcador de posición del usuario en el mapa
        await actualizarPosicionUsuario({ lat, lng, accuracy: precision });

        // Si estamos en modo aventura, procesar lógica de detección secuencial
        if (estadoMapa.modo === MODOS.AVENTURA) {
            await procesarPosicionGPSParaAventura({ lat, lng, accuracy: precision });
        }

        return { exito: true };

    } catch (error) {
        logger.error(`${logPrefix} Error procesando ubicación GPS: ${error.message}`, error);
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja actualizaciones del estado GPS (activado/desactivado, permisos, etc.)
 * @param {Object} mensaje - Mensaje con estado GPS actualizado
 * @returns {Object} Resultado de la operación
 */
async function manejarEstadoGPSActualizado(mensaje) {
    const logPrefix = `[GPS.ESTADO_ACTUALIZADO][${mensaje?.origen || 'desconocido'}]`;

    try {
        // Validación de datos
        if (!mensaje.datos || typeof mensaje.datos !== 'object') {
            logger.warn(`${logPrefix} Mensaje sin datos válidos`);
            return { exito: false, error: 'Datos inválidos' };
        }

        const { activo, permisos, precision, error } = mensaje.datos;

        logger.info(`${logPrefix} Estado GPS actualizado:`, {
            activo,
            permisos,
            precision: precision || 'N/A',
            error: error || 'ninguno'
        });

        // Actualizar estado del mapa
        estadoMapa.gpsActivo = activo;
        estadoMapa.gpsPermisos = permisos;
        estadoMapa.gpsPrecision = precision;
        estadoMapa.gpsError = error;

        // Si GPS se desactiva, remover marcador de usuario
        if (!activo) {
            if (_mapaInstance && marcadorUsuario) {
                _mapaInstance.removeLayer(marcadorUsuario);
                marcadorUsuario = null;
            }
            estadoMapa.posicionUsuario = null;
            logger.debug(`${logPrefix} Marcador de usuario removido (GPS desactivado)`);
        }

        // Si hay error de permisos, log especial
        if (error && permisos === false) {
            logger.warn(`${logPrefix} GPS sin permisos - funcionalidad limitada`);
        }

        return { exito: true };

    } catch (error) {
        logger.error(`${logPrefix} Error procesando estado GPS: ${error.message}`, error);
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja errores GPS del sistema de mensajería y toma acciones correctivas si es necesario.
 * @param {Object} mensaje - Mensaje con error GPS
 * @returns {Object} Resultado de la operación
 */
async function manejarErrorGPSMensaje(mensaje) {
    const logPrefix = `[GPS.ERROR][${mensaje?.origen || 'desconocido'}]`;

    try {
        // Validación de datos
        if (!mensaje.datos || typeof mensaje.datos !== 'object') {
            logger.warn(`${logPrefix} Mensaje sin datos válidos`);
            return { exito: false, error: 'Datos inválidos' };
        }

        const { codigo, mensaje: errorMensaje, contexto } = mensaje.datos;

        logger.error(`${logPrefix} Error GPS recibido:`, {
            codigo,
            mensaje: errorMensaje,
            contexto: contexto || 'desconocido'
        });

        // Actualizar estado del mapa
        estadoMapa.gpsError = errorMensaje;
        estadoMapa.gpsActivo = false; // Asumir GPS inactivo en caso de error

        // Remover marcador de usuario en caso de error
        if (_mapaInstance && marcadorUsuario) {
            _mapaInstance.removeLayer(marcadorUsuario);
            marcadorUsuario = null;
        }
        estadoMapa.posicionUsuario = null;

        // Registrar error en estado
        if (!estadoMapa.errores) {
            estadoMapa.errores = [];
        }

        estadoMapa.errores.push({
            error: errorMensaje,
            codigo,
            severidad: 'medio',
            contexto: `gps_${contexto || 'desconocido'}`,
            timestamp: Date.now()
        });

        // Mantener solo los últimos 20 errores
        if (estadoMapa.errores.length > 20) {
            estadoMapa.errores = estadoMapa.errores.slice(-20);
        }

        return { exito: true };

    } catch (error) {
        logger.error(`${logPrefix} Error procesando error GPS: ${error.message}`, error);
        return { exito: false, error: error.message };
    }
}

/**
 * Función de diagnóstico GPS para debugging
 * @returns {Object} Información de diagnóstico GPS
 */
export async function diagnosticarGPS() {
    const diagnostico = {
        timestamp: new Date().toISOString(),
        navegador: {
            userAgent: navigator.userAgent,
            geolocationSoportada: !!navigator.geolocation,
            permisosSoportados: !!navigator.permissions,
            protocolo: location.protocol,
            hostname: location.hostname,
            esHttps: location.protocol === 'https:',
            esLocalhost: location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        },
        gpsEstado: {
            activo: gpsWatchId !== null,
            watchId: gpsWatchId,
            posicionUsuario: estadoMapa.posicionUsuario,
            gpsActivo: estadoMapa.gpsActivo,
            gpsPermisos: estadoMapa.gpsPermisos,
            gpsError: estadoMapa.gpsError
        },
        gpsEstadoReal: gpsEstadoReal
    };

    // Verificar permisos actuales
    if (navigator.permissions) {
        try {
            const permiso = await navigator.permissions.query({ name: 'geolocation' });
            diagnostico.permisosActuales = {
                estado: permiso.state,
                concedido: permiso.state === 'granted',
                denegado: permiso.state === 'denied',
                prompt: permiso.state === 'prompt'
            };
        } catch (error) {
            diagnostico.permisosActuales = { error: error.message };
        }
    }

    // Intentar obtener ubicación actual para test
    if (navigator.geolocation) {
        try {
            const posicion = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                });
            });
            diagnostico.testUbicacion = {
                exito: true,
                lat: posicion.coords.latitude,
                lng: posicion.coords.longitude,
                accuracy: posicion.coords.accuracy,
                timestamp: posicion.timestamp
            };
        } catch (error) {
            diagnostico.testUbicacion = {
                exito: false,
                error: error.message,
                codigo: error.code
            };
        }
    }

    logger.info('[GPS.DIAGNOSTICO]', diagnostico);
    return diagnostico;
}
async function verificarPermisosGeolocalizacion() {
    const logPrefix = '[verificarPermisosGeolocalizacion]';

    try {
        // Verificar si estamos en HTTPS (requerido para geolocalización en la mayoría de navegadores)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            const warningMsg = 'Geolocalización requiere HTTPS. Sirve la aplicación con HTTPS para funcionalidad GPS completa.';
            logger.warn(`${logPrefix} ${warningMsg}`);
            
            // Enviar advertencia al usuario
            await enviarMensaje({
                tipo: TIPOS_MENSAJE.SISTEMA.ADVERTENCIA,
                origen: 'funciones-mapa',
                destino: 'padre',
                datos: {
                    titulo: 'HTTPS Requerido',
                    mensaje: warningMsg,
                    contexto: 'gps_https'
                }
            });
        }

        // Verificar si el navegador soporta la API de permisos
        if (!navigator.permissions) {
            logger.warn(`${logPrefix} API de permisos no soportada, asumiendo permisos concedidos`);
            return true;
        }

        // Verificar estado de permisos de geolocalización
        const permiso = await navigator.permissions.query({ name: 'geolocation' });

        logger.info(`${logPrefix} Estado de permisos de geolocalización: ${permiso.state}`);

        switch (permiso.state) {
            case 'granted':
                return true;
            case 'denied':
                logger.error(`${logPrefix} Permisos de geolocalización denegados por el usuario`);
                return false;
            case 'prompt':
                logger.info(`${logPrefix} Solicitando permisos de geolocalización al usuario...`);
                // El permiso se solicitará automáticamente cuando se llame a watchPosition/getCurrentPosition
                return true; // Permitir que watchPosition maneje el prompt
            default:
                logger.warn(`${logPrefix} Estado de permisos desconocido: ${permiso.state}`);
                return true;
        }
    } catch (error) {
        logger.error(`${logPrefix} Error verificando permisos: ${error.message}`, error);
        // En caso de error, asumir que podemos proceder (para compatibilidad con navegadores antiguos)
        return true;
    }
}

/**
 * Maneja la activación del GPS real usando navigator.geolocation
 * @param {Object} mensaje - Mensaje de activación GPS
 * @returns {Object} Resultado de la operación
 */
export async function manejarGPSActivar(mensaje) {
    const logPrefix = `[GPS.ACTIVAR][${mensaje?.origen || 'desconocido'}]`;

    try {
        // Si ya estamos en el contexto del padre, activar GPS directamente
        if (window.parent === window) {
            logger.info(`${logPrefix} Activando GPS directamente (ya en contexto padre)`);

            // Actualizar estado GPS directamente
            estadoMapa.gpsActivo = true;
            estadoMapa.gpsPermisos = true;
            estadoMapa.gpsError = null;
            gpsEstadoReal.activo = true;

            logger.info(`${logPrefix} GPS activado directamente`);
            return { exito: true };
        }

        // Si estamos en un iframe, delegar al padre
        logger.info(`${logPrefix} Delegando activación GPS al padre`);

        await enviarMensaje({
            destino: 'padre',
            tipo: TIPOS_MENSAJE.NAVEGACION.GPS.ACTIVAR,
            origen: 'funciones-mapa',
            datos: {
                timestamp: Date.now(),
                razon: 'delegacion_desde_iframe'
            }
        });

        // Actualizar estado local para compatibilidad
        estadoMapa.gpsActivo = true;
        estadoMapa.gpsPermisos = true;
        estadoMapa.gpsError = null;

        logger.info(`${logPrefix} Solicitud de activación GPS enviada al padre`);
        return { exito: true };

    } catch (error) {
        logger.error(`${logPrefix} Error en activación GPS: ${error.message}`, error);

        // Actualizar estado local
        estadoMapa.gpsError = error.message;
        estadoMapa.gpsActivo = false;
        gpsEstadoReal.activo = false;

        return { exito: false, error: error.message };
    }
}

/**
 * Maneja la desactivación del GPS real
 * @param {Object} mensaje - Mensaje de desactivación GPS
 * @returns {Object} Resultado de la operación
 */
export async function manejarGPSDesactivar(mensaje) {
    const logPrefix = `[GPS.DESACTIVAR][${mensaje?.origen || 'desconocido'}]`;

    try {
        // Si ya estamos en el contexto del padre, desactivar GPS directamente
        if (window.parent === window) {
            logger.info(`${logPrefix} Desactivando GPS directamente (ya en contexto padre)`);

            // Actualizar estado GPS directamente
            estadoMapa.gpsActivo = false;
            estadoMapa.gpsPermisos = null;
            estadoMapa.gpsPrecision = null;
            estadoMapa.gpsError = null;
            estadoMapa.posicionUsuario = null;
            gpsEstadoReal.activo = false;

            // Limpiar marcador de usuario si existe
            if (_mapaInstance && marcadorUsuario) {
                _mapaInstance.removeLayer(marcadorUsuario);
                marcadorUsuario = null;
            }

            logger.info(`${logPrefix} GPS desactivado directamente`);
            return { exito: true };
        }

        // Si estamos en un iframe, delegar al padre
        logger.info(`${logPrefix} Delegando desactivación GPS al padre`);

        await enviarMensaje({
            destino: 'padre',
            tipo: TIPOS_MENSAJE.NAVEGACION.GPS.DESACTIVAR,
            origen: 'funciones-mapa',
            datos: {
                timestamp: Date.now(),
                razon: 'delegacion_desde_iframe'
            }
        });

        // Actualizar estado local para compatibilidad
        estadoMapa.gpsActivo = false;
        estadoMapa.gpsPermisos = null;
        estadoMapa.gpsPrecision = null;
        estadoMapa.gpsError = null;
        estadoMapa.posicionUsuario = null;

        // Limpiar marcador de usuario si existe
        if (_mapaInstance && marcadorUsuario) {
            _mapaInstance.removeLayer(marcadorUsuario);
            marcadorUsuario = null;
        }

        logger.info(`${logPrefix} Solicitud de desactivación GPS enviada al padre`);
        return { exito: true };

    } catch (error) {
        logger.error(`${logPrefix} Error en desactivación GPS: ${error.message}`, error);
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja la invalidación del tamaño del mapa.
 * Útil cuando el contenedor del mapa cambia de tamaño.
 * @param {Object} mensaje - Mensaje de invalidación
 * @returns {Object} Resultado de la operación
 */
async function manejarInvalidarTamanio(mensaje) {
    const logPrefix = `[MAPA.INVALIDAR_TAMAÑO][${mensaje?.origen || 'desconocido'}]`;
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Invalidando tamaño del mapa`, { mensajeId });
        
        if (!_mapaInstance) {
            throw new Error('Mapa no inicializado');
        }

        // Llamar función existente
        await invalidarTamañoMapa();

        // Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                accion: 'tamanio_invalidado'
            }
        });

        logger.info(`${logPrefix} Tamaño del mapa invalidado correctamente`);
        
        return { exito: true };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al invalidar tamaño: ${error.message}`, error);
        
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                error: error.message,
                mensajeOriginalId: mensajeId,
                tipo: 'ERROR_INVALIDAR_TAMANIO'
            }
        });
        
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja la configuración de la vista del mapa.
 * @param {Object} mensaje - Mensaje con configuración de vista
 * @param {Object} mensaje.datos - Datos de la vista
 * @param {Object} mensaje.datos.center - Centro {lat, lng}
 * @param {number} mensaje.datos.zoom - Nivel de zoom
 * @param {Object} [mensaje.datos.opciones] - Opciones adicionales
 * @returns {Object} Resultado de la operación
 */
async function manejarSetView(mensaje) {
    const logPrefix = `[MAPA.SET_VIEW][${mensaje?.origen || 'desconocido'}]`;
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Configurando vista del mapa`, { mensajeId, datos: mensaje.datos });
        
        if (!mensaje?.datos?.center) {
            throw new Error('Centro del mapa no especificado');
        }

        if (!mensaje?.datos?.zoom) {
            throw new Error('Nivel de zoom no especificado');
        }

        const { center, zoom, opciones = {} } = mensaje.datos;

        // Validar coordenadas
        if (!center.lat || !center.lng) {
            throw new Error('Coordenadas inválidas');
        }

        // Llamar función existente
        await setMapView(center, zoom, opciones);

        // Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                vista: { center, zoom }
            }
        });

        logger.info(`${logPrefix} Vista del mapa configurada`, { center, zoom });
        
        return { exito: true, center, zoom };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al configurar vista: ${error.message}`, error);
        
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                error: error.message,
                mensajeOriginalId: mensajeId,
                tipo: 'ERROR_SET_VIEW'
            }
        });
        
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja la obtención del centro del mapa.
 * @param {Object} mensaje - Mensaje de solicitud
 * @returns {Object} Resultado con el centro del mapa
 */
async function manejarGetCenter(mensaje) {
    const logPrefix = `[MAPA.GET_CENTER][${mensaje?.origen || 'desconocido'}]`;
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Obteniendo centro del mapa`, { mensajeId });
        
        if (!_mapaInstance) {
            throw new Error('Mapa no inicializado');
        }

        const center = _mapaInstance.getCenter();
        const zoom = _mapaInstance.getZoom();

        const resultado = {
            center: {
                lat: center.lat,
                lng: center.lng
            },
            zoom
        };

        // Enviar respuesta con el centro
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                ...resultado
            }
        });

        logger.info(`${logPrefix} Centro del mapa obtenido`, resultado);
        
        return { exito: true, ...resultado };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al obtener centro: ${error.message}`, error);
        
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                error: error.message,
                mensajeOriginalId: mensajeId,
                tipo: 'ERROR_GET_CENTER'
            }
        });
        
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja la adición de un marcador al mapa.
 * @param {Object} mensaje - Mensaje con datos del marcador
 * @param {Object} mensaje.datos - Datos del marcador
 * @param {string} mensaje.datos.id - ID único del marcador
 * @param {Object} mensaje.datos.coordenadas - Coordenadas {lat, lng}
 * @param {Object} [mensaje.datos.icono] - Configuración del icono
 * @param {string} [mensaje.datos.titulo] - Título del marcador
 * @param {string} [mensaje.datos.popup] - Contenido del popup
 * @returns {Object} Resultado de la operación
 */
async function manejarAddMarker(mensaje) {
    const logPrefix = `[MAPA.ADD_MARKER][${mensaje?.origen || 'desconocido'}]`;
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Añadiendo marcador al mapa`, { mensajeId, datos: mensaje.datos });
        
        if (!_mapaInstance) {
            throw new Error('Mapa no inicializado');
        }

        if (!mensaje?.datos?.id) {
            throw new Error('ID del marcador no especificado');
        }

        if (!mensaje?.datos?.coordenadas) {
            throw new Error('Coordenadas no especificadas');
        }

        const { id, coordenadas, icono = {}, titulo = '', popup = '' } = mensaje.datos;

        // Validar coordenadas
        if (!coordenadas.lat || !coordenadas.lng) {
            throw new Error('Coordenadas inválidas');
        }

        // Verificar si ya existe un marcador con este ID
        if (marcadoresParadas.has(id)) {
            logger.warn(`${logPrefix} Marcador con ID '${id}' ya existe, se reemplazará`);
            const marcadorAnterior = marcadoresParadas.get(id);
            _mapaInstance.removeLayer(marcadorAnterior);
        }

        // Configurar opciones del icono
        const iconOptions = {
            iconUrl: icono.url || 'default-marker.png',
            iconSize: icono.size || [25, 41],
            iconAnchor: icono.anchor || [12, 41],
            popupAnchor: icono.popupAnchor || [0, -41],
            shadowUrl: icono.shadowUrl,
            shadowSize: icono.shadowSize
        };

        // Crear marcador
        const marker = L.marker([coordenadas.lat, coordenadas.lng], {
            icon: L.icon(iconOptions),
            title: titulo
        }).addTo(_mapaInstance);

        // Añadir popup si se proporciona
        if (popup) {
            marker.bindPopup(popup);
        }

        // Guardar referencia del marcador
        marcadoresParadas.set(id, marker);

        // Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                marcadorId: id,
                coordenadas
            }
        });

        logger.info(`${logPrefix} Marcador añadido correctamente`, { id, coordenadas });
        
        return { exito: true, marcadorId: id, coordenadas };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al añadir marcador: ${error.message}`, error);
        
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                error: error.message,
                mensajeOriginalId: mensajeId,
                tipo: 'ERROR_ADD_MARKER'
            }
        });
        
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja la eliminación de un marcador del mapa.
 * @param {Object} mensaje - Mensaje con ID del marcador a eliminar
 * @param {Object} mensaje.datos - Datos del marcador
 * @param {string} mensaje.datos.id - ID del marcador a eliminar
 * @returns {Object} Resultado de la operación
 */
async function manejarRemoveMarker(mensaje) {
    const logPrefix = `[MAPA.REMOVE_MARKER][${mensaje?.origen || 'desconocido'}]`;
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Eliminando marcador del mapa`, { mensajeId, datos: mensaje.datos });
        
        if (!_mapaInstance) {
            throw new Error('Mapa no inicializado');
        }

        if (!mensaje?.datos?.id) {
            throw new Error('ID del marcador no especificado');
        }

        const { id } = mensaje.datos;

        // Buscar y eliminar marcador
        if (!marcadoresParadas.has(id)) {
            throw new Error(`Marcador con ID '${id}' no encontrado`);
        }

        const marcador = marcadoresParadas.get(id);
        _mapaInstance.removeLayer(marcador);
        marcadoresParadas.delete(id);

        // Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                marcadorId: id,
                eliminado: true
            }
        });

        logger.info(`${logPrefix} Marcador eliminado correctamente`, { id });
        
        return { exito: true, marcadorId: id, eliminado: true };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al eliminar marcador: ${error.message}`, error);
        
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                error: error.message,
                mensajeOriginalId: mensajeId,
                tipo: 'ERROR_REMOVE_MARKER'
            }
        });
        
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja la limpieza de todas las capas del mapa.
 * @param {Object} mensaje - Mensaje de limpieza
 * @param {Object} [mensaje.datos] - Opciones de limpieza
 * @param {boolean} [mensaje.datos.mantenerMarcadores=false] - Si se deben mantener los marcadores
 * @param {boolean} [mensaje.datos.mantenerRutas=false] - Si se deben mantener las rutas
 * @param {Array<string>} [mensaje.datos.excluirIds] - IDs de marcadores a mantener
 * @returns {Object} Resultado de la operación
 */
async function manejarClearLayers(mensaje) {
    const logPrefix = `[MAPA.CLEAR_LAYERS][${mensaje?.origen || 'desconocido'}]`;
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Limpiando capas del mapa`, { mensajeId, datos: mensaje.datos });
        
        if (!_mapaInstance) {
            throw new Error('Mapa no inicializado');
        }

        const { 
            mantenerMarcadores = false, 
            mantenerRutas = false, 
            excluirIds = [] 
        } = mensaje.datos || {};

        let marcadoresEliminados = 0;
        let rutasEliminadas = 0;

        // Limpiar marcadores
        if (!mantenerMarcadores) {
            marcadoresParadas.forEach((marcador, id) => {
                if (!excluirIds.includes(id)) {
                    _mapaInstance.removeLayer(marcador);
                    marcadoresParadas.delete(id);
                    marcadoresEliminados++;
                }
            });

            // Limpiar marcadores especiales si no están excluidos
            if (marcadorDestino && !excluirIds.includes('destino')) {
                _mapaInstance.removeLayer(marcadorDestino);
                marcadorDestino = null;
                marcadoresEliminados++;
            }

            if (marcadorParadaActual && !excluirIds.includes('paradaActual')) {
                _mapaInstance.removeLayer(marcadorParadaActual);
                marcadorParadaActual = null;
                marcadoresEliminados++;
            }

            if (marcadorPosicionActual && !excluirIds.includes('posicionActual')) {
                _mapaInstance.removeLayer(marcadorPosicionActual);
                marcadorPosicionActual = null;
                marcadoresEliminados++;
            }

            if (marcadorUsuario && !excluirIds.includes('usuario')) {
                _mapaInstance.removeLayer(marcadorUsuario);
                marcadorUsuario = null;
                marcadoresEliminados++;
            }
        }

        // Limpiar rutas
        if (!mantenerRutas) {
            rutasActivas.forEach(ruta => {
                _mapaInstance.removeLayer(ruta);
                rutasEliminadas++;
            });
            rutasActivas = [];

            rutasTramos.forEach(ruta => {
                _mapaInstance.removeLayer(ruta);
                rutasEliminadas++;
            });
            rutasTramos = [];
        }

        const resultado = {
            marcadoresEliminados,
            rutasEliminadas,
            totalEliminado: marcadoresEliminados + rutasEliminadas
        };

        // Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                mensajeOriginalId: mensajeId,
                estado: 'procesado',
                ...resultado
            }
        });

        logger.info(`${logPrefix} Capas limpiadas correctamente`, resultado);
        
        return { exito: true, ...resultado };
        
    } catch (error) {
        logger.error(`${logPrefix} Error al limpiar capas: ${error.message}`, error);
        
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
            origen: 'funciones-mapa',
            mensajeId: generarIdUnico(),
            datos: {
                error: error.message,
                mensajeOriginalId: mensajeId,
                tipo: 'ERROR_CLEAR_LAYERS'
            }
        });
        
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja el cambio de modo del sistema (casa/aventura).
 * @param {Object} mensaje - Mensaje con datos del cambio de modo
 */
async function manejarCambioModoMapa(mensaje) {
    const logPrefix = `[SISTEMA.CAMBIO_MODO][${mensaje?.origen || 'desconocido'}]`;
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        logger.info(`${logPrefix} Procesando cambio de modo`, { mensajeId, datos: mensaje.datos });
        
        if (!mensaje?.datos?.modo) {
            throw new Error('Modo no especificado en el mensaje');
        }

        const { modo } = mensaje.datos;
        
        // Validar modo
        if (modo !== MODOS.CASA && modo !== MODOS.AVENTURA) {
            throw new Error(`Modo inválido: ${modo}. Debe ser '${MODOS.CASA}' o '${MODOS.AVENTURA}'`);
        }

        // Actualizar estado local
        const modoAnterior = estadoMapa.modo;
        estadoMapa.modo = modo;
        estadoMapa.timestamp = Date.now();

        logger.info(`${logPrefix} Cambiando modo: ${modoAnterior} → ${modo}`);

        // Si cambia a AVENTURA, iniciar GPS para detección secuencial
        if (modo === MODOS.AVENTURA) {
            await iniciarGPSAventura();
        } else if (modo === MODOS.CASA) {
            detenerGPS();
        }

        // Aplicar cambios según el modo usando la lógica existente de limpiarPorEstado
        const limpiado = await limpiarPorEstado({ modo });
        
        logger.info(`${logPrefix} DEBUG: Cambio de modo ${modoAnterior} -> ${modo}, limpiado=${limpiado}`);
        
        // Aquí se podrían agregar cambios específicos de estilos/interacción del mapa
        // Por ahora, delegamos a limpiarPorEstado que ya maneja la lógica básica

        logger.success(`${logPrefix} Cambio de modo completado exitosamente: ${modo}`);
        
        return { 
            exito: true, 
            modo: modo,
            modoAnterior: modoAnterior,
            limpiado: limpiado,
            mensajeId: mensajeId
        };

    } catch (error) {
        logger.error(`${logPrefix} Error procesando cambio de modo:`, error);
        
        // Enviar mensaje de error si es posible
        try {
            await enviarMensaje({
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                origen: 'funciones-mapa',
                destino: mensaje?.origen || 'padre',
                mensajeId: generarIdUnico(),
                datos: {
                    error: error.message,
                    mensajeOriginalId: mensajeId,
                    tipo: 'ERROR_CAMBIO_MODO_MAPA'
                }
            });
        } catch (sendError) {
            logger.error(`${logPrefix} Error enviando mensaje de error:`, sendError);
        }
        
        return { exito: false, error: error.message };
    }
}

/**
 * Maneja la respuesta con datos de paradas del padre
 * @param {Object} mensaje - Mensaje con datos de paradas
 */
async function manejarRespuestaDatosParadas(mensaje) {
    const logPrefix = `[NAVEGACION.RESPUESTA_DATOS_PARADAS][${mensaje?.origen || 'desconocido'}]`;
    
    try {
        logger.info(`${logPrefix} Recibida respuesta de datos de paradas`);
        
        if (!mensaje?.datos?.paradas) {
            throw new Error('Datos de paradas no incluidos en la respuesta');
        }
        
        const { paradas } = mensaje.datos;
        
        if (!Array.isArray(paradas)) {
            throw new Error('Datos de paradas no es un array válido');
        }
        
        if (paradas.length === 0) {
            logger.warn(`${logPrefix} Array de paradas vacío recibido`);
            return;
        }
        
        // Actualizar array local con los datos del padre
        arrayParadasLocal = paradas;
        datosParadasSolicitados = false; // Reset flag para permitir futuras solicitudes si es necesario
        
        logger.info(`${logPrefix} Datos de paradas actualizados: ${paradas.length} paradas cargadas`);
        
        // Opcional: Mostrar paradas en el mapa si está inicializado
        if (_mapaInstance) {
            await mostrarTodasLasParadas(paradas);
        }
        
    } catch (error) {
        logger.error(`${logPrefix} Error procesando respuesta de datos de paradas:`, error);
    }
}

/**
 * Registra los manejadores de mensajes para el mapa.
 */
export function registrarManejadoresMensajes() {
    try {
        // Validar que la función registrarControlador está disponible
        if (typeof registrarControlador !== 'function') {
            throw new Error('La función registrarControlador no está disponible');
        }
        
        // Registrar manejadores de mensajes con manejo de errores
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.ESTABLECER_DESTINO, manejarEstablecerDestino);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.ACTUALIZAR_POSICION, manejarActualizarPosicion);
        registrarControlador(TIPOS_MENSAJE.SISTEMA.CAMBIO_MODO, manejarCambioModoMapa);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.MOSTRAR_RUTA, manejarMostrarRuta);
        
        // Controladores de navegación adicionales
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA, manejarCambiarParada);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.ACTUALIZAR_ESTADO, manejarActualizarEstadoNavegacion);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.INICIAR, manejarIniciarNavegacion);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.INICIADA, manejarNavegacionIniciada);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.CANCELADA, manejarNavegacionCancelada);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.DESTINO_ESTABLECIDO, manejarDestinoEstablecido);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.LLEGADA_DETECTADA, manejarLlegadaDetectada);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.ERROR, manejarErrorNavegacion);
        
        // Controladores GPS
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.GPS.ACTIVAR, manejarGPSActivar);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.GPS.DESACTIVAR, manejarGPSDesactivar);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.GPS.UBICACION_ACTUALIZADA, manejarUbicacionGPSActualizada);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.GPS.ESTADO_ACTUALIZADO, manejarEstadoGPSActualizado);
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.GPS.ERROR, manejarErrorGPSMensaje);
        
        // Controlador para respuesta de datos de paradas
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.RESPUESTA_DATOS_PARADAS, manejarRespuestaDatosParadas);
        
        // Controladores de manipulación del mapa
        registrarControlador(TIPOS_MENSAJE.MAPA.INVALIDAR_TAMAÑO, manejarInvalidarTamanio);
        registrarControlador(TIPOS_MENSAJE.MAPA.SET_VIEW, manejarSetView);
        registrarControlador(TIPOS_MENSAJE.MAPA.GET_CENTER, manejarGetCenter);
        registrarControlador(TIPOS_MENSAJE.MAPA.ADD_MARKER, manejarAddMarker);
        registrarControlador(TIPOS_MENSAJE.MAPA.REMOVE_MARKER, manejarRemoveMarker);
        registrarControlador(TIPOS_MENSAJE.MAPA.CLEAR_LAYERS, manejarClearLayers);
        
        // Controlador para solicitar paradas con proximidad avanzada
        registrarControlador(TIPOS_MENSAJE.DATOS.SOLICITAR_PARADAS, async (mensaje) => {
            const logPrefix = `[funciones-mapa][SOLICITAR_PARADAS][${mensaje?.origen || 'desconocido'}]`;

            try {
                logger.debug(`${logPrefix} Solicitud de paradas con proximidad recibida`);

                // Usar ubicación actual del usuario si está disponible
                const ubicacionUsuario = estadoMapa.posicionUsuario;
                if (!ubicacionUsuario) {
                    logger.warn(`${logPrefix} No hay ubicación de usuario disponible, usando datos locales`);
                    return {
                        exito: true,
                        paradas: arrayParadasLocal,
                        fuente: 'local',
                        timestamp: new Date().toISOString()
                    };
                }

                // Enviar solicitud de proximidad a hijo2 a través del padre
                const respuesta = await enviarMensajeConConfirmacion({
                    tipo: TIPOS_MENSAJE.DATOS.SOLICITAR_PARADAS,
                    origen: 'funciones-mapa',
                    destino: 'padre',
                    datos: {
                        lat: ubicacionUsuario.lat,
                        lng: ubicacionUsuario.lng,
                        radio: mensaje.datos?.radio || 100, // 100m por defecto
                        filtro: mensaje.datos?.filtro,
                        tipo: mensaje.datos?.tipo,
                        ordenPor: mensaje.datos?.ordenPor || 'distancia',
                        orden: mensaje.datos?.orden || 'asc',
                        limite: mensaje.datos?.limite,
                        incluirEstadisticas: mensaje.datos?.incluirEstadisticas || true,
                        soloConAudio: mensaje.datos?.soloConAudio || false,
                        soloConImagen: mensaje.datos?.soloConImagen || false,
                        soloConVideo: mensaje.datos?.soloConVideo || false
                    }
                }, 5000); // 5 segundos timeout

                if (respuesta && respuesta.datos) {
                    logger.info(`${logPrefix} Paradas cercanas obtenidas: ${respuesta.datos.total || 0} paradas`);
                    return {
                        exito: true,
                        ...respuesta.datos,
                        fuente: 'hijo2_proximidad'
                    };
                } else {
                    logger.warn(`${logPrefix} No se recibió respuesta válida, usando datos locales`);
                    return {
                        exito: true,
                        paradas: arrayParadasLocal,
                        fuente: 'local_fallback',
                        timestamp: new Date().toISOString()
                    };
                }

            } catch (error) {
                logger.error(`${logPrefix} Error solicitando paradas con proximidad:`, error);
                // Fallback a datos locales
                return {
                    exito: false,
                    error: error.message,
                    paradas: arrayParadasLocal,
                    fuente: 'local_error_fallback',
                    timestamp: new Date().toISOString()
                };
            }
        });
        
        // Usar limpiarPorEstado como manejador para SISTEMA.ESTADO
        registrarControlador(TIPOS_MENSAJE.SISTEMA.ESTADO, limpiarPorEstado);
        
        // Registrar controladores para los nuevos mensajes
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.VALIDAR_RANGO_PARADA, async (mensaje) => {
            try {
                const { coordenadasUsuario, coordenadasParada, rango } = mensaje.datos;
                if (!validarCoordenadas(coordenadasUsuario) || !validarCoordenadas(coordenadasParada)) {
                    throw new Error('Coordenadas inválidas para validar rango');
                }

                const distancia = calcularDistancia(coordenadasUsuario, coordenadasParada);
                const dentroDelRango = distancia <= rango;

                await enviarMensaje({
                    tipo: TIPOS_MENSAJE.NAVEGACION.VALIDAR_RANGO_PARADA,
                    origen: 'mapa',
                    destino: mensaje.origen,
                    datos: { dentroDelRango, distancia }
                });
            } catch (error) {
                manejarError(error, mensaje);
            }
        });

        registrarControlador(TIPOS_MENSAJE.NAVEGACION.ENVIAR_PARADA_COMPLETADA, async (mensaje) => {
            try {
                const { paradaCompletada, siguienteParada } = mensaje.datos;
                if (!paradaCompletada || !siguienteParada) {
                    throw new Error('Datos incompletos para enviar parada completada');
                }

                await enviarMensaje({
                    tipo: TIPOS_MENSAJE.NAVEGACION.ENVIAR_PARADA_COMPLETADA,
                    origen: 'mapa',
                    destino: mensaje.origen,
                    datos: { paradaCompletada, siguienteParada }
                });
            } catch (error) {
                manejarError(error, mensaje);
            }
        });

        registrarControlador(TIPOS_MENSAJE.NAVEGACION.DIBUJAR_POLYLINE, async (mensaje) => {
            try {
                const { tramo } = mensaje.datos;
                if (!tramo || !tramo.inicio || !tramo.fin) {
                    throw new Error('Datos incompletos para dibujar polyline');
                }

                const polyline = dibujarTramo(tramo, true);
                if (!polyline) {
                    throw new Error('Error al dibujar polyline');
                }

                await enviarMensaje({
                    tipo: TIPOS_MENSAJE.NAVEGACION.DIBUJAR_POLYLINE,
                    origen: 'mapa',
                    destino: mensaje.origen,
                    datos: { exito: true }
                });






            } catch (error) {
                manejarError(error, mensaje);
            }
        });

        // Controlador para respuesta de coordenadas completas de la ruta
        registrarControlador(TIPOS_MENSAJE.DATOS.COORDENADAS_PARADAS_RESPONSE, async (mensaje) => {
            const logPrefix = '[COORDENADAS_PARADAS_RESPONSE]';
            
            try {
                const { coordenadas, total, exito, paradaId } = mensaje.datos;
                
                logger.info(`${logPrefix} ===== RESPONSE RECIBIDO =====`);
                logger.info(`${logPrefix} DEBUG: Recibidas coordenadas - exito=${exito}, total=${total}, paradaId=${paradaId}`);
                logger.info(`${logPrefix} DEBUG: IDs de coordenadas:`, coordenadas?.map(c => c.id) || 'NINGUNO');
                logger.debug(`${logPrefix} DEBUG: Tipos de coordenadas:`, coordenadas?.map(c => c.tipo) || 'NINGUNO');
                logger.debug(`${logPrefix} DEBUG: Origen del mensaje: ${mensaje.origen}`);
                logger.debug(`${logPrefix} DEBUG: Contexto completo del mensaje:`, mensaje.datos);
                
                if (!exito || !coordenadas || !Array.isArray(coordenadas)) {
                    logger.warn(`${logPrefix} Respuesta inválida de coordenadas completas`);
                    return;
                }
                
                logger.info(`${logPrefix} Recibidas ${total} coordenadas completas para dibujar ruta`);
                
                // Transformar coordenadas al formato esperado por dibujarRutaConMarcadores
                const coordenadasTransformadas = [];
                
                coordenadas.forEach(coord => {
                    if (coord.tipo === 'parada' || coord.tipo === 'inicio' || (coord.tipo === 'tramo' && coord.coordenadas)) {
                        // Paradas, inicios y tramos simplificados tienen coordenadas: { lat, lng }
                        if (coord.coordenadas && coord.coordenadas.lat && coord.coordenadas.lng) {
                            coordenadasTransformadas.push({
                                lat: coord.coordenadas.lat,
                                lng: coord.coordenadas.lng,
                                nombre: coord.nombre,
                                id: coord.id,
                                tipo: coord.tipo
                            });
                        }
                    } else if (coord.tipo === 'tramo') {
                        // Tramos tienen inicio, waypoints y fin
                        if (coord.inicio && coord.inicio.lat && coord.inicio.lng) {
                            coordenadasTransformadas.push({
                                lat: coord.inicio.lat,
                                lng: coord.inicio.lng,
                                nombre: coord.nombre,
                                id: coord.id,
                                tipo: coord.tipo
                            });
                        }
                        
                        // Agregar waypoints si existen
                        if (coord.waypoints && Array.isArray(coord.waypoints)) {
                            coord.waypoints.forEach(waypoint => {
                                if (waypoint.lat && waypoint.lng) {
                                    coordenadasTransformadas.push({
                                        lat: waypoint.lat,
                                        lng: waypoint.lng,
                                        nombre: `${coord.nombre} (waypoint)`,
                                        id: `${coord.id}_wp`,
                                        tipo: 'waypoint'
                                    });
                                }
                            });
                        }
                        
                        // Agregar punto final
                        if (coord.fin && coord.fin.lat && coord.fin.lng) {
                            coordenadasTransformadas.push({
                                lat: coord.fin.lat,
                                lng: coord.fin.lng,
                                nombre: coord.nombre,
                                id: coord.id,
                                tipo: coord.tipo
                            });
                        }
                    }
                });
                
                logger.info(`${logPrefix} Coordenadas transformadas: ${coordenadasTransformadas.length} puntos`);
                
                // Determinar opciones de dibujo basado en el contexto del mensaje
                const contexto = mensaje.datos?.contexto || '';
                const esCambioIndividual = contexto.includes('cambio_parada_individual');
                const esTramoIndividual = esCambioIndividual && coordenadas.some(c => c.tipo === 'tramo');
                const incluirRutas = mensaje.datos?.incluirRutas !== undefined ? mensaje.datos.incluirRutas : (!esCambioIndividual || esTramoIndividual);
                
                logger.debug(`${logPrefix} Contexto de dibujo: ${contexto}, incluirRutas: ${incluirRutas}, esTramoIndividual: ${esTramoIndividual}`);
                
                // Dibujar la ruta completa con polylines y marcadores
                await dibujarRutaConMarcadores(coordenadasTransformadas, {
                    dibujarRuta: incluirRutas
                });
                
                logger.success(`${logPrefix} Ruta completa dibujada exitosamente`);
                
            } catch (error) {
                logger.error(`${logPrefix} Error procesando coordenadas completas:`, error);
            }
        });
        
        // Controladores para respuestas de consultas de cambio de parada
        registrarControlador(TIPOS_MENSAJE.NAVEGACION.RESPUESTA_COORDENADAS, async (mensaje) => {
            await procesarRespuestaConsulta('coordenadas', mensaje.datos);
        });
        registrarControlador(TIPOS_MENSAJE.AUDIO.RESPUESTA_AUDIO, async (mensaje) => {
            await procesarRespuestaConsulta('audio', mensaje.datos);
        });
        registrarControlador(TIPOS_MENSAJE.DATOS.RESPUESTA_RETO, async (mensaje) => {
            await procesarRespuestaConsulta('reto', mensaje.datos);
        });
        
        console.debug('Manejadores de mensajes del mapa registrados correctamente');
        return true;
    } catch (error) {
        console.error('Error al registrar manejadores de mensajes:', error);
        throw error; // Propagar el error para que se pueda manejar en la inicialización
    }
}

// Registrar manejadores al cargar el módulo
try {
    if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', () => {
            registrarManejadoresMensajes();
        });
    }
} catch (error) {
    console.error('Error al configurar listener para registrar manejadores:', error);
}

/**
 * Add integration tests for error flows
 */
export async function probarFlujosError() {
    // Simulate communication failures
    try {
        // Mock a failure in enviarMensaje
        const mockEnviarMensaje = jest.fn().mockRejectedValue(new Error('Simulated failure'));
        // Temporarily replace enviarMensaje
        const originalEnviarMensaje = global.enviarMensaje;
        global.enviarMensaje = mockEnviarMensaje;
        
        // Test recovery
        await mostrarTodasLasParadas([]);
        // Verify no crash and recovery logic
        
        // Restore
        global.enviarMensaje = originalEnviarMensaje;
    } catch (error) {
        logger.error('Error en pruebas de flujo:', error);
    }
}

// Call tests in initialization if in test environment
/**
 * Standardize error handling using centralized logger
 * Replace console.error with logger.error throughout
 * (Assuming replacements in functions like actualizarPuntoActual, dibujarTramo, etc.)
 * Example:
 * function actualizarPuntoActual(coordenadas) {
 *     try {
 *         // ...existing code...
 *     } catch (error) {
 *         logger.error('Error al actualizar la posición del usuario:', error);
 *     }
 * }
 */

/**
 * Clean unused markers and routes after state reconciliation
 * (Assuming cleanup in limpiarRecursos or similar)
 */

/**
 * Función de diagnóstico del mapa para verificar estado y configuración
 * @returns {Promise<Object>} Resultado del diagnóstico con información del estado del mapa
 */
export async function diagnosticarMapa() {
    try {
        const diagnostico = {
            mapaInicializado: estaInicializado(),
            servicioInicializado: _mapaInstance !== null,
            marcadoresParadas: marcadoresParadas.size,
            marcadoresActivos: marcadoresParadas.size + (marcadorUsuario ? 1 : 0) + (marcadorDestino ? 1 : 0),
            rutasActivas: rutasActivas.length,
            tramosRuta: rutasTramos.length,
            posicionUsuario: estadoMapa.posicionUsuario,
            modoActual: estadoMapa.modo,
            timestamp: new Date().toISOString()
        };

        // Verificar si el mapa está realmente disponible
        if (_mapaInstance) {
            try {
                const center = await getMapCenter();
                diagnostico.centroMapa = center;
                diagnostico.mapaInteractivo = true;
            } catch (error) {
                diagnostico.mapaInteractivo = false;
                diagnostico.errorCentro = error.message;
            }
        }

        logger.info('Diagnóstico del mapa completado:', diagnostico);
        return diagnostico;
    } catch (error) {
        logger.error('Error en diagnóstico del mapa:', error);
        return {
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Inicia GPS para modo aventura secuencial
 */
async function iniciarGPSAventura() {
    const logPrefix = '[funciones-mapa][GPS-AVENTURA]';

    try {
        logger.info(`${logPrefix} Activando GPS centralizado del padre para modo aventura`);

        // Actualizar estado GPS directamente (ya estamos en el contexto del padre)
        estadoMapa.gpsActivo = true;
        estadoMapa.gpsPermisos = true;
        estadoMapa.gpsError = null;
        gpsEstadoReal.activo = true;

        logger.info(`${logPrefix} GPS activado para modo aventura`);

    } catch (error) {
        logger.error(`${logPrefix} Error al activar GPS para aventura:`, error);
    }
}

/**
 * Detiene GPS
 */
function detenerGPS() {
    const logPrefix = '[funciones-mapa][GPS]';

    try {
        logger.info(`${logPrefix} Desactivando GPS centralizado del padre`);

        // Actualizar estado GPS directamente (ya estamos en el contexto del padre)
        estadoMapa.gpsActivo = false;
        estadoMapa.gpsPermisos = false;
        estadoMapa.gpsError = null;
        gpsEstadoReal.activo = false;

        logger.info(`${logPrefix} GPS desactivado`);

    } catch (error) {
        logger.error(`${logPrefix} Error al detener GPS:`, error);
    }
}

/**
 * Procesa posición GPS para detección secuencial en modo aventura
 */
async function procesarPosicionGPSParaAventura(posicion) {
    const logPrefix = '[funciones-mapa][GPS-POSICION]';

    try {
        const { lat: latitude, lng: longitude, accuracy } = posicion;

        logger.debug(`${logPrefix} Posición GPS: lat=${latitude}, lng=${longitude}, accuracy=${accuracy}m`);

        // Actualizar estado
        gpsEstadoReal.precision = accuracy;
        gpsEstadoReal.ultimaUbicacion = { lat: latitude, lng: longitude };

        // Solo procesar si precisión es buena (< 50m)
        if (accuracy > 50) {
            logger.debug(`${logPrefix} Precisión insuficiente: ${accuracy}m > 50m`);
            return;
        }

        // Obtener paradas del array global (asumiendo que está disponible)
        if (typeof window.AVENTURA_PARADAS === 'undefined') {
            logger.warn(`${logPrefix} Array AVENTURA_PARADAS no disponible`);
            return;
        }

        const paradas = window.AVENTURA_PARADAS;
        const paradaActualIndex = estadoMapa.paradaActual ?
            paradas.findIndex(p => p.padreid === estadoMapa.paradaActual) : -1;

        // Buscar la siguiente parada en secuencia
        const siguienteIndex = paradaActualIndex + 1;
        if (siguienteIndex >= paradas.length) {
            logger.info(`${logPrefix} Ruta completada`);
            return;
        }

        const siguienteParada = paradas[siguienteIndex];
        if (!siguienteParada || !siguienteParada.coordenadas) {
            logger.info(`${logPrefix} Siguiente parada no válida`);
            return;
        }

        // Calcular distancia
        const distancia = calcularDistancia(latitude, longitude,
            siguienteParada.coordenadas.lat, siguienteParada.coordenadas.lng);

        logger.debug(`${logPrefix} Distancia a ${siguienteParada.padreid}: ${distancia}m`);

        // Si está dentro de 20m, activar la parada
        if (distancia <= 20) {
            logger.info(`${logPrefix} Activando parada secuencial: ${siguienteParada.padreid}`);

            // Enviar mensaje de cambio de parada
            await enviarMensaje({
                destino: 'padre',
                tipo: TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA,
                origen: 'funciones-mapa',
                datos: {
                    paradaId: siguienteParada.padreid,
                    origen: 'gps-automatico',
                    distancia: distancia,
                    timestamp: Date.now()
                }
            });
        }

    } catch (error) {
        logger.error(`${logPrefix} Error procesando posición GPS:`, error);
    }
}

/**
 * Maneja errores GPS del navegador
 */
function manejarErrorGPSNavegador(error) {
    const logPrefix = '[funciones-mapa][GPS-ERROR]';
    
    logger.error(`${logPrefix} Error GPS:`, {
        code: error.code,
        message: error.message
    });
    
    gpsEstadoReal.error = error.message;
}

// Asignar funciones al objeto global para compatibilidad con código existente
window.funcionesMapa = {
    inicializarServicioMapa,
    estaInicializado,
    invalidarTamañoMapa,
    diagnosticarMapa,
    isMapInitialized: estaInicializado,
    mostrarTodasLasParadas,
    limpiarRecursos,
    dibujarRutaConMarcadores,
    registrarManejadoresMensajes,
    limpiarPorEstado
};

// Limpieza agresiva de globales al descargar la página
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        try {
            // Limpiar globales del mapa agresivamente
            if (window.funcionesMapa) {
                delete window.funcionesMapa;
            }
            
            // Limpiar instancia del mapa si existe
            if (_mapaInstance) {
                _mapaInstance.remove();
                _mapaInstance = null;
            }
            
            // Limpiar arrays y mapas
            marcadoresParadas.clear();
            rutasTramos.length = 0;
            rutasActivas.length = 0;
            marcadorUsuario = null;
            marcadorDestino = null;
            _mapaOpciones = null;
            arrayParadasLocal.length = 0;
            
            // Limpiar estado del mapa
            Object.keys(estadoMapa).forEach(key => {
                estadoMapa[key] = null;
            });
            
            // Limpiar listeners de actividad
            if (intervaloLimpiezaAutomatica) {
                clearInterval(intervaloLimpiezaAutomatica);
                intervaloLimpiezaAutomatica = null;
            }
            
            logger.info('Limpieza agresiva de globales del mapa completada');
        } catch (error) {
            // Logging mínimo durante pagehide para evitar errores
            console.warn('Error en limpieza agresiva del mapa:', error.message);
        }
    });
}

/**
 * Calcula la distancia entre dos coordenadas usando la fórmula Haversine
 * @param {Object} coord1 - Primera coordenada {lat, lng}
 * @param {Object} coord2 - Segunda coordenada {lat, lng}
 * @returns {number} Distancia en metros
 */
function calcularDistanciaCoordenadas(coord1, coord2) {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Valida si las coordenadas del usuario están dentro del rango de 20 metros de una parada
 * @param {Object} coordenadasUsuario - Coordenadas del usuario {lat, lng}
 * @param {Object} coordenadasParada - Coordenadas de la parada {lat, lng}
 * @returns {boolean} True si está dentro del rango
 */
function validarRango(coordenadasUsuario, coordenadasParada) {
    const distancia = calcularDistanciaCoordenadas(coordenadasUsuario, coordenadasParada);
    return distancia <= 20; // 20 metros o menos
}

// ==================== CONTROLADORES DE NAVEGACIÓN ====================

/**
 * Estado de navegación (inicializar si no existe)
 */
let estadoNavegacion = {
    posicionActual: null,
    vistaActual: null,
    ultimaActualizacion: null,
    estado: 'INACTIVO', // INACTIVO, ACTIVO, PAUSADO, ERROR
    modoVista: 'normal',
    tipoMapa: 'vectorial',
    estadoMapa: null
};

/**
 * Controlador: NAVEGACION.ACTUALIZAR_POSICION
 * Actualiza la posición del usuario en el mapa
 */
registrarControlador(TIPOS_MENSAJE.NAVEGACION.ACTUALIZAR_POSICION, async (mensaje) => {
    const logPrefix = `[NAVEGACION.ACTUALIZAR_POSICION][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = mensaje.datos?.timestamp || Date.now();
    const mensajeId = mensaje.mensajeId || generarIdUnico();
    
    try {
        // 1. Validación del mensaje
        if (!mensaje?.origen) {
            const errorMsg = 'Mensaje sin origen, ignorando actualización de posición';
            logger.warn(`${logPrefix} ${errorMsg}`);
            return;
        }

        const { 
            posicion,
            centrarMapa = true,
            forzarActualizacion = false
        } = mensaje.datos || {};

        // 2. Validación de campos obligatorios
        if (!posicion || typeof posicion !== 'object') {
            const errorMsg = 'Datos de posición no válidos o faltantes';
            logger.error(`${logPrefix} ${errorMsg}`, { posicion });
            
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                origen: 'funciones-mapa',
                datos: {
                    error: errorMsg,
                    mensajeId,
                    timestamp,
                    tipo: 'VALIDACION',
                    campoFaltante: 'posicion'
                }
            });
            return;
        }

        // 3. Validación de coordenadas
        const { lat, lng, accuracy } = posicion;
        const errores = [];

        if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
            errores.push('Latitud no válida (debe estar entre -90 y 90)');
        }
        if (typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
            errores.push('Longitud no válida (debe estar entre -180 y 180)');
        }
        if (accuracy !== undefined && (typeof accuracy !== 'number' || accuracy < 0)) {
            errores.push('Precisión no válida (debe ser un número positivo)');
        }

        if (errores.length > 0) {
            const errorMsg = `Datos de posición inválidos: ${errores.join('; ')}`;
            logger.error(`${logPrefix} ${errorMsg}`, { posicion });
            
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                origen: 'funciones-mapa',
                datos: {
                    error: errorMsg,
                    mensajeId,
                    timestamp,
                    tipo: 'VALIDACION',
                    detalles: { lat, lng, accuracy }
                }
            });
            return;
        }

        logger.info(`${logPrefix} Procesando actualización de posición`, {
            lat,
            lng,
            accuracy,
            origen: mensaje.origen
        });

        // 4. Verificar si la posición ha cambiado significativamente
        const posicionActual = estadoNavegacion?.posicionActual;
        const UMBRAL_DISTANCIA = 5; // metros
        let esCambioSignificativo = forzarActualizacion;

        if (posicionActual) {
            const distancia = calcularDistanciaCoordenadas(
                { lat: posicionActual.lat, lng: posicionActual.lng },
                { lat, lng }
            );
            
            esCambioSignificativo = esCambioSignificativo || 
                                   distancia > UMBRAL_DISTANCIA || 
                                   (Date.now() - (posicionActual.timestamp || 0)) > 30000; // 30 segundos
        }

        if (!esCambioSignificativo && !forzarActualizacion) {
            logger.debug(`${logPrefix} Cambio de posición no significativo, ignorando`);
            return;
        }

        // 5. Actualizar estado de navegación
        const nuevaPosicion = {
            lat,
            lng,
            accuracy: accuracy || null,
            heading: posicion.heading !== undefined ? posicion.heading : null,
            speed: posicion.speed !== undefined ? posicion.speed : null,
            timestamp
        };

        estadoNavegacion.posicionActual = nuevaPosicion;
        estadoNavegacion.ultimaActualizacion = timestamp;
        estadoNavegacion.estado = 'ACTIVO';

        // 6. Actualizar marcador de posición en el mapa
        actualizarPosicionUsuario(nuevaPosicion);

        // 7. Enviar confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'funciones-mapa',
            datos: {
                mensajeOriginalId: mensajeId,
                timestamp: Date.now(),
                estado: 'procesado',
                posicion: nuevaPosicion
            }
        });

        logger.debug(`${logPrefix} Posición actualizada correctamente`);
        
    } catch (error) {
        logger.error(`${logPrefix} Error no manejado:`, error);
        throw error;
    }
});

/**
 * Controlador: NAVEGACION.CENTRAR_EN_UBICACION
 * Centra el mapa en una ubicación específica
 */
registrarControlador(TIPOS_MENSAJE.NAVEGACION.CENTRAR_EN_UBICACION, async (mensaje) => {
    const logPrefix = `[NAVEGACION.CENTRAR_EN_UBICACION][${mensaje?.origen || 'desconocido'}]`;
    const timestamp = Date.now();
    const mensajeId = mensaje?.mensajeId || generarIdUnico();
    
    try {
        if (!mensaje?.origen) {
            logger.warn(`${logPrefix} Mensaje sin origen`);
            return;
        }

        const { 
            posicion,
            zoom = 15,
            suavizado = true
        } = mensaje.datos || {};

        // Validación
        if (!posicion || typeof posicion !== 'object') {
            const errorMsg = 'Datos de posición no válidos';
            logger.error(`${logPrefix} ${errorMsg}`);
            
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                origen: 'funciones-mapa',
                datos: { error: errorMsg, mensajeId, timestamp }
            });
            return;
        }

        const { lat, lng } = posicion;
        if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90 ||
            typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
            const errorMsg = 'Coordenadas inválidas';
            logger.error(`${logPrefix} ${errorMsg}`, { lat, lng });
            
            await enviarMensaje({
                destino: mensaje.origen,
                tipo: TIPOS_MENSAJE.SISTEMA.ERROR,
                origen: 'funciones-mapa',
                datos: { error: errorMsg, mensajeId, timestamp, detalles: { lat, lng } }
            });
            return;
        }

        logger.info(`${logPrefix} Centrando mapa`, { lat, lng, zoom });

        // Centrar el mapa usando setMapView
        await setMapView([lat, lng], zoom, { animate: suavizado });

        // Actualizar estado
        estadoNavegacion.vistaActual = {
            centro: { lat, lng },
            zoom,
            timestamp
        };
        estadoNavegacion.ultimaActualizacion = timestamp;

        // Confirmación
        await enviarMensaje({
            destino: mensaje.origen,
            tipo: TIPOS_MENSAJE.SISTEMA.CONFIRMACION,
            origen: 'funciones-mapa',
            datos: {
                mensajeOriginalId: mensajeId,
                timestamp: Date.now(),
                estado: 'procesado',
                vista: estadoNavegacion.vistaActual
            }
        });

        logger.debug(`${logPrefix} Mapa centrado correctamente`);
        
    } catch (error) {
        logger.error(`${logPrefix} Error:`, error);
        throw error;
    }
});

/**
 * Dibuja una polyline desde la ubicación del usuario hasta la siguiente parada en modo aventura
 * @param {Object} opciones - Opciones para el dibujo
 * @param {Object} opciones.origen - Coordenadas de origen {lat, lng}
 * @param {Object} opciones.destino - Coordenadas de destino {lat, lng}
 * @param {string} opciones.color - Color de la polyline (default: 'blue')
 * @param {number} opciones.weight - Grosor de la polyline (default: 3)
 */
export function dibujarPolylineNavegacion(opciones = {}) {
    const { origen, destino, color = 'blue', weight = 3 } = opciones;
    
    if (!_mapaInstance) {
        logger.warn('dibujarPolylineNavegacion: Mapa no inicializado');
        return null;
    }
    
    if (!origen || !destino || !origen.lat || !origen.lng || !destino.lat || !destino.lng) {
        logger.warn('dibujarPolylineNavegacion: Origen o destino inválidos');
        return null;
    }
    
    try {
        // Limpiar polyline anterior si existe
        if (polylineNavegacion) {
            _mapaInstance.removeLayer(polylineNavegacion);
            polylineNavegacion = null;
        }
        
        // Crear nueva polyline
        polylineNavegacion = L.polyline([[origen.lat, origen.lng], [destino.lat, destino.lng]], {
            color: color,
            weight: weight,
            opacity: 0.7
        }).addTo(_mapaInstance);
        
        logger.debug(`Polyline de navegación dibujada desde [${origen.lat}, ${origen.lng}] hasta [${destino.lat}, ${destino.lng}]`);
        return polylineNavegacion;
    } catch (error) {
        logger.error('Error dibujando polyline de navegación:', error);
        return null;
    }
}

// Variable para la polyline de navegación
let polylineNavegacion = null;
