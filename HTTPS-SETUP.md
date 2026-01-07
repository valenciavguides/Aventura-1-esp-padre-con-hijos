# 🔒 Configuración HTTPS para Valencia VGuides

Este documento explica cómo configurar HTTPS en GitHub Pages para que el GPS funcione correctamente.

## ❓ ¿Por qué necesito HTTPS?

Los navegadores modernos (Chrome, Firefox, Safari, Edge) **requieren HTTPS** para acceder a la API de geolocalización por razones de seguridad. Sin HTTPS:

- ❌ El GPS no funcionará en modo Aventura
- ❌ Los usuarios recibirán errores de permisos
- ❌ La aplicación mostrará mensajes de "sitio no seguro"

## ✅ Solución Implementada

Este repositorio ya incluye dos mecanismos para forzar HTTPS:

### 1. Redirección Automática HTTP → HTTPS

En `codigo-padre.html`, líneas 19-23:

```javascript
// Redirect HTTP to HTTPS automatically
if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    window.location.href = 'https://' + window.location.hostname + window.location.pathname + window.location.search + window.location.hash;
}
```

Esto redirige automáticamente cualquier visita HTTP a HTTPS (excepto en localhost durante desarrollo).

### 2. Content Security Policy (CSP)

En `codigo-padre.html`, línea 18:

```html
<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests" />
```

Esto fuerza al navegador a cargar todos los recursos (imágenes, scripts, CSS) mediante HTTPS, incluso si están referenciados como HTTP.

## 🔧 Configuración en GitHub Pages

### Para Dominio Personalizado (valenciavguides.es)

1. **Verificar CNAME**
   - El archivo `CNAME` debe contener tu dominio: `valenciavguides.es`
   - Ya está configurado en este repositorio ✅

2. **Configurar DNS en tu proveedor**
   - Añadir registros A apuntando a las IPs de GitHub:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
   - O usar un registro CNAME apuntando a: `valenciavguides.github.io`

3. **Habilitar HTTPS en GitHub**
   - Ve a Settings → Pages en tu repositorio
   - Marca "Enforce HTTPS" ✅
   - GitHub generará automáticamente un certificado SSL gratuito

### Para Dominio GitHub Pages Estándar

Si usas `https://valenciavguides.github.io/Aventura-1-esp-padre-con-hijos/`:

1. Ve a Settings → Pages
2. Marca "Enforce HTTPS"
3. ¡Listo! GitHub proporciona HTTPS automáticamente

## 🧪 Verificar la Configuración

### Método 1: Abrir el Test de HTTPS

Abre el archivo de prueba en tu navegador:
```
https://valenciavguides.es/test/test-https-redirect.html
```

Este test verificará:
- ✅ Que estés usando HTTPS
- ✅ Que la API de geolocalización esté disponible
- ✅ Que los permisos GPS funcionen

### Método 2: Verificación Manual

1. Abre `https://valenciavguides.es/codigo-padre.html` (con HTTPS)
2. Abre la consola del navegador (F12)
3. Verifica que no haya errores de "Mixed Content"
4. Prueba el modo Aventura y verifica que pida permisos GPS

## 🛠️ Solución de Problemas

### Problema: "El GPS no funciona"

**Causas posibles:**
1. Estás accediendo al sitio vía HTTP en lugar de HTTPS
   - **Solución**: Usa `https://valenciavguides.es/codigo-padre.html`
   
2. No has dado permisos de ubicación al navegador
   - **Solución**: Haz clic en "Permitir" cuando el navegador pida acceso a la ubicación

3. Estás usando un navegador antiguo
   - **Solución**: Actualiza tu navegador (Chrome 90+, Firefox 88+, Safari 14+)

### Problema: "Mixed Content" warnings

**Causa:** Algunos recursos se están cargando por HTTP en lugar de HTTPS

**Solución:** La meta tag CSP `upgrade-insecure-requests` debería resolver esto automáticamente. Si persiste:
1. Busca referencias HTTP en el código: `grep -r "http://" *.html *.js`
2. Cambia todas las URLs a HTTPS o usa URLs relativas

### Problema: Certificado SSL no válido

**Causas posibles:**
1. El DNS no está configurado correctamente
   - **Solución**: Verifica los registros A/CNAME en tu proveedor DNS
   
2. GitHub aún está generando el certificado (puede tardar hasta 24 horas)
   - **Solución**: Espera y vuelve a intentar más tarde

3. "Enforce HTTPS" no está habilitado en GitHub Pages
   - **Solución**: Ve a Settings → Pages y actívalo

## 📚 Referencias

- [GitHub Pages Custom Domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [Securing GitHub Pages with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Geolocation API Requirements](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

## ✅ Estado Actual

- ✅ Redirección HTTP → HTTPS implementada
- ✅ Content Security Policy configurada
- ✅ CNAME configurado para valenciavguides.es
- ✅ Documentación actualizada
- ✅ Test de verificación creado

**El sitio está listo para usar HTTPS y el GPS debería funcionar correctamente.**
