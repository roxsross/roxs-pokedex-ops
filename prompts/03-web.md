# Prompt 3 · Generar el frontend

```text
Contexto: frontend del juego "¿Quién es ese Pokémon?". HTML, CSS y JavaScript
sin frameworks ni librerías externas. Lo sirve nginx, que reenvía /api y /health
a la API, así que todas las llamadas usan rutas relativas.

API disponible:
- POST /api/partidas { jugador } → { id, jugador, total }
- GET /api/partidas/:id/ronda → { ronda, total, imagen, opciones }
- POST /api/partidas/:id/respuesta { opcion } → { correcta, puntos, pokemon:
  { nombre, tipos: [{ clave, nombre }], imagen }, puntaje, racha, aciertos,
  ronda, total, terminada }
- GET /api/ranking → [{ jugador, puntaje }]
- GET /api/historial → [{ jugador, puntaje, aciertos, total, fecha }]
- GET /health → "ok"

Pantallas:
1. Inicio: título "¿Quién es ese Pokémon?", campo de nombre, botón Jugar,
   y dos tableros: ranking y últimas partidas.
2. Juego: marcador (jugador, ronda, puntaje, racha), barra de progreso, la
   imagen como silueta negra (CSS filter: brightness(0)) sobre un fondo de rayos
   animado, y 4 botones de opción. Al responder: revelar la imagen con una
   transición, marcar en verde la correcta y en rojo la elegida si falló,
   mostrar el nombre y los tipos con sus colores, y un botón Siguiente.
   Atajos de teclado: 1 a 4 para responder.
3. Fin: puntaje grande, aciertos, un mensaje según el resultado y un botón
   para volver a jugar.
Además, un indicador de salud en la barra superior que consulte /health.

Requisitos:
- Mostrá todo texto que venga de la API con textContent, nunca con innerHTML.
- Estilo: modo oscuro, acentos rojo y amarillo, responsive.
- Mostrá los errores de la API en pantalla.

Servidor web:
- nginx.conf: escucha en el 8080, sirve los archivos estáticos y reenvía
  /api/ y /health a http://api:3000. Usá el DNS de Docker (resolver 127.0.0.11)
  y una variable en proxy_pass, para que nginx siga encontrando a la API si su
  contenedor se recrea.
- Dockerfile: imagen nginxinc/nginx-unprivileged:1.27-alpine y HEALTHCHECK con
  wget contra http://127.0.0.1:8080/ (no localhost: resuelve primero a IPv6 y
  nginx escucha en IPv4).

Salida: web/index.html, web/styles.css, web/app.js, web/nginx.conf y
web/Dockerfile.
Formato: un bloque de código por archivo, con la ruta como título justo antes
del bloque (por ejemplo: ### api/server.js). Nunca pongas la ruta como
comentario dentro del archivo: en JSON y en el Dockerfile rompe el build.
Sin explicaciones entre los archivos.
```