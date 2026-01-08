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

## 📞 Soporte Adicional

Si después de 48 horas la casilla "Enforce HTTPS" sigue deshabilitada:

1. Verifica que los registros DNS estén correctos usando https://dnschecker.org
2. Contacta al soporte de GitHub Pages: https://support.github.com
3. O utiliza la URL de GitHub Pages como alternativa temporal

---

**Nota Importante:** GitHub Pages **requiere** que el certificado SSL esté generado antes de poder marcar "Enforce HTTPS". Este proceso es automático pero puede tardar hasta 48 horas desde que se configura el dominio personalizado.
