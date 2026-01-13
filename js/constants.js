/**
 * Constantes utilizadas en toda la aplicación
 * @module Constants
 */

/**
 * Niveles de log disponibles
 */
export const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

/**
 * Modos de la aplicación
 */
export const MODOS = {
    CASA: 'casa',
    AVENTURA: 'aventura'
};

/**
 * Configuración de TTL (Time To Live) para limpieza automática de memoria
 * Optimizado por tipo de dispositivo para mejorar rendimiento
 * ✅ PROBLEMA 26: Centralización de TTLs para evitar duplicación
 */
export const TTL_LIMPIEZA = {
    /* Configuración de TTL (Time To Live) para limpieza automática de memoria
     * Optimizado por tipo de dispositivo para mejorar rendimiento y consumo de recursos.
     *
     * - En MÓVIL: Se mantiene menos historial y la limpieza es menos frecuente (para ahorrar batería y CPU).
     * - En DESKTOP: Se mantiene más historial y la limpieza es más frecuente (más recursos disponibles).
     *
     * Ejemplo:
     *   LOGGER: MÓVIL = 5min (menos frecuente, menos historial), DESKTOP = 1min (más frecuente, más historial)
     *   SUPPRESS: MÓVIL = 2min, DESKTOP = 5min
     * ✅ PROBLEMA 26: Centralización de TTLs para evitar duplicación
     */
    // Mensajería: limpieza de mensajes procesados y promesas pendientes
    MENSAJERIA: {
        MOVIL: 30000,      // 30 segundos (móvil necesita limpieza agresiva)
        DESKTOP: 60000     // 60 segundos (1 minuto)
    },
    
    // Logger: limpieza de historial de logs
    LOGGER: {
        MOVIL: 300000,     // 5 minutos (móvil conserva menos logs)
        DESKTOP: 60000     // 1 minuto (desktop limpia más frecuentemente)
    },
    
    // Suppress Warnings: limpieza de mensajes de error
    SUPPRESS: {
        MOVIL: 120000,     // 2 minutos
        DESKTOP: 300000    // 5 minutos
    }
};

// Make TTL_LIMPIEZA available to legacy scripts that expect a global variable
if (typeof window !== 'undefined') {
    try { window.TTL_LIMPIEZA = TTL_LIMPIEZA; } catch (e) { /* ignore in restricted environments */ }
}

/**
 * Tipos de mensajes para la comunicación entre iframes
 * Organizados por categorías para mejor mantenimiento
 */
export const TIPOS_MENSAJE = {
    SISTEMA: {
        INICIALIZACION: 'SISTEMA.INICIALIZACION',
        INICIALIZACION_COMPLETADA: 'SISTEMA.INICIALIZACION_COMPLETADA',
        ESTADO: 'SISTEMA.ESTADO',
        CAMBIO_MODO: 'SISTEMA.CAMBIO_MODO',
        CAMBIO_MODO_ENTENDIDO: 'SISTEMA.CAMBIO_MODO_ENTENDIDO',
        CAMBIO_MODO_EFECTUADO: 'SISTEMA.CAMBIO_MODO_EFECTUADO',
        CAMBIO_MODO_APLICADO: 'SISTEMA.CAMBIO_MODO_APLICADO',
        CAMBIO_MODO_RESPONSE: 'SISTEMA.CAMBIO_MODO_RESPONSE',
        COMPONENTE_INICIALIZADO: 'SISTEMA.COMPONENTE_INICIALIZADO',
        INICIALIZACION_FINALIZADA: 'SISTEMA.INICIALIZACION_FINALIZADA',
        PADRE_LISTO: 'SISTEMA.PADRE_LISTO',
        HIJO_LISTO: 'SISTEMA.HIJO_LISTO',
        HIJO_PREPARADO: 'SISTEMA.HIJO_PREPARADO',
        PADRE_DATOS: 'SISTEMA.PADRE_DATOS',
        PADRE_CONFIRMA_HIJO_LISTO: 'SISTEMA.PADRE_CONFIRMA_HIJO_LISTO',
        HIJO_FALLIDO: 'SISTEMA.HIJO_FALLIDO',
        HEARTBEAT: 'SISTEMA.HEARTBEAT',
        HEARTBEAT_START: 'SISTEMA.HEARTBEAT_START',
        HEARTBEAT_PAUSE: 'SISTEMA.HEARTBEAT_PAUSE',
        HEARTBEAT_ESTADO: 'SISTEMA.HEARTBEAT_ESTADO',
        HEARTBEAT_RESPONSE: 'SISTEMA.HEARTBEAT_RESPONSE',
        ALLOWED_ORIGIN_ADD: 'SISTEMA.ALLOWED_ORIGIN_ADD',
        ALLOWED_ORIGIN_REMOVE: 'SISTEMA.ALLOWED_ORIGIN_REMOVE',
        ALLOWED_ORIGINS_SET: 'SISTEMA.ALLOWED_ORIGINS_SET',
        ACK: 'SISTEMA.ACK',
        NACK: 'SISTEMA.NACK',
        ERROR: 'SISTEMA.ERROR',
        CONFIRMACION: 'SISTEMA.CONFIRMACION',
        NOTIFICACION: 'SISTEMA.NOTIFICACION',
        APLICACION_INICIALIZADA: 'SISTEMA.APLICACION_INICIALIZADA',
        REINTENTAR: 'SISTEMA.REINTENTAR',
        RESPUESTA_ESTADO: 'SISTEMA.RESPUESTA_ESTADO',
        ADVERTENCIA: 'SISTEMA.ADVERTENCIA'
    },
    NAVEGACION: {
        CAMBIO_PARADA: 'NAVEGACION.CAMBIO_PARADA',
        ESTABLECER_DESTINO: 'NAVEGACION.ESTABLECER_DESTINO',
        // ACTUALIZAR_POSICION: Eliminado - legacy code nunca usado (reemplazado por ACTUALIZAR_ESTADO)
        MOSTRAR_RUTA: 'NAVEGACION.MOSTRAR_RUTA',
        ACTUALIZAR_ESTADO: 'NAVEGACION.ACTUALIZAR_ESTADO',
        INICIAR: 'NAVEGACION.INICIAR',
        INICIADA: 'NAVEGACION.INICIADA',
        CANCELADA: 'NAVEGACION.CANCELADA',
        DESTINO_ESTABLECIDO: 'NAVEGACION.DESTINO_ESTABLECIDO',
        LLEGADA_DETECTADA: 'NAVEGACION.LLEGADA_DETECTADA',
        ERROR: 'NAVEGACION.ERROR',
        SOLICITAR_DESTINO: 'NAVEGACION.SOLICITAR_DESTINO',
        ESTADO: 'NAVEGACION.ESTADO',
        ESTADO_MAPA: 'NAVEGACION.ESTADO_MAPA',
        ESTADO_MAPA_ACTUALIZADO: 'NAVEGACION.ESTADO_MAPA_ACTUALIZADO',
        CENTRAR_EN_UBICACION: 'NAVEGACION.CENTRAR_EN_UBICACION',
        MOSTRAR_UBICACION_POLYLINE: 'NAVEGACION.MOSTRAR_UBICACION_POLYLINE',
        ACTUALIZAR_MARCADOR_USUARIO: 'NAVEGACION.ACTUALIZAR_MARCADOR_USUARIO', // Actualizar flecha azul del usuario
        VALIDAR_RANGO_PARADA: 'NAVEGACION.VALIDAR_RANGO_PARADA',
        USUARIO_FUERA_RANGO: 'NAVEGACION.USUARIO_FUERA_RANGO', // Usuario >5min fuera de rango (>50m)
        MOSTRAR_MAPA_COMPLETO: 'NAVEGACION.MOSTRAR_MAPA_COMPLETO',
        MOSTRAR_MAPA_JPG: 'NAVEGACION.MOSTRAR_MAPA_JPG',
        ENVIAR_PARADA_COMPLETADA: 'NAVEGACION.ENVIAR_PARADA_COMPLETADA',
        DIBUJAR_POLYLINE: 'NAVEGACION.DIBUJAR_POLYLINE',
        // GPS - Nuevos tipos para control GPS real
        GPS: {
            ACTIVAR: 'NAVEGACION.GPS.ACTIVAR',
            DESACTIVAR: 'NAVEGACION.GPS.DESACTIVAR',
            ESTADO: 'NAVEGACION.GPS.ESTADO',
            ESTADO_GLOBAL: 'NAVEGACION.GPS.ESTADO_GLOBAL',
            ESTADO_ACTUALIZADO: 'NAVEGACION.GPS.ESTADO_ACTUALIZADO',
            UBICACION_ACTUALIZADA: 'NAVEGACION.GPS.UBICACION_ACTUALIZADA',
            ERROR: 'NAVEGACION.GPS.ERROR',
            RESTRINGIDO: 'NAVEGACION.GPS.RESTRINGIDO'
        },
        PARADA_COMPLETADA: 'NAVEGACION.PARADA_COMPLETADA',
        // Datos de paradas para funciones-mapa
        SOLICITAR_DATOS_PARADAS: 'NAVEGACION.SOLICITAR_DATOS_PARADAS',
        RESPUESTA_DATOS_PARADAS: 'NAVEGACION.RESPUESTA_DATOS_PARADAS',
        // Consultas para cambio de parada
        SOLICITAR_COORDENADAS: 'NAVEGACION.SOLICITAR_COORDENADAS',
        RESPUESTA_COORDENADAS: 'NAVEGACION.RESPUESTA_COORDENADAS',
        CAMBIO_PARADA_CONFIRMADO: 'NAVEGACION.CAMBIO_PARADA_CONFIRMADO'
    },
    DATOS: {
        SOLICITAR_PARADAS: 'DATOS.SOLICITAR_PARADAS',
        RESPUESTA_PARADAS: 'DATOS.RESPUESTA_PARADAS',
        COORDENADAS_PARADAS: 'DATOS.COORDENADAS_PARADAS',
        COORDENADAS_PARADAS_REQUEST: 'DATOS.COORDENADAS_PARADAS_REQUEST',
        COORDENADAS_PARADAS_RESPONSE: 'DATOS.COORDENADAS_PARADAS_RESPONSE',
        SOLICITAR_DATOS: 'DATOS.SOLICITAR_DATOS',
        ACTUALIZACION_PARADA: 'DATOS.ACTUALIZACION_PARADA',
        // Retos - Agregados para hijo4
        SOLICITAR_RETO: 'DATOS.SOLICITAR_RETO',
        RESPUESTA_RETO: 'DATOS.RESPUESTA_RETO',
        SOLICITAR_RETOS: 'DATOS.SOLICITAR_RETOS',
        RESPUESTA_RETOS: 'DATOS.RESPUESTA_RETOS',
        // Datos de aventura - enviados por padre a hijos al iniciar
        CARGAR_COORDENADAS: 'DATOS.CARGAR_COORDENADAS',       // Padre → hijo2
        COORDENADAS_CARGADAS: 'DATOS.COORDENADAS_CARGADAS',   // hijo2 → Padre (confirmación)
        CARGAR_AUDIOS: 'DATOS.CARGAR_AUDIOS',                 // Padre → hijo3
        AUDIOS_CARGADOS: 'DATOS.AUDIOS_CARGADOS',             // hijo3 → Padre (confirmación)
        CARGAR_RETOS: 'DATOS.CARGAR_RETOS',                   // Padre → hijo4
        RETOS_CARGADOS: 'DATOS.RETOS_CARGADOS'                // hijo4 → Padre (confirmación)
    },
    AUDIO: {
        REPRODUCIR_REQUEST: 'AUDIO.REPRODUCIR_REQUEST',
        REPRODUCIR_RESPONSE: 'AUDIO.REPRODUCIR_RESPONSE',
        PAUSA_REQUEST: 'AUDIO.PAUSA_REQUEST',
        PAUSA_RESPONSE: 'AUDIO.PAUSA_RESPONSE',
        CONTROL_REQUEST: 'AUDIO.CONTROL_REQUEST',
        CONTROL_RESPONSE: 'AUDIO.CONTROL_RESPONSE',
        FIN_REPRODUCCION: 'AUDIO.FIN_REPRODUCCION',
        ERROR: 'AUDIO.ERROR',
        ESTADO_ACTUALIZADO: 'AUDIO.ESTADO_ACTUALIZADO',
        SOLICITAR_AUDIO: 'AUDIO.SOLICITAR_AUDIO',
        RESPUESTA_AUDIO: 'AUDIO.RESPUESTA_AUDIO'
    },
    CONTROL: {
        HABILITAR: 'CONTROL.HABILITAR',
        DESHABILITAR: 'CONTROL.DESHABILITAR',
        CAMBIAR_MODO: 'CONTROL.CAMBIAR_MODO',
        ESTADO: 'CONTROL.ESTADO',
        EJECUTAR: 'CONTROL.EJECUTAR',
        ROLLBACK: 'CONTROL.ROLLBACK'
    },
    RETO: {
        MOSTRAR: 'RETO.MOSTRAR',
        MOSTRADO: 'RETO.MOSTRADO',
        OCULTAR: 'RETO.OCULTAR',
        COMPLETADO: 'RETO.COMPLETADO',
        SOLICITAR_RETO: 'RETO.SOLICITAR_RETO'
    },
    UI: {
        NOTIFICACION: 'UI.NOTIFICACION',
        MODAL: 'UI.MODAL',
        ALERTA: 'UI.ALERTA',
        ACCION_USUARIO: 'UI.ACCION_USUARIO',
        CLOSE_MENUS: 'UI.CLOSE_MENUS',
        ACTUALIZACION: 'UI.ACTUALIZACION',
        MENUS_ESTADO_ACTUALIZADO: 'UI.MENUS_ESTADO_ACTUALIZADO'
    },
    MONITOREO: {
        EVENTO: 'MONITOREO.EVENTO',
        METRICA: 'MONITOREO.METRICA',
        APLICACION_INICIALIZADA: 'MONITOREO.APLICACION_INICIALIZADA',
        LOGGER_INICIALIZADO: 'MONITOREO.LOGGER_INICIALIZADO'
    },
    COORDINACION: {
        SOLICITAR_DATOS_HIJO: 'COORDINACION.SOLICITAR_DATOS_HIJO',
        RESPUESTA_DATOS_HIJO: 'COORDINACION.RESPUESTA_DATOS_HIJO',
        COORDINAR_ACCION: 'COORDINACION.COORDINAR_ACCION',
        ESTADO_COORDINACION: 'COORDINACION.ESTADO_COORDINACION',
        SINCRONIZAR_COMPONENTES: 'COORDINACION.SINCRONIZAR_COMPONENTES'
    },
    MAPA: {
        INVALIDAR_TAMAÑO: 'MAPA.INVALIDAR_TAMAÑO',
        SET_VIEW: 'MAPA.SET_VIEW',
        GET_CENTER: 'MAPA.GET_CENTER',
        ADD_MARKER: 'MAPA.ADD_MARKER',
        REMOVE_MARKER: 'MAPA.REMOVE_MARKER',
        CLEAR_LAYERS: 'MAPA.CLEAR_LAYERS'
    },
    // Tipos de mensaje para la página de selección (En-busca-del-tesoro)
    SELECCION: {
        IDIOMA_SELECCIONADO: 'SELECCION.IDIOMA_SELECCIONADO',
        AVENTURA_SELECCIONADA: 'SELECCION.AVENTURA_SELECCIONADA',
        INICIAR_AVENTURA: 'SELECCION.INICIAR_AVENTURA',
        TERMINOS_ACEPTADOS: 'SELECCION.TERMINOS_ACEPTADOS',
        SOLICITAR_ESTADO: 'SELECCION.SOLICITAR_ESTADO',
        RESPUESTA_ESTADO: 'SELECCION.RESPUESTA_ESTADO'
    }
};

/**
 * Códigos de error estandarizados
 * Organizados por categorías con rangos numéricos específicos
 */
export const ERRORES = {
    // Errores de validación (1000-1099)
    VALIDACION: {
        DATOS_INVALIDOS: {
            codigo: 1000,
            mensaje: 'Los datos proporcionados no son válidos',
            nivel: 'error'
        },
        PARAMETROS_FALTANTES: {
            codigo: 1001,
            mensaje: 'Faltan parámetros requeridos',
            nivel: 'error'
        },
        TIPO_MENSAJE_INVALIDO: {
            codigo: 1002,
            mensaje: 'Tipo de mensaje no válido',
            nivel: 'warning'
        },
        MENSAJE_INVALIDO: {
            codigo: 1003,
            mensaje: 'El formato del mensaje no es válido',
            nivel: 'error'
        },
        DESTINO_INVALIDO: {
            codigo: 1004,
            mensaje: 'El destino especificado no es válido',
            nivel: 'error'
        },
        IMPORTACION_FALLIDA: {
            codigo: 1005,
            mensaje: 'Fallo en la importación de módulo',
            nivel: 'error'
        }
    },
    
    // Errores de inicialización (1100-1199)
    INICIALIZACION: {
        MENSAJERIA: {
            codigo: 1100,
            mensaje: 'Error al inicializar el sistema de mensajería',
            nivel: 'error'
        },
        MAPA: {
            codigo: 1101,
            mensaje: 'Error al inicializar el mapa',
            nivel: 'error'
        },
        COMPONENTE: {
            codigo: 1102,
            mensaje: 'Error al inicializar el componente',
            nivel: 'error'
        }
    },
    
    // Errores de red/comunicación (1200-1299)
    COMUNICACION: {
        TIEMPO_ESPERA: {
            codigo: 1200,
            mensaje: 'Tiempo de espera agotado',
            nivel: 'error'
        },
        DESTINO_NO_DISPONIBLE: {
            codigo: 1201,
            mensaje: 'El destino no está disponible',
            nivel: 'warning'
        },
        MENSAJE_NO_ENTREGADO: {
            codigo: 1202,
            mensaje: 'No se pudo entregar el mensaje',
            nivel: 'error'
        }
    },
    
    // Errores de autenticación/autorización (1300-1399)
    AUTENTICACION: {
        NO_AUTORIZADO: {
            codigo: 201,
            mensaje: 'No autorizado para realizar esta acción'
        }
    },
    
    // Errores de recursos (300-399)
    RECURSO: {
        NO_ENCONTRADO: {
            codigo: 301,
            mensaje: 'Recurso no encontrado'
        },
        YA_EXISTE: {
            codigo: 302,
            mensaje: 'El recurso ya existe'
        }
    },
    
    // Errores del sistema (500-599)
    SISTEMA: {
        ERROR_INTERNO: {
            codigo: 500,
            mensaje: 'Error interno del servidor'
        },
        NO_IMPLEMENTADO: {
            codigo: 501,
            mensaje: 'Funcionalidad no implementada'
        },
        SERVICIO_NO_DISPONIBLE: {
            codigo: 503,
            mensaje: 'Servicio no disponible temporalmente'
        }
    }
};

/**
 * Estados de la aplicación
 */
export const ESTADOS = {
    INICIALIZANDO: 'inicializando',
    LISTO: 'listo',
    ERROR: 'error'
};

/**
 * Códigos de error
 */
export const CODIGOS_ERROR = {
    // Errores existentes
    INICIALIZACION: 'ERROR_INICIALIZACION',
    MENSAJERIA: 'ERROR_MENSAJERIA',
    MAPA: 'ERROR_MAPA',
    AUDIO: 'ERROR_AUDIO',
    
    // Nuevos códigos de error para monitoreo
    MONITOREO: {
        INICIALIZACION: 'ERROR_MONITOREO_INICIALIZACION',
        EVENTO_INVALIDO: 'ERROR_EVENTO_INVALIDO',
        METRICA_INVALIDA: 'ERROR_METRICA_INVALIDA',
        INFORME_FALLIDO: 'ERROR_INFORME_FALLIDO',
        DIAGNOSTICO_FALLIDO: 'ERROR_DIAGNOSTICO_FALLIDO',
        ALTA_LATENCIA: 'ADVERTENCIA_ALTA_LATENCIA',
        ALTA_MEMORIA: 'ADVERTENCIA_ALTA_MEMORIA',
        TASA_ERROR_ELEVADA: 'ADVERTENCIA_TASA_ERROR_ELEVADA'
    },
    RETO: 'ERROR_RETO',
    NAVEGACION: 'ERROR_NAVEGACION'
};

/**
 * Destinos para mensajería
 */
export const DESTINOS = {
    PADRE: 'padre',
    TODOS: 'todos'
};

/**
 * Clases CSS para los diferentes modos
 */
export const CSS_CLASES = {
    MODO_CASA: 'modo-casa',
    MODO_AVENTURA: 'modo-aventura',
    HIJO3_CONTAINER: 'hijo3-container'
};

// ❌ CONFIG_MENSAJERIA ELIMINADO - OBSOLETO
// mensajeria.js define su propio estadoMensajeria local para evitar dependencias circulares

/**
 * Construcción programática de la lista de tipos válidos.
 *
 * En lugar de mantener múltiples arrays duplicados, derivamos la
 * lista válida a partir de `TIPOS_MENSAJE` (fuente única de verdad).
 */
function _flattenTipos(obj) {
    const out = [];
    const seen = new Set();
    function recurse(v) {
        if (!v && v !== 0) return;
        if (typeof v === 'string') {
            if (!seen.has(v)) { seen.add(v); out.push(v); }
            return;
        }
        if (Array.isArray(v)) return v.forEach(recurse);
        if (typeof v === 'object') return Object.values(v).forEach(recurse);
    }
    recurse(obj);
    return out;
}

export const TIPOS_MENSAJE_VALIDOS = _flattenTipos(TIPOS_MENSAJE);

export default {
    LOG_LEVELS,
    MODOS,
    TIPOS_MENSAJE,
    ESTADOS,
    CODIGOS_ERROR,
    DESTINOS,
    CSS_CLASES
};
