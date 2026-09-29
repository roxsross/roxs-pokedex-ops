# Prompt 2 · Generar la API

```text
Contexto: API para el juego "¿Quién es ese Pokémon?". Node.js 24, CommonJS,
Express 5 y la librería oficial "redis" (node-redis v5) para conectarse a Valkey.
Los datos de los Pokémon vienen de PokeAPI (https://pokeapi.co/api/v2).

Contrato (respetá nombres de rutas, campos y claves exactamente):
- GET /health: PING a Valkey. Responde el texto "ok", o 503.
- GET /api/info: { version (de package.json), partidas (contador stats:partidas) }.
- POST /api/partidas { jugador } (máx. 20 caracteres, obligatorio o 400):
  crea el hash partida:{uuid} con TTL de 1 hora e incrementa stats:partidas.
  Responde 201 con { id, jugador, total: 10 }.
- GET /api/partidas/:id/ronda: elige un Pokémon al azar entre 1 y 151 que no se
  haya usado en la partida, más 3 nombres distintos como distractores, y mezcla
  las 4 opciones. Guarda la ronda pendiente en el hash. Responde
  { ronda, total, imagen, opciones }. Si hay una ronda sin responder, devuelve
  la misma. NUNCA incluye el nombre correcto por separado.
- POST /api/partidas/:id/respuesta { opcion }: 400 si la opción no es de la
  ronda; 409 si no hay ronda pendiente. Acierto: 100 puntos + 20 por cada
  acierto consecutivo previo. Responde { correcta, puntos, pokemon: { id, nombre,
  tipos: [{ clave, nombre en español }], imagen, altura, peso }, puntaje, racha,
  aciertos, ronda, total, terminada }.
  Al terminar la ronda 10: guarda en el sorted set "ranking" solo si supera el
  récord del jugador, y agrega un resumen a la lista "historial" (máximo 10).
- GET /api/ranking: top 10 del sorted set, [{ jugador, puntaje }].
- GET /api/historial: la lista "historial", [{ jugador, puntaje, aciertos, total, fecha }].
- Partida inexistente o expirada: 404. Un id que no tiene formato UUID: 404,
  sin consultar Valkey. Pedir una ronda de una partida terminada: 409.
- Cualquier otra ruta bajo /api: 404 con { error }. Un cuerpo que no es JSON
  válido: 400 con { error }.

PokeAPI y caché:
- Nombres: GET /pokemon?limit=151, cacheado en "pokeapi:lista:151".
- Detalle: GET /pokemon/{id}, cacheado en "pokeapi:pokemon:{id}".
  Imagen: sprites.other["official-artwork"].front_default.
- Caché con TTL de 24 horas (patrón cache-aside) y timeout de 5 segundos por consulta.
- Nombres legibles: "mr-mime" → "Mr. Mime", "nidoran-f" → "Nidoran♀",
  "farfetchd" → "Farfetch'd"; el resto con mayúscula inicial.
- Si PokeAPI falla, la API responde 502 con un mensaje claro.

Configuración y resiliencia:
- PORT (3000), VALKEY_URL (redis://localhost:6379), POKEAPI_URL.
- Listener de "error" en el cliente, disableOfflineQueue: true, y 503 si el
  cliente no está listo. La app arranca aunque Valkey no esté disponible.
- Manejo de errores centralizado en un middleware de Express.
- Apagado ordenado: al recibir SIGTERM o SIGINT, dejar de aceptar conexiones,
  cerrar el cliente de Valkey y terminar el proceso.

Restricciones: solo express y redis. Separá el código en estos módulos, todos
en la raíz de api/: valkey.js (conexión), pokeapi.js (acceso a PokeAPI con
caché), juego.js (lógica del juego) y server.js (rutas HTTP y arranque).

Salida: api/package.json, api/valkey.js, api/pokeapi.js, api/juego.js,
api/server.js, api/Dockerfile (node:24-alpine, usuario node, CMD con server.js,
HEALTHCHECK contra /health con wget) y api/.dockerignore.
Formato: un bloque de código por archivo, con la ruta como título justo antes
del bloque (por ejemplo: ### api/server.js). Nunca pongas la ruta como
comentario dentro del archivo: en JSON y en el Dockerfile rompe el build.
Sin explicaciones entre los archivos.
```