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

const crypto = require('crypto');

const MAX_POCIONES = 3;

// Constantes de combate (sistema_completo.json → combat / player).
const CRIT_MULT_DEFECTO = 1.75; // combat.critMultiplier
const TOPE_CRIT = 0.35; // player.stats.crit: min(0.35, ...)
const TOPE_ESQUIVA = 0.3; // player.stats.dodge: min(0.30, ...)
const MAX_RONDAS = 300; // si se llega, la pelea cuenta como derrota

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
        gold: oroBoss(objetivo, px),
        drops: [], // los bosses no dan loot
      },
    };
  }

  return {
    id: crypto.randomUUID(), // identifica esta pelea para que no se resuelva dos veces
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

// ---------------------------------------------------------------------
// Oro de los bosses. El JSON no lo trae: se toma la escala del oro de los
// enemigos (de rango/2 a rango×2) multiplicada por lo mismo que la XP del
// boss respecto a la del enemigo (×25). Si algún día el boss trae
// loot.goldMin / loot.goldMax en el JSON, se usa eso.
// ---------------------------------------------------------------------
function oroBoss(boss, px) {
  const loot = boss.loot || {};
  if (loot.goldMin != null && loot.goldMax != null) return { min: loot.goldMin, max: loot.goldMax };
  const factor = (px.bossMultiplier ?? 15 * 25) / (px.enemyMultiplier ?? 15);
  return {
    min: Math.round(boss.progressionRank * 0.5 * factor),
    max: Math.round(boss.progressionRank * 2 * factor),
  };
}

// ---------------------------------------------------------------------
// SIMULACIÓN DE LA PELEA
//
// 1) Las pociones se aplican a las stats del jugador (multiplicativas; los
//    topes de crítico y esquiva valen después de las pociones).
// 2) Se turnan los ataques, el jugador primero, hasta que uno llega a 0 de
//    vida o se alcanzan MAX_RONDAS (derrota).
//
// Daño del jugador  = ataque × poder del arma × (debilidad/resistencia/arma especial)
// Daño del rival    = ataque × 100 / (100 + protección × efectividad de la armadura)
// Cada golpe: primero esquiva del defensor, después crítico (×critMultiplier);
// el daño es entero con mínimo 1.
//
// opciones.rng permite pasar un generador propio (para pruebas).
// ---------------------------------------------------------------------
const comoLista = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const enteroAlAzar = (min, max, rng) => min + Math.floor(rng() * (max - min + 1));

function aplicarPociones(stats, pociones) {
  const factores = { hp: 1, attack: 1, crit: 1, dodge: 1 };
  for (const p of pociones || []) {
    if (p.stat === 'all') {
      for (const k of Object.keys(factores)) factores[k] *= p.multiplier;
    } else if (p.stat in factores) {
      factores[p.stat] *= p.multiplier;
    }
  }
  return {
    factores,
    stats: {
      hp: Math.max(1, Math.round(stats.hp * factores.hp)),
      attack: stats.attack * factores.attack,
      crit: Math.min(TOPE_CRIT, stats.crit * factores.crit),
      dodge: Math.min(TOPE_ESQUIVA, stats.dodge * factores.dodge),
    },
  };
}

// Multiplicador del daño del jugador contra el objetivo.
function multiplicadorContraObjetivo(objetivo, arma) {
  let multiplicador = 1;
  const detalle = [];

  if (arma) {
    for (const d of comoLista(objetivo.weakness)) {
      if (d.weaponType === arma.type) {
        multiplicador *= d.multiplier;
        detalle.push({ tipo: 'debilidad', weaponType: d.weaponType, multiplier: d.multiplier });
      }
    }
    for (const r of comoLista(objetivo.resistance)) {
      if (r.weaponType === arma.type) {
        multiplicador *= r.multiplier;
        detalle.push({ tipo: 'resistencia', weaponType: r.weaponType, multiplier: r.multiplier });
      }
    }
  }
  if (objetivo.usingSpecialWeapon && objetivo.specialWeapon) {
    multiplicador *= objetivo.specialWeapon.multiplier;
    detalle.push({
      tipo: 'arma_especial',
      weaponId: objetivo.specialWeapon.weaponId,
      multiplier: objetivo.specialWeapon.multiplier,
    });
  }
  return { multiplicador, detalle };
}

function simularCombate(paquete, opciones = {}) {
  const rng = opciones.rng || Math.random;
  const cfg = opciones.cfg || null;
  const critMult = (cfg && cfg.combat && cfg.combat.critMultiplier) || CRIT_MULT_DEFECTO;

  const { jugador, equipo, objetivo } = paquete;
  const { factores, stats: yo } = aplicarPociones(jugador.stats, equipo.pociones);
  const rival = {
    hp: objetivo.stats.hp,
    attack: objetivo.stats.attack,
    crit: objetivo.stats.crit ?? 0, // los bosses no tienen crítico ni esquiva
    dodge: objetivo.stats.dodge ?? 0,
  };

  const arma = equipo.arma;
  const armadura = equipo.armadura;
  const poder = arma ? arma.basePowerMultiplier : 1;
  const { multiplicador, detalle } = multiplicadorContraObjetivo(objetivo, arma);
  const armaduraEfectiva = armadura ? armadura.protection * (objetivo.armorEffectiveness ?? 1) : 0;
  const factorArmadura = 100 / (100 + armaduraEfectiva);

  const danioBaseJugador = yo.attack * poder * multiplicador;
  const danioBaseRival = rival.attack * factorArmadura;

  function golpe(base, atacante, defensor) {
    if (rng() < defensor.dodge) return { esquivado: true, critico: false, danio: 0 };
    const critico = rng() < atacante.crit;
    return { esquivado: false, critico, danio: Math.max(1, Math.round(base * (critico ? critMult : 1))) };
  }

  const resumen = {
    jugador: { hpInicial: yo.hp, hpFinal: yo.hp, danioHecho: 0, danioRecibido: 0, criticos: 0, esquivas: 0 },
    objetivo: { hpInicial: rival.hp, hpFinal: rival.hp, danioHecho: 0, danioRecibido: 0, criticos: 0, esquivas: 0 },
  };
  const log = [];
  let hpJugador = yo.hp;
  let hpRival = rival.hp;
  let ganador = null;
  let rondas = 0;

  function registrar(actor, g) {
    const atacante = resumen[actor];
    const defensor = resumen[actor === 'jugador' ? 'objetivo' : 'jugador'];
    atacante.danioHecho += g.danio;
    defensor.danioRecibido += g.danio;
    if (g.critico) atacante.criticos += 1;
    if (g.esquivado) defensor.esquivas += 1;
    log.push({ ronda: rondas, actor, ...g, jugadorHp: hpJugador, objetivoHp: hpRival });
  }

  while (rondas < MAX_RONDAS && !ganador) {
    rondas += 1;

    const g1 = golpe(danioBaseJugador, yo, rival);
    hpRival = Math.max(0, hpRival - g1.danio);
    registrar('jugador', g1);
    if (hpRival <= 0) {
      ganador = 'jugador';
      break;
    }

    const g2 = golpe(danioBaseRival, rival, yo);
    hpJugador = Math.max(0, hpJugador - g2.danio);
    registrar('objetivo', g2);
    if (hpJugador <= 0) ganador = 'objetivo';
  }

  resumen.jugador.hpFinal = hpJugador;
  resumen.objetivo.hpFinal = hpRival;

  return {
    victoria: ganador === 'jugador',
    ganador, // 'jugador' | 'objetivo' | null (se agotaron las rondas)
    motivo: ganador ? 'vida' : 'limite_rondas',
    rondas,
    preparacion: {
      jugadorBase: { ...jugador.stats },
      jugadorConPociones: {
        hp: yo.hp,
        attack: redondear(yo.attack),
        crit: redondear(yo.crit, 4),
        dodge: redondear(yo.dodge, 4),
      },
      factoresPociones: factores,
      pociones: equipo.pociones.map((p) => ({ potionId: p.potionId, name: p.name, stat: p.stat, multiplier: p.multiplier })),
      objetivo: { ...rival },
      poderArma: poder,
      multiplicadorContraObjetivo: redondear(multiplicador, 4),
      detalleMultiplicador: detalle,
      armaduraEfectiva: redondear(armaduraEfectiva),
      factorArmadura: redondear(factorArmadura, 4),
      danioBaseJugador: redondear(danioBaseJugador),
      danioBaseObjetivo: redondear(danioBaseRival),
      multiplicadorCritico: critMult,
      maxRondas: MAX_RONDAS,
    },
    resumen,
    log,
  };
}

// ---------------------------------------------------------------------
// RECOMPENSAS (solo si se gana)
// - XP: la del paquete (enemigo: rango×15; boss: rango×15×25).
// - Oro: entero al azar entre min y max.
// - Loot: cada drop se tira por separado con su chance; cantidad al azar
//   entre min y max. Los bosses no dan loot.
// - Boss ya derrotado antes (repetido): la mitad de XP y oro.
// ---------------------------------------------------------------------
function calcularRecompensas(paquete, { rng = Math.random, repetido = false } = {}) {
  const r = paquete.objetivo.rewards || {};
  const mitad = (n) => (repetido ? Math.round(n / 2) : n);

  const drops = [];
  for (const d of r.drops || []) {
    if (rng() < d.chance) {
      drops.push({ materialId: d.materialId, name: d.name, cantidad: enteroAlAzar(d.min, d.max, rng) });
    }
  }

  return {
    xp: mitad(r.xp || 0),
    oro: r.gold ? mitad(enteroAlAzar(r.gold.min, r.gold.max, rng)) : 0,
    drops,
    mitad: repetido,
  };
}

const SIN_RECOMPENSAS = () => ({ xp: 0, oro: 0, drops: [], mitad: false });

// Suma XP y sube de nivel las veces que haga falta. La barra se reinicia en
// cada subida y el sobrante queda. En el nivel máximo no se acumula XP.
function aplicarXp(nivel, xp, ganada, cfg) {
  const max = nivelMaximo(cfg);
  let n = nivel;
  let x = xp + ganada;
  let subidos = 0;

  while (n < max && x >= xpParaSubir(n, cfg)) {
    x -= xpParaSubir(n, cfg);
    n += 1;
    subidos += 1;
  }
  if (n >= max) x = 0;

  return { nivel: n, xp: x, subidos };
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
  simularCombate,
  calcularRecompensas,
  aplicarXp,
  SIN_RECOMPENSAS,
  MAX_RONDAS,
};
