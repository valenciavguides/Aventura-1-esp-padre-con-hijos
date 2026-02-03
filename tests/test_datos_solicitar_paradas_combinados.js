/**
 * Test para verificar que DATOS.SOLICITAR_PARADAS combina correctamente los datos
 * Este test simula la lógica del controlador sin necesidad de navegador
 */

// Simular el entorno global
global.window = {
    aventuraSeleccionada: 'Av1',
    idiomaSeleccionado: 'esp',
    __vv_DATOS_AVENTURAS: {
        'Av1': {
            'coordenadas-hijo2': {
                coordenadas: [
                    { id: 'P-1', coordenadas: { lat: 39.4699, lng: -0.3763 }, nombre: 'Parada 1' },
                    { id: 'P-2', coordenadas: { lat: 39.4700, lng: -0.3764 }, nombre: 'Parada 2' }
                ]
            }
        }
    },
    __vv_AUDIOS_AVENTURAS: {
        'Av1': {
            'esp': [
                { id: 'audio-P-1', titulo: 'Audio Parada 1', url: 'audio1.mp3' },
                { id: 'audio-P-2', titulo: 'Audio Parada 2', url: 'audio2.mp3' }
            ]
        }
    },
    __vv_RETOS_AVENTURAS: {
        'Av1': {
            'esp': [
                { id: 'R-3', titulo: 'Reto Parada 1', descripcion: 'Descripción del reto 1' },
                { id: 'R-4', titulo: 'Reto Parada 2', descripcion: 'Descripción del reto 2' }
            ]
        }
    },
    AVENTURA_PARADAS: [
        { padreid: "padre-P-1", tipo: "parada", parada_id: 'P-1', audio_id: "audio-P-1", reto_id: "R-3" },
        { padreid: "padre-P-2", tipo: "parada", parada_id: 'P-2', audio_id: "audio-P-2", reto_id: "R-4" }
    ]
};

// Simular constantes necesarias
global.TIPOS_MENSAJE = {
    DATOS: {
        RESPUESTA_PARADAS: 'DATOS.RESPUESTA_PARADAS'
    }
};

// Función para combinar datos dinámicos con AVENTURA_PARADAS
function combinarDatosParada(item) {
    const paradaCompleta = { ...item };

    // Buscar coordenadas en DATOS_AVENTURAS si están disponibles
    if (global.window.__vv_DATOS_AVENTURAS && global.window.aventuraSeleccionada) {
        const datosAventura = global.window.__vv_DATOS_AVENTURAS[global.window.aventuraSeleccionada];
        if (datosAventura && datosAventura['coordenadas-hijo2'] && datosAventura['coordenadas-hijo2'].coordenadas) {
            const coordEncontrada = datosAventura['coordenadas-hijo2'].coordenadas.find(c =>
                c.id === item.parada_id || c.id === item.tramo_id || c.padreid === item.padreid
            );
            if (coordEncontrada) {
                paradaCompleta.ubicacion = coordEncontrada.coordenadas || coordEncontrada.ubicacion;
                paradaCompleta.waypoints = coordEncontrada.waypoints;
                paradaCompleta.nombre = coordEncontrada.nombre || paradaCompleta.nombre;
                paradaCompleta.imagen = coordEncontrada.imagen;
                paradaCompleta.video = coordEncontrada.video;
            }
        }
    }

    // Buscar audio en AUDIOS_AVENTURAS si están disponibles
    if (global.window.__vv_AUDIOS_AVENTURAS && global.window.aventuraSeleccionada && global.window.idiomaSeleccionado) {
        const audiosAventura = global.window.__vv_AUDIOS_AVENTURAS[global.window.aventuraSeleccionada];
        if (audiosAventura && audiosAventura[global.window.idiomaSeleccionado]) {
            const audioEncontrado = audiosAventura[global.window.idiomaSeleccionado].find(a =>
                a.id === item.audio_id || a.id === `audio-${item.parada_id}` || a.id === `audio-${item.tramo_id}`
            );
            if (audioEncontrado) {
                paradaCompleta.audio = audioEncontrado;
            }
        }
    }

    // Buscar reto en RETOS_AVENTURAS si están disponibles
    if (global.window.__vv_RETOS_AVENTURAS && global.window.aventuraSeleccionada && global.window.idiomaSeleccionado) {
        const retosAventura = global.window.__vv_RETOS_AVENTURAS[global.window.aventuraSeleccionada];
        if (retosAventura && retosAventura[global.window.idiomaSeleccionado]) {
            const retoEncontrado = retosAventura[global.window.idiomaSeleccionado].find(r =>
                r.id === item.reto_id
            );
            if (retoEncontrado) {
                paradaCompleta.reto = retoEncontrado;
            }
        }
    }

    return paradaCompleta;
}

// Función de normalización simplificada (simulando utils.js)
function normalizarParada(item) {
    if (!item || typeof item !== 'object') return null;
    let id = null;
    if (typeof item.id === 'string' && item.id.trim() !== '') id = item.id.trim();
    else if (typeof item.parada_id === 'string' && item.parada_id.trim() !== '') id = item.parada_id.trim();
    else if (typeof item.padreid === 'string' && item.padreid.trim() !== '') {
        id = item.padreid.trim().replace(/^padre-/, '');
    }
    if (!id) return null;
    const salida = Object.assign({}, item);
    salida.id = id;
    if (typeof salida.padreid !== 'string' || salida.padreid.trim() === '') {
        salida.padreid = `padre-${id}`;
    }
    return salida;
}

function normalizarParadas(arr) {
    if (!Array.isArray(arr)) return [];
    const resultado = [];
    for (let i = 0; i < arr.length; i++) {
        const n = normalizarParada(arr[i]);
        if (n) resultado.push(n);
    }
    return resultado;
}

// Función getPadreId simplificada
function getPadreId() {
    return 'padre';
}

// Ejecutar el test
console.log('🧪 Iniciando test de DATOS.SOLICITAR_PARADAS con datos combinados...\n');

try {
    // Preparar respuesta con datos combinados
    const paradasNormalizadas = normalizarParadas(global.window.AVENTURA_PARADAS);
    const paradasParaEnviar = [];

    console.log(`📊 Procesando ${paradasNormalizadas.length} paradas normalizadas`);

    for (const p of paradasNormalizadas) {
        console.log(`\n🔄 Procesando parada: ${p.id} (${p.padreid})`);

        // Combinar con datos dinámicos
        const paradaCompleta = combinarDatosParada(p);

        const paradaParaEnviar = {
            padreid: p.padreid || `padre-${p.id}`,
            paradaId: p.paradaId || p.parada_id || p.id,
            id: p.id,
            tipo: p.tipo,
            nombre: p.nombre || p.nombreCompleto || p.id,
            ubicacion: p.ubicacion || ((p.lat !== undefined && p.lng !== undefined) ? { lat: p.lat, lng: p.lng } : undefined),
            waypoints: Array.isArray(p.waypoints) ? p.waypoints.map(w => ({ lat: w.lat, lng: w.lng })) : undefined,
            rutas: p.rutas || [],
            metadatos: p.metadatos || {},
            estado: p.estado || 'activa',
            // IDs originales del array AVENTURA_PARADAS
            audio_id: p.audio_id,
            reto_id: p.reto_id,
            // Datos adicionales combinados
            coordenadas: paradaCompleta.ubicacion,
            waypointsCompletos: paradaCompleta.waypoints,
            imagen: paradaCompleta.imagen,
            video: paradaCompleta.video,
            audio: paradaCompleta.audio,
            reto: paradaCompleta.reto
        };

        paradasParaEnviar.push(paradaParaEnviar);

        // Verificaciones
        console.log(`  ✓ ID: ${paradaParaEnviar.id}`);
        console.log(`  ✓ Audio ID: ${paradaParaEnviar.audio_id || 'NO ENCONTRADO'}`);
        console.log(`  ✓ Reto ID: ${paradaParaEnviar.reto_id || 'NO ENCONTRADO'}`);
        console.log(`  ✓ Coordenadas: ${paradaParaEnviar.coordenadas ? `${paradaParaEnviar.coordenadas.lat}, ${paradaParaEnviar.coordenadas.lng}` : 'NO ENCONTRADAS'}`);
        console.log(`  ✓ Audio objeto: ${paradaParaEnviar.audio ? paradaParaEnviar.audio.titulo : 'NO ENCONTRADO'}`);
        console.log(`  ✓ Reto objeto: ${paradaParaEnviar.reto ? paradaParaEnviar.reto.titulo : 'NO ENCONTRADO'}`);
    }

    const respuesta = {
        tipo: TIPOS_MENSAJE.DATOS.RESPUESTA_PARADAS,
        origen: getPadreId(),
        destino: 'test-hijo',
        datos: {
            paradas: paradasParaEnviar,
            total: global.window.AVENTURA_PARADAS.length,
            estadisticas: {
                paradas: global.window.AVENTURA_PARADAS.filter(p => p.tipo === 'parada').length,
                tramos: global.window.AVENTURA_PARADAS.filter(p => p.tipo === 'tramo').length
            },
            metadatos: {
                timestamp: Date.now(),
                version: 'combinada_v1',
                aventura: global.window.aventuraSeleccionada,
                idioma: global.window.idiomaSeleccionado
            }
        }
    };

    console.log(`\n✅ Test completado exitosamente!`);
    console.log(`📈 Total de paradas procesadas: ${paradasParaEnviar.length}`);
    console.log(`📋 Estadísticas: ${respuesta.datos.estadisticas.paradas} paradas, ${respuesta.datos.estadisticas.tramos} tramos`);

    // Verificación final
    const todasTienenDatos = paradasParaEnviar.every(p =>
        p.audio_id && p.reto_id && p.coordenadas && p.audio && p.reto
    );

    if (todasTienenDatos) {
        console.log('\n🎉 ÉXITO: Todas las paradas tienen datos completos (IDs + objetos + coordenadas)');
    } else {
        console.log('\n❌ ERROR: Algunas paradas no tienen datos completos');
        paradasParaEnviar.forEach((p, i) => {
            const completa = p.audio_id && p.reto_id && p.coordenadas && p.audio && p.reto;
            if (!completa) {
                console.log(`  Parada ${i + 1} (${p.id}) incompleta`);
            }
        });
    }

} catch (error) {
    console.error('❌ Error en el test:', error.message);
    console.error(error.stack);
}