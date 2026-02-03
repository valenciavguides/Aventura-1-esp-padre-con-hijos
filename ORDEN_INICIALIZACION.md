# Orden de Inicialización de la Aplicación Valencia VGuides

## Resumen Ejecutivo

La aplicación sigue un orden de inicialización en **dos fases**:
1. **Fase 1 (Arranque inicial)**: Carga del padre y la pantalla de selección
2. **Fase 2 (Post-selección)**: Carga de los hijos funcionales después de que el usuario selecciona aventura e idioma

---

## FASE 1: ARRANQUE INICIAL (desde minuto 0)

### Paso 1: Entrada por index.html
- El usuario accede a `index.html`
- Este archivo **no tiene dependencias** porque es solo una página de redirección
- Inmediatamente redirige al navegador hacia `codigo-padre.html` usando meta-refresh y JavaScript

### Paso 2: Carga de codigo-padre.html (El Padre)
El archivo `codigo-padre.html` comienza a cargarse. Este es el **componente central** de toda la aplicación.

#### 2.1 Carga de recursos externos (CDN)
- Se cargan los archivos CSS y JS de **Leaflet** (librería de mapas) desde unpkg.com
- Se carga **leaflet-rotate** y **leaflet-geometryutil** (extensiones del mapa)
- Estos recursos **no dependen de nada interno** de la aplicación

#### 2.2 Creación de stubs globales
Antes de cargar cualquier módulo JS propio, el padre crea "stubs" (funciones vacías que se llenarán después):
- `window.activarGPS` - stub que encola llamadas hasta que la implementación real esté lista
- `window.ejecutarValidacion` - stub para validaciones de retos
- `window.getPadreId` - función que devuelve el ID del padre
- `window.handleIframeError` y `window.handleIframeLoad` - manejadores de eventos para iframes

Estos stubs **no dependen de nada** y permiten que código posterior pueda referenciar estas funciones aunque aún no estén completamente implementadas.

#### 2.3 Listener de mensajes global
Se registra un `window.addEventListener('message')` para escuchar mensajes de los hijos. Este listener **no depende de ningún módulo** porque usa JavaScript puro.

#### 2.4 Evento DOMContentLoaded
Cuando el DOM está completamente cargado, se ejecuta el listener unificado que:
- Crea el contenedor `#mapa` si no existe
- Inicializa `toggleRotationMessage` para orientación
- Registra el handler del backdrop

### Paso 3: Carga de Módulos JavaScript (ES Modules)

Los módulos se cargan en el siguiente orden basado en sus dependencias:

#### 3.1 constants.js
- **No tiene dependencias** de otros módulos propios
- Define todas las constantes: `TIPOS_MENSAJE`, `MODOS`, `TTL_LIMPIEZA`, `ERRORES`, etc.
- Se expone en `window.constants` para acceso global

#### 3.2 logger.js
- **Depende de**: `constants.js` (para niveles de log)
- Proporciona sistema de logging unificado

#### 3.3 device-detection.js
- **No tiene dependencias** de módulos propios
- Detecta si es móvil/desktop

#### 3.4 utils.js
- **Depende de**: `constants.js`
- Proporciona funciones utilitarias: `generarIdUnico`, `getPadreId`, `normalizarParadas`, etc.

#### 3.5 state-manager.js
- **No tiene dependencias** de módulos propios (usa clases internas)
- Proporciona gestión centralizada del estado con mutexes
- Se expone en `window.__stateManager` y `window.__vv_stateManager`

#### 3.6 mensajeria.js
- **Depende de**: `constants.js`, `logger.js`, `utils.js`, `device-detection.js`
- Sistema de comunicación entre padre e hijos
- Al cargar, **expone inmediatamente** `window.mensajeria`
- **Dispara el evento `mensajeriaReady`** para notificar que está disponible

#### 3.7 monitoreo.js
- **Depende de**: `constants.js`, `logger.js`, `utils.js`
- Sistema de métricas y monitoreo

#### 3.8 funciones-mapa.js
- **Depende de**: `constants.js`, `logger.js`, `utils.js`, `mensajeria.js`
- Funciones del mapa Leaflet
- Se expone en `window.funcionesMapa`

#### 3.9 aventuras-ID-padre.js, coordenadas-aventuras.js, audios-aventuras.js, retos-aventuras.js
- **Dependen de**: módulos básicos
- Contienen los datos de las aventuras
- Se exponen en `window.__vv_DATOS_AVENTURAS`, `window.__vv_AUDIOS_AVENTURAS`, `window.__vv_RETOS_AVENTURAS`

### Paso 4: Inicialización Automática del Sistema

Una vez cargados todos los módulos, se ejecuta `ejecutarInicializacionAutomatica()`:

#### 4.1 Esperar Leaflet y el Mapa
- Función `waitForLeafletAndInitialize()` espera hasta que `L.map` esté disponible
- Llama a `initializeMap()` que crea la instancia del mapa con centro en Valencia
- **El mapa no depende de los hijos**, solo de Leaflet

#### 4.2 Cargar iframe de Selección (En-busca-del-tesoro.html)
- Función `cargarIframeSoloSeleccion()` carga **SOLO** la página de selección
- El iframe `seleccion` tiene `src="En-busca-del-tesoro.html"`
- Se hace visible (display: block)

### Paso 5: Inicialización de En-busca-del-tesoro.html (Selección)

Cuando el iframe de selección carga:

#### 5.1 El hijo registra sus controladores
- Registra controladores para: `PADRE_LISTO`, `PADRE_DATOS`, `PADRE_CONFIRMA_HIJO_LISTO`
- **Estos controladores deben registrarse ANTES de enviar HIJO_PREPARADO**

#### 5.2 El hijo envía HIJO_PREPARADO al padre
- **Mensaje enviado**: `SISTEMA.HIJO_PREPARADO`
- **Origen**: `seleccion`
- **Destino**: `padre`
- **Contenido**: versión y capacidades del hijo

#### 5.3 El padre recibe HIJO_PREPARADO
- El padre marca al hijo como "preparado" en `estadoPadre.hijosPreparados`
- El padre **envía ACK** confirmando recepción

#### 5.4 El padre solicita manejadores (migración)
- **Mensaje enviado**: `SISTEMA.PADRE_PIDE_MANEJADORES`
- El hijo responde con **HIJO_MANEJADORES** listando qué tipos de mensaje puede manejar
- El padre crea proxies para reenviar mensajes al hijo

#### 5.5 El padre envía PADRE_LISTO
- **Mensaje enviado**: `SISTEMA.PADRE_LISTO`
- **Contenido**: versión del padre, timestamp, modo actual (casa)

#### 5.6 El hijo recibe PADRE_LISTO y responde con HIJO_LISTO
- El hijo procesa el mensaje y **envía** `SISTEMA.HIJO_LISTO`
- **Contenido**: versión, capacidades, tiempo de inicialización

#### 5.7 El padre confirma con PADRE_CONFIRMA_HIJO_LISTO
- El padre recibe HIJO_LISTO y actualiza `estadoPadre.hijosInicializados`
- **Mensaje enviado**: `SISTEMA.PADRE_CONFIRMA_HIJO_LISTO`

#### 5.8 El hijo muestra su UI
- Al recibir `PADRE_CONFIRMA_HIJO_LISTO`, el hijo habilita `_uiConfirmado = true`
- Llama a `mostrarUI()` para hacer visible la interfaz de selección
- **El usuario ahora puede ver la pantalla de selección de idioma**

### Paso 6: Remover Overlay de Carga
- El sistema está inicializado
- Se remueve el `#loading-overlay` con animación de fade-out
- Se quita la clase `loading` del body
- **El usuario ve la página de selección de aventura**

---

## FASE 2: DESPUÉS DE SELECCIONAR AVENTURA E IDIOMA

### Paso 7: Usuario Selecciona Idioma
- El usuario hace clic en una bandera (ej: España para español)
- **Mensaje enviado por selección**: `SELECCION.IDIOMA_SELECCIONADO`
- **Contenido**: `{ idioma: 'es', timestamp }`
- El padre almacena el idioma en `estadoPadre.seleccion.idioma`

### Paso 8: Usuario Selecciona Aventura
- El usuario hace clic en una aventura (ej: "Aventura1")
- **Mensaje enviado por selección**: `SELECCION.AVENTURA_SELECCIONADA`
- **Contenido**: `{ aventura: 'Aventura1', idioma: 'es', timestamp }`
- El padre almacena en `estadoPadre.seleccion.aventura`

### Paso 9: Distribución de Datos de Aventura
- El padre ejecuta `distribuirDatosAventura(aventura, idioma)`
- Prepara coordenadas, audios y retos para los hijos
- **Estos datos se enviarán cuando los hijos estén listos**

### Paso 10: Cargar Resto de iframes (cargarRestoDeiframes)
Se cargan secuencialmente:
1. `hijo1-hamburguesa` ← `botones-y-subfunciones-hamburguesa.html`
2. `hijo1-opciones` ← `botones-y-subfunciones-opciones.html`
3. `hijo2` ← `coordenadas-hijo2.html`
4. `hijo3` ← `audio-hijo3.html`
5. `hijo4` ← `retos-hijo4.html`

**Para cada hijo, el proceso es:**

#### 10.1 El hijo carga y registra controladores
- El hijo registra controladores para `PADRE_DATOS`, `PADRE_CONFIRMA_HIJO_LISTO`, etc.
- **Importante**: Los controladores se registran ANTES de enviar HIJO_PREPARADO

#### 10.2 Handshake hijo → padre
- **El hijo envía**: `SISTEMA.HIJO_PREPARADO` (indica que está listo para recibir datos)
- **El padre responde con ACK**
- **El padre envía**: `SISTEMA.PADRE_DATOS` (con modo actual: casa o aventura)
- **El hijo recibe PADRE_DATOS** y procesa la información
- **El hijo envía**: `SISTEMA.HIJO_LISTO` (confirma inicialización completa)
- **El padre responde**: `SISTEMA.PADRE_CONFIRMA_HIJO_LISTO`
- **El hijo habilita UI** al recibir la confirmación

### Paso 11: Cargar hijo5 (cargarHijoCasa)
- Se carga `hijo5` ← `boton-casa-hijo5.html`
- Sigue el mismo handshake que los demás hijos:
  - HIJO_PREPARADO → ACK → PADRE_DATOS → HIJO_LISTO → PADRE_CONFIRMA_HIJO_LISTO

### Paso 12: Envío de Datos Específicos de Aventura

Una vez todos los hijos están inicializados:

#### 12.1 Coordenadas a hijo2
- **Mensaje**: `DATOS.CARGAR_COORDENADAS`
- **Destino**: `hijo2`
- **Contenido**: Array de coordenadas de la aventura seleccionada

#### 12.2 Audios a hijo3
- **Mensaje**: `DATOS.CARGAR_AUDIOS`
- **Destino**: `hijo3`
- **Contenido**: Lista de archivos de audio para la aventura

#### 12.3 Retos a hijo4
- **Mensaje**: `DATOS.CARGAR_RETOS`
- **Destino**: `hijo4`
- **Contenido**: Retos/preguntas para cada parada

#### 12.4 Confirmación de carga
Cada hijo responde cuando ha procesado los datos:
- hijo2 responde: `DATOS.COORDENADAS_CARGADAS`
- hijo3 responde: `DATOS.AUDIOS_CARGADOS`
- hijo4 responde: `DATOS.RETOS_CARGADOS`

### Paso 13: Sistema Completamente Operativo

- `window.sistemaInicializado = true`
- Todos los hijos están en `estadoPadre.hijosInicializados`
- El mapa está visible con la ruta de la aventura
- Los botones de navegación (hijo2) están activos
- El reproductor de audio (hijo3) está listo
- Los retos (hijo4) están cargados
- El botón casa (hijo5) permite cambiar entre modos

---

## Diagrama de Secuencia de Mensajes

```
ARRANQUE INICIAL:
==================
index.html ──redirección──▶ codigo-padre.html

codigo-padre.html:
  1. Carga CDN (Leaflet)
  2. Crea stubs globales
  3. Carga módulos JS en orden de dependencias:
     constants.js → logger.js → utils.js → state-manager.js → mensajeria.js → ...
  4. Inicializa mapa
  5. Carga iframe selección

HANDSHAKE CON SELECCIÓN (PATRÓN ESTANDARIZADO):
================================================
seleccion                                    padre
    │                                           │
    │──── SISTEMA.HIJO_PREPARADO ──────────────▶│
    │◀─── SISTEMA.ACK ─────────────────────────│
    │◀─── SISTEMA.PADRE_PIDE_MANEJADORES ──────│
    │──── SISTEMA.HIJO_MANEJADORES ────────────▶│
    │◀─── SISTEMA.PADRE_APLICA_MANEJADORES ────│
    │◀─── SISTEMA.PADRE_DATOS ─────────────────│  ← Mensaje estandarizado (antes era PADRE_LISTO)
    │──── SISTEMA.HIJO_LISTO ──────────────────▶│
    │◀─── SISTEMA.PADRE_CONFIRMA_HIJO_LISTO ───│
    │                                           │
    [Usuario ve pantalla de selección]          │

NOTA: PADRE_LISTO se mantiene para compatibilidad pero HIJO_LISTO
      solo se envía en respuesta a PADRE_DATOS para evitar duplicados.

SELECCIÓN DE AVENTURA:
======================
seleccion                                    padre
    │                                           │
    │──── SELECCION.IDIOMA_SELECCIONADO ───────▶│
    │──── SELECCION.AVENTURA_SELECCIONADA ─────▶│
    │                                           │
    │                    [padre carga hijos 1-5]│

HANDSHAKE CON CADA HIJO (x5) - PATRÓN ESTANDARIZADO:
====================================================
hijo(N)                                      padre
    │                                           │
    │──── SISTEMA.HIJO_PREPARADO ──────────────▶│
    │◀─── SISTEMA.ACK ─────────────────────────│
    │◀─── SISTEMA.PADRE_DATOS ─────────────────│  ← Envía HIJO_LISTO SOLO aquí
    │──── SISTEMA.HIJO_LISTO ──────────────────▶│
    │◀─── SISTEMA.PADRE_CONFIRMA_HIJO_LISTO ───│
    │                                           │

DISTRIBUCIÓN DE DATOS:
======================
padre                                        hijos
    │                                           │
    │──── DATOS.CARGAR_COORDENADAS ────────────▶│ hijo2
    │◀─── DATOS.COORDENADAS_CARGADAS ──────────│
    │                                           │
    │──── DATOS.CARGAR_AUDIOS ─────────────────▶│ hijo3
    │◀─── DATOS.AUDIOS_CARGADOS ───────────────│
    │                                           │
    │──── DATOS.CARGAR_RETOS ──────────────────▶│ hijo4
    │◀─── DATOS.RETOS_CARGADOS ────────────────│
    │                                           │
    [Sistema completamente operativo]           │
```

---

## Notas Importantes

1. **Orden de registro de controladores**: Cada hijo debe registrar sus controladores ANTES de enviar HIJO_PREPARADO, para asegurar que puede recibir la respuesta del padre.

2. **Comunicación centralizada**: Todos los mensajes pasan por el sistema de mensajería (`mensajeria.js`) que se apoya en `postMessage` para comunicación entre iframes.

3. **Bidireccionalidad verificada**: Cada mensaje importante tiene una respuesta de confirmación (ACK, HIJO_LISTO, etc.)

4. **No hay duplicados de controladores**: El sistema `registrarControladorSeguro` usa un Set (`__CONTROLADOR_REGISTRADOS`) para evitar registros duplicados.

5. **Carga diferida de hijos**: Los hijos funcionales (1-5) solo se cargan DESPUÉS de que el usuario selecciona aventura, optimizando el tiempo de carga inicial.

6. **UI bloqueada hasta confirmación**: Cada hijo oculta su UI con `mostrarUI()` hasta recibir `PADRE_CONFIRMA_HIJO_LISTO`, evitando que el usuario vea elementos parcialmente cargados.

7. **Patrón estandarizado PADRE_DATOS → HIJO_LISTO**: Todos los hijos envían `HIJO_LISTO` únicamente en respuesta a `PADRE_DATOS` (no `PADRE_LISTO`). Esto crea consistencia y evita mensajes duplicados. Cada hijo tiene un flag `hijoListoEnviado` para garantizar un solo envío.
