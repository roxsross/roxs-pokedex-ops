// Genera las capturas del README: juega una partida en un Chromium headless
// contra el juego levantado y guarda una imagen de cada pantalla en docs/img/.
//
// Uso (con el stack levantado):
//   cd scripts/capturas && npm install && npx playwright install chromium
//   node capturas.js [url-del-juego]
const path = require('path');
const { chromium } = require('playwright');

const URL_JUEGO = process.argv[2] || 'http://localhost:8080';
const DESTINO = path.join(__dirname, '..', '..', 'docs', 'img');
const foto = (pagina, nombre) => pagina.screenshot({ path: path.join(DESTINO, `${nombre}.png`) });

(async () => {
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 1 });
  const pagina = await contexto.newPage();

  // Inicio, con el ranking y las últimas partidas
  await pagina.goto(URL_JUEGO);
  await pagina.waitForSelector('#ranking li');
  await pagina.waitForTimeout(800);
  await foto(pagina, 'inicio');

  await pagina.fill('#jugador', 'Roxs');
  await pagina.click('#boton-jugar');

  for (let ronda = 1; ronda <= 10; ronda++) {
    await pagina.waitForSelector('#silueta.lista', { timeout: 15000 });
    await pagina.waitForTimeout(600);
    if (ronda === 1) {
      // Silueta con la pista pedida
      await pagina.keyboard.press('p');
      await pagina.waitForSelector('#tipos .tipo');
      await pagina.waitForTimeout(400);
      await foto(pagina, 'silueta');
    }
    await pagina.keyboard.press('1');
    await pagina.waitForSelector('#siguiente:not([hidden])');
    if (ronda === 1) {
      await pagina.waitForTimeout(1000); // la revelación tiene una transición
      await foto(pagina, 'revelado');
    }
    await pagina.keyboard.press('Enter');
  }

  // Pantalla final con el resumen de los 10 Pokémon
  await pagina.waitForSelector('#pantalla-fin.activa');
  await pagina.waitForTimeout(1500);
  await foto(pagina, 'final');

  await navegador.close();
  console.log(`Capturas guardadas en ${DESTINO}`);
})().catch((err) => {
  console.error(`No se pudieron generar las capturas: ${err.message}`);
  process.exit(1);
});
