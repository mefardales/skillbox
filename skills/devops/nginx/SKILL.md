---
name: nginx
description: >
  Nginx configuration best practices for web serving, reverse proxying, and
  load balancing. Covers server blocks, SSL/TLS, caching, security headers,
  rate limiting, and performance tuning. Use this skill when writing or
  reviewing Nginx configurations for production deployments.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: devops
  tags: nginx, proxy, ssl, server, loadbalancer
---

# Nginx Configuration Best Practices

## Server Block Structure

Use separate files per virtual host under `conf.d/`. Always redirect HTTP to HTTPS.

```nginx
server {
    listen 80;
    server_name app.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;
    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    root /var/www/app;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Reverse Proxy

Set headers so the backend knows the original client IP and protocol. Set explicit timeouts on every proxy location.

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 5s;
    proxy_read_timeout    60s;
    proxy_send_timeout    60s;
}
```

## SSL/TLS Setup

Use Mozilla's "Intermediate" profile. Do not enable TLSv1.0 or TLSv1.1.

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
```

Automate certificates with certbot: `certbot --nginx -d app.example.com --non-interactive --agree-tos -m ops@example.com`

## Load Balancing

Use `least_conn` for backends with varying response times. Enable `keepalive` to reduce TCP overhead.

```nginx
upstream app_backend {
    least_conn;
    server 10.0.1.10:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3000 backup;
    keepalive 32;
}

server {
    location / {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}
```

## Caching

Use `proxy_cache` for backend responses. Serve stale content when the backend is unreachable.

```nginx
proxy_cache_path /var/cache/nginx/app levels=1:2 keys_zone=app_cache:10m max_size=1g inactive=60m use_temp_path=off;

location /api/ {
    proxy_pass http://app_backend;
    proxy_cache app_cache;
    proxy_cache_valid 200 10m;
    proxy_cache_valid 404 1m;
    proxy_cache_use_stale error timeout updating;
    add_header X-Cache-Status $upstream_cache_status;
}
```

## Security Headers

Add headers in a shared snippet and include it in every server block. Use `always` so headers are sent on error responses too.

```nginx
# /etc/nginx/snippets/security-headers.conf
add_header X-Frame-Options        "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy         "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self';" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header Permissions-Policy      "camera=(), microphone=(), geolocation=()" always;
```

## Rate Limiting

Use `limit_req` to protect against brute-force attacks. Return 429 status. Use `nodelay` to reject excess requests immediately.

```nginx
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/s;

server {
    location /auth/login {
        limit_req zone=login burst=10 nodelay;
        limit_req_status 429;
        proxy_pass http://app_backend;
    }
}
```

## Gzip Compression

Enable gzip for text-based responses. Use `gzip_comp_level 4` -- levels above 6 give diminishing returns.

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 4;
gzip_min_length 256;
gzip_types text/plain text/css text/javascript application/javascript application/json application/xml image/svg+xml;
```

## WebSocket Proxying

Upgrade the connection and set a high read timeout so Nginx does not close idle connections.

```nginx
location /ws/ {
    proxy_pass http://app_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400s;
}
```

## Static File Serving

Serve static files directly. Use fingerprinted filenames for cache busting. Disable access_log for static assets to reduce I/O.

```nginx
location /static/ {
    alias /var/www/app/static/;
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}
```
