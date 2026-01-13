#!/usr/bin/env python3
"""
Verificación exhaustiva de controladores registrados vs TIPOS_MENSAJE
Detecta errores de escritura, inconsistencias y controladores faltantes
"""

import re
from pathlib import Path
from collections import defaultdict

# Colores ANSI
RED = '\033[91m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def extraer_tipos_mensaje(archivo_constants):
    """Extrae todos los tipos de mensaje definidos en constants.js"""
    contenido = Path(archivo_constants).read_text(encoding='utf-8')
    
    # Patrón para encontrar definiciones como: ACTIVAR: 'NAVEGACION.GPS.ACTIVAR'
    patron = r'(\w+):\s*[\'"]([A-Z_\.]+)[\'"]'
    matches = re.findall(patron, contenido)
    
    tipos_definidos = set()
    for key, value in matches:
        tipos_definidos.add(value)
    
    return sorted(tipos_definidos)

def extraer_controladores_registrados(archivos):
    """Extrae todos los controladores registrados en todos los archivos"""
    registrados = defaultdict(list)
    
    for archivo in archivos:
        if not Path(archivo).exists():
            continue
            
        contenido = Path(archivo).read_text(encoding='utf-8', errors='ignore')
        
        # Patrón para: registrarControlador(TIPOS_MENSAJE.XXX.YYY, ...
        # Captura variantes: TIPOS_MENSAJE, TIPOS_MENSAJE_S1, etc.
        patron = r'registrarControlador(?:Seguro)?\s*\(\s*(TIPOS_MENSAJE[_A-Z0-9]*(?:\.[A-Z_]+)+)'
        matches = re.findall(patron, contenido)
        
        for match in matches:
            # Normalizar: TIPOS_MENSAJE_S1.XXX -> TIPOS_MENSAJE.XXX
            normalizado = re.sub(r'TIPOS_MENSAJE[_A-Z0-9]*\.', '', match)
            normalizado = re.sub(r'^\.', '', normalizado)
            
            # Convertir punto por punto a formato de constants
            partes = normalizado.split('.')
            tipo_completo = '.'.join(partes)
            
            registrados[tipo_completo].append({
                'archivo': Path(archivo).name,
                'original': match
            })
    
    return registrados

def main():
    base_path = Path(__file__).parent.parent
    
    # Archivos a analizar
    archivos = [
        base_path / 'codigo-padre.html',
        base_path / 'js' / 'mensajeria.js',
        base_path / 'js' / 'monitoreo.js',
        base_path / 'js' / 'utils.js',
        base_path / 'js' / 'funciones-mapa.js',
        base_path / 'js' / 'app.js',
        base_path / 'audio-hijo3.html',
        base_path / 'Av1-boton-casa.html',
        base_path / 'coordenadas-hijo2.html',
        base_path / 'retos-hijo4.html',
        base_path / 'botones-y-subfunciones-hamburguesa.html',
        base_path / 'botones-y-subfunciones-opciones.html',
    ]
    
    print(f"\n{BLUE}{'='*80}")
    print(f"VERIFICACIÓN DE CONTROLADORES REGISTRADOS")
    print(f"{'='*80}{RESET}\n")
    
    # 1. Extraer tipos definidos
    tipos_definidos = extraer_tipos_mensaje(base_path / 'js' / 'constants.js')
    print(f"{GREEN}✓ Tipos de mensaje definidos en constants.js: {len(tipos_definidos)}{RESET}\n")
    
    # 2. Extraer controladores registrados
    controladores = extraer_controladores_registrados(archivos)
    print(f"{GREEN}✓ Controladores únicos registrados: {len(controladores)}{RESET}\n")
    
    # 3. Análisis de errores
    errores = []
    advertencias = []
    
    print(f"{BLUE}{'='*80}")
    print("ANÁLISIS DE INCONSISTENCIAS")
    print(f"{'='*80}{RESET}\n")
    
    # 3.1 Controladores registrados que NO existen en constants.js
    for tipo, ubicaciones in sorted(controladores.items()):
        if tipo not in tipos_definidos:
            # Buscar similares (posibles typos)
            similares = [t for t in tipos_definidos if t.split('.')[-1] == tipo.split('.')[-1]]
            
            errores.append({
                'tipo': 'NO_DEFINIDO',
                'controlador': tipo,
                'ubicaciones': ubicaciones,
                'similares': similares
            })
    
    # 3.2 Tipos definidos que NO tienen controlador
    tipos_sin_controlador = []
    for tipo in tipos_definidos:
        if tipo not in controladores:
            # Filtrar algunos que son solo para envío (no requieren controlador)
            if not any(x in tipo for x in ['_REQUEST', '_RESPONSE', 'SOLICITAR']):
                tipos_sin_controlador.append(tipo)
    
    # 4. Reportar errores
    if errores:
        print(f"{RED}❌ ERRORES ENCONTRADOS: {len(errores)}{RESET}\n")
        for i, error in enumerate(errores, 1):
            print(f"{RED}Error #{i}: Controlador NO DEFINIDO en constants.js{RESET}")
            print(f"  Controlador registrado: {YELLOW}{error['controlador']}{RESET}")
            print(f"  Archivos donde aparece:")
            for ub in error['ubicaciones']:
                print(f"    - {ub['archivo']}: {ub['original']}")
            if error['similares']:
                print(f"  {YELLOW}¿Quizás querías decir?{RESET}")
                for similar in error['similares'][:3]:
                    print(f"    - {GREEN}{similar}{RESET}")
            print()
    else:
        print(f"{GREEN}✓ Todos los controladores registrados están correctamente definidos{RESET}\n")
    
    # 5. Reportar advertencias
    if tipos_sin_controlador:
        print(f"{YELLOW}⚠ ADVERTENCIAS: {len(tipos_sin_controlador)} tipos sin controlador{RESET}\n")
        print(f"{YELLOW}Los siguientes tipos están definidos pero no tienen controlador registrado:{RESET}")
        for tipo in sorted(tipos_sin_controlador)[:20]:  # Mostrar solo los primeros 20
            print(f"  - {tipo}")
        if len(tipos_sin_controlador) > 20:
            print(f"  ... y {len(tipos_sin_controlador) - 20} más")
        print()
    
    # 6. Resumen final
    print(f"{BLUE}{'='*80}")
    print("RESUMEN")
    print(f"{'='*80}{RESET}\n")
    print(f"  Tipos definidos:          {len(tipos_definidos)}")
    print(f"  Controladores registrados: {len(controladores)}")
    print(f"  {RED}Errores:                   {len(errores)}{RESET}")
    print(f"  {YELLOW}Advertencias:              {len(tipos_sin_controlador)}{RESET}")
    
    if errores == 0:
        print(f"\n{GREEN}{'='*80}")
        print("✅ VERIFICACIÓN EXITOSA: Todos los controladores son válidos")
        print(f"{'='*80}{RESET}\n")
        return 0
    else:
        print(f"\n{RED}{'='*80}")
        print("❌ VERIFICACIÓN FALLIDA: Se encontraron errores")
        print(f"{'='*80}{RESET}\n")
        return 1

if __name__ == '__main__':
    exit(main())
