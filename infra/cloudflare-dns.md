# Cloudflare DNS + Security

## DNS records
| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `dashboard` | `<railway-service>.up.railway.app` | Proxied (orange cloud) |

## Security settings
- **SSL/TLS mode**: Full (strict)
- **Always Use HTTPS**: On
- **Automatic HTTPS Rewrites**: On
- **Bot Fight Mode**: On (free tier)
- **Security Level**: Medium

## WAF rules
- Rate limit `/api/refresh/*` → 10 req / min per IP
- Rate limit `/api/*` → 60 req / min per IP
- Optional: country allowlist (AU + your travel countries)

## Caching
- Default cache everything on static assets
- Bypass cache for `/api/*` and authenticated pages (`Cache-Control: private`)
