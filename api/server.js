// API HTTP del juego. Las rutas solo validan la entrada y delegan en juego.js.
const express = require('express');
const { valkey } = require('./valkey');
const juego = require('./juego');
const { version } = require('./package.json');

const PORT = process.env.PORT || 3000;
const ID_VALIDO = /^[0-9a-f-]{36}$/;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

const requiereValkey = (req, res, next) =>
  valkey.isReady ? next() : res.status(503).json({ error: 'Valkey no disponible' });

const validarId = (req, res, next) =>
  ID_VALIDO.test(req.params.id) ? next() : res.status(404).json({ error: 'La partida no existe' });

app.get('/health', async (req, res) => {
  try {
    await valkey.ping();
    res.send('ok');
  } catch {
    res.status(503).send('valkey no responde');
  }
});

app.get('/api/info', requiereValkey, async (req, res) => {
  const partidas = Number((await valkey.get('stats:partidas')) ?? 0);
  res.json({ version, partidas });
});

app.get('/api/generaciones', (req, res) => {
  res.json(juego.generaciones());
});

app.post('/api/partidas', requiereValkey, async (req, res) => {
  const jugador = String(req.body?.jugador ?? '').trim().slice(0, 20);
  if (!jugador) return res.status(400).json({ error: 'El campo jugador es obligatorio' });
  const generacion = Number(req.body?.generacion ?? 1);
  if (!Object.hasOwn(juego.GENERACIONES, generacion)) {
    return res.status(400).json({ error: 'La generación debe ser un número del 0 al 9' });
  }
  res.status(201).json(await juego.crearPartida(jugador, generacion));
});

app.get('/api/partidas/:id', requiereValkey, validarId, async (req, res) => {
  res.json(await juego.estadoPartida(req.params.id));
});

app.get('/api/partidas/:id/ronda', requiereValkey, validarId, async (req, res) => {
  res.json(await juego.siguienteRonda(req.params.id));
});

app.get('/api/partidas/:id/imagen', requiereValkey, validarId, async (req, res) => {
  const { tipo, datos } = await juego.imagenRonda(req.params.id);
  // Privada: la URL es de una partida puntual y no debe quedar en cachés compartidas
  res.set('Cache-Control', 'private, max-age=3600').type(tipo).send(datos);
});

app.post('/api/partidas/:id/pista', requiereValkey, validarId, async (req, res) => {
  res.json(await juego.pedirPista(req.params.id));
});

app.post('/api/partidas/:id/respuesta', requiereValkey, validarId, async (req, res) => {
  const opcion = String(req.body?.opcion ?? '');
  if (!opcion) return res.status(400).json({ error: 'El campo opcion es obligatorio' });
  res.json(await juego.responder(req.params.id, opcion));
});

app.get('/api/ranking', requiereValkey, async (req, res) => {
  res.json(await juego.ranking());
});

app.get('/api/historial', requiereValkey, async (req, res) => {
  res.json(await juego.historial());
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta inexistente' });
});

// Manejo centralizado de errores: Express 5 atrapa los errores de las rutas async.
app.use((err, req, res, next) => {
  if (err instanceof juego.ErrorDeJuego) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo no es JSON válido' });
  }
  console.error(err);
  const fallaPokeApi = err.name === 'TimeoutError' || /PokeAPI|fetch/i.test(err.message);
  res.status(fallaPokeApi ? 502 : 500).json({
    error: fallaPokeApi ? 'No se pudo consultar PokeAPI' : 'Error interno',
  });
});

const servidor = app.listen(PORT, () => console.log(`API escuchando en ${PORT}`));

// Apagado ordenado: docker compose manda SIGTERM. Se dejan terminar los
// pedidos en curso y se cierra la conexión con Valkey antes de salir.
for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => {
    console.log(`${senal} recibido, cerrando...`);
    servidor.close(async () => {
      await valkey.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
