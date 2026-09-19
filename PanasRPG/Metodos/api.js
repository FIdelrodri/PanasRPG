/**
 * PanasRPG/Metodos/api.js
 *
 * Rutas /api del juego (se montan en index.js detrás del chequeo de sesión):
 *
 *   GET    /api/menu                     cuenta + inventario + equipo
 *   PUT    /api/equipo                   guarda arma, armadura y pociones elegidas
 *   GET    /api/mundos                   lista de mundos
 *   GET    /api/mundos/:worldId/enemigos enemigos de un mundo
 *   GET    /api/bosses                   todos los bosses con su estado
 *   POST   /api/combate/iniciar          arma el paquete de batalla
 *   GET    /api/combate/actual           devuelve el paquete guardado en sesión
 *   DELETE /api/combate/actual           descarta el paquete (volver al menú)
 */

const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('./db');
const combate = require('./combate');

const router = express.Router();

const RUTA_BATALLA = '/PanasRPG/Vistas/Vistas_generales/Main_batalla.html';
const SIN_ID = { projection: { _id: 0 } };

// Envuelve los handlers async para responder 500 en vez de colgar la request.
const ruta = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(`Error en ${req.method} /api${req.path}:`, err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  });

const esTexto = (v) => typeof v === 'string' && v.length > 0 && v.length <= 100;

// OJO: con el MemoryStore de express-session, userId vuelve como texto (no
// como ObjectId) a partir de la segunda request, por eso se reconstruye.
async function cargarUsuario(req) {
  const id = req.session && req.session.userId;
  if (!id || !ObjectId.isValid(id)) return null;
  return getDB().collection('usuarios').findOne({ _id: new ObjectId(id) });
}

const cargarConfig = () => getDB().collection('gameConfig').findOne({ _id: 'gameConfig' });

// -------------------- MENÚ --------------------

router.get('/menu', ruta(async (req, res) => {
  const db = getDB();
  const usuario = await cargarUsuario(req);
  if (!usuario) return res.status(401).json({ ok: false, error: 'Sesión inválida' });

  const cfg = await cargarConfig();
  const pociones = usuario.ownedPotions || {};
  const materiales = usuario.materials || {};

  const [armas, armaduras, defsPociones, defsMateriales] = await Promise.all([
    db.collection('weapons').find({ weaponId: { $in: usuario.ownedWeapons || [] } }, SIN_ID).toArray(),
    db.collection('armors').find({ armorId: { $in: usuario.ownedArmors || [] } }, SIN_ID).toArray(),
    db.collection('potions').find({ potionId: { $in: Object.keys(pociones) } }, SIN_ID).toArray(),
    db.collection('materials').find({ materialId: { $in: Object.keys(materiales) } }, SIN_ID).toArray(),
  ]);

  const nivelMax = combate.nivelMaximo(cfg);

  res.json({
    ok: true,
    usuario: {
      username: usuario.username,
      level: usuario.level,
      xp: usuario.xp,
      xpToNext: usuario.level >= nivelMax ? null : combate.xpParaSubir(usuario.level, cfg),
      maxLevel: nivelMax,
    },
    inventario: {
      weapons: armas.map((w) => ({
        weaponId: w.weaponId,
        name: w.name,
        type: w.type,
        basePowerMultiplier: w.basePowerMultiplier,
      })),
      armors: armaduras.map((a) => ({ armorId: a.armorId, name: a.name, protection: a.protection })),
      potions: defsPociones
        .filter((p) => pociones[p.potionId] > 0)
        .map((p) => ({
          potionId: p.potionId,
          name: p.name,
          stat: p.stat,
          multiplier: p.multiplier,
          quantity: pociones[p.potionId],
        })),
      materials: defsMateriales
        .filter((m) => materiales[m.materialId] > 0)
        .map((m) => ({ materialId: m.materialId, name: m.name, quantity: materiales[m.materialId] })),
    },
    equipado: combate.equipadoValido(usuario),
    maxPociones: combate.MAX_POCIONES,
  });
}));

// -------------------- EQUIPO --------------------

router.put('/equipo', ruta(async (req, res) => {
  const usuario = await cargarUsuario(req);
  if (!usuario) return res.status(401).json({ ok: false, error: 'Sesión inválida' });

  const { weaponId = null, armorId = null, potionIds = [] } = req.body || {};

  if (weaponId !== null && !esTexto(weaponId)) {
    return res.status(400).json({ ok: false, error: 'Arma inválida' });
  }
  if (armorId !== null && !esTexto(armorId)) {
    return res.status(400).json({ ok: false, error: 'Armadura inválida' });
  }
  if (!Array.isArray(potionIds) || !potionIds.every(esTexto)) {
    return res.status(400).json({ ok: false, error: 'Pociones inválidas' });
  }
  if (new Set(potionIds).size !== potionIds.length) {
    return res.status(400).json({ ok: false, error: 'No repitas la misma poción' });
  }
  if (potionIds.length > combate.MAX_POCIONES) {
    return res.status(400).json({ ok: false, error: `Máximo ${combate.MAX_POCIONES} pociones por batalla` });
  }

  if (weaponId !== null && !(usuario.ownedWeapons || []).includes(weaponId)) {
    return res.status(403).json({ ok: false, error: 'No tenés esa arma' });
  }
  if (armorId !== null && !(usuario.ownedArmors || []).includes(armorId)) {
    return res.status(403).json({ ok: false, error: 'No tenés esa armadura' });
  }
  const tiene = usuario.ownedPotions || {};
  if (!potionIds.every((id) => tiene[id] > 0)) {
    return res.status(403).json({ ok: false, error: 'No tenés alguna de esas pociones' });
  }

  const equipped = { weaponId, armorId, potionIds };
  await getDB().collection('usuarios').updateOne({ _id: usuario._id }, { $set: { equipped } });
  res.json({ ok: true, equipado: equipped });
}));

// -------------------- MUNDOS Y ENEMIGOS --------------------

router.get('/mundos', ruta(async (req, res) => {
  const mundos = await getDB().collection('worlds').find({}, SIN_ID).sort({ worldId: 1 }).toArray();
  res.json({ ok: true, worlds: mundos });
}));

router.get('/mundos/:worldId/enemigos', ruta(async (req, res) => {
  const db = getDB();
  const worldId = String(req.params.worldId);

  const mundo = await db.collection('worlds').findOne({ worldId }, SIN_ID);
  if (!mundo) return res.status(404).json({ ok: false, error: 'Ese mundo no existe' });

  const enemigos = await db
    .collection('enemies')
    .find(
      { worldId },
      {
        projection: {
          _id: 0,
          enemyId: 1,
          worldId: 1,
          worldEnemyIndex: 1,
          progressionRank: 1,
          name: 1,
          stats: 1,
          'combat.weakness': 1,
          'combat.resistance': 1,
        },
      }
    )
    .sort({ worldEnemyIndex: 1 })
    .toArray();

  res.json({ ok: true, world: mundo, enemies: enemigos });
}));

// -------------------- BOSSES --------------------

async function listarBosses(usuario) {
  const db = getDB();
  const bosses = await db.collection('bosses').find({}, SIN_ID).toArray();
  const idsEspeciales = bosses.map((b) => b.specialWeaponId).filter(Boolean);
  const armas = await db.collection('weapons').find({ weaponId: { $in: idsEspeciales } }, SIN_ID).toArray();
  const nombreArma = Object.fromEntries(armas.map((w) => [w.weaponId, w.name]));

  return combate.estadoBosses(bosses, usuario.defeatedBosses).map(({ boss, estado, bloqueadoPor }) => ({
    bossId: boss.bossId,
    name: boss.name,
    progressionRank: boss.progressionRank,
    stats: { hp: boss.hp, attack: boss.attack },
    specialWeapon: boss.specialWeaponId
      ? {
          weaponId: boss.specialWeaponId,
          name: nombreArma[boss.specialWeaponId] || boss.specialWeaponId,
          multiplier: boss.specialMultiplier,
        }
      : null,
    estado, // 'available' | 'defeated' | 'locked'
    bloqueadoPor,
  }));
}

router.get('/bosses', ruta(async (req, res) => {
  const usuario = await cargarUsuario(req);
  if (!usuario) return res.status(401).json({ ok: false, error: 'Sesión inválida' });
  res.json({ ok: true, bosses: await listarBosses(usuario) });
}));

// -------------------- COMBATE --------------------

router.post('/combate/iniciar', ruta(async (req, res) => {
  const db = getDB();
  const usuario = await cargarUsuario(req);
  if (!usuario) return res.status(401).json({ ok: false, error: 'Sesión inválida' });

  const { tipo, id } = req.body || {};
  if (!['enemigo', 'boss'].includes(tipo) || !esTexto(id)) {
    return res.status(400).json({ ok: false, error: 'Falta elegir a quién pelear' });
  }

  const cfg = await cargarConfig();
  const equipado = combate.equipadoValido(usuario);

  // Objetivo (y mundo, si es enemigo)
  let objetivo;
  let mundo = null;
  let armaEspecial = null;

  if (tipo === 'enemigo') {
    objetivo = await db.collection('enemies').findOne({ enemyId: id }, SIN_ID);
    if (!objetivo) return res.status(404).json({ ok: false, error: 'Ese enemigo no existe' });
    mundo = await db.collection('worlds').findOne({ worldId: objetivo.worldId }, SIN_ID);
  } else {
    objetivo = await db.collection('bosses').findOne({ bossId: id }, SIN_ID);
    if (!objetivo) return res.status(404).json({ ok: false, error: 'Ese boss no existe' });

    const estado = (await listarBosses(usuario)).find((b) => b.bossId === id);
    if (estado.estado === 'locked') {
      return res.status(403).json({
        ok: false,
        error: `Primero tenés que derrotar a ${estado.bloqueadoPor.name}`,
      });
    }
    if (objetivo.specialWeaponId) {
      armaEspecial = await db.collection('weapons').findOne({ weaponId: objetivo.specialWeaponId }, SIN_ID);
    }
  }

  // Equipo elegido en el menú
  const [arma, armadura, defsPociones] = await Promise.all([
    equipado.weaponId ? db.collection('weapons').findOne({ weaponId: equipado.weaponId }, SIN_ID) : null,
    equipado.armorId ? db.collection('armors').findOne({ armorId: equipado.armorId }, SIN_ID) : null,
    equipado.potionIds.length
      ? db.collection('potions').find({ potionId: { $in: equipado.potionIds } }, SIN_ID).toArray()
      : [],
  ]);
  // Mantiene el orden en que se equiparon
  const pociones = equipado.potionIds
    .map((pid) => defsPociones.find((p) => p.potionId === pid))
    .filter(Boolean);

  // Nombres de materiales para mostrar el botín
  const idsMateriales = ((objetivo.loot && objetivo.loot.drops) || []).map((d) => d.materialId);
  const mats = idsMateriales.length
    ? await db.collection('materials').find({ materialId: { $in: idsMateriales } }, SIN_ID).toArray()
    : [];
  const nombresMateriales = Object.fromEntries(mats.map((m) => [m.materialId, m.name]));

  const paquete = combate.construirPaquete({
    usuario,
    cfg,
    kind: tipo,
    objetivo,
    mundo,
    arma,
    armadura,
    pociones,
    armaEspecial,
    nombresMateriales,
  });

  const falta = combate.faltantes(paquete);
  if (falta.length) {
    return res.status(409).json({
      ok: false,
      error: 'Faltan datos para la batalla',
      faltantes: falta,
    });
  }

  req.session.combate = paquete;
  req.session.save((err) => {
    if (err) {
      console.error('Error guardando la sesión:', err);
      return res.status(500).json({ ok: false, error: 'No se pudo preparar la batalla' });
    }
    res.json({ ok: true, redirect: RUTA_BATALLA });
  });
}));

router.get('/combate/actual', (req, res) => {
  const paquete = req.session && req.session.combate;
  if (!paquete) return res.status(404).json({ ok: false, error: 'No hay una batalla preparada' });
  res.json({ ok: true, paquete });
});

router.delete('/combate/actual', (req, res) => {
  if (req.session) delete req.session.combate;
  res.json({ ok: true });
});

module.exports = router;
