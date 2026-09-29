# nginx sin privilegios: corre con un usuario sin permisos de root y escucha en el 8080
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css app.js /usr/share/nginx/html/

EXPOSE 8080
# 127.0.0.1 y no localhost: dentro del contenedor localhost resuelve primero a
# IPv6 (::1) y nginx solo escucha en IPv4, así que el chequeo fallaría.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
