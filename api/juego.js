// Lógica del juego ¿Quién es ese Pokémon?
// El servidor guarda la respuesta correcta: el navegador nunca la recibe
// antes de que la persona responda.
const crypto = require('crypto');
const { valkey } = require('./valkey');
const { GENERACIONES, listarNombres, obtenerPokemon, obtenerImagen } = require('./pokeapi');

const RONDAS = 10;
const TTL_PARTIDA = 60 * 60; // una partida abandonada desaparece en una hora
const PUNTOS_ACIERTO = 100;
const BONUS_RACHA = 20; // bonus por cada acierto previo consecutivo
const COSTO_PISTA = 30; // se descuenta de los puntos del acierto
const GENERACION_POR_DEFECTO = 1;

const clave = (id) => `partida:${id}`;

// Escribe los campos solo si `campo` sigue valiendo `esperado`, en un único
// paso atómico. Así dos pedidos simultáneos no pueden responder dos veces
// la misma ronda ni pisarse al crear la siguiente.
const HSET_SI_CAMPO = `
if redis.call('HGET', KEYS[1], ARGV[1]) ~= ARGV[2] then return 0 end
redis.call('HSET', KEYS[1], unpack(ARGV, 3))
return 1`;

async function hSetSiCampo(id, campo, esperado, valores) {
  const argumentos = [campo, esperado, ...Object.entries(valores).flat().map(String)];
  return (await valkey.eval(HSET_SI_CAMPO, { keys: [clave(id)], arguments: argumentos })) === 1;
}

class ErrorDeJuego extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

function mezclar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

const urlImagen = (id, ronda) => `/api/partidas/${id}/imagen?ronda=${ronda}`;

async function leerPartida(id) {
  const p = await valkey.hGetAll(clave(id));
  if (!p || Object.keys(p).length === 0) {
    throw new ErrorDeJuego(404, 'La partida no existe o expiró');
  }
  return {
    jugador: p.jugador,
    estado: p.estado,
    generacion: Number(p.generacion ?? GENERACION_POR_DEFECTO),
    ronda: Number(p.ronda),
    puntaje: Number(p.puntaje),
    racha: Number(p.racha),
    aciertos: Number(p.aciertos),
    pokemonId: p.pokemonId ? Number(p.pokemonId) : null,
    opciones: p.opciones ? JSON.parse(p.opciones) : [],
    pista: p.pista === '1',
    usados: JSON.parse(p.usados || '[]'),
    resumen: JSON.parse(p.resumen || '[]'),
  };
}

function generaciones() {
  return Object.entries(GENERACIONES).map(([generacion, g]) => ({ generacion: Number(generacion), ...g }));
}

async function crearPartida(jugador, generacion = GENERACION_POR_DEFECTO) {
  const id = crypto.randomUUID();
  await valkey
    .multi()
    .hSet(clave(id), {
      jugador,
      estado: 'jugando',
      generacion: String(generacion),
      ronda: '0',
      puntaje: '0',
      racha: '0',
      aciertos: '0',
      pokemonId: '',
      opciones: '',
      pista: '0',
      usados: '[]',
      resumen: '[]',
    })
    .expire(clave(id), TTL_PARTIDA)
    .incr('stats:partidas')
    .exec();
  return { id, jugador, total: RONDAS, generacion };
}

// Estado público de la partida, para retomarla después de recargar la página.
// No incluye el Pokémon de la ronda pendiente.
async function estadoPartida(id) {
  const p = await leerPartida(id);
  return {
    id,
    jugador: p.jugador,
    estado: p.estado,
    generacion: p.generacion,
    ronda: p.ronda,
    total: RONDAS,
    puntaje: p.puntaje,
    racha: p.racha,
    aciertos: p.aciertos,
    pendiente: Boolean(p.pokemonId),
    resumen: p.resumen,
  };
}

async function siguienteRonda(id) {
  const p = await leerPartida(id);
  if (p.estado !== 'jugando') throw new ErrorDeJuego(409, 'La partida ya terminó');

  // Si hay una ronda sin responder, se devuelve la misma:
  // recargar la página no sirve para cambiar de Pokémon.
  if (p.pokemonId) {
    return { ronda: p.ronda, total: RONDAS, imagen: urlImagen(id, p.ronda), opciones: p.opciones };
  }

  const { desde, hasta } = GENERACIONES[p.generacion];
  let pokemonId;
  do {
    pokemonId = desde + crypto.randomInt(hasta - desde + 1);
  } while (p.usados.includes(pokemonId));

  const [pokemon, nombres] = await Promise.all([obtenerPokemon(pokemonId), listarNombres(p.generacion)]);

  const distractores = new Set();
  while (distractores.size < 3) {
    const nombre = nombres[crypto.randomInt(nombres.length)];
    if (nombre !== pokemon.nombre) distractores.add(nombre);
  }
  const opciones = mezclar([pokemon.nombre, ...distractores]);
  const ronda = p.ronda + 1;

  const creada = await hSetSiCampo(id, 'pokemonId', '', {
    pokemonId,
    opciones: JSON.stringify(opciones),
    ronda,
    pista: '0',
    usados: JSON.stringify([...p.usados, pokemonId]),
  });
  // Otro pedido creó la ronda al mismo tiempo: se devuelve esa.
  if (!creada) return siguienteRonda(id);

  return { ronda, total: RONDAS, imagen: urlImagen(id, ronda), opciones };
}

async function imagenRonda(id) {
  const p = await leerPartida(id);
  if (!p.pokemonId) throw new ErrorDeJuego(409, 'No hay una ronda pendiente');
  return obtenerImagen(p.pokemonId);
}

// La pista muestra los tipos antes de responder. Pedirla otra vez en la
// misma ronda devuelve lo mismo y no cobra de nuevo.
async function pedirPista(id) {
  const p = await leerPartida(id);
  if (p.estado !== 'jugando' || !p.pokemonId) {
    throw new ErrorDeJuego(409, 'No hay una ronda pendiente de respuesta');
  }
  const pokemon = await obtenerPokemon(p.pokemonId);
  if (!p.pista) await hSetSiCampo(id, 'pokemonId', String(p.pokemonId), { pista: '1' });
  return { tipos: pokemon.tipos, costo: COSTO_PISTA };
}

async function responder(id, opcion) {
  const p = await leerPartida(id);
  if (p.estado !== 'jugando' || !p.pokemonId) {
    throw new ErrorDeJuego(409, 'No hay una ronda pendiente de respuesta');
  }
  if (!p.opciones.includes(opcion)) {
    throw new ErrorDeJuego(400, 'La opción no pertenece a esta ronda');
  }

  const pokemon = await obtenerPokemon(p.pokemonId);
  const correcta = opcion === pokemon.nombre;
  const costo = p.pista ? COSTO_PISTA : 0;
  const puntos = correcta ? PUNTOS_ACIERTO + BONUS_RACHA * p.racha - costo : 0;
  const puntaje = p.puntaje + puntos;
  const racha = correcta ? p.racha + 1 : 0;
  const aciertos = p.aciertos + (correcta ? 1 : 0);
  const terminada = p.ronda >= RONDAS;
  const resumen = [...p.resumen, { id: pokemon.id, nombre: pokemon.nombre, imagen: pokemon.imagen, correcta, puntos, pista: p.pista }];

  // Solo el primer pedido que llega con esta ronda pendiente la responde.
  const respondida = await hSetSiCampo(id, 'pokemonId', String(p.pokemonId), {
    puntaje,
    racha,
    aciertos,
    pokemonId: '',
    opciones: '',
    resumen: JSON.stringify(resumen),
    estado: terminada ? 'terminada' : 'jugando',
  });
  if (!respondida) throw new ErrorDeJuego(409, 'No hay una ronda pendiente de respuesta');

  if (terminada) await guardarResultado(p.jugador, puntaje, aciertos, p.generacion);

  return { correcta, puntos, pokemon, puntaje, racha, aciertos, ronda: p.ronda, total: RONDAS, terminada, pista: p.pista };
}

async function guardarResultado(jugador, puntaje, aciertos, generacion) {
  // En el ranking queda el mejor puntaje de cada jugador/a
  const record = await valkey.zScore('ranking', jugador);
  const multi = valkey.multi();
  if (record === null || puntaje > record) {
    multi.zAdd('ranking', { score: puntaje, value: jugador });
  }
  multi.lPush('historial', JSON.stringify({ jugador, puntaje, aciertos, total: RONDAS, generacion, fecha: new Date().toISOString() }));
  multi.lTrim('historial', 0, 9);
  await multi.exec();
}

async function ranking() {
  const plano = await valkey.sendCommand(['ZRANGE', 'ranking', '0', '9', 'REV', 'WITHSCORES']);
  const resultado = [];
  for (let i = 0; i < plano.length; i += 2) {
    resultado.push({ jugador: String(plano[i]), puntaje: Number(plano[i + 1]) });
  }
  return resultado;
}

async function historial() {
  const items = await valkey.lRange('historial', 0, 9);
  return items.map((item) => JSON.parse(item));
}

module.exports = {
  ErrorDeJuego, GENERACIONES, generaciones, crearPartida, estadoPartida, siguienteRonda,
  imagenRonda, pedirPista, responder, ranking, historial,
};
