#!/usr/bin/env python3
"""
Test para verificar que DATOS.SOLICITAR_PARADAS combina correctamente los datos
Este test simula la lógica del controlador usando Python
"""

import json
import time

# Simular el entorno global
class MockWindow:
    def __init__(self):
        self.aventuraSeleccionada = 'Av1'
        self.idiomaSeleccionado = 'esp'
        self.__vv_DATOS_AVENTURAS = {
            'Av1': {
                'coordenadas-hijo2': {
                    'coordenadas': [
                        {'id': 'P-1', 'coordenadas': {'lat': 39.4699, 'lng': -0.3763}, 'nombre': 'Parada 1'},
                        {'id': 'P-2', 'coordenadas': {'lat': 39.4700, 'lng': -0.3764}, 'nombre': 'Parada 2'}
                    ]
                }
            }
        }
        self.__vv_AUDIOS_AVENTURAS = {
            'Av1': {
                'esp': [
                    {'id': 'audio-P-1', 'titulo': 'Audio Parada 1', 'url': 'audio1.mp3'},
                    {'id': 'audio-P-2', 'titulo': 'Audio Parada 2', 'url': 'audio2.mp3'}
                ]
            }
        }
        self.__vv_RETOS_AVENTURAS = {
            'Av1': {
                'esp': [
                    {'id': 'R-3', 'titulo': 'Reto Parada 1', 'descripcion': 'Descripción del reto 1'},
                    {'id': 'R-4', 'titulo': 'Reto Parada 2', 'descripcion': 'Descripción del reto 2'}
                ]
            }
        }
        self.AVENTURA_PARADAS = [
            {'padreid': "padre-P-1", 'tipo': "parada", 'parada_id': 'P-1', 'audio_id': "audio-P-1", 'reto_id': "R-3"},
            {'padreid': "padre-P-2", 'tipo': "parada", 'parada_id': 'P-2', 'audio_id': "audio-P-2", 'reto_id': "R-4"}
        ]

# Crear instancia global
window = MockWindow()

# Simular constantes necesarias
TIPOS_MENSAJE = {
    'DATOS': {
        'RESPUESTA_PARADAS': 'DATOS.RESPUESTA_PARADAS'
    }
}

def combinarDatosParada(item):
    """Función para combinar datos dinámicos con AVENTURA_PARADAS"""
    paradaCompleta = dict(item)

    # Buscar coordenadas en DATOS_AVENTURAS si están disponibles
    if hasattr(window, '__vv_DATOS_AVENTURAS') and window.aventuraSeleccionada:
        datosAventura = window.__vv_DATOS_AVENTURAS.get(window.aventuraSeleccionada)
        if datosAventura and 'coordenadas-hijo2' in datosAventura and 'coordenadas' in datosAventura['coordenadas-hijo2']:
            coordenadas = datosAventura['coordenadas-hijo2']['coordenadas']
            coordEncontrada = None
            for c in coordenadas:
                if (c.get('id') == item.get('parada_id') or
                    c.get('id') == item.get('tramo_id') or
                    c.get('padreid') == item.get('padreid')):
                    coordEncontrada = c
                    break

            if coordEncontrada:
                paradaCompleta['ubicacion'] = coordEncontrada.get('coordenadas') or coordEncontrada.get('ubicacion')
                paradaCompleta['waypoints'] = coordEncontrada.get('waypoints')
                paradaCompleta['nombre'] = coordEncontrada.get('nombre') or paradaCompleta.get('nombre')
                paradaCompleta['imagen'] = coordEncontrada.get('imagen')
                paradaCompleta['video'] = coordEncontrada.get('video')

    # Buscar audio en AUDIOS_AVENTURAS si están disponibles
    if hasattr(window, '__vv_AUDIOS_AVENTURAS') and window.aventuraSeleccionada and window.idiomaSeleccionado:
        audiosAventura = window.__vv_AUDIOS_AVENTURAS.get(window.aventuraSeleccionada)
        if audiosAventura and window.idiomaSeleccionado in audiosAventura:
            audios = audiosAventura[window.idiomaSeleccionado]
            audioEncontrado = None
            for a in audios:
                if (a.get('id') == item.get('audio_id') or
                    a.get('id') == f"audio-{item.get('parada_id')}" or
                    a.get('id') == f"audio-{item.get('tramo_id')}"):
                    audioEncontrado = a
                    break

            if audioEncontrado:
                paradaCompleta['audio'] = audioEncontrado

    # Buscar reto en RETOS_AVENTURAS si están disponibles
    if hasattr(window, '__vv_RETOS_AVENTURAS') and window.aventuraSeleccionada and window.idiomaSeleccionado:
        retosAventura = window.__vv_RETOS_AVENTURAS.get(window.aventuraSeleccionada)
        if retosAventura and window.idiomaSeleccionado in retosAventura:
            retos = retosAventura[window.idiomaSeleccionado]
            retoEncontrado = None
            for r in retos:
                if r.get('id') == item.get('reto_id'):
                    retoEncontrado = r
                    break

            if retoEncontrado:
                paradaCompleta['reto'] = retoEncontrado

    return paradaCompleta

def normalizarParada(item):
    """Función de normalización simplificada"""
    if not item or not isinstance(item, dict):
        return None

    id_val = None
    if isinstance(item.get('id'), str) and item['id'].strip():
        id_val = item['id'].strip()
    elif isinstance(item.get('parada_id'), str) and item['parada_id'].strip():
        id_val = item['parada_id'].strip()
    elif isinstance(item.get('padreid'), str) and item['padreid'].strip():
        id_val = item['padreid'].strip().replace('^padre-', '', 1)

    if not id_val:
        return None

    salida = dict(item)
    salida['id'] = id_val

    if not isinstance(salida.get('padreid'), str) or not salida['padreid'].strip():
        salida['padreid'] = f"padre-{id_val}"

    return salida

def normalizarParadas(arr):
    """Normalizar array de paradas"""
    if not isinstance(arr, list):
        return []

    resultado = []
    for item in arr:
        n = normalizarParada(item)
        if n:
            resultado.append(n)
    return resultado

def getPadreId():
    """Función getPadreId simplificada"""
    return 'padre'

def main():
    print('🧪 Iniciando test de DATOS.SOLICITAR_PARADAS con datos combinados...\n')

    try:
        # Preparar respuesta con datos combinados
        paradasNormalizadas = normalizarParadas(window.AVENTURA_PARADAS)
        paradasParaEnviar = []

        print(f'📊 Procesando {len(paradasNormalizadas)} paradas normalizadas')

        for p in paradasNormalizadas:
            print(f'\n🔄 Procesando parada: {p["id"]} ({p["padreid"]})')

            # Combinar con datos dinámicos
            paradaCompleta = combinarDatosParada(p)

            paradaParaEnviar = {
                'padreid': p.get('padreid') or f"padre-{p['id']}",
                'paradaId': p.get('paradaId') or p.get('parada_id') or p['id'],
                'id': p['id'],
                'tipo': p.get('tipo'),
                'nombre': p.get('nombre') or p.get('nombreCompleto') or p['id'],
                'ubicacion': p.get('ubicacion') or ((p.get('lat') is not None and p.get('lng') is not None) and {'lat': p['lat'], 'lng': p['lng']} or None),
                'waypoints': p.get('waypoints') if isinstance(p.get('waypoints'), list) else [],
                'rutas': p.get('rutas', []),
                'metadatos': p.get('metadatos', {}),
                'estado': p.get('estado', 'activa'),
                # IDs originales del array AVENTURA_PARADAS
                'audio_id': p.get('audio_id'),
                'reto_id': p.get('reto_id'),
                # Datos adicionales combinados
                'coordenadas': paradaCompleta.get('ubicacion'),
                'waypointsCompletos': paradaCompleta.get('waypoints'),
                'imagen': paradaCompleta.get('imagen'),
                'video': paradaCompleta.get('video'),
                'audio': paradaCompleta.get('audio'),
                'reto': paradaCompleta.get('reto')
            }

            paradasParaEnviar.append(paradaParaEnviar)

            # Verificaciones
            print(f'  ✓ ID: {paradaParaEnviar["id"]}')
            print(f'  ✓ Audio ID: {paradaParaEnviar.get("audio_id") or "NO ENCONTRADO"}')
            print(f'  ✓ Reto ID: {paradaParaEnviar.get("reto_id") or "NO ENCONTRADO"}')

            coords = paradaParaEnviar.get('coordenadas')
            if coords and 'lat' in coords and 'lng' in coords:
                print(f'  ✓ Coordenadas: {coords["lat"]}, {coords["lng"]}')
            else:
                print('  ✗ Coordenadas: NO ENCONTRADAS')

            audio = paradaParaEnviar.get('audio')
            if audio and 'titulo' in audio:
                print(f'  ✓ Audio objeto: {audio["titulo"]}')
            else:
                print('  ✗ Audio objeto: NO ENCONTRADO')

            reto = paradaParaEnviar.get('reto')
            if reto and 'titulo' in reto:
                print(f'  ✓ Reto objeto: {reto["titulo"]}')
            else:
                print('  ✗ Reto objeto: NO ENCONTRADO')
        respuesta = {
            'tipo': TIPOS_MENSAJE['DATOS']['RESPUESTA_PARADAS'],
            'origen': getPadreId(),
            'destino': 'test-hijo',
            'datos': {
                'paradas': paradasParaEnviar,
                'total': len(window.AVENTURA_PARADAS),
                'estadisticas': {
                    'paradas': len([p for p in window.AVENTURA_PARADAS if p.get('tipo') == 'parada']),
                    'tramos': len([p for p in window.AVENTURA_PARADAS if p.get('tipo') == 'tramo'])
                },
                'metadatos': {
                    'timestamp': int(time.time() * 1000),
                    'version': 'combinada_v1',
                    'aventura': window.aventuraSeleccionada,
                    'idioma': window.idiomaSeleccionado
                }
            }
        }

        print(f'\n✅ Test completado exitosamente!')
        print(f'📈 Total de paradas procesadas: {len(paradasParaEnviar)}')
        print(f'📋 Estadísticas: {respuesta["datos"]["estadisticas"]["paradas"]} paradas, {respuesta["datos"]["estadisticas"]["tramos"]} tramos')

        # Verificación final
        todasTienenDatos = all(
            p.get('audio_id') and p.get('reto_id') and p.get('coordenadas') and p.get('audio') and p.get('reto')
            for p in paradasParaEnviar
        )

        if todasTienenDatos:
            print('\n🎉 ÉXITO: Todas las paradas tienen datos completos (IDs + objetos + coordenadas)')
            return True
        else:
            print('\n❌ ERROR: Algunas paradas no tienen datos completos')
            for i, p in enumerate(paradasParaEnviar):
                completa = (p.get('audio_id') and p.get('reto_id') and
                           p.get('coordenadas') and p.get('audio') and p.get('reto'))
                if not completa:
                    print(f'  Parada {i + 1} ({p["id"]}) incompleta')
            return False

    except Exception as error:
        print(f'❌ Error en el test: {str(error)}')
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)