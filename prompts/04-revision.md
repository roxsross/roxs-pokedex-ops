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
