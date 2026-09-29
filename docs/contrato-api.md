# Contrato de la API

Este es el contrato que cumple la API de referencia. Cualquier implementación que lo respete, la escribas vos o la genere una IA, funciona con el frontend y pasa la prueba `scripts/probar-api.sh`.

## Rutas

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /health` | — | `ok` (texto) si Valkey responde; `503` si no |
| `GET /api/info` | — | `{ version, partidas }` |
| `GET /api/generaciones` | — | `[{ generacion, region, desde, hasta }]`. La `0` mezcla todas |
| `POST /api/partidas` | `{ "jugador": "Roxs", "generacion": 1 }` | `201` · `{ id, jugador, total, generacion }`. Sin `jugador` o con una `generacion` fuera de 0 a 9: `400`. `generacion` es opcional (por defecto `1`) |
| `GET /api/partidas/:id` | — | `{ id, jugador, estado, generacion, ronda, total, puntaje, racha, aciertos, pendiente, resumen }`. Sirve para retomar la partida; no incluye el Pokémon pendiente |
| `GET /api/partidas/:id/ronda` | — | `{ ronda, total, imagen, opciones: [4 nombres] }`. Nunca incluye la respuesta correcta: `imagen` es una ruta de la propia API |
| `GET /api/partidas/:id/imagen` | — | La imagen de la ronda pendiente (PNG). Sin ronda pendiente: `409` |
| `POST /api/partidas/:id/pista` | — | `{ tipos, costo }`. Marca la ronda como "con pista"; pedirla de nuevo no cobra dos veces. Sin ronda pendiente: `409` |
| `POST /api/partidas/:id/respuesta` | `{ "opcion": "Pikachu" }` | `{ correcta, puntos, pokemon: { id, nombre, tipos, imagen, altura, peso }, puntaje, racha, aciertos, ronda, total, terminada, pista }` |
| `GET /api/ranking` | — | Top 10: `[{ jugador, puntaje }]`, de mayor a menor |
| `GET /api/historial` | — | Últimas 10 partidas: `[{ jugador, puntaje, aciertos, total, generacion, fecha }]` |

Cualquier otra ruta bajo `/api` devuelve `404` con `{ error }`; un cuerpo que no es JSON válido, `400`.

## Reglas del juego

- Cada partida tiene **10 rondas** con Pokémon de la generación elegida (por defecto la **primera**, IDs 1 a 151), sin repetir.
- Cada ronda ofrece **4 opciones**: la correcta y 3 distractores distintos.
- Un acierto suma **100 puntos + 20 por cada acierto consecutivo previo**. Un error reinicia la racha.
- La **pista** muestra los tipos antes de responder y descuenta **30 puntos** del acierto de esa ronda. Si se falla, no descuenta nada.
- La imagen de la ronda se sirve desde la API: la URL original de PokeAPI lleva el número del Pokémon y delataría la respuesta.
- Responder dos veces a la vez cuenta **una sola vez**: la escritura en Valkey es atómica (script Lua) y el segundo pedido recibe `409`.
- Pedir la ronda de nuevo sin responder devuelve **la misma ronda**.
- Responder con una opción que no pertenece a la ronda devuelve `400`. Responder sin ronda pendiente, `409`. Una partida inexistente o expirada, `404`.
- Al terminar, el ranking guarda **el mejor puntaje** de cada jugador/a.

## Modelo de datos en Valkey

| Clave | Tipo | Uso | Expira |
|---|---|---|---|
| `pokeapi:lista:gen{n}` | String (JSON) | Nombres de los Pokémon de la generación `n` (`gen0` = todas) | 24 h |
| `pokeapi:pokemon:{id}` | String (JSON) | Datos de un Pokémon ya consultado | 24 h |
| `pokeapi:imagen:{id}` | String (JSON, imagen en base64) | Imagen de un Pokémon ya consultado (~100-300 KB cada una) | 24 h |
| `partida:{id}` | Hash | Estado de una partida en curso | 1 h |
| `ranking` | Sorted set | Mejor puntaje por jugador/a | No |
| `historial` | List | Últimas 10 partidas (se recorta con `LTRIM`) | No |
| `stats:partidas` | String (contador) | Partidas creadas | No |
