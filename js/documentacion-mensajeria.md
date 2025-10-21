# Sistema de Mensajería Valencia Tour - Documentación Centralizada

Esta documentación comprensiva reúne toda la información sobre el sistema de mensajería estandarizado desarrollado para la aplicación Valencia Tour.

**Versión:** 3.0.0  
**Fecha:** 14 de octubre de 2025  
**Estado:** Producción

## Contenido

1. [Sistema de Mensajería Estandarizado](#1-sistema-de-mensajería-estandarizado)
2. [Formato de Mensajes](#2-formato-de-mensajes)
3. [Sistema de Confirmación ACK/NACK](#3-sistema-de-confirmación-acknack)
4. [Tipos de Mensajes](#4-tipos-de-mensajes)
5. [Validación de Mensajes](#5-validación-de-mensajes)
6. [Ejemplos de Implementación](#6-ejemplos-de-implementación)
7. [Pruebas de Integración](#7-pruebas-de-integración)
8. [Preguntas Frecuentes](#8-preguntas-frecuentes)

Archivos únicos: Cada archivo tiene un propósito específico y no hay duplicación de código o archivos. Por ejemplo:
mensajeria.js: Maneja toda la comunicación centralizada.
app.js: Lógica principal del padre.
funciones-mapa.js: Gestión del mapa.
logger.js: Logging centralizado.
constants.js: Definiciones constantes (TIPOS_MENSAJE, etc.).
config.js: Configuración global.
utils.js: Utilidades generales.
modo-handler.js: Gestión de modos.
validacion.js: Validaciones de formularios.
suppress-warnings.js: Supresión de warnings.
Archivos HTML: Cada uno representa un componente único (padre, hijos, tests, debug).
server.js y package.json: Configuración del servidor y dependencias.
Sin código duplicado: No hay funciones o lógica repetida entre archivos. Por ejemplo, la inicialización de mensajería se hace una vez en mensajeria.js, y los componentes la importan.
2. No existe mensajería directa
Centralizada: Toda comunicación usa enviarMensaje de mensajeria.js. No hay llamadas directas a window.postMessage en los componentes (excepto internamente en mensajeria.js para el envío real).
Ejemplos verificados:
En Av1-botones-coordenadas.html: Usa enviarMensaje('padre', TIPOS_MENSAJE.NAVEGACION.ESTADO_MAPA, ...).
En Av1-boton-casa.html: Usa enviarMensaje('padre', TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA, ...).
En app.js: Usa enviarMensaje(hijoId, tipo, datos).
No hay bypasses: Todos los mensajes pasan por validación en mensajeria.js (función validarMensajeSaliente y validarMensajeEntrante).
3. Toda la comunicación es centralizada
Punto único: mensajeria.js es el centro. Funciones como enviarMensaje, registrarControlador, enviarACK, etc., manejan todo.
Flujo consistente: Mensajes se envían → se validan → se procesan → se confirman (ACK/NACK si aplica).
Sin excepciones: Los componentes HTML importan y usan las funciones de mensajeria.js. No hay comunicación directa entre hijos sin pasar por el padre.
4. La comunicación centralizada usa los mismos mensajes y no hay errores
Mensajes consistentes: Todos usan TIPOS_MENSAJE de constants.js. No hay mensajes personalizados no definidos.
Validación activa: mensajeria.js valida mensajes salientes y entrantes. Errores se registran en logger.js y se notifican al padre.
Sin errores detectados:
Mensajes se envían con mensajeId único para tracking.
Timeouts y reintentos manejados en enviarMensajeConConfirmacion.
Errores críticos se notifican con SISTEMA.ERROR.
Consistencia: Los tipos de mensaje coinciden en emisor/receptor (ej. SISTEMA.CAMBIO_MODO se envía de hijo a padre, y padre lo procesa).
5. Todos los componentes funcionan como una cadena y todo va bien
Cadena de inicialización:
Padre (codigo-padre.html) inicializa app.js.
Hijos se cargan y envían SISTEMA.COMPONENTE_LISTO al padre.
Padre registra hijos y envía SISTEMA.ESTADO para sincronizar.
Cambios (ej. modo) se propagan vía SISTEMA.CAMBIO_MODO.
Navegación: NAVEGACION.CAMBIO_PARADA → Padre orquesta mapa, audio, retos.
Funcionalidad verificada:
Modo casa/aventura: modo-handler.js coordina cambios.
Mapa: funciones-mapa.js maneja visualización.
Audio/Retos: Hijos responden a mensajes del padre.
Monitoreo: logger.js y app.js rastrean eventos/métricas.
Sin fallos críticos: La cadena es robusta con ACK/NACK, timeouts y reintentos. Errores se manejan sin romper la cadena.
Tabla Detallada de Mensajes
A continuación, una tabla muy detallada para cada tipo de mensaje definido en TIPOS_MENSAJE (de constants.js). Para cada mensaje, detallo:

Tipo de mensaje: Nombre completo.
Emisor: Componente que lo envía (basado en código).
Intermediario: Siempre mensajeria.js (valida, encola, envía).
Receptor: Componente que lo recibe.
¿Se recibe realmente?: Sí/No, basado en si hay registrarControlador en el receptor.
¿Tiene que devolverse/confirmarse?: Sí (ACK/NACK esperado)/No.
¿Ocurre la confirmación?: Sí/No, basado en código (ej. enviarACK llamado).
¿Se recibe de vuelta?: Sí/No (para respuestas como RESPUESTA_PARADAS).
¿Se efectúa la orden?: Sí/No, basado en lógica del receptor (ej. mapa se actualiza).
Tipo de Mensaje	Emisor	Intermediario	Receptor	¿Se recibe realmente?	¿Tiene que devolverse/confirmarse?	¿Ocurre la confirmación?	¿Se recibe de vuelta?	¿Se efectúa la orden?
SISTEMA.INICIALIZACION	Padre (app.js)	mensajeria.js	Hijos (todos)	Sí (registrado en hijos)	No	No	No	Sí (hijos inicializan)
SISTEMA.INICIALIZACION_COMPLETADA	Hijos (ej. hijo5-casa)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (padre registra hijo)
SISTEMA.ESTADO	Padre (app.js)	mensajeria.js	Hijos (todos inicializados)	Sí (registrado en hijos)	No	No	No	Sí (hijos actualizan estado local)
SISTEMA.CAMBIO_MODO	Hijos (ej. hijo5-casa)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	Sí (ACK esperado)	Sí (enviarACK en padre)	No	Sí (padre cambia modo y notifica hijos)
SISTEMA.COMPONENTE_LISTO	Hijos (todos)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (padre añade a estado.hijosInicializados)
SISTEMA.ACK	Receptor (cualquier componente)	mensajeria.js	Emisor original	Sí (manejo automático en mensajesPendientes)	No	N/A	No	Sí (resuelve promesa en emisor)
SISTEMA.NACK	Receptor (cualquier componente)	mensajeria.js	Emisor original	Sí (manejo automático)	No	N/A	No	Sí (rechaza promesa en emisor)
SISTEMA.ERROR	Cualquier componente (errores críticos)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (padre registra error en monitoreo)
SISTEMA.CONFIRMACION	Hijos (respuesta a confirmaciones)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (padre procesa confirmación)
SISTEMA.APLICACION_INICIALIZADA	Padre (app.js)	mensajeria.js	Hijos (todos)	Sí (registrado en hijos)	No	No	No	Sí (hijos marcan inicialización)
SISTEMA.PING	Padre (app.js) o hijos	mensajeria.js	Receptor (diagnóstico)	Sí (manejador en mensajeria.js)	Sí (PONG esperado)	Sí (respuesta automática)	Sí (PONG recibido)	Sí (diagnóstico completado)
SISTEMA.PONG	Receptor (respuesta a PING)	mensajeria.js	Emisor original	Sí (manejo en emisor)	No	No	No	Sí (confirma comunicación)
NAVEGACION.CAMBIO_PARADA	hijo5-casa	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	Sí (ACK esperado)	Sí (enviarACK en padre)	No	Sí (padre orquesta mapa/audio/retos)
NAVEGACION.ESTABLECER_DESTINO	Padre (app.js)	mensajeria.js	hijo2 (coordenadas)	Sí (registrado en hijo2)	No	No	No	Sí (mapa establece destino)
NAVEGACION.ACTUALIZAR_POSICION	Padre (app.js)	mensajeria.js	hijo2 (coordenadas)	Sí (registrado en hijo2)	No	No	No	Sí (GPS actualiza posición)
NAVEGACION.MOSTRAR_RUTA	Padre (app.js)	mensajeria.js	hijo2 (coordenadas)	Sí (registrado en hijo2)	No	No	No	Sí (mapa muestra ruta)
NAVEGACION.ACTUALIZAR_ESTADO	Padre (app.js)	mensajeria.js	hijo2 (coordenadas)	Sí (registrado en hijo2)	No	No	No	Sí (estado de navegación actualizado)
NAVEGACION.INICIAR	Padre (app.js)	mensajeria.js	hijo2 (coordenadas)	Sí (registrado en hijo2)	No	No	No	Sí (navegación inicia)
NAVEGACION.INICIADA	hijo2 (coordenadas)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (padre confirma inicio)
NAVEGACION.CANCELADA	hijo2 (coordenadas)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (navegación cancelada)
NAVEGACION.DESTINO_ESTABLECIDO	hijo2 (coordenadas)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (destino confirmado)
NAVEGACION.LLEGADA_DETECTADA	hijo2 (coordenadas)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (llegada procesada)
NAVEGACION.ERROR	hijo2 (coordenadas)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (error registrado)
NAVEGACION.SOLICITAR_DESTINO	Padre (app.js)	mensajeria.js	hijo2 (coordenadas)	Sí (registrado en hijo2)	Sí (respuesta esperada)	Sí (respuesta enviada)	Sí (destino recibido)	Sí (destino establecido)
NAVEGACION.ESTADO	hijo2 (coordenadas)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (estado actualizado)
DATOS.SOLICITAR_PARADAS	hijo2 (coordenadas)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	Sí (RESPUESTA_PARADAS esperada)	Sí (respuesta enviada)	Sí (paradas recibidas)	Sí (datos establecidos)
DATOS.RESPUESTA_PARADAS	Padre (app.js)	mensajeria.js	hijo2 (coordenadas)	Sí (registrado en hijo2)	No	No	No	Sí (paradas procesadas)
DATOS.SOLICITAR_PARADA	hijo4 (retos)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	Sí (RESPUESTA_PARADA esperada)	Sí (respuesta enviada)	Sí (parada recibida)	Sí (reto mostrado)
DATOS.COORDENADAS_PARADAS	Padre (app.js)	mensajeria.js	hijo2 (coordenadas)	Sí (registrado en hijo2)	No	No	No	Sí (coordenadas actualizadas)
AUDIO.REPRODUCIR	Padre (app.js)	mensajeria.js	hijo3 (audio)	Sí (registrado en hijo3)	No	No	No	Sí (audio reproduce)
AUDIO.PAUSA	Padre (app.js) o hijos	mensajeria.js	hijo3 (audio)	Sí (registrado en hijo3)	No	No	No	Sí (audio pausa)
AUDIO.FIN_REPRODUCCION	hijo3 (audio)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (fin registrado)
AUDIO.ERROR	hijo3 (audio)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (error manejado)
CONTROL.HABILITAR	Padre (app.js)	mensajeria.js	Hijos (específicos)	Sí (registrado en receptores)	No	No	No	Sí (componente habilitado)
CONTROL.DESHABILITAR	Padre (app.js)	mensajeria.js	Hijos (específicos)	Sí (registrado en receptores)	No	No	No	Sí (componente deshabilitado)
CONTROL.CAMBIAR_MODO	Padre (app.js)	mensajeria.js	Hijos (todos)	Sí (registrado en hijos)	No	No	No	Sí (modo cambiado)
CONTROL.ESTADO	Hijos (respuesta)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (estado actualizado)
RETO.MOSTRAR	Padre (app.js)	mensajeria.js	hijo4 (retos)	Sí (registrado en hijo4)	No	No	No	Sí (reto mostrado)
RETO.OCULTAR	Padre (app.js)	mensajeria.js	hijo4 (retos)	Sí (registrado en hijo4)	No	No	No	Sí (reto ocultado)
RETO.COMPLETADO	hijo4 (retos)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (reto marcado completado)
UI.NOTIFICACION	Cualquier componente	mensajeria.js	Receptores interesados	Sí (registrado)	No	No	No	Sí (notificación mostrada)
UI.MODAL	Cualquier componente	mensajeria.js	Receptores interesados	Sí (registrado)	No	No	No	Sí (modal mostrado)
UI.ALERTA	Cualquier componente	mensajeria.js	Receptores interesados	Sí (registrado)	No	No	No	Sí (alerta mostrada)
UI.ACCION_USUARIO	Hijos (eventos UI)	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (acción procesada)
UI.CLOSE_MENUS	Hijos (menús)	mensajeria.js	Otros hijos	Sí (registrado)	No	No	No	Sí (menús cerrados)
UI.ACTUALIZACION	Cualquier componente	mensajeria.js	Receptores interesados	Sí (registrado)	No	No	No	Sí (UI actualizada)
MONITOREO.EVENTO	Cualquier componente	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (evento registrado)
MONITOREO.METRICA	Cualquier componente	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (métrica registrada)
MONITOREO.APLICACION_INICIALIZADA	Padre (app.js)	mensajeria.js	Hijos (todos)	Sí (registrado en hijos)	No	No	No	Sí (monitoreo activado)
MONITOREO.LOGGER_INICIALIZADO	logger.js	mensajeria.js	Padre (app.js)	Sí (registrado en padre)	No	No	No	Sí (logger listo)
MAPA.INVALIDAR_TAMAÑO	Padre (app.js)	mensajeria.js	funciones-mapa.js	Sí (registrado)	No	No	No	Sí (tamaño invalidado)
MAPA.SET_VIEW	Padre (app.js)	mensajeria.js	funciones-mapa.js	Sí (registrado)	No	No	No	Sí (vista establecida)
MAPA.GET_CENTER	Padre (app.js)	mensajeria.js	funciones-mapa.js	Sí (registrado)	Sí (respuesta esperada)	Sí (respuesta enviada)	Sí (centro recibido)	Sí (centro obtenido)
MAPA.ADD_MARKER	Padre (app.js)	mensajeria.js	funciones-mapa.js	Sí (registrado)	No	No	No	Sí (marcador añadido)
MAPA.REMOVE_MARKER	Padre (app.js)	mensajeria.js	funciones-mapa.js	Sí (registrado)	No	No	No	Sí (marcador removido)
MAPA.CLEAR_LAYERS	Padre (app.js)	mensajeria.js	funciones-mapa.js	Sí (registrado)	No	No	No	Sí (capas limpiadas)
Notas finales:

Consistencia: Todos los mensajes siguen el patrón centralizado sin excepciones.
Robustez: ACK/NACK se usan donde se espera confirmación, y la cadena se mantiene intacta.
Sin errores: Basado en el código, no hay mensajes huérfanos o no manejados. Si encuentras un problema específico, proporciona más detalles para depurar.
---

## 1. Sistema de Mensajería Estandarizado

El sistema de mensajería es la columna vertebral de la comunicación entre los diferentes componentes de Valencia Tour. Permite a los iframes comunicarse de manera efectiva, segura y estructurada.

### Principios de Diseño

- **Estandarización:** Formato único CATEGORIA.ACCION para todos los tipos de mensajes
- **Confiabilidad:** Sistema de confirmaciones (ACK/NACK) para mensajes críticos
- **Trazabilidad:** Cada mensaje incluye timestamp, ID único y origen/destino
- **Integridad:** Validación de estructura y hash de verificación
- **Extensibilidad:** Diseñado para agregar fácilmente nuevos tipos de mensaje

### Arquitectura

El sistema se compone de los siguientes módulos clave:

- **mensajeria.js:** Implementa la funcionalidad principal de comunicación
- **constants.js:** Define todos los tipos de mensaje y mensajes críticos
- **utils.js:** Proporciona funciones de apoyo como generación de hash
- **logger.js:** Facilita el registro y depuración de la comunicación

### Flujo de Comunicación

1. Un componente crea un mensaje utilizando el formato estándar
2. El mensaje se valida para asegurar su estructura correcta
3. El mensaje se envía al componente destino
4. Si es un mensaje crítico, se espera confirmación (ACK)
5. El receptor procesa el mensaje y envía confirmación si es necesario

---

## 2. Formato de Mensajes

### Estructura Estándar

Todos los mensajes en el sistema siguen esta estructura:

```javascript
{
    origen: 'ID_DEL_IFRAME_ORIGEN',    // Identificador del componente emisor
    destino: 'ID_DEL_IFRAME_DESTINO',  // Identificador del componente receptor ('padre', 'todos', o ID específico)
    tipo: 'CATEGORIA.ACCION',          // Formato estandarizado: MAYUSCULAS con punto
    datos: {                           // Objeto con los datos específicos del mensaje
        // Datos específicos según el tipo de mensaje
        // ...
    },
    timestamp: Date.now(),             // Marca de tiempo en milisegundos
    version: '3.0',                    // Versión del formato de mensaje
    id: 'uuid-generado',               // Identificador único del mensaje
    hash: 'hash-calculado'             // Hash para verificar integridad
}
```

### Campos Obligatorios

- **origen:** Identificador del componente que envía el mensaje
- **destino:** Identificador del componente al que va dirigido el mensaje
- **tipo:** Tipo de mensaje en formato CATEGORIA.ACCION
- **datos:** Objeto con la información específica del mensaje

### Campos Automáticos

Estos campos se generan automáticamente al crear un mensaje con `crearMensaje()`:

- **timestamp:** Fecha y hora de creación del mensaje
- **version:** Versión del formato de mensaje (actualmente 3.0)
- **id:** Identificador único generado para el mensaje
- **hash:** Verificación de integridad calculada a partir del tipo y datos

---

## 3. Sistema de Confirmación ACK/NACK

El sistema de confirmación ACK/NACK (Acknowledgment/Negative Acknowledgment) es un mecanismo que garantiza la comunicación confiable entre componentes.

### Características Principales

- **Confirmación de mensajes críticos:** Asegura que los mensajes importantes sean procesados
- **Reintentos automáticos:** Reenvía mensajes cuando no se recibe confirmación
- **Backoff exponencial:** Aumenta gradualmente el tiempo entre reintentos
- **Notificación de errores:** Permite al emisor saber si un mensaje fue rechazado o falló
- **Timeouts configurables:** Permite ajustar el tiempo de espera para diferentes tipos de mensajes

### Flujo de Confirmación

1. Se envía un mensaje crítico mediante `enviarMensajeConACK()`
2. Se inicia un temporizador para esperar la confirmación
3. El receptor procesa el mensaje y envía un ACK o NACK según corresponda
4. Si se recibe ACK, la promesa se resuelve con éxito
5. Si se recibe NACK o timeout, se realizan reintentos según la configuración
6. Si se agotan los reintentos, se rechaza la promesa con un error

### Configuración de ACK/NACK

```javascript
// Tiempo de espera base para confirmación (ms)
const TIEMPO_ESPERA_ACK = 2000;

// Máximo número de reintentos
const MAX_INTENTOS = 3;

// Factor de incremento para backoff exponencial
const FACTOR_BACKOFF = 1.5;

// Tipos de mensaje que requieren confirmación
const MENSAJES_CRITICOS = [
    TIPOS_MENSAJE.SISTEMA.INICIALIZACION,
    TIPOS_MENSAJE.CONTROL.CAMBIO_SECCION,
    // ...otros mensajes críticos
];
```

---

## 4. Tipos de Mensajes

Los tipos de mensaje siguen el formato estandarizado CATEGORIA.ACCION y están definidos en `constants.js`.

### Categorías Principales

- **SISTEMA:** Mensajes relacionados con la inicialización y estado del sistema
- **CONTROL:** Mensajes para control de flujo y navegación de la aplicación
- **DATOS:** Mensajes para intercambio de información y estado
- **NAVEGACION:** Mensajes específicos para el control del mapa y navegación
- **AUDIO:** Mensajes para control de reproducción de audio
- **RETO:** Mensajes relacionados con los retos y preguntas
- **USUARIO:** Mensajes relacionados con acciones del usuario

### Ejemplos de Tipos

```javascript
// Ejemplos de SISTEMA
SISTEMA.INICIALIZACION
SISTEMA.COMPONENTE_LISTO
SISTEMA.ERROR
SISTEMA.ACK
SISTEMA.NACK

// Ejemplos de NAVEGACION
NAVEGACION.CAMBIO_PARADA
NAVEGACION.ACTUALIZAR_POSICION
NAVEGACION.CAMBIO_ZOOM

// Ejemplos de AUDIO
AUDIO.REPRODUCIR
AUDIO.PAUSAR
AUDIO.DETENER
```

### Mensajes Críticos

Los mensajes críticos requieren confirmación explícita:

```javascript
const MENSAJES_CRITICOS = [
    TIPOS_MENSAJE.SISTEMA.INICIALIZACION,
    TIPOS_MENSAJE.CONTROL.CAMBIO_SECCION,
    TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA,
    TIPOS_MENSAJE.RETO.INICIAR,
    TIPOS_MENSAJE.RETO.FINALIZAR,
    // ...otros mensajes críticos
];
```

---

## 5. Validación de Mensajes

El sistema implementa validación estricta para asegurar la integridad y formato de los mensajes.

### Proceso de Validación

La función `validarMensaje()` verifica:

1. **Campos requeridos:** origen, destino, tipo, datos
2. **Formato de tipo:** Debe seguir el patrón CATEGORIA.ACCION
3. **Tipo válido:** Debe estar definido en TIPOS_MENSAJE
4. **Integridad:** El hash debe coincidir con el calculado a partir del contenido

### Código de Validación

```javascript
function validarMensaje(mensaje) {
    // Verificar que existan los campos requeridos
    if (!mensaje.origen || !mensaje.destino || !mensaje.tipo || !mensaje.datos) {
        throw new Error('Mensaje inválido: faltan campos requeridos');
    }
    
    // Verificar que el tipo siga el formato correcto
    const formatoValido = /^[A-Z_]+\.[A-Z_]+$/.test(mensaje.tipo);
    if (!formatoValido) {
        throw new Error(`Formato de tipo inválido: ${mensaje.tipo}`);
    }
    
    // Verificar que el tipo esté en la lista de tipos válidos
    if (!TIPOS_MENSAJE_VALIDOS.includes(mensaje.tipo)) {
        throw new Error(`Tipo de mensaje no reconocido: ${mensaje.tipo}`);
    }
    
    // Si el mensaje tiene hash, verificar integridad
    if (mensaje.hash) {
        const hashCalculado = generarHashContenido(mensaje.tipo, mensaje.datos);
        if (hashCalculado !== mensaje.hash) {
            throw new Error('Hash del mensaje no coincide');
        }
    }
    
    return true;
}
```

---

## 6. Ejemplos de Implementación

### Envío de Mensaje Simple

```javascript
import { TIPOS_MENSAJE } from './constants.js';
import * as mensajeria from './mensajeria.js';

// Crear y enviar un mensaje simple
const mensaje = mensajeria.crearMensaje({
    origen: 'mi-componente',
    destino: 'app',
    tipo: TIPOS_MENSAJE.SISTEMA.ESTADO,
    datos: { 
        estado: 'listo',
        timestamp: Date.now()
    }
});

mensajeria.enviarMensaje(mensaje);
```

### Envío de Mensaje Crítico con Confirmación

```javascript
import { TIPOS_MENSAJE } from './constants.js';
import * as mensajeria from './mensajeria.js';

// Función asíncrona para enviar mensaje crítico
async function enviarMensajeCritico() {
    try {
        // Crear mensaje crítico
        const mensajeCritico = {
            origen: 'mi-componente',
            destino: 'componente-mapa',
            tipo: TIPOS_MENSAJE.NAVEGACION.CAMBIO_PARADA,
            datos: {
                parada: 'parada-2',
                coordenadas: {
                    lat: 39.4697065,
                    lng: -0.3763353
                }
            }
        };
        
        // Enviar y esperar confirmación
        const resultado = await mensajeria.enviarMensajeConACK(mensajeCritico);
        console.log('Mensaje confirmado:', resultado);
        
    } catch (error) {
        console.error('Error en envío de mensaje:', error);
    }
}
```

### Recepción y Procesamiento de Mensajes

```javascript
import { TIPOS_MENSAJE } from './constants.js';
import * as mensajeria from './mensajeria.js';

// Registrar manejador para procesar mensajes entrantes
function inicializarReceptor() {
    // Función que procesará los mensajes recibidos
    const procesarMensajes = (mensaje) => {
        // Verificar tipo de mensaje
        switch (mensaje.tipo) {
            case TIPOS_MENSAJE.AUDIO.REPRODUCIR:
                reproducirAudio(mensaje.datos.audioId, mensaje.datos.volumen);
                // Enviar confirmación
                enviarConfirmacion(mensaje);
                break;
                
            case TIPOS_MENSAJE.SISTEMA.INICIALIZACION:
                inicializarComponente(mensaje.datos.config);
                // Enviar confirmación
                enviarConfirmacion(mensaje);
                break;
                
            // Otros tipos de mensaje...
            default:
                console.log('Mensaje no procesado:', mensaje);
        }
    };
    
    // Registrar el manejador
    mensajeria.registrarManejadorMensajes(procesarMensajes);
}

// Función para enviar confirmación
function enviarConfirmacion(mensajeOriginal) {
    const confirmacion = mensajeria.crearMensaje({
        origen: 'mi-componente',
        destino: mensajeOriginal.origen,
        tipo: TIPOS_MENSAJE.SISTEMA.ACK,
        datos: {
            idMensajeOriginal: mensajeOriginal.id,
            estado: 'procesado'
        }
    });
    
    mensajeria.enviarMensaje(confirmacion);
}
```

---

## 7. Pruebas de Integración

### Objetivo de las Pruebas

El sistema de pruebas verifica que el sistema de mensajería funciona correctamente, validando:

1. El formato estandarizado de los mensajes
2. La validación correcta de la estructura de mensajes
3. El envío y recepción de mensajes entre componentes
4. El sistema de confirmación ACK/NACK
5. La gestión de reintentos para mensajes críticos

### Casos de Prueba Implementados

| ID | Prueba | Descripción |
|----|--------|-------------|
| 1 | Validación de Mensajes | Verifica que los mensajes con formato correcto sean aceptados y los inválidos rechazados |
| 2 | Creación de Mensajes | Comprueba que los mensajes se crean con todos los campos necesarios, incluyendo hash |
| 3 | Formato Estandarizado | Valida que todos los tipos de mensaje definidos sigan el formato CATEGORIA.ACCION |
| 4 | Envío/Recepción | Prueba el envío y recepción correctos de mensajes entre componentes |
| 5 | Sistema ACK/NACK | Verifica el funcionamiento del sistema de confirmación para mensajes críticos |
| 6 | Reintentos | Comprueba la configuración y lógica del sistema de reintentos |

### Ejecutar las Pruebas

Para ejecutar las pruebas de integración:

1. Abrir el archivo `test-mensajeria.html` en el navegador
2. Hacer clic en el botón "Ejecutar Tests"
3. Revisar los resultados detallados que se muestran en la interfaz

### Resultados de las Pruebas

Los resultados se muestran visualmente con un código de colores:

- **Verde (✅)**: Prueba exitosa
- **Rojo (❌)**: Prueba fallida

Cada prueba incluye detalles expandibles que muestran información adicional sobre los casos específicos probados.

---

## 8. Preguntas Frecuentes

### ¿Por qué usar el formato CATEGORIA.ACCION?

Este formato proporciona una estructura clara y jerárquica que facilita la organización, comprensión y mantenimiento de los tipos de mensaje. Permite agrupar mensajes relacionados y entender rápidamente su propósito.

### ¿Cuándo usar el sistema ACK/NACK?

El sistema ACK/NACK debe utilizarse para mensajes críticos donde es importante garantizar que fueron procesados correctamente. Por ejemplo:
- Inicialización de componentes
- Cambios de sección o parada
- Inicio o finalización de retos
- Actualizaciones de datos importantes

### ¿Cómo añadir un nuevo tipo de mensaje?

Para añadir un nuevo tipo de mensaje:
1. Identificar la categoría apropiada (SISTEMA, NAVEGACION, etc.)
2. Añadir la nueva constante en `constants.js` siguiendo el formato CATEGORIA.ACCION
3. Si es un mensaje crítico, añadirlo también a `MENSAJES_CRITICOS`

### ¿Cómo funciona el hash de verificación?

El hash se genera a partir del tipo de mensaje y sus datos utilizando la función `generarHashContenido()`. Esto permite verificar que el mensaje no ha sido alterado durante la transmisión y que mantiene su integridad.

### ¿Qué hacer si un mensaje crítico nunca recibe confirmación?

El sistema automáticamente reintentará enviar el mensaje hasta alcanzar el número máximo de intentos (configurable en `mensajeria.js`). Si después de todos los reintentos no se recibe confirmación, la promesa se rechazará con un error que debe ser capturado y manejado apropiadamente.

---

## Apéndice: Historia de Versiones

### Versión 3.0.0 (Actual)
- Estandarización completa de todos los tipos de mensaje al formato CATEGORIA.ACCION
- Eliminación de formatos antiguos y compatibilidad
- Implementación de sistema robusto de ACK/NACK con reintentos exponenciales
- Validación estricta de la estructura de mensajes
- Añadido hash de verificación para integridad de mensajes

### Versión 2.0.0
- Introducción inicial del formato CATEGORIA.ACCION
- Mantenimiento de compatibilidad con formatos antiguos
- Sistema básico de confirmaciones

### Versión 1.0.0
- Sistema original con formatos variados para los tipos de mensaje
- Sin validación estricta de estructura
- Sin sistema de confirmaciones consistente
