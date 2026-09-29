#!/usr/bin/env bash
# Prueba de la API: juega una partida completa contra la API eligiendo
# siempre la primera opción. Sirve para validar cualquier API que cumpla
# el contrato, la hayas escrito vos, la IA o la de referencia.
#
# Uso: bash probar-api.sh [jugador] [url-de-la-api] [generacion]
set -euo pipefail

JUGADOR="${1:-bot}"
API="${2:-http://localhost:3000}"
GENERACION="${3:-1}"

falla() { echo "❌ $1"; exit 1; }

echo "▶ Salud"
curl -sf "$API/health"; echo

echo "▶ Validaciones"
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/api/partidas" -H 'Content-Type: application/json' -d '{}')
[ "$CODIGO" = "400" ] || falla "sin jugador debería dar 400 y dio $CODIGO"
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/api/partidas" -H 'Content-Type: application/json' \
  -d '{"jugador":"x","generacion":42}')
[ "$CODIGO" = "400" ] || falla "una generación inválida debería dar 400 y dio $CODIGO"
echo "  400 sin jugador y con generación inválida"

echo "▶ Crear partida para $JUGADOR (generación $GENERACION)"
PARTIDA=$(curl -sf -X POST "$API/api/partidas" -H 'Content-Type: application/json' \
  -d "{\"jugador\":\"$JUGADOR\",\"generacion\":$GENERACION}")
ID=$(echo "$PARTIDA" | sed -E 's/.*"id":"([^"]+)".*/\1/')
echo "  id: $ID"

for i in $(seq 1 10); do
  RONDA=$(curl -sf "$API/api/partidas/$ID/ronda")
  OPCION=$(echo "$RONDA" | sed -E 's/.*"opciones":\["([^"]+)".*/\1/')
  IMAGEN=$(echo "$RONDA" | sed -E 's/.*"imagen":"([^"]+)".*/\1/')

  # La imagen tiene que salir de la API: la URL de PokeAPI lleva el número del Pokémon
  case "$IMAGEN" in /api/*) ;; *) falla "la imagen revela la respuesta: $IMAGEN" ;; esac
  TIPO=$(curl -sf -o /dev/null -w '%{content_type}' "$API$IMAGEN")
  case "$TIPO" in image/*) ;; *) falla "la imagen no es una imagen: $TIPO" ;; esac

  # Pedir la ronda otra vez sin responder devuelve la misma
  [ "$(curl -sf "$API/api/partidas/$ID/ronda")" = "$RONDA" ] || falla "pedir la ronda de nuevo cambió el Pokémon"

  if [ "$i" = "1" ]; then
    PISTA=$(curl -sf -X POST "$API/api/partidas/$ID/pista")
    echo "$PISTA" | grep -q '"tipos":\[' || falla "la pista no trae tipos: $PISTA"
    echo "  pista de la ronda 1: $PISTA"
  fi

  # Dos respuestas al mismo tiempo: solo una puede contar
  CUERPO=$(printf '{"opcion":"%s"}' "$OPCION")
  SALIDA=$(mktemp)
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/api/partidas/$ID/respuesta" \
    -H 'Content-Type: application/json' -d "$CUERPO" >>"$SALIDA" &
  RESPUESTA=$(curl -s -w '\n%{http_code}' -X POST "$API/api/partidas/$ID/respuesta" \
    -H 'Content-Type: application/json' -d "$CUERPO")
  wait
  echo "$RESPUESTA" | tail -1 >>"$SALIDA"
  [ "$(sort "$SALIDA" | tr '\n' ' ')" = "200 409 " ] || falla "dos respuestas simultáneas dieron: $(tr '\n' ' ' <"$SALIDA")"
  rm -f "$SALIDA"

  # Si la respuesta ganadora fue la de segundo plano, se consulta el estado
  RESPUESTA=$(echo "$RESPUESTA" | sed '$d')
  if ! echo "$RESPUESTA" | grep -q '"correcta"'; then
    RESPUESTA=$(curl -sf "$API/api/partidas/$ID" | sed -E 's/.*"resumen":\[(.*)\]\}$/\1/' | sed -E 's/.*\{/{/')
    PUNTAJE=$(curl -sf "$API/api/partidas/$ID" | sed -E 's/.*"puntaje":([0-9]+).*/\1/')
  else
    PUNTAJE=$(echo "$RESPUESTA" | sed -E 's/.*"puntaje":([0-9]+).*/\1/')
  fi
  CORRECTA=$(echo "$RESPUESTA" | grep -oE '"correcta":(true|false)' | head -1 | cut -d: -f2)
  NOMBRE=$(echo "$RESPUESTA" | grep -o '"nombre":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
  if [ "$CORRECTA" = "true" ]; then MARCA="✔"; else MARCA="✘"; fi
  printf '  Ronda %2d  %s  elegí %-12s era %-12s puntaje %s\n' "$i" "$MARCA" "$OPCION" "$NOMBRE" "$PUNTAJE"
done

echo "▶ Estado final"
ESTADO=$(curl -sf "$API/api/partidas/$ID")
echo "$ESTADO" | grep -q '"estado":"terminada"' || falla "la partida no quedó terminada"
echo "  terminada"

echo "▶ Ranking"
curl -sf "$API/api/ranking"; echo
echo "✅ La API pasó todas las pruebas"
