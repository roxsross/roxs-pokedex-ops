# Prompt 5 · Agregar una funcionalidad con cambio mínimo

Usá este prompt una vez por funcionalidad, reemplazando la última parte por una
de las especificaciones de abajo. `scripts/probar-api.sh` exige las cuatro.

```text
Este es el código actual de la API y del frontend:
[pegá los archivos involucrados]

Restricciones:
- No modifiques el comportamiento de las rutas existentes ni sus campos.
- No agregues dependencias.
- La respuesta correcta no puede llegar al navegador antes de responder.
Devolveme solo los archivos modificados y, aparte, la lista de cambios.
No incluyas el nombre del archivo como comentario dentro de los archivos.

Quiero agregar:
[pegá acá una de las especificaciones]
```

## Especificación 1 · Pista

```text
Una pista que muestra los tipos del Pokémon antes de responder.
- POST /api/partidas/:id/pista → { tipos, costo: 30 }. Sin ronda pendiente: 409.
- Marca la ronda como "con pista" en el hash; pedirla otra vez no cobra dos veces.
- Si se acierta con pista: 100 + 20 por racha − 30. Si se falla, no descuenta nada.
- POST /respuesta suma el campo pista (true o false).
- Frontend: botón "💡 Pista" y tecla P.
```

## Especificación 2 · Elegir generación

```text
Elegir la generación de Pokémon al crear la partida.
- GET /api/generaciones → [{ generacion, region, desde, hasta }], con:
  0 Todas 1-1025, 1 Kanto 1-151, 2 Johto 152-251, 3 Hoenn 252-386,
  4 Sinnoh 387-493, 5 Teselia 494-649, 6 Kalos 650-721, 7 Alola 722-809,
  8 Galar 810-905, 9 Paldea 906-1025.
- POST /api/partidas acepta "generacion" opcional (por defecto 1). Fuera de 0 a 9: 400.
  La respuesta suma el campo generacion.
- Los nombres salen de GET /pokemon-species?offset=<desde-1>&limit=<cantidad>,
  cacheados en "pokeapi:lista:gen{n}".
- El historial guarda la generación de cada partida.
- Frontend: un selector de generación en la pantalla de inicio.
```

## Especificación 3 · Resumen final

```text
Un resumen con los 10 Pokémon de la partida.
- Cada respuesta agrega al hash de la partida un elemento a "resumen" (lista JSON):
  { id, nombre, imagen, correcta, puntos, pista }.
- Frontend: en la pantalla final, una grilla con los 10 Pokémon, marcando
  aciertos y errores.
```

## Especificación 4 · Continuar la partida al recargar

```text
Poder retomar una partida después de recargar la página.
- GET /api/partidas/:id → { id, jugador, estado, generacion, ronda, total,
  puntaje, racha, aciertos, pendiente, resumen }, en ese orden, con resumen
  como último campo. estado vale "jugando" o "terminada", y pendiente indica
  si hay una ronda sin responder. No incluye el Pokémon de la ronda pendiente.
- Frontend: guarda el id de la partida en localStorage y, al cargar la página,
  ofrece continuarla si sigue en curso.
```