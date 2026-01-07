# GitHub Pages Configuration

This directory contains configuration for GitHub Pages.

## HTTPS Enforcement

GitHub Pages automatically provides HTTPS for custom domains. To ensure HTTPS is enforced:

1. Go to your repository Settings
2. Navigate to "Pages" section
3. Under "Custom domain", verify that `valenciavguides.es` is configured
4. **Enable "Enforce HTTPS" checkbox** - This is critical for GPS functionality

### DNS Configuration

Your DNS should have the following records:
- A record pointing to GitHub Pages IPs (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153)
- Or CNAME record pointing to `valenciavguides.github.io`

### Verification

After enabling "Enforce HTTPS" in GitHub Pages settings, all HTTP requests will automatically redirect to HTTPS.

The application includes additional HTTPS enforcement via:
- JavaScript redirect in `codigo-padre.html` (for immediate redirect)
- CSP meta tag `upgrade-insecure-requests` (for resource loading)
