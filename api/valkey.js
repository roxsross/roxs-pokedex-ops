// Cliente único de Valkey para toda la API.
// Valkey habla el protocolo de Redis, por eso se usa la librería oficial "redis".
const { createClient } = require('redis');

const VALKEY_URL = process.env.VALKEY_URL || 'redis://localhost:6379';

const valkey = createClient({
  url: VALKEY_URL,
  // Sin cola offline: si Valkey no está, los comandos fallan rápido
  // en lugar de dejar las peticiones HTTP colgadas.
  disableOfflineQueue: true,
});

valkey.on('error', (err) => console.error(`[valkey] ${err.message}`));
valkey.on('ready', () => console.log(`[valkey] conectado a ${VALKEY_URL}`));

// La conexión no bloquea el arranque: el cliente reintenta en segundo plano.
valkey.connect().catch((err) => console.error(`[valkey] conexion inicial fallida: ${err.message}`));

module.exports = { valkey };
