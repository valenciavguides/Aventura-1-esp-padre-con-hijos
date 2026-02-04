# Diagrama del Sistema de Protección Contra Carga Duplicada

## ANTES: Múltiples puntos de carga (PROBLEMA)

```
┌──────────────────────────────────────────────────────────────┐
│                    INICIO DE APLICACIÓN                      │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│           ejecutarInicializacionAutomatica()                 │
│                                                              │
│  Carga: seleccion + hijo1 + hijo2 + hijo3 + hijo4 + hijo5   │  ❌ PROBLEMA
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              SELECCION.AVENTURA_SELECCIONADA                 │
│                                                              │
│  Carga: hijo1 + hijo2 + hijo3 + hijo4 + hijo5               │  ❌ DUPLICADO
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              SELECCION.AVENTURA_CONFIRMADA                   │
│                                                              │
│  Carga: hijo1 + hijo2 + hijo3 + hijo4 + hijo5               │  ❌ DUPLICADO
└──────────────────────────────────────────────────────────────┘

Resultado: Los iframes se cargan 3 VECES ❌
```

## DESPUÉS: Único punto de carga (SOLUCIÓN)

```
┌──────────────────────────────────────────────────────────────┐
│                    INICIO DE APLICACIÓN                      │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│           ejecutarInicializacionAutomatica()                 │
│                                                              │
│  Carga: SOLO seleccion (En-busca-del-tesoro.html)           │  ✅ CORRECTO
│                                                              │
│  Los hijos NO se cargan aquí                                 │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              SELECCION.AVENTURA_SELECCIONADA                 │
│                                                              │
│  Solo distribuye datos                                       │  ✅ NO CARGA
│  NO carga iframes                                            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              SELECCION.AVENTURA_CONFIRMADA                   │
│                                                              │
│  Solo guarda selección                                       │  ✅ NO CARGA
│  NO carga iframes                                            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│           ⭐ SELECCION.INICIAR_AVENTURA ⭐                    │
│                                                              │
│  1. Verifica __CARGA_EN_PROGRESO (mutex)                    │
│  2. Llama a cargarTodosLosHijosCriticos()                   │
│  3. Para cada hijo:                                          │
│     └─> cargarIframeSiNoEstaCargado()                       │  ✅ ÚNICO PUNTO
│         ├─> Verifica __HIJOS_CARGADOS                       │
│         ├─> Si NO existe: CARGA y marca en Set              │
│         └─> Si SÍ existe: SALTA (no duplica)                │
│                                                              │
│  Carga: hijo1 + hijo2 + hijo3 + hijo4 + hijo5               │
└──────────────────────────────────────────────────────────────┘

Resultado: Los iframes se cargan 1 VEZ ✅
```

## Sistema de Protección

```
┌─────────────────────────────────────────────────────────────────┐
│                  SISTEMA DE PROTECCIÓN                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  window.__HIJOS_CARGADOS = Set(['hijo2', 'hijo3', ...])        │
│  └─> Trackea qué iframes ya fueron cargados                    │
│                                                                 │
│  window.__CARGA_EN_PROGRESO = true/false                       │
│  └─> Mutex para evitar cargas concurrentes                     │
│                                                                 │
│  cargarIframeSiNoEstaCargado(id, src)                          │
│  ├─> if (__HIJOS_CARGADOS.has(id)) return false;              │
│  ├─> // ... cargar iframe ...                                  │
│  └─> __HIJOS_CARGADOS.add(id);                                 │
│                                                                 │
│  cargarTodosLosHijosCriticos()                                 │
│  ├─> if (__CARGA_EN_PROGRESO) return "ya en progreso";        │
│  ├─> __CARGA_EN_PROGRESO = true;                              │
│  ├─> for cada hijo: cargarIframeSiNoEstaCargado()             │
│  └─> __CARGA_EN_PROGRESO = false;                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Ventajas del Nuevo Sistema

| Aspecto                | ANTES ❌             | DESPUÉS ✅          |
|------------------------|---------------------|---------------------|
| Puntos de carga        | 3 (duplicados)      | 1 (único)           |
| Protección duplicados  | NO                  | SÍ (Set + mutex)    |
| Carga inicial          | Todos los iframes   | Solo selección      |
| Rendimiento            | Lento               | Rápido (lazy)       |
| Mantenibilidad         | Difícil             | Fácil               |
| Fallos de init         | Frecuentes          | Eliminados          |
| Comportamiento         | Inconsistente       | Predecible          |
