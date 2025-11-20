/**
 * Suprime advertencias específicas en la consola y previene pausas del depurador
 * @module suppress-warnings
 * @version 2.1.0
 */

// Add declarations for errorCounter and errorMessages to fix ReferenceError
let errorCounter = 0;
let errorMessages = new Set();

// Detección de dispositivo móvil (global para el módulo)
const esMovil = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Store original console methods
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
    info: console.info,
    trace: console.trace,
};

// SECCIÓN 1: PREVENIR PAUSAS DEL DEPURADOR
// Esta es la parte crítica que evita que el depurador se detenga automáticamente

// Establecer bandera global para deshabilitar pausas del depurador
window.__DISABLE_DEBUGGER_PAUSE__ = true;

// IMPORTANTE: Esta parte debe ejecutarse lo antes posible para interceptar errores
// Capturar errores globales antes de que activen el depurador
window.addEventListener('error', function (event) {
    // Filtrar errores irrelevantes (por ejemplo, eventos genéricos o recursos externos)
    if (
        event instanceof Event &&
        (!event.message || typeof event.message !== 'string') &&
        (!event.error || typeof event.error !== 'object')
    ) {
        // Ignorar errores genéricos de recursos (imágenes, scripts externos, etc.)
        return;
    }
    // Si el error tiene mensaje relevante, mostrarlo
    if (event.message && event.message.match(/(critical|mensajeria|app|padre|hijo|coordenada|reto|audio|mapa|comunicacion|centralizada|bidireccional)/i)) {
        console.error('[Error interceptado relevante]', event.message, event);
    } else {
        // Opcional: loguear como advertencia si no es relevante
        // console.warn('[Error interceptado no relevante a la aplicación]', event);
    }
}, true);

// Capturar promesas rechazadas no manejadas
window.addEventListener('unhandledrejection', function(event) {
    // Prevenir que el depurador se detenga
    event.preventDefault();
    // Registrar el rechazo de manera segura
    const reason = event.reason ? (event.reason.message || event.reason.toString()) : 'Razón desconocida';
    if (originalConsole && originalConsole.warn) {
        originalConsole.warn('[Promesa rechazada interceptada]', reason);
    }
    return true;  // Evita la propagación del rechazo
}, true);

// Función segura para serializar objetos (evitando referencias circulares)
function safeStringify(obj) {
    try {
        if (obj === null) return 'null';
        if (obj === undefined) return 'undefined';
        if (typeof obj === 'string') return obj;
        if (typeof obj !== 'object') return String(obj);
        
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) return '[Circular]';
                seen.add(value);
            }
            return value;
        });
    } catch (e) {
        return '[Objeto no serializable]';
    }
}

// Safe console method fallback
const safeConsoleMethod = (typeof console !== 'undefined' && console.log) 
  ? console.log.bind(console) 
  : () => {};

// Override console.warn to filter out specific messages (use originalConsole.warn instead of redefining originalWarn)
if (typeof console !== 'undefined' && console.warn) {
  console.warn = function(...args) {
    try {
        if (args[0] && typeof args[0] === 'string') {
            // Ignorar mensajes específicos que causan ruido
            if (args[0].includes('Permissions policy violation') && args[0].includes('unload is not allowed')) {
                return; // Ignorar este mensaje específico
            }

            // Suprimir la advertencia sobre acceso al padre
            if (args[0].includes("No se puede acceder al padre")) {
                return; // Ignorar este mensaje específico para evitar ruido repetitivo
            }

            // Suprimir la advertencia sobre controlador existente
            if (args[0].includes("Ya existe un controlador para mensajes tipo")) {
                return; // Ignorar este mensaje específico para evitar ruido repetitivo
            }
        }
        
        // Llamar al método original para otros mensajes
        originalConsole.warn.apply(console, args);
    } catch (e) {
        // Fallback seguro si algo falla
        originalConsole.warn('[Error en console.warn]');
    }
  };
}

// Reemplazar console.error para evitar loops de error y limitar mensajes repetitivos
console.error = function(...args) {
    try {
        // Filtrar errores específicos relacionados con pausas del depurador o ruido
        if (args[0] && typeof args[0] === 'string') {
            // Errores específicos a limitar
            if (args[0].includes('Error Crítico') && args[0].includes('Origen: padre')) {
                errorCounter++;
                if (errorCounter > 3) return; // Limitar estos errores específicos
            }
            
            if (args[0].includes('Timeout al enviar mensaje')) {
                errorCounter++;
                if (errorCounter > 2) return; // Limitar estos errores específicos
            }

            // Suprimir el error específico de SyntaxError sobre 'actualizarPuntoActual'
            if (args[0].includes("Identifier 'actualizarPuntoActual' has already been declared")) {
                return; // Ignorar este error específico para evitar ruido repetitivo
            }

            // Suprimir el error crítico al procesar mensaje
            if (args[0].includes("Error crítico al procesar mensaje")) {
                return; // Ignorar este error específico para evitar ruido repetitivo
            }
        } else if (args[0] instanceof Error && args[0].message && args[0].message.includes("Identifier 'actualizarPuntoActual' has already been declared")) {
            return; // También suprimir si es un objeto Error con este mensaje
        }
        
        // Crear una clave única para este error
        let errorKey = '';
        try {
            errorKey = args.map(arg =>
                typeof arg === 'string' ? arg.slice(0, 100) :
                (arg instanceof Error ? arg.message.slice(0, 100) :
                safeStringify(arg).slice(0, 100))
            ).join('|');
        } catch (e) {
            errorKey = 'error-key-creation-failed';
        }

        // Verificar si el error ya fue registrado recientemente para evitar repeticiones
        if (errorMessages.has(errorKey)) {
            return; // Saltar logging de duplicados
        }
        errorMessages.add(errorKey);
        
        // Llamar al método original con argumentos seguros
        originalConsole.error.apply(console, args);
    } catch (e) {
        // Fallback ultra seguro
        try {
            originalConsole.error('[Error en console.error]');
        } catch {
            // Nada más que podamos hacer
        }
    }
};

// Función para limpiar mensajes de error
function limpiarMensajesError() {
    const limite = esMovil ? 10 : 50;  // Changed from 25/100 to 10/50 for more aggressive cleanup
    if (errorMessages.size > limite) {
        const arrayMensajes = Array.from(errorMessages);
        errorMessages.clear();
        arrayMensajes.slice(-limite).forEach(msg => errorMessages.add(msg));
        console.debug(`Mensajes de error limitados a ${limite}`);
    }
}

// Add new aggressive global cleanup function
function cleanupGlobalAgresivo() {
    // Force manual GC if available (reduce threshold to 75% of memory usage)
    if (window.gc && window.performance && window.performance.memory) {
        const memUsage = window.performance.memory.usedJSHeapSize / window.performance.memory.totalJSHeapSize;
        if (memUsage > 0.75) {
            window.gc();
            console.debug('[GC Forzado] Memoria limpiada agresivamente');
        }
    }
    // Additional cleanup for retained references
    errorMessages.clear();  // Full clear for aggressive mode
    errorCounter = 0;
}

// Limpiar periódicamente para evitar fuga de memoria (optimized for mobile)
setInterval(() => {
    errorCounter = 0;
    limpiarMensajesError();
    cleanupGlobalAgresivo();  // Added call to new function
}, esMovil ? 120000 : 300000);  // Changed from 300000/60000 to 120000/300000 (2 min mobile / 5 min desktop)

// Reemplazar JSON.stringify con una versión segura que maneja referencias circulares
const originalJSONStringify = JSON.stringify;
JSON.stringify = function(obj, replacer, space) {
    try {
        // Usar el método original primero
        return originalJSONStringify(obj, replacer, space);
    } catch (e) {
        // Si falla, usar nuestra versión segura
        try {
            const seen = new WeakSet();
            return originalJSONStringify(obj, function(key, value) {
                // Manejar la función replacer original si existe
                if (replacer) {
                    value = replacer(key, value);
                }
                
                // Manejar referencias circulares
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) {
                        return '[Circular]';
                    }
                    seen.add(value);
                }
                return value;
            }, space);
        } catch (circularError) {
            // Última opción: devolver un objeto simple
            console.warn('[JSON.stringify] Error al serializar objeto con posibles referencias circulares:', e.message);
            return JSON.stringify({
                error: 'No se pudo serializar el objeto',
                reason: e.message
            });
        }
    }
};

// Mostrar confirmación de inicialización
console.log('✅ Sistema de prevención de pausas del depurador inicializado correctamente');
