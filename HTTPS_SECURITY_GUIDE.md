# HTTPS Security Configuration Guide

## Summary
This document explains the HTTPS security measures implemented for valenciavguides.es to ensure the website is always served securely over HTTPS in all browsing modes (public, private, incognito).

## Changes Implemented

### 1. HTTP Strict Transport Security (HSTS)
Added HSTS meta tag to all HTML files:
```html
<meta http-equiv="Strict-Transport-Security" content="max-age=31536000; includeSubDomains; preload" />
```

**What this does:**
- Instructs browsers to only access the site over HTTPS for 1 year (31536000 seconds)
- Applies to all subdomains (`includeSubDomains`)
- Enables HSTS preload list eligibility (`preload`)

### 2. JavaScript HTTPS Enforcement
Added automatic redirect from HTTP to HTTPS for valenciavguides.es:
```javascript
if (window.location.protocol !== 'https:' && 
    window.location.hostname === 'valenciavguides.es') {
    window.location.href = 'https://' + window.location.hostname + 
                           window.location.pathname + 
                           window.location.search + 
                           window.location.hash;
}
```

**What this does:**
- Automatically redirects HTTP requests to HTTPS
- Only applies to the production domain (valenciavguides.es)
- Preserves all URL parameters and hash fragments
- Does not affect localhost or other development domains

### 3. Content Security Policy (CSP)
Existing CSP header retained and working in conjunction with HSTS:
```html
<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests" />
```

**What this does:**
- Automatically upgrades all HTTP resource requests (images, scripts, etc.) to HTTPS
- Prevents mixed content warnings

## Files Modified

1. `index.html` - Entry point with redirect to codigo-padre.html
2. `codigo-padre.html` - Main application file
3. `Av1-boton-casa.html` - Child component (hijo5-casa)
4. `Av1-botones-coordenadas.html` - Child component (hijo2)
5. `Av1_audio_esp.html` - Child component (hijo3)
6. `Av1-esp-retos-preguntas.html` - Child component (hijo4)

## GitHub Pages Configuration

### Required Settings (Verify in Repository Settings)

1. **Custom Domain:** `valenciavguides.es`
   - Path: Settings → Pages → Custom domain
   
2. **Enforce HTTPS:** ✓ Enabled
   - Path: Settings → Pages → Enforce HTTPS checkbox
   - **IMPORTANT:** This must be checked for HTTPS to work properly

3. **DNS Configuration (at domain registrar):**
   - Should have proper A/AAAA records or CNAME pointing to GitHub Pages
   - Verify DNS propagation: `nslookup valenciavguides.es`

## Testing the Implementation

### Manual Testing

1. **Test HTTP to HTTPS redirect:**
   ```
   http://valenciavguides.es/codigo-padre.html
   ```
   Should automatically redirect to:
   ```
   https://valenciavguides.es/codigo-padre.html
   ```

2. **Test HTTPS access directly:**
   ```
   https://valenciavguides.es/codigo-padre.html
   ```
   Should load without any security warnings

3. **Verify in different browsing modes:**
   - Normal/Public mode
   - Incognito/Private mode
   - Different browsers (Chrome, Firefox, Safari, Edge)

### Browser Developer Tools Testing

1. Open Developer Tools (F12)
2. Go to Console tab
3. Check for:
   - ✓ No mixed content warnings
   - ✓ No security errors
   - ✓ Protocol shows `https:`

4. Go to Network tab
5. Check response headers for:
   ```
   strict-transport-security: max-age=31536000; includeSubDomains; preload
   ```

### Security Headers Check

Use online tools to verify security headers:
- https://securityheaders.com/?q=valenciavguides.es
- https://www.ssllabs.com/ssltest/analyze.html?d=valenciavguides.es

## Troubleshooting

### Issue: Still seeing HTTP in browser
**Solution:** 
- Clear browser cache (Ctrl+Shift+Del)
- Clear DNS cache: `ipconfig /flushdns` (Windows) or `sudo killall -HUP mDNSResponder` (Mac)
- Wait for DNS propagation (up to 48 hours)

### Issue: Mixed content warnings
**Solution:**
- Check Console for specific resources causing issues
- Ensure all resources are loaded via HTTPS or protocol-relative URLs

### Issue: Certificate errors
**Solution:**
- Verify "Enforce HTTPS" is enabled in GitHub Pages settings
- Wait for GitHub to provision SSL certificate (can take up to 24 hours)
- Check CNAME file is present and correct

## Security Benefits

1. **Protection against downgrade attacks:** HSTS prevents attackers from forcing HTTP
2. **Protection against man-in-the-middle attacks:** All traffic encrypted
3. **Improved SEO:** Google ranks HTTPS sites higher
4. **User trust:** Browser shows secure padlock icon
5. **Required for modern web features:** Geolocation API requires HTTPS

## HSTS Preload (Optional Enhancement)

To add valenciavguides.es to the HSTS preload list:

1. Verify current implementation meets requirements:
   - max-age ≥ 31536000 (1 year) ✓
   - includeSubDomains directive present ✓
   - preload directive present ✓
   - All subdomains support HTTPS ✓

2. Submit domain at: https://hstspreload.org/

3. Benefits:
   - Browsers will always use HTTPS, even on first visit
   - Protection against initial HTTP request vulnerability

## Maintenance

- HSTS max-age is set to 1 year
- Review security headers annually
- Monitor for any deprecation notices from GitHub Pages
- Keep up-to-date with security best practices

## References

- [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [MDN HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [HSTS Preload](https://hstspreload.org/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
