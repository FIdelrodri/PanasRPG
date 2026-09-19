// PanasRPG/javaScript/batalla.js
//
// Vista de batalla (Main_batalla.html). Por ahora solo recibe el "paquete de
// batalla" que armó el servidor (/api/combate/actual) y lo muestra en lista.
// La cuenta del combate se agrega después sobre ese mismo paquete.
//
// Para cambiar qué se muestra, editar SECCIONES: cada sección es un título
// más una función que devuelve las filas [etiqueta, valor].

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

  // ---------------------------------------------------------------- utilidades

  const $ = (id) => document.getElementById(id);

  function el(tag, props = {}, ...hijos) {
    const nodo = document.createElement(tag);
    for (const [clave, valor] of Object.entries(props || {})) {
      if (valor === false || valor == null) continue;
      if (clave === 'class') nodo.className = valor;
      else nodo.setAttribute(clave, valor === true ? '' : valor);
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
    caja.classList.add('aviso--visible');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => caja.classList.remove('aviso--visible'), 4000);
  }

  // ----------------------------------------------------- qué se muestra (editable)

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
              'Arma especial',
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
      titulo: () => 'Recompensas',
      filas: (p) => {
        const r = p.objetivo.rewards || {};
        const filas = [['Experiencia', tiene(r.xp) ? numero(r.xp) : null]];
        if (r.gold) filas.push(['Oro', `${numero(r.gold.min)} a ${numero(r.gold.max)}`]);
        for (const d of r.drops || []) {
          const cantidad = d.min === d.max ? numero(d.min) : `${numero(d.min)} a ${numero(d.max)}`;
          filas.push([d.name, `${numero(d.chance * 100)}% de probabilidad, ${cantidad}`]);
        }
        return filas;
      },
    },
  ];

  // ------------------------------------------------------------------ dibujar

  function renderPaquete(paquete) {
    const o = paquete.objetivo;
    const tipo = o.kind === 'boss' ? 'Boss' : paquete.mundo ? `Enemigo del mundo ${paquete.mundo.name}` : 'Enemigo';
    $('bt-tipo').textContent = tipo;
    $('bt-titulo').textContent = o.name;
    document.title = `PanasRPG — Batalla contra ${o.name}`;

    const cont = $('datos');
    cont.replaceChildren();

    for (const seccion of SECCIONES) {
      if (seccion.visible && !seccion.visible(paquete)) continue;

      const filas = seccion.filas(paquete).map(([etiqueta, valor]) => {
        const vacio = !tiene(valor) || valor === '';
        return el(
          'div',
          { class: 'dato' },
          el('dt', {}, etiqueta),
          el('dd', { class: vacio ? 'dato__vacio' : '' }, vacio ? '—' : valor)
        );
      });

      cont.append(
        el(
          'section',
          { class: 'panel' },
          el('div', { class: 'panel__cabecera' }, el('h2', { class: 'panel__titulo' }, seccion.titulo(paquete))),
          el('div', { class: 'panel__cuerpo panel__cuerpo--datos' }, el('dl', { class: 'datos__lista' }, filas))
        )
      );
    }

    $('crudo').textContent = JSON.stringify(paquete, null, 2);
  }

  // -------------------------------------------------------------- navegación

  async function descartarPaquete() {
    try {
      await fetch('/api/combate/actual', { method: 'DELETE', credentials: 'same-origin' });
    } catch (_) {
      /* si falla, igual se vuelve al menú */
    }
  }

  async function volverAlMenu() {
    await descartarPaquete();
    window.location.href = URL_MENU;
  }

  // Falta algún dato: se descarta el paquete y se vuelve al menú con un aviso.
  async function devolverAlMenu(mensaje) {
    await descartarPaquete();
    window.location.replace(`${URL_MENU}?aviso=${encodeURIComponent(mensaje)}`);
  }

  async function iniciar() {
    $('btn-volver').addEventListener('click', volverAlMenu);

    let paquete = null;
    try {
      const respuesta = await fetch('/api/combate/actual', { credentials: 'same-origin' });
      if (respuesta.status === 401) {
        window.location.href = URL_INICIO;
        return;
      }
      const datos = await respuesta.json().catch(() => null);
      paquete = respuesta.ok && datos ? datos.paquete : null;
    } catch (_) {
      return devolverAlMenu('No se pudo cargar la batalla.');
    }

    if (!paquete) {
      return devolverAlMenu('No hay una batalla preparada. Elegí a quién pelear desde el menú.');
    }

    const faltan = faltantes(paquete);
    if (faltan.length) {
      return devolverAlMenu(`Faltan datos para la batalla: ${faltan.join(', ')}`);
    }

    try {
      renderPaquete(paquete);
    } catch (error) {
      console.error(error);
      aviso('Hubo un problema al mostrar los datos de la batalla.');
    }
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
