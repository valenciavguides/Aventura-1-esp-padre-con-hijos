# Instrucciones para Habilitar HTTPS en GitHub Pages

## 🔒 Pasos para Forzar HTTPS (IMPORTANTE para GPS)

Para que tu sitio `valenciavguides.es` funcione completamente con HTTPS y permita el uso del GPS, debes **habilitar "Enforce HTTPS" en GitHub Pages**. Sigue estos pasos:

### 1. Accede a la Configuración del Repositorio

1. Ve a tu repositorio en GitHub: `https://github.com/valenciavguides/Aventura-1-esp-padre-con-hijos`
2. Haz clic en **"Settings"** (Configuración) en la barra superior del repositorio

### 2. Navega a la Sección de Pages

1. En el menú lateral izquierdo, busca y haz clic en **"Pages"**
2. Desplázate hasta la sección **"Custom domain"**

### 3. Verifica el Dominio Personalizado

1. Confirma que el campo muestra: `valenciavguides.es`
2. Asegúrate de que aparece una marca verde ✅ indicando que el dominio está verificado

### 4. Activa "Enforce HTTPS" ⚠️ PASO CRÍTICO

1. Busca la casilla **"Enforce HTTPS"** (Forzar HTTPS)
2. **Marca esta casilla** ☑️
3. Espera unos segundos a que GitHub aplique los cambios

### 5. Verificación

Después de habilitar "Enforce HTTPS":
- Visita: `http://valenciavguides.es/codigo-padre.html` 
- Deberías ser redirigido automáticamente a: `https://valenciavguides.es/codigo-padre.html`
- El GPS ahora debería funcionar correctamente ✅

## 🔧 Mejoras de Código Implementadas

Además de la configuración de GitHub Pages, se han añadido las siguientes mejoras al código:

1. **Redirección JavaScript**: El archivo `codigo-padre.html` incluye un script que redirige automáticamente de HTTP a HTTPS
2. **Content Security Policy**: Todas las páginas HTML incluyen una meta tag que fuerza la actualización de recursos a HTTPS
3. **Documentación**: Se ha actualizado `documentacion.md` con información sobre HTTPS

## ❓ Solución de Problemas

### El GPS sigue sin funcionar
- Asegúrate de que "Enforce HTTPS" está activado en GitHub Pages
- Verifica que tu navegador permite el acceso a la ubicación para el sitio
- Limpia la caché del navegador y vuelve a cargar la página

### El dominio no aparece verificado
- Verifica que tus registros DNS apuntan correctamente a GitHub Pages
- Espera hasta 24 horas para que los cambios DNS se propaguen

## 📞 Ayuda Adicional

Si necesitas más ayuda, consulta la documentación oficial de GitHub Pages:
https://docs.github.com/es/pages/configuring-a-custom-domain-for-your-github-pages-site
