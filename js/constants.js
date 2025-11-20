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
 * Tipos de mensajes para la comunicación entre iframes
 * Organizados por categorías para mejor mantenimiento
 */
export const TIPOS_MENSAJE = {
    SISTEMA: {
        INICIALIZACION: 'SISTEMA.INICIALIZACION',
        INICIALIZACION_COMPLETADA: 'SISTEMA.INICIALIZACION_COMPLETADA',
        ESTADO: 'SISTEMA.ESTADO',
        CAMBIO_MODO: 'SISTEMA.CAMBIO_MODO',
        COMPONENTE_INICIALIZADO: 'SISTEMA.COMPONENTE_INICIALIZADO',
        INICIALIZACION_FINALIZADA: 'SISTEMA.INICIALIZACION_FINALIZADA',
        PADRE_LISTO: 'SISTEMA.PADRE_LISTO',
        HIJO_LISTO: 'SISTEMA.HIJO_LISTO',
        PADRE_CONFIRMA_HIJO_LISTO: 'SISTEMA.PADRE_CONFIRMA_HIJO_LISTO',
        HIJO_FALLIDO: 'SISTEMA.HIJO_FALLIDO',
        HEARTBEAT: 'SISTEMA.HEARTBEAT',
        HEARTBEAT_RESPONSE: 'SISTEMA.HEARTBEAT_RESPONSE',
        PING: 'SISTEMA.PING',
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
        ACTUALIZAR_POSICION: 'NAVEGACION.ACTUALIZAR_POSICION',
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
        VALIDAR_RANGO_PARADA: 'NAVEGACION.VALIDAR_RANGO_PARADA',
        ENVIAR_PARADA_COMPLETADA: 'NAVEGACION.ENVIAR_PARADA_COMPLETADA',
        DIBUJAR_POLYLINE: 'NAVEGACION.DIBUJAR_POLYLINE',
        // GPS - Nuevos tipos para control GPS real
        GPS: {
            ACTIVAR: 'NAVEGACION.GPS.ACTIVAR',
            DESACTIVAR: 'NAVEGACION.GPS.DESACTIVAR',
            ESTADO: 'NAVEGACION.GPS.ESTADO',
            ESTADO_ACTUALIZADO: 'NAVEGACION.GPS.ESTADO_ACTUALIZADO',
            UBICACION_ACTUALIZADA: 'NAVEGACION.GPS.UBICACION_ACTUALIZADA',
            ERROR: 'NAVEGACION.GPS.ERROR',
            PERMISOS_DENEGADOS: 'NAVEGACION.GPS.PERMISOS_DENEGADOS',
            PERMITIDO: 'NAVEGACION.GPS.PERMITIDO',
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
        SOLICITAR_PARADA: 'DATOS.SOLICITAR_PARADA',
        RESPUESTA_PARADA: 'DATOS.RESPUESTA_PARADA',
        COORDENADAS_PARADAS: 'DATOS.COORDENADAS_PARADAS',
        COORDENADAS_PARADAS_REQUEST: 'DATOS.COORDENADAS_PARADAS_REQUEST',
        COORDENADAS_PARADAS_RESPONSE: 'DATOS.COORDENADAS_PARADAS_RESPONSE',
        SOLICITAR_DATOS: 'DATOS.SOLICITAR_DATOS',
        ACTUALIZACION_PARADA: 'DATOS.ACTUALIZACION_PARADA',
        // Retos - Agregados para hijo4
        SOLICITAR_RETO: 'DATOS.SOLICITAR_RETO',
        RESPUESTA_RETO: 'DATOS.RESPUESTA_RETO',
        SOLICITAR_RETOS: 'DATOS.SOLICITAR_RETOS',
        RESPUESTA_RETOS: 'DATOS.RESPUESTA_RETOS'
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

/**
 * Configuraciones de mensajería centralizadas para evitar dependencias circulares
 */
export const CONFIG_MENSAJERIA = {
    // Estado global de la mensajería
    ESTADO_INICIAL: {
        inicializado: false,
        manejadores: new Map(),
        mensajesPendientes: new Map(),
        tiempoEspera: 10000,
        maxReintentos: 3,
        mensajesProcesados: new Set(),
        estadisticas: {
            mensajesEnviados: 0,
            mensajesRecibidos: 0,
            errores: 0,
            totalTiempoRespuesta: 0,
            tiempoPromedioRespuesta: 0,
            ultimoError: null
        },
        instancias: new Map(),
        rol: 'hijo',
        estado: 'inactivo',
        timeouts: {},
        colaMensajes: [],
        procesandoCola: false,
        listenerRegistrado: false
    },
    
    // Sistema de heartbeat
    HEARTBEAT: {
        activo: false,
        intervalo: 5000, // 5 segundos
        timer: null,
        hijosConectados: new Set(),
        ultimoHeartbeat: new Map(),
        timeoutsHeartbeat: new Map(),
        reintentosMaximos: 3
    },
    
    // Limpieza automática con TTL sincronizado (30s)
    LIMPIEZA: {
        ttlMensajesProcesados: 30000, // 30s
        ttlPromesasPendientes: 30000, // 30s
        ttlHistorial: 30000, // 30s
        intervaloLimpieza: 30000, // 30s
        timerLimpieza: null
    }
};

/**
 * Tipos de mensaje válidos pregenerados para validación eficiente
 * Dividido en partes para evitar problemas de parsing con arrays largos
 */
const TIPOS_SISTEMA = [
    'SISTEMA.INICIALIZACION',
    'SISTEMA.INICIALIZACION_COMPLETADA',
    'SISTEMA.ESTADO',
    'SISTEMA.CAMBIO_MODO',
    'SISTEMA.COMPONENTE_INICIALIZADO',
    'SISTEMA.INICIALIZACION_FINALIZADA',
    'SISTEMA.PADRE_LISTO',
    'SISTEMA.HIJO_LISTO',
    'SISTEMA.HEARTBEAT',
    'SISTEMA.HEARTBEAT_RESPONSE',
    'SISTEMA.ACK',
    'SISTEMA.NACK',
    'SISTEMA.ERROR',
    'SISTEMA.CONFIRMACION',
    'SISTEMA.APLICACION_INICIALIZADA'
];

const TIPOS_NAVEGACION = [
    'NAVEGACION.CAMBIO_PARADA',
    'NAVEGACION.ESTABLECER_DESTINO',
    'NAVEGACION.ACTUALIZAR_POSICION',
    'NAVEGACION.MOSTRAR_RUTA',
    'NAVEGACION.ACTUALIZAR_ESTADO',
    'NAVEGACION.INICIAR',
    'NAVEGACION.INICIADA',
    'NAVEGACION.CANCELADA',
    'NAVEGACION.DESTINO_ESTABLECIDO',
    'NAVEGACION.LLEGADA_DETECTADA',
    'NAVEGACION.ERROR',
    'NAVEGACION.SOLICITAR_DESTINO',
    'NAVEGACION.ESTADO',
    'NAVEGACION.VALIDAR_RANGO_PARADA',
    'NAVEGACION.ENVIAR_PARADA_COMPLETADA',
    'NAVEGACION.DIBUJAR_POLYLINE'
];

const TIPOS_DATOS = [
    'DATOS.SOLICITAR_PARADAS',
    'DATOS.RESPUESTA_PARADAS',
    'DATOS.SOLICITAR_PARADA',
    'DATOS.RESPUESTA_PARADA',
    'DATOS.COORDENADAS_PARADAS',
    'DATOS.COORDENADAS_PARADAS_REQUEST',
    'DATOS.COORDENADAS_PARADAS_RESPONSE',
    'DATOS.SOLICITAR_DATOS',
    // Retos - hijo4
    'DATOS.SOLICITAR_RETO',
    'DATOS.RESPUESTA_RETO',
    'DATOS.SOLICITAR_RETOS',
    'DATOS.RESPUESTA_RETOS'
];

const TIPOS_AUDIO = [
    'AUDIO.REPRODUCIR',
    'AUDIO.PAUSA',
    'AUDIO.FIN_REPRODUCCION',
    'AUDIO.ERROR'
];

const TIPOS_CONTROL = [
    'CONTROL.HABILITAR',
    'CONTROL.DESHABILITAR',
    'CONTROL.CAMBIAR_MODO',
    'CONTROL.ESTADO'
];

const TIPOS_RETO = [
    'RETO.MOSTRAR',
    'RETO.OCULTAR',
    'RETO.COMPLETADO'
];

const TIPOS_UI = [
    'UI.NOTIFICACION',
    'UI.MODAL',
    'UI.ALERTA',
    'UI.ACCION_USUARIO',
    'UI.CLOSE_MENUS',
    'UI.ACTUALIZACION'
];

const TIPOS_MONITOREO = [
    'MONITOREO.EVENTO',
    'MONITOREO.METRICA',
    'MONITOREO.APLICACION_INICIALIZADA',
    'MONITOREO.LOGGER_INICIALIZADO'
];

const TIPOS_COORDINACION = [
    'COORDINACION.SOLICITAR_DATOS_HIJO',
    'COORDINACION.RESPUESTA_DATOS_HIJO',
    'COORDINACION.COORDINAR_ACCION',
    'COORDINACION.ESTADO_COORDINACION',
    'COORDINACION.SINCRONIZAR_COMPONENTES'
];

const TIPOS_MAPA = [
    'MAPA.INVALIDAR_TAMAÑO',
    'MAPA.SET_VIEW',
    'MAPA.GET_CENTER',
    'MAPA.ADD_MARKER',
    'MAPA.REMOVE_MARKER',
    'MAPA.CLEAR_LAYERS'
];

export const TIPOS_MENSAJE_VALIDOS = [
    ...TIPOS_SISTEMA,
    ...TIPOS_NAVEGACION,
    ...TIPOS_DATOS,
    ...TIPOS_AUDIO,
    ...TIPOS_CONTROL,
    ...TIPOS_RETO,
    ...TIPOS_UI,
    ...TIPOS_MONITOREO,
    ...TIPOS_COORDINACION,
    ...TIPOS_MAPA
];

export default {
    LOG_LEVELS,
    MODOS,
    TIPOS_MENSAJE,
    ESTADOS,
    CODIGOS_ERROR,
    DESTINOS,
    CSS_CLASES
};
