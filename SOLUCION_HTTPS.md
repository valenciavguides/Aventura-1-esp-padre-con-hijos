# Solución: Problema de HTTPS en valenciavguides.es

## 🔒 Problema Identificado

Chrome muestra "No es seguro" y usa HTTP en lugar de HTTPS, sin el candado de seguridad.

## ✅ Solución: Activar HTTPS en GitHub Pages

### Pasos para Solucionar:

1. **Ve a la Configuración del Repositorio:**
   - Abre https://github.com/valenciavguides/Aventura-1-esp-padre-con-hijos/settings/pages

2. **Forzar HTTPS:**
   - En la sección "Enforce HTTPS", **marca la casilla** "Enforce HTTPS"
   - Si la casilla está deshabilitada, sigue los pasos siguientes

3. **Si la casilla de HTTPS está deshabilitada:**
   
   **Opción A - Esperar la Propagación del DNS (Recomendado):**
   - Puede tomar entre 24-48 horas para que GitHub genere el certificado SSL
   - GitHub genera automáticamente un certificado Let's Encrypt para dominios personalizados
   - Una vez generado, la casilla "Enforce HTTPS" se habilitará automáticamente

   **Opción B - Re-configurar el Dominio Personalizado:**
   - En la misma página de Settings > Pages
   - **Elimina** el dominio personalizado (borra `valenciavguides.es` del campo Custom Domain)
   - Haz clic en **Save**
   - Espera 1 minuto
   - **Vuelve a añadir** `valenciavguides.es` en el campo Custom Domain
   - Haz clic en **Save**
   - Espera unos minutos para que GitHub genere el certificado SSL
   - Marca la casilla "Enforce HTTPS" cuando esté disponible

4. **Verificar la Configuración DNS:**
   
   Asegúrate de que tus registros DNS estén correctamente configurados:
   
   ```
   Tipo: A
   Nombre: @ (o valenciguides.es)
   Valor: 185.199.108.153
   
   Tipo: A
   Nombre: @ (o valenciavguides.es)
   Valor: 185.199.109.153
   
   Tipo: A
   Nombre: @ (o valenciavguides.es)
   Valor: 185.199.110.153
   
   Tipo: A
   Nombre: @ (o valenciavguides.es)
   Valor: 185.199.111.153
   
   Tipo: CNAME (si usas www)
   Nombre: www
   Valor: valenciavguides.github.io
   ```

5. **Verificar el Certificado SSL:**
   
   Una vez que GitHub haya generado el certificado (puede tardar hasta 48 horas):
   - Visita https://valenciavguides.es/codigo-padre.html (con HTTPS)
   - Deberías ver el candado verde
   - Si no funciona inmediatamente, limpia la caché del navegador

## 🔍 Verificación del Estado Actual

### Comando para Verificar Certificado SSL:

```bash
# En tu terminal o línea de comandos:
curl -I https://valenciavguides.es/codigo-padre.html
```

Si el certificado está activo, verás:
```
HTTP/2 200
```

Si no está activo, verás un error de certificado.

## 📋 Checklist de Verificación

- [ ] DNS configurado correctamente (registros A apuntando a GitHub Pages)
- [ ] CNAME file contiene `valenciavguides.es` ✓ (ya verificado)
- [ ] Dominio personalizado añadido en GitHub Settings > Pages
- [ ] Esperado 24-48 horas para generación del certificado SSL
- [ ] Casilla "Enforce HTTPS" marcada en GitHub Settings > Pages
- [ ] Navegador accediendo a https:// (no http://)
- [ ] Caché del navegador limpiada

## ⚡ Solución Rápida (Si necesitas HTTPS inmediatamente)

Mientras esperas que GitHub genere el certificado SSL, puedes usar la URL de GitHub Pages con HTTPS:

**URL temporal con HTTPS garantizado:**
```
https://valenciavguides.github.io/Aventura-1-esp-padre-con-hijos/codigo-padre.html
```

Esta URL **siempre** tendrá HTTPS porque GitHub Pages lo proporciona automáticamente para subdominios de github.io.

## 🎯 Resultado Esperado

Una vez completados los pasos:

- ✅ URL con HTTPS: https://valenciavguides.es/codigo-padre.html
- ✅ Candado verde de seguridad visible
- ✅ Chrome muestra "Conexión segura"
- ✅ Geolocalización y todas las APIs funcionando correctamente

## 🔧 Solución Avanzada: Si HTTPS ya está marcado pero sigue sin funcionar

**Si "Enforce HTTPS" ya está marcado hace más de 24 horas y Chrome aún muestra "No es seguro":**

### Paso 1: Verificar que estás usando HTTPS en la URL

❌ **Incorrecto:** `http://valenciavguides.es/codigo-padre.html`  
✅ **Correcto:** `https://valenciavguides.es/codigo-padre.html`

Chrome puede estar cacheando la versión HTTP. **Escribe manualmente `https://` al principio de la URL.**

### Paso 2: Limpiar completamente la caché del navegador

1. En Chrome, presiona `Ctrl + Shift + Delete` (Windows/Linux) o `Cmd + Shift + Delete` (Mac)
2. Selecciona **"Desde siempre"** en el rango de tiempo
3. Marca las casillas:
   - ✅ Historial de navegación
   - ✅ Cookies y otros datos de sitios
   - ✅ Imágenes y archivos almacenados en caché
4. Haz clic en **"Borrar datos"**
5. **Cierra completamente Chrome** (todas las ventanas)
6. Abre Chrome de nuevo y visita: `https://valenciavguides.es/codigo-padre.html`

### Paso 3: Usar modo incógnito para verificar

1. Abre una **ventana de incógnito** en Chrome (`Ctrl + Shift + N`)
2. Visita: `https://valenciavguides.es/codigo-padre.html`
3. Si funciona en incógnito pero no en modo normal, el problema es la caché local

### Paso 4: Verificar el certificado SSL desde el navegador

1. Visita `https://valenciavguides.es/codigo-padre.html`
2. Haz clic en **el icono a la izquierda de la URL** (candado o "No es seguro")
3. Selecciona **"Certificado"** o **"La conexión no es privada > Avanzado"**
4. Verifica:
   - **Emitido para:** `valenciavguides.es`
   - **Emitido por:** Let's Encrypt o GitHub
   - **Válido desde/hasta:** Fechas actuales

### Paso 5: Forzar la redirección HTTPS

Si el navegador insiste en usar HTTP, puedes:

**Opción A - Usar un enlace directo:**
```html
<a href="https://valenciavguides.es/codigo-padre.html">Ir a Valencia VGuides</a>
```

**Opción B - Añadir meta tag de redirección (si tienes acceso al HTML):**
```html
<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
```

Este meta tag ya está considerado en el código, pero puedes verificarlo.

### Paso 6: Verificar desde herramientas externas

Usa estas herramientas para verificar que el HTTPS esté funcionando correctamente:

1. **SSL Labs:** https://www.ssllabs.com/ssltest/analyze.html?d=valenciavguides.es
   - Debe mostrar una calificación A o B
   
2. **WhyNoPadlock:** https://www.whynopadlock.com/results/valenciavguides.es
   - Detecta contenido mixto (HTTP en página HTTPS)

3. **DNSChecker:** https://dnschecker.org/#A/valenciavguides.es
   - Verifica que el DNS esté propagado globalmente

### Paso 7: Re-configurar el dominio personalizado (último recurso)

Si nada de lo anterior funciona:

1. Ve a https://github.com/valenciavguides/Aventura-1-esp-padre-con-hijos/settings/pages
2. En "Custom domain", **elimina** `valenciavguides.es` y guarda
3. Espera **5 minutos**
4. **Vuelve a añadir** `valenciavguides.es` y guarda
5. Espera que GitHub valide el dominio (puede tardar unos minutos)
6. Verifica que **"Enforce HTTPS"** esté marcado
7. Limpia la caché del navegador y prueba de nuevo

### 🆘 Diagnóstico rápido

Ejecuta este comando en tu terminal para ver el estado del certificado:

```bash
curl -vI https://valenciavguides.es/codigo-padre.html 2>&1 | grep -E "(subject|issuer|expire)"
```

Si ves información del certificado, HTTPS está funcionando del lado del servidor.

## 📞 Soporte Adicional

Si después de seguir todos los pasos anteriores el problema persiste:

1. Verifica que los registros DNS estén correctos usando https://dnschecker.org
2. Contacta al soporte de GitHub Pages: https://support.github.com
3. O utiliza la URL de GitHub Pages como alternativa temporal
4. Verifica con otro navegador (Firefox, Edge, Safari) para confirmar si es específico de Chrome

---

**Nota Importante:** GitHub Pages **requiere** que el certificado SSL esté generado antes de poder marcar "Enforce HTTPS". Este proceso es automático pero puede tardar hasta 48 horas desde que se configura el dominio personalizado.
