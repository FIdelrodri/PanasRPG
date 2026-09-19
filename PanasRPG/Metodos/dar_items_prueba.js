/**
 * PanasRPG/Metodos/dar_items_prueba.js
 *
 * Solo para desarrollo: los usuarios nuevos empiezan sin armas, armaduras
 * ni pociones, así que el menú se vería vacío. Este script les carga un
 * inventario de prueba.
 *
 * Ejecutar desde D:\www con:
 *   node PanasRPG/Metodos/dar_items_prueba.js <usuario> [--nivel=5] [--xp=40] [--bosses=B1,B2]
 *
 * Pisa ownedWeapons, ownedArmors, ownedPotions, materials, gold, level, xp
 * (y defeatedBosses si se pasa --bosses) del usuario indicado.
 */

const { connectDB, getDB, closeDB } = require('./db');

async function main() {
  const [usuario, ...flags] = process.argv.slice(2);

  if (!usuario || usuario.startsWith('--')) {
    console.log('Uso: node PanasRPG/Metodos/dar_items_prueba.js <usuario> [--nivel=5] [--xp=40] [--bosses=B1,B2]');
    process.exitCode = 1;
    return;
  }

  const opciones = {};
  for (const flag of flags) {
    if (!flag.startsWith('--')) continue;
    const [clave, valor] = flag.slice(2).split('=');
    opciones[clave] = valor;
  }

  const cambios = {
    ownedWeapons: ['espada_hierro', 'hacha_batalla', 'lanza_acero', 'arco_cazador', 'raiz_ancestral'],
    ownedArmors: ['cuero_reforzado', 'musgo_guardian'],
    ownedPotions: { pocion_vital: 3, pocion_furia: 2, pocion_precision: 1, elixir_batalla: 1 },
    materials: { hierro: 12, cuero: 5, madera_viva: 8, esencia_monstruosa: 6, fibra_forestal: 4 },
    gold: 250,
    level: Number(opciones.nivel ?? 5),
    xp: Number(opciones.xp ?? 40),
  };

  if (opciones.bosses) {
    cambios.defeatedBosses = opciones.bosses
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  await connectDB();
  const resultado = await getDB().collection('usuarios').updateOne({ username: usuario }, { $set: cambios });

  if (resultado.matchedCount === 0) {
    console.error(`No existe el usuario "${usuario}".`);
    process.exitCode = 1;
  } else {
    console.log(`Listo: "${usuario}" ahora tiene items de prueba (nivel ${cambios.level}, xp ${cambios.xp}).`);
  }

  await closeDB();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exitCode = 1;
});
