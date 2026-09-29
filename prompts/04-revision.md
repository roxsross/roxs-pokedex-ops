# Prompt 4 · Revisar el código

```text
Actuá como revisor/a de código con foco en seguridad y operación.
Revisá esta API y este frontend:
[pegá los archivos]

Evaluá SOLO estos puntos y respondé en una tabla con: hallazgo, severidad
(alta/media/baja), archivo y línea, y cómo lo verifico con un comando o prueba.
1. ¿La respuesta correcta puede llegar al navegador antes de responder?
2. ¿Se valida la entrada (jugador, opción, id de partida)?
3. ¿Hay riesgo de inyección de HTML en el frontend?
4. ¿Qué pasa si PokeAPI está caída o tarda? ¿Y si Valkey no está?
5. ¿Se respeta el uso justo de PokeAPI (caché)?
6. ¿Las claves de Valkey tienen la expiración adecuada?
7. ¿Hay condiciones de carrera (por ejemplo, responder dos veces a la vez)?
No reescribas el código: solo el diagnóstico.
```

## Después del diagnóstico: corregir

Una buena revisión encuentra dos problemas: la imagen revela la respuesta y
responder dos veces a la vez suma doble. Para corregirlos:

```text
Corregí estos dos problemas en la API, sin cambiar las demás rutas ni sus
campos y sin agregar dependencias:

1. La imagen revela la respuesta. En GET /api/partidas/:id/ronda, el campo
   imagen tiene que ser una ruta de la propia API:
   /api/partidas/:id/imagen?ronda=<número de ronda>.
   Agregá GET /api/partidas/:id/imagen, que devuelve la imagen de la ronda
   pendiente con su Content-Type (image/png). La API la descarga de PokeAPI una
   sola vez y la guarda en Valkey en "pokeapi:imagen:{id}" (en base64, TTL 24 h).
   Sin ronda pendiente: 409.

2. Responder dos veces a la vez suma doble. La escritura de la respuesta tiene
   que ser atómica: usá un script Lua (EVAL) que actualice el hash de la partida
   solo si el campo pokemonId sigue siendo el de la ronda pendiente. El segundo
   pedido recibe 409.

Devolveme solo los archivos modificados y, aparte, la lista de cambios.
No incluyas el nombre del archivo como comentario dentro de los archivos.
```