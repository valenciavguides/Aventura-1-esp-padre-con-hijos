# Sistema de Protección Contra Carga Duplicada de Iframes

## Problema Resuelto

Los iframes de los hijos (hijo1-hamburguesa, hijo1-opciones, hijo2, hijo3, hijo4, hijo5) se cargaban **múltiples veces** desde diferentes puntos del código en `codigo-padre.html`, causando:
- Fallos de inicialización
- Comportamiento inconsistente
- Sobrecarga del sistema

### Puntos de carga duplicada anteriores:
1. `ejecutarInicializacionAutomatica()` - cargaba TODOS los hijos durante startup
2. `SELECCION.AVENTURA_SELECCIONADA` handler - llamaba a `cargarRestoDeiframes()`
3. `SELECCION.AVENTURA_CONFIRMADA` handler - asignaba `src` directamente a iframes
4. Sin protección contra cargas concurrentes o duplicadas

## Solución Implementada

### 1. Sistema de Protección Contra Duplicados

```javascript
// Set para trackear qué iframes ya fueron cargados
window.__HIJOS_CARGADOS = new Set();

// Flag mutex para evitar cargas concurrentes
window.__CARGA_EN_PROGRESO = false;
```

### 2. Función de Carga Única

```javascript
window.cargarIframeSiNoEstaCargado = async function(id, src) {
    // Verificar si ya está cargado
    if (window.__HIJOS_CARGADOS.has(id)) {
        return false; // Ya cargado, saltar
    }
    
    // Cargar iframe...
    
    // Marcar como cargado
    window.__HIJOS_CARGADOS.add(id);
    return true;
};
```

### 3. Función Centralizada para Cargar Todos los Hijos

```javascript
window.cargarTodosLosHijosCriticos = async function() {
    // Verificar mutex
    if (window.__CARGA_EN_PROGRESO) {
        return { exito: false, mensaje: 'Carga ya en progreso' };
    }
    
    window.__CARGA_EN_PROGRESO = true;
    
    try {
        const hijosConfig = [
            { id: 'hijo1-hamburguesa', src: 'botones-y-subfunciones-hamburguesa.html' },
            { id: 'hijo1-opciones', src: 'botones-y-subfunciones-opciones.html' },
            { id: 'hijo2', src: 'coordenadas-hijo2.html' },
            { id: 'hijo3', src: 'audio-hijo3.html' },
            { id: 'hijo4', src: 'retos-hijo4.html' },
            { id: 'hijo5', src: 'boton-casa-hijo5.html' }
        ];
        
        for (const hijo of hijosConfig) {
            await window.cargarIframeSiNoEstaCargado(hijo.id, hijo.src);
        }
        
        return { exito: true, resultados: {...} };
    } finally {
        window.__CARGA_EN_PROGRESO = false;
    }
};
```

### 4. Único Punto de Carga: SELECCION.INICIAR_AVENTURA

Los iframes hijos ahora se cargan ÚNICAMENTE en el controlador `SELECCION.INICIAR_AVENTURA`:

```javascript
window.registrarControladorSeguro(TIPOS_MENSAJE.SELECCION.INICIAR_AVENTURA, async (mensaje) => {
    // ... código existente ...
    
    // 🔥 CARGAR TODOS LOS IFRAMES HIJOS (ÚNICO PUNTO DE CARGA)
    const resultadoCarga = await window.cargarTodosLosHijosCriticos();
    
    // ... continuar con distribución de datos ...
});
```

### 5. Modificaciones en Funciones Existentes

#### `inicializarHijosCriticos()`
Ahora usa el sistema de protección:
```javascript
window.inicializarHijosCriticos = async function() {
    return await window.cargarTodosLosHijosCriticos();
};
```

#### `cargarIframeSoloSeleccion()`
Agregada protección contra duplicados:
```javascript
async function cargarIframeSoloSeleccion() {
    // ✅ Verificar si ya está cargado
    if (window.__HIJOS_CARGADOS.has('seleccion')) {
        return;
    }
    
    // ... código de carga ...
    
    // ✅ Marcar como cargado
    window.__HIJOS_CARGADOS.add('seleccion');
}
```

#### `ejecutarInicializacionAutomatica()`
Ahora carga SOLO el iframe de selección:
```javascript
// ✅ Cargar SOLO iframe de selección durante inicialización
// Los hijos se cargarán DESPUÉS en SELECCION.INICIAR_AVENTURA
await cargarIframeSoloSeleccion();
```

#### `SELECCION.AVENTURA_SELECCIONADA`
Eliminada la carga de iframes:
```javascript
// ✅ NOTA: Los iframes hijos se cargarán únicamente desde SELECCION.INICIAR_AVENTURA
// para evitar carga duplicada
```

#### `SELECCION.AVENTURA_CONFIRMADA`
Eliminada la carga de iframes:
```javascript
// ✅ NOTA: Los iframes se cargarán en SELECCION.INICIAR_AVENTURA
console.log('Aventura confirmada. Los iframes se cargarán al iniciar la aventura.');
```

## Flujo de Carga Actualizado

```
1. Inicio de Aplicación
   └─> ejecutarInicializacionAutomatica()
       └─> cargarIframeSoloSeleccion()
           └─> Carga SOLO 'seleccion' (En-busca-del-tesoro.html)

2. Usuario Selecciona Aventura
   └─> SELECCION.AVENTURA_SELECCIONADA
       └─> Solo distribuye datos (NO carga iframes)

3. Usuario Confirma Aventura
   └─> SELECCION.AVENTURA_CONFIRMADA
       └─> Solo guarda selección (NO carga iframes)

4. Usuario Inicia Aventura ⭐
   └─> SELECCION.INICIAR_AVENTURA
       └─> cargarTodosLosHijosCriticos()
           ├─> Verifica mutex (__CARGA_EN_PROGRESO)
           └─> Para cada hijo:
               └─> cargarIframeSiNoEstaCargado()
                   ├─> Verifica si ya está en __HIJOS_CARGADOS
                   ├─> Si NO: carga iframe y lo agrega al Set
                   └─> Si SÍ: salta la carga
```

## Beneficios

1. ✅ **Eliminación de carga duplicada**: Un iframe nunca se carga más de una vez
2. ✅ **Protección contra concurrencia**: El mutex previene cargas simultáneas
3. ✅ **Punto único de carga**: Fácil de mantener y depurar
4. ✅ **Carga lazy**: Los hijos se cargan solo cuando se inicia la aventura
5. ✅ **Mejor rendimiento**: Menor carga inicial, inicio más rápido
6. ✅ **Consistencia**: Comportamiento predecible y repetible

## Compatibilidad

- ✅ Mantiene compatibilidad con código existente
- ✅ No cambia el comportamiento final de la aplicación
- ✅ Solo optimiza y protege el proceso de carga

## Validación

- ✅ Code Review: Sin issues críticos
- ✅ Security Check: Sin vulnerabilidades detectadas
- ✅ Sintaxis JavaScript: Validada correctamente

## Archivo Modificado

- `codigo-padre.html` (236 líneas agregadas, 154 líneas eliminadas)

---

**Fecha de implementación**: 2026-02-04
**Autor**: GitHub Copilot Agent
