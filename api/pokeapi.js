// Acceso a PokeAPI con caché en Valkey (patrón cache-aside).
// La política de uso justo de PokeAPI pide cachear los recursos localmente:
// cada Pokémon se consulta una sola vez y después se sirve desde Valkey.
const { valkey } = require('./valkey');

const POKEAPI_URL = process.env.POKEAPI_URL || 'https://pokeapi.co/api/v2';
const TTL_CACHE = 60 * 60 * 24; // 24 horas

// Rango de IDs de cada generación. La 0 mezcla todas.
const GENERACIONES = {
  0: { region: 'Todas', desde: 1, hasta: 1025 },
  1: { region: 'Kanto', desde: 1, hasta: 151 },
  2: { region: 'Johto', desde: 152, hasta: 251 },
  3: { region: 'Hoenn', desde: 252, hasta: 386 },
  4: { region: 'Sinnoh', desde: 387, hasta: 493 },
  5: { region: 'Teselia', desde: 494, hasta: 649 },
  6: { region: 'Kalos', desde: 650, hasta: 721 },
  7: { region: 'Alola', desde: 722, hasta: 809 },
  8: { region: 'Galar', desde: 810, hasta: 905 },
  9: { region: 'Paldea', desde: 906, hasta: 1025 },
};

const TIPOS = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', grass: 'Planta', electric: 'Eléctrico',
  ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador',
  psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón',
  dark: 'Siniestro', steel: 'Acero', fairy: 'Hada',
};

// Nombres de especie cuyo guion o símbolo forma parte del nombre oficial
const NOMBRES_ESPECIALES = {
  'nidoran-f': 'Nidoran♀',
  'nidoran-m': 'Nidoran♂',
  'mr-mime': 'Mr. Mime',
  'mr-rime': 'Mr. Rime',
  'mime-jr': 'Mime Jr.',
  farfetchd: "Farfetch'd",
  sirfetchd: "Sirfetch'd",
  'ho-oh': 'Ho-Oh',
  'porygon-z': 'Porygon-Z',
  'type-null': 'Type: Null',
  'jangmo-o': 'Jangmo-o',
  'hakamo-o': 'Hakamo-o',
  'kommo-o': 'Kommo-o',
  flabebe: 'Flabébé',
  'wo-chien': 'Wo-Chien',
  'chien-pao': 'Chien-Pao',
  'ting-lu': 'Ting-Lu',
  'chi-yu': 'Chi-Yu',
};

function formatearNombre(nombre) {
  if (NOMBRES_ESPECIALES[nombre]) return NOMBRES_ESPECIALES[nombre];
  return nombre
    .split('-')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

async function pedirJson(ruta) {
  const res = await fetch(`${POKEAPI_URL}${ruta}`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`PokeAPI respondió ${res.status} para ${ruta}`);
  return res.json();
}

// Cache-aside: primero se busca en Valkey; si no está, se pide a PokeAPI
// y se guarda con un TTL para que la caché se renueve sola.
async function conCache(clave, obtener) {
  const guardado = await valkey.get(clave);
  if (guardado) return JSON.parse(guardado);
  const valor = await obtener();
  await valkey.setEx(clave, TTL_CACHE, JSON.stringify(valor));
  return valor;
}

// Se usan los nombres de especie (y no los de /pokemon) porque no llevan
// la forma: "deoxys" y no "deoxys-normal".
async function listarNombres(generacion) {
  const { desde, hasta } = GENERACIONES[generacion];
  return conCache(`pokeapi:lista:gen${generacion}`, async () => {
    const datos = await pedirJson(`/pokemon-species?offset=${desde - 1}&limit=${hasta - desde + 1}`);
    return datos.results.map((p) => formatearNombre(p.name));
  });
}

async function obtenerPokemon(id) {
  return conCache(`pokeapi:pokemon:${id}`, async () => {
    const p = await pedirJson(`/pokemon/${id}`);
    return {
      id: p.id,
      nombre: formatearNombre(p.species?.name || p.name),
      tipos: p.types.map((t) => ({ clave: t.type.name, nombre: TIPOS[t.type.name] || t.type.name })),
      imagen: p.sprites?.other?.['official-artwork']?.front_default || p.sprites?.front_default,
      altura: p.height / 10,
      peso: p.weight / 10,
    };
  });
}

// La imagen se descarga en el servidor y se sirve desde la API: la URL
// original lleva el número del Pokémon y delataría la respuesta.
async function obtenerImagen(id) {
  const imagen = await conCache(`pokeapi:imagen:${id}`, async () => {
    const { imagen: url } = await obtenerPokemon(id);
    if (!url) throw new Error(`PokeAPI no tiene imagen para el Pokémon ${id}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`PokeAPI respondió ${res.status} al pedir la imagen ${id}`);
    return {
      tipo: res.headers.get('content-type') || 'image/png',
      datos: Buffer.from(await res.arrayBuffer()).toString('base64'),
    };
  });
  return { tipo: imagen.tipo, datos: Buffer.from(imagen.datos, 'base64') };
}

module.exports = { GENERACIONES, listarNombres, obtenerPokemon, obtenerImagen, formatearNombre };
