// PanasRPG/javaScript/batalla.js
//
// Vista de batalla (Main_batalla.html).
//
//  1. Pide el "paquete de batalla" al servidor (/api/combate/actual) y lo
//     muestra en lista.
//  2. "Comenzar pelea" llama a POST /api/combate/resolver: el servidor simula
//     la pelea, da las recompensas, actualiza la cuenta y devuelve el
//     resultado completo (incluido el registro turno por turno).
//  3. Se muestra el resultado y un botón para volver al menú.
//
// Este archivo no calcula nada del juego. Para cambiar qué se muestra, editar
// SECCIONES (datos de la pelea) y seccionesResultado() (resultado).

(() => {
  'use strict';

  const URL_INICIO = '../Menus/inicio/inicio.html';
  const URL_MENU = 'Main_game.html';

  const ARMAS = {
    sword: 'Espada',
    axe: 'Hacha',
    spear: 'Lanza',
    bow: 'Arco',
    dagger: 'Daga',
    hammer: 'Martillo',
    staff: 'Bastón',
    special: 'Especial',
  };
  const STATS = { hp: 'Vida', attack: 'Ataque', crit: 'Crítico', dodge: 'Esquiva', all: 'Todo' };

  const estado = { paquete: null, resultado: null };

  // ---------------------------------------------------------------- utilidades

  const $ = (id) => document.getElementById(id);

  function el(tag, props = {}, ...hijos) {
    const nodo = document.createElement(tag);
    for (const [clave, valor] of Object.entries(props || {})) {
      if (valor === false || valor == null) continue;
      if (clave === 'class') nodo.className = valor;
      else if (clave.startsWith('on') && typeof valor === 'function') {
        nodo.addEventListener(clave.slice(2).toLowerCase(), valor);
      } else nodo.setAttribute(clave, valor === true ? '' : valor);
    }
    for (const hijo of hijos.flat()) {
      if (hijo == null || hijo === false) continue;
      nodo.append(hijo instanceof Node ? hijo : String(hijo));
    }
    return nodo;
  }

  const numero = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const porcentaje = (n) => `${numero(Number(n) * 100)}%`;
  const multiplicador = (m) => `×${numero(m)}`;
  const armaTipo = (t) => ARMAS[t] || t;
  const comoLista = (x) => (Array.isArray(x) ? x : x ? [x] : []);
  const tiene = (v) => v !== undefined && v !== null && v !== '';

  const leerRuta = (obj, ruta) => ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  // Los datos elementales los define el servidor (paquete.meta.camposElementales).
  function faltantes(paquete) {
    const rutas = paquete && paquete.meta && paquete.meta.camposElementales;
    if (!Array.isArray(rutas)) return ['meta.camposElementales'];
    return rutas.filter((ruta) => {
      const v = leerRuta(paquete, ruta);
      return !tiene(v) || (typeof v === 'number' && !Number.isFinite(v));
    });
  }

  let temporizadorAviso = null;
  function aviso(texto) {
    const caja = $('aviso');
    caja.textContent = texto;
    caja.classList.add('aviso--error', 'aviso--visible');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => caja.classList.remove('aviso--visible'), 5000);
  }

  async function pedir(ruta, opciones = {}) {
    const respuesta = await fetch(ruta, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...opciones,
    });

    if (respuesta.status === 401) {
      window.location.href = URL_INICIO;
      const error = new Error('Sesión vencida');
      error.sesion = true;
      throw error;
    }

    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (_) {
      /* sin JSON */
    }

    if (!respuesta.ok || !datos || datos.ok === false) {
      const error = new Error((datos && datos.error) || 'No se pudo conectar con el servidor');
      error.status = respuesta.status;
      error.datos = datos;
      throw error;
    }
    return datos;
  }

  // Un panel con una lista etiqueta/valor. filas = [[etiqueta, valor], ...]
  function panelDatos(titulo, filas, clase = '') {
    const items = filas.map(([etiqueta, valor]) => {
      const vacio = !tiene(valor);
      return el(
        'div',
        { class: 'dato' },
        el('dt', {}, etiqueta),
        el('dd', { class: vacio ? 'dato__vacio' : '' }, vacio ? '—' : valor)
      );
    });
    return el(
      'section',
      { class: `panel ${clase}`.trim() },
      el('div', { class: 'panel__cabecera' }, el('h2', { class: 'panel__titulo' }, titulo)),
      el('div', { class: 'panel__cuerpo panel__cuerpo--datos' }, el('dl', { class: 'datos__lista' }, items))
    );
  }

  // ------------------------------------------- datos de la pelea (editable)

  const SECCIONES = [
    {
      titulo: (p) => (p.objetivo.kind === 'boss' ? 'Boss' : 'Enemigo'),
      filas: (p) => {
        const o = p.objetivo;
        const debilidades = comoLista(o.weakness).map((d) => `${armaTipo(d.weaponType)} ${multiplicador(d.multiplier)}`);
        const resistencias = comoLista(o.resistance).map((r) => `${armaTipo(r.weaponType)} ${multiplicador(r.multiplier)}`);
        const filas = [
          ['Nombre', o.name],
          ['Rango de progresión', o.progressionRank],
          ['Vida', numero(o.stats.hp)],
          ['Ataque', numero(o.stats.attack)],
          ['Crítico', tiene(o.stats.crit) ? porcentaje(o.stats.crit) : null],
          ['Esquiva', tiene(o.stats.dodge) ? porcentaje(o.stats.dodge) : null],
        ];
        if (o.kind === 'enemigo') {
          filas.push(
            ['Débil a', debilidades.join(', ')],
            ['Resiste', resistencias.join(', ')],
            ['Efectividad de tu armadura contra él', tiene(o.armorEffectiveness) ? multiplicador(o.armorEffectiveness) : null]
          );
        } else {
          filas.push(
            [
              'Arma especial (su debilidad)',
              o.specialWeapon
                ? `${o.specialWeapon.name} ${multiplicador(o.specialWeapon.multiplier)}${o.specialWeapon.mandatory ? '' : ' (opcional)'}`
                : null,
            ],
            ['¿Llevás el arma especial?', o.specialWeapon ? (o.usingSpecialWeapon ? 'Sí' : 'No') : null]
          );
        }
        return filas;
      },
    },
    {
      titulo: () => 'Mundo',
      visible: (p) => Boolean(p.mundo),
      filas: (p) => [['Nombre', p.mundo.name]],
    },
    {
      titulo: () => 'Jugador',
      filas: (p) => {
        const j = p.jugador;
        return [
          ['Nombre', j.username],
          ['Nivel', j.level],
          ['Vida', numero(j.stats.hp)],
          ['Ataque', numero(j.stats.attack)],
          ['Crítico', porcentaje(j.stats.crit)],
          ['Esquiva', porcentaje(j.stats.dodge)],
          ['Experiencia', j.xpToNext == null ? `${numero(j.xp)} (nivel máximo)` : `${numero(j.xp)} / ${numero(j.xpToNext)}`],
        ];
      },
    },
    {
      titulo: () => 'Equipo',
      filas: (p) => {
        const { arma, armadura } = p.equipo;
        return [
          ['Arma', arma ? arma.name : 'Sin arma'],
          ['Tipo de arma', arma ? armaTipo(arma.type) : null],
          ['Poder del arma', arma ? multiplicador(arma.basePowerMultiplier) : null],
          ['Armadura', armadura ? armadura.name : 'Sin armadura'],
          ['Protección', armadura ? numero(armadura.protection) : null],
        ];
      },
    },
    {
      titulo: (p) => `Pociones (${p.equipo.pociones.length})`,
      filas: (p) =>
        p.equipo.pociones.length
          ? p.equipo.pociones.map((x) => [x.name, `${STATS[x.stat] || x.stat} ${multiplicador(x.multiplier)}`])
          : [['Activas', 'Ninguna']],
    },
    {
      titulo: () => 'Recompensas posibles',
      filas: (p) => {
        const r = p.objetivo.rewards || {};
        const filas = [['Experiencia', tiene(r.xp) ? numero(r.xp) : null]];
        if (r.gold) filas.push(['Oro', `${numero(r.gold.min)} a ${numero(r.gold.max)}`]);
        for (const d of r.drops || []) {
          const cantidad = d.min === d.max ? numero(d.min) : `${numero(d.min)} a ${numero(d.max)}`;
          filas.push([d.name, `${numero(d.chance * 100)}% de probabilidad, ${cantidad}`]);
        }
        if (p.objetivo.kind === 'boss') filas.push(['Materiales', 'Los bosses no dan materiales']);
        return filas;
      },
    },
  ];

  // ---------------------------------------------- resultado de la pelea (editable)

  function detalleMultiplicador(lista) {
    return lista
      .map((d) => {
        if (d.tipo === 'debilidad') return `débil a ${armaTipo(d.weaponType)} ${multiplicador(d.multiplier)}`;
        if (d.tipo === 'resistencia') return `resiste ${armaTipo(d.weaponType)} ${multiplicador(d.multiplier)}`;
        return `arma especial ${multiplicador(d.multiplier)}`;
      })
      .join(', ');
  }

  function seccionesResultado(r) {
    const p = r.paquete;
    const o = p.objetivo;
    const rec = r.recompensas;
    const prep = r.preparacion;
    const j = r.resumen.jugador;
    const x = r.resumen.objetivo;

    const ganador = r.victoria ? `Vos (${p.jugador.username})` : r.ganador === 'objetivo' ? o.name : 'Nadie';
    const motivo =
      r.motivo === 'vida'
        ? `La vida de ${r.victoria ? o.name : 'tu personaje'} llegó a 0`
        : `Se alcanzó el límite de ${prep.maxRondas} rondas (cuenta como derrota)`;

    const filasRecompensas = [];
    if (!r.victoria) {
      filasRecompensas.push(['Recompensas', 'Ninguna: perdiste la pelea']);
    } else {
      filasRecompensas.push(
        ['Experiencia ganada', `+${numero(rec.xp)}${rec.mitad ? ' (la mitad: ya habías derrotado a este boss)' : ''}`],
        ['Oro ganado', `+${numero(rec.oro)}`],
        [
          'Materiales',
          o.kind === 'boss'
            ? 'Los bosses no dan materiales'
            : rec.drops.length
              ? rec.drops.map((d) => `${d.name} ×${numero(d.cantidad)}`).join(', ')
              : 'Ninguno esta vez',
        ]
      );
      if (o.kind === 'boss') {
        filasRecompensas.push([
          'Boss',
          rec.primeraVezBoss ? 'Primera vez derrotado: se desbloquea el siguiente' : 'Ya lo habías derrotado antes',
        ]);
      }
    }
    filasRecompensas.push(
      ['Nivel', rec.subioNivel ? `${rec.nivelAntes} → ${rec.nivelDespues}` : rec.nivelDespues],
      [
        'Experiencia actual',
        rec.xpParaSubir == null ? 'Nivel máximo' : `${numero(rec.xpDespues)} / ${numero(rec.xpParaSubir)}`,
      ],
      ['Oro total', numero(rec.oroTotal)],
      ['Pociones gastadas', r.pocionesGastadas.length ? r.pocionesGastadas.map((x2) => x2.name).join(', ') : 'Ninguna']
    );

    const conPociones = prep.jugadorConPociones;
    const base = prep.jugadorBase;

    return [
      panelDatos('Resultado', [
        ['Resultado', r.victoria ? 'Victoria' : 'Derrota'],
        ['Ganador', ganador],
        ['Rondas', `${r.rondas} (máximo ${prep.maxRondas})`],
        ['Motivo', motivo],
      ]),
      panelDatos('Recompensas obtenidas', filasRecompensas, rec.subioNivel ? 'panel--subida' : ''),
      panelDatos('Resumen de la pelea', [
        ['Tu vida al final', `${numero(j.hpFinal)} / ${numero(j.hpInicial)}`],
        [`Vida de ${o.name} al final`, `${numero(x.hpFinal)} / ${numero(x.hpInicial)}`],
        ['Daño que hiciste', numero(j.danioHecho)],
        ['Daño que recibiste', numero(x.danioHecho)],
        ['Tus críticos', j.criticos],
        ['Críticos del rival', x.criticos],
        ['Tus esquivas', j.esquivas],
        ['Esquivas del rival', x.esquivas],
      ]),
      panelDatos('Cómo se calculó', [
        [
          'Pociones aplicadas',
          prep.pociones.length
            ? prep.pociones.map((q) => `${q.name} (${STATS[q.stat] || q.stat} ${multiplicador(q.multiplier)})`).join(', ')
            : 'Ninguna',
        ],
        ['Tu vida (antes → con pociones)', `${numero(base.hp)} → ${numero(conPociones.hp)}`],
        ['Tu ataque (antes → con pociones)', `${numero(base.attack)} → ${numero(conPociones.attack)}`],
        ['Tu crítico (antes → con pociones)', `${porcentaje(base.crit)} → ${porcentaje(conPociones.crit)}`],
        ['Tu esquiva (antes → con pociones)', `${porcentaje(base.dodge)} → ${porcentaje(conPociones.dodge)}`],
        ['Poder del arma', multiplicador(prep.poderArma)],
        [
          'Multiplicador contra el rival',
          prep.detalleMultiplicador.length
            ? `${multiplicador(prep.multiplicadorContraObjetivo)} (${detalleMultiplicador(prep.detalleMultiplicador)})`
            : multiplicador(prep.multiplicadorContraObjetivo),
        ],
        ['Armadura efectiva', numero(prep.armaduraEfectiva)],
        ['Factor de daño por armadura', multiplicador(prep.factorArmadura)],
        ['Tu daño base por golpe', numero(prep.danioBaseJugador)],
        [`Daño base de ${o.name} por golpe`, numero(prep.danioBaseObjetivo)],
        ['Multiplicador de crítico', multiplicador(prep.multiplicadorCritico)],
      ]),
    ];
  }

  function tablaRegistro(r) {
    const nombreRival = r.paquete.objetivo.name;
    const filas = r.log.map((e) =>
      el(
        'tr',
        { class: e.actor === 'jugador' ? 'log__jugador' : 'log__rival' },
        el('td', { class: 'num' }, e.ronda),
        el('td', {}, e.actor === 'jugador' ? 'Vos' : nombreRival),
        el('td', {}, e.esquivado ? 'Esquivado' : e.critico ? 'Crítico' : 'Golpe'),
        el('td', { class: 'num' }, e.esquivado ? '—' : numero(e.danio)),
        el('td', { class: 'num' }, numero(e.jugadorHp)),
        el('td', { class: 'num' }, numero(e.objetivoHp))
      )
    );

    return el(
      'section',
      { class: 'panel panel--ancho' },
      el(
        'div',
        { class: 'panel__cabecera' },
        el('h2', { class: 'panel__titulo' }, 'Registro de turnos'),
        el('p', { class: 'panel__nota' }, `${r.log.length} ataques`)
      ),
      el(
        'div',
        { class: 'tabla-scroll', tabindex: '0', role: 'region', 'aria-label': 'Registro de turnos' },
        el(
          'table',
          { class: 'tabla-log' },
          el(
            'thead',
            {},
            el(
              'tr',
              {},
              el('th', { scope: 'col' }, 'Ronda'),
              el('th', { scope: 'col' }, 'Ataca'),
              el('th', { scope: 'col' }, 'Resultado'),
              el('th', { scope: 'col' }, 'Daño'),
              el('th', { scope: 'col' }, 'Tu vida'),
              el('th', { scope: 'col' }, 'Vida del rival')
            )
          ),
          el('tbody', {}, filas)
        )
      )
    );
  }

  // ------------------------------------------------------------------ dibujar

  function renderEncabezado(paquete) {
    const o = paquete.objetivo;
    const tipo = o.kind === 'boss' ? 'Boss' : paquete.mundo ? `Enemigo del mundo ${paquete.mundo.name}` : 'Enemigo';
    $('bt-tipo').textContent = tipo;
    $('bt-titulo').textContent = o.name;
    document.title = `PanasRPG — Batalla contra ${o.name}`;
  }

  function renderDatos(paquete, hayResultado) {
    const cont = $('datos');
    cont.replaceChildren(
      el('h2', { class: 'datos__encabezado' }, hayResultado ? 'Datos con los que se peleó' : 'Datos de la pelea')
    );

    for (const seccion of SECCIONES) {
      if (seccion.visible && !seccion.visible(paquete)) continue;
      cont.append(panelDatos(seccion.titulo(paquete), seccion.filas(paquete)));
    }
  }

  function renderAccion() {
    const cont = $('accion');
    cont.replaceChildren();

    if (!estado.resultado) {
      cont.append(
        el(
          'button',
          { type: 'button', class: 'boton boton--grande', id: 'btn-comenzar', onclick: (e) => comenzarPelea(e.currentTarget) },
          'Comenzar pelea'
        ),
        el('p', { class: 'accion__nota' }, 'La pelea se calcula completa; después vas a ver el resultado y lo que ganaste.')
      );
      return;
    }

    const r = estado.resultado;
    cont.append(
      el('button', { type: 'button', class: 'boton boton--grande', id: 'btn-volver-fin', onclick: volverAlMenu }, 'Volver al menú'),
      el(
        'p',
        { class: 'accion__nota' },
        r.victoria
          ? 'Tus recompensas ya se guardaron en tu cuenta.'
          : 'No ganaste recompensas. Las pociones usadas se gastaron.'
      )
    );
  }

  function renderResultado() {
    const cont = $('resultado');
    const r = estado.resultado;
    if (!r) {
      cont.hidden = true;
      cont.replaceChildren();
      return;
    }

    const rec = r.recompensas;
    const o = r.paquete.objetivo;

    const titular = el(
      'div',
      { class: `titular ${r.victoria ? 'titular--victoria' : 'titular--derrota'}`, id: 'titular', tabindex: '-1', role: 'status' },
      el('h2', { class: 'titular__texto' }, r.victoria ? 'Victoria' : 'Derrota'),
      el(
        'p',
        { class: 'titular__detalle' },
        r.victoria
          ? `Derrotaste a ${o.name} en ${r.rondas} ${r.rondas === 1 ? 'ronda' : 'rondas'}.`
          : r.motivo === 'vida'
            ? `${o.name} te derrotó en ${r.rondas} ${r.rondas === 1 ? 'ronda' : 'rondas'}.`
            : `Se alcanzó el límite de ${r.preparacion.maxRondas} rondas sin un ganador.`
      ),
      rec.subioNivel &&
        el(
          'p',
          { class: 'titular__subida' },
          `¡Subiste de nivel! Ahora sos nivel ${rec.nivelDespues}${rec.nivelesSubidos > 1 ? ` (subiste ${rec.nivelesSubidos} niveles)` : ''}.`
        )
    );

    cont.replaceChildren(titular, ...seccionesResultado(r), tablaRegistro(r));
    cont.hidden = false;
  }

  function renderTodo() {
    renderEncabezado(estado.paquete);
    renderAccion();
    renderResultado();
    renderDatos(estado.paquete, Boolean(estado.resultado));
    $('crudo').textContent = JSON.stringify({ paquete: estado.paquete, resultado: estado.resultado }, null, 2);
  }

  // -------------------------------------------------------------- navegación

  async function descartarBatalla() {
    try {
      await fetch('/api/combate/actual', { method: 'DELETE', credentials: 'same-origin' });
    } catch (_) {
      /* si falla, igual se vuelve al menú */
    }
  }

  async function volverAlMenu() {
    await descartarBatalla();
    window.location.href = URL_MENU;
  }

  // Falta algún dato: se descarta la batalla y se vuelve al menú con un aviso.
  async function devolverAlMenu(mensaje) {
    await descartarBatalla();
    window.location.replace(`${URL_MENU}?aviso=${encodeURIComponent(mensaje)}`);
  }

  // ------------------------------------------------------------------- pelea

  async function comenzarPelea(boton) {
    boton.disabled = true;
    boton.textContent = 'Peleando…';

    try {
      const datos = await pedir('/api/combate/resolver', { method: 'POST' });
      estado.resultado = datos.resultado;
      renderTodo();
      window.scrollTo(0, 0);
      const titular = $('titular');
      if (titular) titular.focus({ preventScroll: true });
    } catch (error) {
      if (error.sesion) return;
      if (error.status === 404) return devolverAlMenu(error.message);
      aviso(error.message);
      boton.disabled = false;
      boton.textContent = 'Comenzar pelea';
    }
  }

  async function iniciar() {
    $('btn-volver').addEventListener('click', volverAlMenu);

    let datos;
    try {
      datos = await pedir('/api/combate/actual');
    } catch (error) {
      if (error.sesion) return;
      if (error.status === 404) {
        return devolverAlMenu('No hay una batalla preparada. Elegí a quién pelear desde el menú.');
      }
      return devolverAlMenu('No se pudo cargar la batalla.');
    }

    estado.paquete = datos.paquete;
    estado.resultado = datos.resultado || null;

    const faltan = faltantes(estado.paquete);
    if (faltan.length) {
      return devolverAlMenu(`Faltan datos para la batalla: ${faltan.join(', ')}`);
    }

    try {
      renderTodo();
    } catch (error) {
      console.error(error);
      aviso('Hubo un problema al mostrar los datos de la batalla.');
    }
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
