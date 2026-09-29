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

Salida: index.html, styles.css y app.js. Sin explicaciones entre los archivos.
```
