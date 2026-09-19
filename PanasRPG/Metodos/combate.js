/**
 * PanasRPG/Metodos/combate.js
 *
 * Fórmulas del jugador y armado del "paquete de batalla" (todos los datos
 * que Main_batalla.html necesita para pelear). No usa Express ni la base
 * de datos: recibe documentos ya leídos y devuelve datos, así se puede
 * probar y modificar por separado.
 *
 * Los nombres de los campos siguen los del JSON maestro (hp, attack, crit,
 * dodge, weakness, resistance, basePowerMultiplier...) para que después la
 * cuenta de daño use las mismas palabras que sistema_completo.json.
 */

const MAX_POCIONES = 3;

const redondear = (n, decimales = 2) => {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
};

// ---------------------------------------------------------------------
// Fórmulas del jugador (sistema_completo.json → player.stats).
// Si cambian en el JSON, cambiarlas también acá.
// ---------------------------------------------------------------------
function statsJugador(nivel) {
  const factor = Math.pow(1.08, nivel - 1);
  return {
    hp: redondear(100 * factor),
    attack: redondear(20 * factor),
    crit: redondear(Math.min(0.35, 0.05 + 0.004 * (nivel - 1)), 4),
    dodge: redondear(Math.min(0.3, 0.05 + 0.003 * (nivel - 1)), 4),
  };
}

// XP necesaria para pasar del nivel actual al siguiente (gameConfig.progressionXP).
function xpParaSubir(nivel, cfg) {
  const p = (cfg && cfg.progressionXP) || {};
  const base = p.levelCurveBase ?? 100;
  const crecimiento = p.levelCurveGrowth ?? 1.12;
  return Math.round(base * Math.pow(crecimiento, nivel - 1));
}

function nivelMaximo(cfg) {
  return (cfg && cfg.player && cfg.player.levelMax) || 50;
}

// ---------------------------------------------------------------------
// Equipo: descarta lo que el usuario ya no tiene (por ejemplo una poción
// que se gastó) para no mandar a la batalla algo inexistente.
// ---------------------------------------------------------------------
function equipadoValido(usuario) {
  const eq = usuario.equipped || {};
  const armas = usuario.ownedWeapons || [];
  const armaduras = usuario.ownedArmors || [];
  const pociones = usuario.ownedPotions || {};
  const pocionIds = Array.isArray(eq.potionIds) ? eq.potionIds : [];

  return {
    weaponId: armas.includes(eq.weaponId) ? eq.weaponId : null,
    armorId: armaduras.includes(eq.armorId) ? eq.armorId : null,
    potionIds: [...new Set(pocionIds)]
      .filter((id) => (pociones[id] || 0) > 0)
      .slice(0, MAX_POCIONES),
  };
}

// ---------------------------------------------------------------------
// Bosses: B(n+1) solo se abre si B(n) está derrotado.
// ---------------------------------------------------------------------
function estadoBosses(bosses, derrotados) {
  const orden = [...bosses].sort((a, b) => a.progressionRank - b.progressionRank);
  const vencidos = derrotados || [];

  return orden.map((boss, i) => {
    const previo = i > 0 ? orden[i - 1] : null;
    const pidePrevio = previo && boss.accessibleAfterPreviousBoss !== false;
    const bloqueado = Boolean(pidePrevio && !vencidos.includes(previo.bossId));

    let estado = 'available';
    if (vencidos.includes(boss.bossId)) estado = 'defeated';
    else if (bloqueado) estado = 'locked';

    return {
      boss,
      estado,
      bloqueadoPor: estado === 'locked' ? { bossId: previo.bossId, name: previo.name } : null,
    };
  });
}

// ---------------------------------------------------------------------
// Datos elementales: si falta alguno, la batalla no arranca y se vuelve
// al menú. Para cambiar qué es "elemental", editar esta lista.
// Armadura, arma y pociones NO son elementales (se puede pelear sin ellas).
// ---------------------------------------------------------------------
function camposElementales(kind) {
  const comunes = [
    'jugador.level',
    'jugador.stats.hp',
    'jugador.stats.attack',
    'jugador.stats.crit',
    'jugador.stats.dodge',
    'objetivo.kind',
    'objetivo.id',
    'objetivo.name',
    'objetivo.stats.hp',
    'objetivo.stats.attack',
  ];
  // Los bosses no pertenecen a un mundo, así que solo el enemigo lo exige.
  return kind === 'enemigo' ? [...comunes, 'mundo.worldId', 'mundo.name'] : comunes;
}

function leerRuta(obj, ruta) {
  return ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function faltantes(paquete) {
  const rutas = paquete && paquete.meta && paquete.meta.camposElementales;
  if (!Array.isArray(rutas)) return ['meta.camposElementales'];
  return rutas.filter((ruta) => {
    const v = leerRuta(paquete, ruta);
    return v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v));
  });
}

// ---------------------------------------------------------------------
// Paquete de batalla.
//
// datos = {
//   usuario, cfg,
//   kind: 'enemigo' | 'boss',
//   objetivo: documento de enemies o bosses,
//   mundo: documento de worlds (solo enemigo),
//   arma, armadura: documentos ya resueltos (o null),
//   pociones: documentos de potions en el orden equipado,
//   armaEspecial: documento de weapons (solo boss),
//   nombresMateriales: { materialId: nombre },
// }
// ---------------------------------------------------------------------
function construirPaquete(datos) {
  const { usuario, cfg, kind, objetivo, mundo, arma, armadura, pociones, armaEspecial } = datos;
  const nombresMateriales = datos.nombresMateriales || {};
  const nivel = usuario.level;
  const max = nivelMaximo(cfg);
  const px = (cfg && cfg.progressionXP) || {};

  let objetivoPaquete;
  if (kind === 'enemigo') {
    const efectividades = (objetivo.combat && objetivo.combat.armorEffectiveness) || {};
    objetivoPaquete = {
      kind,
      id: objetivo.enemyId,
      name: objetivo.name,
      progressionRank: objetivo.progressionRank,
      stats: { ...objetivo.stats },
      weakness: (objetivo.combat && objetivo.combat.weakness) || null,
      resistance: (objetivo.combat && objetivo.combat.resistance) || null,
      // Efectividad de la armadura equipada contra este enemigo (null si no hay armadura).
      armorEffectiveness: armadura ? efectividades[armadura.armorId] ?? null : null,
      specialWeapon: null,
      usingSpecialWeapon: false,
      rewards: {
        xp: objetivo.progressionRank * (px.enemyMultiplier ?? 15),
        gold: objetivo.loot ? { min: objetivo.loot.goldMin, max: objetivo.loot.goldMax } : null,
        drops: ((objetivo.loot && objetivo.loot.drops) || []).map((d) => ({
          materialId: d.materialId,
          name: nombresMateriales[d.materialId] || d.materialId,
          chance: d.chance,
          min: d.min,
          max: d.max,
        })),
      },
    };
  } else {
    objetivoPaquete = {
      kind,
      id: objetivo.bossId,
      name: objetivo.name,
      progressionRank: objetivo.progressionRank,
      stats: { hp: objetivo.hp, attack: objetivo.attack },
      weakness: null,
      resistance: null,
      armorEffectiveness: null,
      specialWeapon: armaEspecial
        ? {
            weaponId: armaEspecial.weaponId,
            name: armaEspecial.name,
            multiplier: objetivo.specialMultiplier,
            mandatory: Boolean(objetivo.specialWeaponIsMandatory),
          }
        : null,
      usingSpecialWeapon: Boolean(arma && objetivo.specialWeaponId === arma.weaponId),
      rewards: {
        xp: objetivo.progressionRank * (px.bossMultiplier ?? 15 * 25),
        gold: null,
        drops: [],
      },
    };
  }

  return {
    creadoEn: new Date().toISOString(),
    meta: { version: 1, camposElementales: camposElementales(kind) },
    jugador: {
      username: usuario.username,
      level: nivel,
      xp: usuario.xp,
      xpToNext: nivel >= max ? null : xpParaSubir(nivel, cfg),
      stats: statsJugador(nivel),
    },
    equipo: {
      arma: arma
        ? {
            weaponId: arma.weaponId,
            name: arma.name,
            type: arma.type,
            basePowerMultiplier: arma.basePowerMultiplier,
          }
        : null,
      armadura: armadura
        ? { armorId: armadura.armorId, name: armadura.name, protection: armadura.protection }
        : null,
      pociones: (pociones || []).map((p) => ({
        potionId: p.potionId,
        name: p.name,
        stat: p.stat,
        multiplier: p.multiplier,
      })),
    },
    objetivo: objetivoPaquete,
    mundo: mundo ? { worldId: mundo.worldId, name: mundo.name } : null,
  };
}

module.exports = {
  MAX_POCIONES,
  statsJugador,
  xpParaSubir,
  nivelMaximo,
  equipadoValido,
  estadoBosses,
  camposElementales,
  faltantes,
  construirPaquete,
};
