# Prompt 1 · Diseñar la arquitectura

```text
Actuá como arquitecto/a de software. Necesito diseñar un juego web
"¿Quién es ese Pokémon?" para un laboratorio de contenedores.

Requisitos funcionales:
- La persona ingresa su nombre y juega 10 rondas.
- En cada ronda ve la silueta de un Pokémon de la primera generación y elige
  entre 4 nombres. Al responder se revela la imagen y sus tipos.
- Se guarda un ranking con el mejor puntaje de cada jugador/a y un historial
  de las últimas partidas.
- Los datos de los Pokémon vienen de PokeAPI (https://pokeapi.co).

Requisitos no funcionales:
- Frontend y backend separados, cada uno en su contenedor.
- Respetar la política de uso justo de PokeAPI (cachear los recursos).
- La respuesta correcta nunca debe llegar al navegador antes de responder.
- Las partidas abandonadas no deben acumularse para siempre.
- Todo tiene que levantarse con Docker Compose.

Proponé: los componentes y su responsabilidad, qué base de datos usarías y por
qué, el modelo de datos, y las rutas de la API. Si evaluás alternativas
(por ejemplo, PostgreSQL frente a Valkey), compará ventajas y desventajas en una tabla.
No escribas código todavía.
```
