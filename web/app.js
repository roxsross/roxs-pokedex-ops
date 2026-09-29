// Frontend del juego. Todo el texto que viene de la API o de otras personas
// se muestra con textContent, nunca con innerHTML, para evitar inyección de HTML.
const $ = (id) => document.getElementById(id);

const COLORES_TIPO = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C', grass: '#7AC74C',
  ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1', ground: '#E2BF65', flying: '#A98FF3',
  psychic: '#F95587', bug: '#A6B91A', rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC',
  dark: '#705746', steel: '#B7B7CE', fairy: '#D685AD',
};

// La partida en curso se recuerda para poder retomarla si se recarga la página
const CLAVE_PARTIDA = 'pokedex-ops:partida';
const CLAVE_JUGADOR = 'pokedex-ops:jugador';
const CLAVE_GENERACION = 'pokedex-ops:generacion';

const estado = { partidaId: null, jugador: '', esperando: false, terminada: false, resumen: [] };

// ---------- Utilidades ----------
async function api(ruta, opciones = {}) {
  const res = await fetch(`/api${ruta}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || `Error ${res.status}`);
  return datos;
}

function mostrar(pantalla) {
  document.querySelectorAll('.pantalla').forEach((p) => {
    p.classList.toggle('activa', p.id === `pantalla-${pantalla}`);
  });
}

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function hace(fechaIso) {
  const s = Math.floor((Date.now() - new Date(fechaIso)) / 1000);
  if (s < 60) return 'hace instantes';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return new Date(fechaIso).toLocaleDateString('es');
}

const numero = (id) => `#${String(id).padStart(3, '0')}`;

function mostrarTipos(tipos) {
  $('tipos').replaceChildren(...tipos.map((t) => {
    const chip = crear('span', 'tipo', t.nombre);
    chip.style.background = COLORES_TIPO[t.clave] || '#64748b';
    return chip;
  }));
}

function mostrarMarcador({ jugador, puntaje, racha }) {
  $('m-jugador').textContent = jugador;
  $('m-puntaje').textContent = puntaje;
  $('m-racha').textContent = racha >= 2 ? `${racha} 🔥` : racha;
}

// ---------- Salud ----------
async function chequearSalud() {
  try {
    const res = await fetch('/health');
    const ok = res.ok && (await res.text()) === 'ok';
    $('salud-punto').className = `punto ${ok ? 'ok' : 'mal'}`;
    $('salud-texto').textContent = ok ? 'API y Valkey en línea' : 'Valkey no disponible';
  } catch {
    $('salud-punto').className = 'punto mal';
    $('salud-texto').textContent = 'API sin respuesta';
  }
}

// ---------- Inicio: generaciones, ranking e historial ----------
let nombresGeneracion = { 1: 'Kanto' };

async function cargarGeneraciones() {
  try {
    const lista = await api('/generaciones');
    nombresGeneracion = Object.fromEntries(lista.map((g) => [g.generacion, g.region]));
    const opciones = lista.map((g) => {
      const texto = g.generacion === 0
        ? `Todas · ${g.hasta} Pokémon`
        : `Gen ${g.generacion} · ${g.region}`;
      const opcion = crear('option', null, texto);
      opcion.value = g.generacion;
      return opcion;
    });
    // "Todas" va al final de la lista
    opciones.push(opciones.shift());
    $('generacion').replaceChildren(...opciones);
    $('generacion').value = localStorage.getItem(CLAVE_GENERACION) || '1';
  } catch {
    // Sin la lista se juega con la generación 1, que ya está en el HTML
  }
}

async function cargarTableros() {
  try {
    const [ranking, historial, info] = await Promise.all([api('/ranking'), api('/historial'), api('/info')]);
    $('info-partidas').textContent = `${info.partidas} partidas jugadas`;

    $('ranking').replaceChildren();
    if (ranking.length === 0) $('ranking').append(crear('li', 'vacio', 'Todavía no hay récords'));
    ranking.forEach((r, i) => {
      const li = crear('li', r.jugador === estado.jugador ? 'propio' : null);
      li.append(crear('span', 'posicion', `${i + 1}`), crear('span', 'nombre', r.jugador), crear('span', 'puntos', r.puntaje));
      $('ranking').append(li);
    });

    $('historial').replaceChildren();
    if (historial.length === 0) $('historial').append(crear('li', 'vacio', 'Todavía no hay partidas'));
    historial.forEach((h) => {
      const li = crear('li');
      const info = crear('span', 'nombre');
      const region = nombresGeneracion[h.generacion ?? 1] ?? `Gen ${h.generacion}`;
      info.append(crear('span', null, h.jugador), document.createElement('br'),
        crear('span', 'detalle', `${h.aciertos}/${h.total} aciertos · ${region} · ${hace(h.fecha)}`));
      li.append(info, crear('span', 'puntos', h.puntaje));
      $('historial').append(li);
    });
  } catch (err) {
    $('error-inicio').textContent = `No se pudieron cargar los tableros: ${err.message}`;
  }
}

// Si quedó una partida sin terminar, se ofrece retomarla
async function buscarPartidaPendiente() {
  const id = localStorage.getItem(CLAVE_PARTIDA);
  if (!id) return;
  try {
    const p = await api(`/partidas/${id}`);
    if (p.estado !== 'jugando') throw new Error('terminada');
    $('continuar-texto').textContent =
      `Tenés una partida sin terminar (${p.jugador}, ronda ${p.ronda}/${p.total}, ${p.puntaje} puntos).`;
    $('continuar').hidden = false;
    $('boton-continuar').onclick = () => retomar(p);
  } catch {
    localStorage.removeItem(CLAVE_PARTIDA);
  }
}

function empezar(partida) {
  estado.partidaId = partida.id;
  estado.jugador = partida.jugador;
  estado.terminada = false;
  estado.resumen = partida.resumen ?? [];
  localStorage.setItem(CLAVE_PARTIDA, partida.id);
  localStorage.setItem(CLAVE_JUGADOR, partida.jugador);
  $('continuar').hidden = true;
  mostrarMarcador({ jugador: partida.jugador, puntaje: partida.puntaje ?? 0, racha: partida.racha ?? 0 });
  mostrar('juego');
  return nuevaRonda();
}

async function retomar(partida) {
  $('error-inicio').textContent = '';
  await empezar(partida);
}

$('boton-descartar').addEventListener('click', () => {
  localStorage.removeItem(CLAVE_PARTIDA);
  $('continuar').hidden = true;
});

$('form-inicio').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  $('error-inicio').textContent = '';
  $('boton-jugar').disabled = true;
  try {
    const generacion = Number($('generacion').value);
    localStorage.setItem(CLAVE_GENERACION, generacion);
    const partida = await api('/partidas', {
      method: 'POST',
      body: JSON.stringify({ jugador: $('jugador').value, generacion }),
    });
    await empezar(partida);
  } catch (err) {
    $('error-inicio').textContent = err.message;
  } finally {
    $('boton-jugar').disabled = false;
  }
});

// ---------- Juego ----------
async function nuevaRonda() {
  $('error-juego').textContent = '';
  $('siguiente').hidden = true;
  $('pista').hidden = true;
  $('pista').disabled = false;
  $('resultado').textContent = '';
  $('resultado').className = 'resultado';
  $('ficha').textContent = '';
  $('tipos').replaceChildren();
  $('opciones').replaceChildren();
  $('silueta').className = 'silueta';
  $('silueta').removeAttribute('src');
  $('cargando').textContent = 'Buscando un Pokémon...';
  $('cargando').hidden = false;

  try {
    const ronda = await api(`/partidas/${estado.partidaId}/ronda`);
    $('m-ronda').textContent = `${ronda.ronda}/${ronda.total}`;
    $('progreso-barra').style.width = `${((ronda.ronda - 1) / ronda.total) * 100}%`;

    $('silueta').onload = () => {
      $('cargando').hidden = true;
      $('silueta').classList.add('lista');
    };
    $('silueta').onerror = () => {
      $('cargando').textContent = 'No se pudo cargar la imagen, pero podés responder igual.';
    };
    $('silueta').src = ronda.imagen;

    ronda.opciones.forEach((opcion, i) => {
      const boton = crear('button', 'opcion');
      boton.append(crear('span', 'numero', `${i + 1}`), document.createTextNode(opcion));
      boton.dataset.opcion = opcion;
      boton.addEventListener('click', () => responder(opcion));
      $('opciones').append(boton);
    });
    $('pista').hidden = false;
    estado.esperando = true;
  } catch (err) {
    $('error-juego').textContent = err.message;
    // Una partida vencida no se puede retomar: se vuelve al inicio
    if (/no existe|expiró|terminó/.test(err.message)) {
      localStorage.removeItem(CLAVE_PARTIDA);
      setTimeout(() => { mostrar('inicio'); cargarTableros(); }, 2500);
    }
  }
}

async function pedirPista() {
  if (!estado.esperando || $('pista').disabled) return;
  $('pista').disabled = true;
  try {
    const { tipos, costo } = await api(`/partidas/${estado.partidaId}/pista`, { method: 'POST' });
    mostrarTipos(tipos);
    $('ficha').textContent = `Pista: si acertás, sumás ${costo} puntos menos`;
  } catch (err) {
    $('error-juego').textContent = err.message;
    $('pista').disabled = false;
  }
}

$('pista').addEventListener('click', pedirPista);

async function responder(opcion) {
  if (!estado.esperando) return;
  estado.esperando = false;
  $('pista').disabled = true;
  const botones = [...$('opciones').children];
  botones.forEach((b) => { b.disabled = true; });

  try {
    const r = await api(`/partidas/${estado.partidaId}/respuesta`, {
      method: 'POST',
      body: JSON.stringify({ opcion }),
    });

    botones.forEach((b) => {
      if (b.dataset.opcion === r.pokemon.nombre) b.classList.add('acierto');
      else if (b.dataset.opcion === opcion) b.classList.add('fallo');
    });

    $('silueta').classList.add('lista', 'revelada');
    $('cargando').hidden = true;
    $('resultado').textContent = r.correcta
      ? `¡Es ${r.pokemon.nombre}! +${r.puntos}`
      : `Era ${r.pokemon.nombre}`;
    $('resultado').className = `resultado ${r.correcta ? 'correcta' : 'incorrecta'}`;
    $('ficha').textContent = `${numero(r.pokemon.id)} · ${r.pokemon.altura} m · ${r.pokemon.peso} kg`;
    mostrarTipos(r.pokemon.tipos);

    mostrarMarcador({ jugador: estado.jugador, puntaje: r.puntaje, racha: r.racha });
    $('progreso-barra').style.width = `${(r.ronda / r.total) * 100}%`;

    estado.resumen.push({ ...r.pokemon, correcta: r.correcta, puntos: r.puntos, pista: r.pista });
    estado.terminada = r.terminada;
    estado.resultadoFinal = r;
    if (r.terminada) localStorage.removeItem(CLAVE_PARTIDA);
    $('siguiente').textContent = r.terminada ? 'Ver resultado' : 'Siguiente';
    $('siguiente').hidden = false;
    $('siguiente').focus();
  } catch (err) {
    $('error-juego').textContent = err.message;
    botones.forEach((b) => { b.disabled = false; });
    $('pista').disabled = false;
    estado.esperando = true;
  }
}

$('siguiente').addEventListener('click', () => {
  if (estado.terminada) mostrarFin(estado.resultadoFinal);
  else nuevaRonda();
});

// Atajos de teclado: 1 a 4 para responder, P para pedir pista
document.addEventListener('keydown', (evento) => {
  if (!$('pantalla-juego').classList.contains('activa')) return;
  if (evento.metaKey || evento.ctrlKey || evento.altKey) return;
  if (evento.key.toLowerCase() === 'p') return pedirPista();
  const indice = Number(evento.key) - 1;
  const boton = $('opciones').children[indice];
  if (estado.esperando && boton) boton.click();
});

// ---------- Fin ----------
function mostrarFin(r) {
  $('puntaje-final').textContent = r.puntaje;
  $('aciertos-final').textContent = `${r.aciertos} de ${r.total} aciertos`;
  const mensajes = [
    [10, '¡Perfecto! Sos una verdadera enciclopedia Pokémon.'],
    [7, '¡Muy bien! Te falta poco para completar la Pokédex.'],
    [4, 'Buen intento. La práctica hace al maestro Pokémon.'],
    [0, 'Recién empezás tu aventura. ¡A seguir entrenando!'],
  ];
  $('mensaje-final').textContent = mensajes.find(([minimo]) => r.aciertos >= minimo)[1];

  $('resumen').replaceChildren(...estado.resumen.map((p) => {
    const li = crear('li', p.correcta ? 'acierto' : 'fallo');
    const img = crear('img');
    img.src = p.imagen;
    img.alt = '';
    img.loading = 'lazy';
    let detalle = p.correcta ? `+${p.puntos}` : '✘';
    if (p.pista) detalle += ' 💡';
    li.append(img, crear('span', 'nombre', p.nombre), crear('span', 'detalle', detalle));
    li.title = `${numero(p.id)} ${p.nombre}`;
    return li;
  }));

  mostrar('fin');
  $('otra-vez').focus();
}

$('otra-vez').addEventListener('click', () => {
  mostrar('inicio');
  cargarTableros();
  $('jugador').value = estado.jugador;
  $('jugador').focus();
});

// ---------- Arranque ----------
$('jugador').value = localStorage.getItem(CLAVE_JUGADOR) || '';
cargarGeneraciones().then(cargarTableros);
buscarPartidaPendiente();
chequearSalud();
setInterval(chequearSalud, 10000);
