// PanasRPG/javaScript/menu.js
//
// Menú principal (Main_game.html): cuenta, equipo, inventario y la lista de
// mundos/enemigos/bosses. Todo lo que se dibuja sale de la API (/api/...);
// este archivo no calcula nada del juego.
//
// Se usa textContent en vez de innerHTML a propósito: nombres de usuario y de
// items nunca se interpretan como HTML.

(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const URL_INICIO = '../Menus/inicio/inicio.html'; // relativa a Vistas_generales/

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

  const CATEGORIAS = [
    { id: 'armas', nombre: 'Armas' },
    { id: 'armaduras', nombre: 'Armaduras' },
    { id: 'pociones', nombre: 'Pociones' },
    { id: 'materiales', nombre: 'Materiales' },
  ];

  const estado = {
    usuario: null,
    inventario: { weapons: [], armors: [], potions: [], materials: [] },
    equipado: { weaponId: null, armorId: null, potionIds: [] },
    maxPociones: 3,
    mundos: [],
    mundoActivo: null,
    enemigos: {}, // cache: worldId -> lista
    bosses: [],
    filtroInv: 'todo',
    ordenInv: 'categoria',
  };

  // ---------------------------------------------------------------- utilidades

  function el(tag, props = {}, ...hijos) {
    const nodo = document.createElement(tag);
    for (const [clave, valor] of Object.entries(props)) {
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

  const $ = (id) => document.getElementById(id);
  const vaciar = (nodo) => nodo.replaceChildren();

  const numero = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const multiplicador = (m) => `×${numero(m)}`;
  const armaTipo = (t) => ARMAS[t] || t;

  // La API puede mandar una debilidad/resistencia sola o una lista.
  const comoLista = (x) => (Array.isArray(x) ? x : x ? [x] : []);

  let temporizadorAviso = null;
  function aviso(texto, tipo) {
    const caja = $('aviso');
    caja.textContent = texto;
    caja.classList.toggle('aviso--error', tipo === 'error');
    caja.classList.add('aviso--visible');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => caja.classList.remove('aviso--visible'), 4500);
  }

  async function api(ruta, opciones = {}) {
    const respuesta = await fetch(ruta, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...opciones,
    });

    if (respuesta.status === 401) {
      window.location.href = URL_INICIO;
      throw new Error('Sesión vencida');
    }

    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (_) {
      /* respuesta sin JSON */
    }

    if (!respuesta.ok || !datos || datos.ok === false) {
      const error = new Error((datos && datos.error) || 'No se pudo conectar con el servidor');
      error.datos = datos;
      throw error;
    }
    return datos;
  }

  // -------------------------------------------------------------------- cuenta

  function renderCuenta() {
    const u = estado.usuario;
    if (!u) return;

    $('cuenta-nombre').textContent = u.username;
    $('cuenta-nivel').textContent = u.level;
    $('cuenta-oro').textContent = `Oro: ${numero(u.gold || 0)}`;

    const maximo = u.xpToNext == null;
    const porcentaje = maximo ? 100 : Math.max(0, Math.min(100, (u.xp / u.xpToNext) * 100));

    $('xp-relleno').style.width = `${porcentaje}%`;
    const barra = $('xp');
    barra.setAttribute('aria-valuenow', String(Math.round(porcentaje)));
    barra.setAttribute('aria-valuetext', maximo ? 'Nivel máximo' : `${u.xp} de ${u.xpToNext} de experiencia`);

    $('xp-texto').textContent = maximo
      ? 'Nivel máximo'
      : `${numero(u.xp)} / ${numero(u.xpToNext)} de experiencia para el nivel ${u.level + 1}`;
  }

  // -------------------------------------------------------------------- equipo

  function opcion({ titulo, detalle, activa, deshabilitada, alHacerClick }) {
    return el(
      'button',
      {
        type: 'button',
        class: 'opcion',
        'aria-pressed': activa ? 'true' : 'false',
        disabled: deshabilitada,
        onclick: alHacerClick,
      },
      el('span', { class: 'opcion__titulo' }, titulo),
      detalle && el('span', { class: 'opcion__detalle' }, detalle),
      activa && el('span', { class: 'opcion__marca' }, 'Equipado')
    );
  }

  function renderEquipo() {
    const { weapons, armors, potions } = estado.inventario;
    const eq = estado.equipado;
    const cont = $('equipo');
    vaciar(cont);

    // Arma
    cont.append(
      el(
        'div',
        { class: 'grupo' },
        el('h3', { class: 'grupo__titulo' }, 'Arma'),
        weapons.length
          ? el(
              'div',
              { class: 'opciones' },
              opcion({
                titulo: 'Sin arma',
                activa: eq.weaponId === null,
                alHacerClick: () => cambiarEquipo({ weaponId: null }),
              }),
              weapons.map((w) =>
                opcion({
                  titulo: w.name,
                  detalle: `${armaTipo(w.type)}, poder ${multiplicador(w.basePowerMultiplier)}`,
                  activa: eq.weaponId === w.weaponId,
                  alHacerClick: () => cambiarEquipo({ weaponId: w.weaponId }),
                })
              )
            )
          : el('p', { class: 'vacio' }, 'Todavía no tenés armas.')
      )
    );

    // Armadura
    cont.append(
      el(
        'div',
        { class: 'grupo' },
        el('h3', { class: 'grupo__titulo' }, 'Armadura'),
        armors.length
          ? el(
              'div',
              { class: 'opciones' },
              opcion({
                titulo: 'Sin armadura',
                activa: eq.armorId === null,
                alHacerClick: () => cambiarEquipo({ armorId: null }),
              }),
              armors.map((a) =>
                opcion({
                  titulo: a.name,
                  detalle: `Protección ${numero(a.protection)}`,
                  activa: eq.armorId === a.armorId,
                  alHacerClick: () => cambiarEquipo({ armorId: a.armorId }),
                })
              )
            )
          : el('p', { class: 'vacio' }, 'Todavía no tenés armaduras.')
      )
    );

    // Pociones (se activan hasta el máximo; se consumen en la batalla)
    const llenas = eq.potionIds.length >= estado.maxPociones;
    cont.append(
      el(
        'div',
        { class: 'grupo' },
        el(
          'h3',
          { class: 'grupo__titulo' },
          'Pociones',
          el('span', { class: 'grupo__cuenta' }, `${eq.potionIds.length} de ${estado.maxPociones} activas`)
        ),
        potions.length
          ? el(
              'div',
              { class: 'opciones' },
              potions.map((p) => {
                const activa = eq.potionIds.includes(p.potionId);
                return opcion({
                  titulo: p.name,
                  detalle: `${STATS[p.stat] || p.stat} ${multiplicador(p.multiplier)}, tenés ${numero(p.quantity)}`,
                  activa,
                  deshabilitada: !activa && llenas,
                  alHacerClick: () => alternarPocion(p.potionId),
                });
              })
            )
          : el('p', { class: 'vacio' }, 'Todavía no tenés pociones.')
      )
    );
  }

  function alternarPocion(id) {
    const actuales = estado.equipado.potionIds;
    if (actuales.includes(id)) {
      cambiarEquipo({ potionIds: actuales.filter((p) => p !== id) });
    } else if (actuales.length < estado.maxPociones) {
      cambiarEquipo({ potionIds: [...actuales, id] });
    }
  }

  // Los cambios se guardan de a uno, en orden, para que no se pisen.
  let colaGuardado = Promise.resolve();

  function cambiarEquipo(cambios) {
    estado.equipado = { ...estado.equipado, ...cambios };
    renderEquipo();
    renderInventario();

    const cuerpo = JSON.stringify({
      weaponId: estado.equipado.weaponId,
      armorId: estado.equipado.armorId,
      potionIds: estado.equipado.potionIds,
    });

    colaGuardado = colaGuardado
      .then(() => api('/api/equipo', { method: 'PUT', body: cuerpo }))
      .catch(async (error) => {
        aviso(error.message || 'No se pudo guardar el equipo', 'error');
        await cargarMenu(); // vuelve a lo que quedó guardado
      });
  }

  // ---------------------------------------------------------------- inventario

  function itemsInventario() {
    const { weapons, armors, potions, materials } = estado.inventario;
    const eq = estado.equipado;

    return [
      ...weapons.map((w) => ({
        categoria: 'armas',
        id: w.weaponId,
        nombre: w.name,
        detalle: `${armaTipo(w.type)}, poder ${multiplicador(w.basePowerMultiplier)}`,
        cantidad: null,
        equipado: eq.weaponId === w.weaponId,
      })),
      ...armors.map((a) => ({
        categoria: 'armaduras',
        id: a.armorId,
        nombre: a.name,
        detalle: `Protección ${numero(a.protection)}`,
        cantidad: null,
        equipado: eq.armorId === a.armorId,
      })),
      ...potions.map((p) => ({
        categoria: 'pociones',
        id: p.potionId,
        nombre: p.name,
        detalle: `${STATS[p.stat] || p.stat} ${multiplicador(p.multiplier)}`,
        cantidad: p.quantity,
        equipado: eq.potionIds.includes(p.potionId),
      })),
      ...materials.map((m) => ({
        categoria: 'materiales',
        id: m.materialId,
        nombre: m.name,
        detalle: null,
        cantidad: m.quantity,
        equipado: false,
      })),
    ];
  }

  function renderFiltrosInventario(items) {
    const cont = $('inv-filtros');
    vaciar(cont);

    const opciones = [{ id: 'todo', nombre: 'Todo' }, ...CATEGORIAS];
    for (const op of opciones) {
      const cuenta = op.id === 'todo' ? items.length : items.filter((i) => i.categoria === op.id).length;
      cont.append(
        el(
          'button',
          {
            type: 'button',
            class: 'filtro',
            'aria-pressed': estado.filtroInv === op.id ? 'true' : 'false',
            onclick: () => {
              estado.filtroInv = op.id;
              renderInventario();
            },
          },
          op.nombre,
          el('span', { class: 'filtro__cuenta' }, cuenta)
        )
      );
    }
  }

  function filaInventario(item) {
    return el(
      'li',
      { class: 'fila' },
      el(
        'div',
        { class: 'fila__principal' },
        el('span', { class: 'fila__nombre' }, item.nombre),
        item.detalle && el('span', { class: 'fila__detalle' }, item.detalle)
      ),
      el(
        'div',
        { class: 'fila__lado' },
        item.equipado && el('span', { class: 'fila__marca' }, 'Equipado'),
        item.cantidad != null && el('span', { class: 'fila__cantidad' }, `×${numero(item.cantidad)}`)
      )
    );
  }

  function renderInventario() {
    const todos = itemsInventario();
    renderFiltrosInventario(todos);

    const cont = $('inventario');
    vaciar(cont);

    let items = estado.filtroInv === 'todo' ? todos : todos.filter((i) => i.categoria === estado.filtroInv);

    if (!items.length) {
      cont.append(
        el(
          'p',
          { class: 'vacio' },
          todos.length ? 'No hay objetos en esta categoría.' : 'Tu inventario está vacío.'
        )
      );
      return;
    }

    const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
    const ordenCategoria = (c) => CATEGORIAS.findIndex((x) => x.id === c);

    if (estado.ordenInv === 'nombre') {
      items = [...items].sort(porNombre);
    } else if (estado.ordenInv === 'cantidad') {
      items = [...items].sort((a, b) => (b.cantidad ?? 0) - (a.cantidad ?? 0) || porNombre(a, b));
    } else {
      items = [...items].sort((a, b) => ordenCategoria(a.categoria) - ordenCategoria(b.categoria) || porNombre(a, b));
    }

    const lista = el('ul', { class: 'lista' });
    const agrupar = estado.ordenInv === 'categoria' && estado.filtroInv === 'todo';
    let anterior = null;

    for (const item of items) {
      if (agrupar && item.categoria !== anterior) {
        const cat = CATEGORIAS.find((c) => c.id === item.categoria);
        lista.append(el('li', { class: 'lista__grupo' }, cat.nombre));
        anterior = item.categoria;
      }
      lista.append(filaInventario(item));
    }
    cont.append(lista);
  }

  // ------------------------------------------------------------- combate: común

  async function pelear(tipo, id, boton) {
    const textoOriginal = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Entrando…';

    try {
      const datos = await api('/api/combate/iniciar', {
        method: 'POST',
        body: JSON.stringify({ tipo, id }),
      });
      window.location.href = datos.redirect;
    } catch (error) {
      const faltan = error.datos && error.datos.faltantes;
      aviso(faltan ? `${error.message}: ${faltan.join(', ')}` : error.message, 'error');
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }
  }

  function botonPelear(tipo, id, nombre, deshabilitado) {
    return el(
      'button',
      {
        type: 'button',
        class: 'boton',
        disabled: deshabilitado,
        'aria-label': `Pelear contra ${nombre}`,
        onclick: (evento) => pelear(tipo, id, evento.currentTarget),
      },
      'Pelear'
    );
  }

  // ------------------------------------------------------------------- mundos

  function renderMundos() {
    const cont = $('mundos');
    vaciar(cont);
    for (const mundo of estado.mundos) {
      cont.append(
        el(
          'button',
          {
            type: 'button',
            class: 'filtro',
            'aria-pressed': estado.mundoActivo === mundo.worldId ? 'true' : 'false',
            onclick: () => elegirMundo(mundo.worldId),
          },
          mundo.name,
          el('span', { class: 'filtro__cuenta' }, mundo.enemyCount)
        )
      );
    }
  }

  async function elegirMundo(worldId) {
    estado.mundoActivo = worldId;
    renderMundos();

    const cont = $('enemigos');
    if (!estado.enemigos[worldId]) {
      vaciar(cont);
      cont.append(el('p', { class: 'vacio' }, 'Cargando enemigos…'));
      try {
        const datos = await api(`/api/mundos/${encodeURIComponent(worldId)}/enemigos`);
        estado.enemigos[worldId] = datos.enemies;
      } catch (error) {
        if (estado.mundoActivo === worldId) {
          vaciar(cont);
          cont.append(el('p', { class: 'vacio' }, 'No se pudieron cargar los enemigos.'));
          aviso(error.message, 'error');
        }
        return;
      }
    }

    // Si mientras tanto se eligió otro mundo, no pisar su lista.
    if (estado.mundoActivo === worldId) renderEnemigos(worldId);
  }

  function etiquetasCombate(combat) {
    const etiquetas = [];
    for (const d of comoLista(combat && combat.weakness)) {
      etiquetas.push(
        el('span', { class: 'etiqueta etiqueta--debil' }, `Débil a ${armaTipo(d.weaponType)} ${multiplicador(d.multiplier)}`)
      );
    }
    for (const r of comoLista(combat && combat.resistance)) {
      etiquetas.push(
        el('span', { class: 'etiqueta etiqueta--resiste' }, `Resiste ${armaTipo(r.weaponType)} ${multiplicador(r.multiplier)}`)
      );
    }
    return etiquetas;
  }

  function renderEnemigos(worldId) {
    const cont = $('enemigos');
    vaciar(cont);

    const lista = estado.enemigos[worldId] || [];
    if (!lista.length) {
      cont.append(el('p', { class: 'vacio' }, 'Este mundo todavía no tiene enemigos.'));
      return;
    }

    cont.append(
      el(
        'ul',
        { class: 'lista' },
        lista.map((e) =>
          el(
            'li',
            { class: 'fila' },
            el(
              'div',
              { class: 'fila__principal' },
              el('span', { class: 'fila__nombre' }, e.name),
              el(
                'span',
                { class: 'fila__detalle' },
                `Rango ${e.progressionRank}, vida ${numero(e.stats.hp)}, ataque ${numero(e.stats.attack)}`
              ),
              el('div', { class: 'etiquetas' }, etiquetasCombate(e.combat))
            ),
            el('div', { class: 'fila__lado' }, botonPelear('enemigo', e.enemyId, e.name, false))
          )
        )
      )
    );
  }

  // ------------------------------------------------------------------- bosses

  function renderBosses() {
    const cont = $('bosses');
    vaciar(cont);

    if (!estado.bosses.length) {
      cont.append(el('p', { class: 'vacio' }, 'Todavía no hay bosses.'));
      return;
    }

    cont.append(
      el(
        'ul',
        { class: 'lista' },
        estado.bosses.map((b) => {
          const bloqueado = b.estado === 'locked';
          return el(
            'li',
            { class: `fila${bloqueado ? ' fila--bloqueada' : ''}` },
            el(
              'div',
              { class: 'fila__principal' },
              el('span', { class: 'fila__nombre' }, b.name),
              el(
                'span',
                { class: 'fila__detalle' },
                `Rango ${b.progressionRank}, vida ${numero(b.stats.hp)}, ataque ${numero(b.stats.attack)}`
              ),
              el(
                'div',
                { class: 'etiquetas' },
                b.estado === 'defeated' && el('span', { class: 'etiqueta etiqueta--estado' }, 'Derrotado'),
                b.specialWeapon &&
                  el(
                    'span',
                    { class: 'etiqueta etiqueta--especial' },
                    `Arma especial (opcional): ${b.specialWeapon.name} ${multiplicador(b.specialWeapon.multiplier)}`
                  )
              ),
              bloqueado &&
                el('span', { class: 'fila__aviso' }, `Bloqueado: primero derrotá a ${b.bloqueadoPor.name}.`)
            ),
            el('div', { class: 'fila__lado' }, botonPelear('boss', b.bossId, b.name, bloqueado))
          );
        })
      )
    );
  }

  // ---------------------------------------------------------- pestañas y móvil

  function elegirPestana(nombre) {
    for (const boton of document.querySelectorAll('.pestana')) {
      const activa = boton.dataset.tab === nombre;
      boton.setAttribute('aria-selected', activa ? 'true' : 'false');
      const panel = $(`panel-${boton.dataset.tab}`);
      if (panel) panel.hidden = !activa;
    }
  }

  function irASeccion(nombre) {
    for (const seccion of document.querySelectorAll('.seccion')) {
      seccion.classList.toggle('seccion--activa', seccion.dataset.seccion === nombre);
    }
    for (const boton of document.querySelectorAll('[data-ir]')) {
      if (boton.dataset.ir === nombre) boton.setAttribute('aria-current', 'true');
      else boton.removeAttribute('aria-current');
    }
  }

  // ------------------------------------------------------------------- carga

  async function cargarMenu() {
    const datos = await api('/api/menu');
    estado.usuario = datos.usuario;
    estado.inventario = datos.inventario;
    estado.equipado = datos.equipado;
    estado.maxPociones = datos.maxPociones || 3;
    renderCuenta();
    renderEquipo();
    renderInventario();
  }

  async function cargarMundos() {
    const datos = await api('/api/mundos');
    estado.mundos = datos.worlds;
    if (estado.mundos.length) await elegirMundo(estado.mundos[0].worldId);
    else $('enemigos').replaceChildren(el('p', { class: 'vacio' }, 'Todavía no hay mundos.'));
  }

  async function cargarBosses() {
    const datos = await api('/api/bosses');
    estado.bosses = datos.bosses;
    renderBosses();
  }

  function mostrarAvisoDeLaUrl() {
    // Main_batalla.html devuelve acá con ?aviso=... cuando falta algún dato.
    const params = new URLSearchParams(window.location.search);
    const texto = params.get('aviso');
    if (!texto) return;
    aviso(texto.slice(0, 200), 'error');
    window.history.replaceState(null, '', window.location.pathname);
  }

  function iniciar() {
    $('inv-orden').addEventListener('change', (evento) => {
      estado.ordenInv = evento.target.value;
      renderInventario();
    });

    for (const boton of document.querySelectorAll('.pestana')) {
      boton.addEventListener('click', () => elegirPestana(boton.dataset.tab));
    }
    for (const boton of document.querySelectorAll('[data-ir]')) {
      boton.addEventListener('click', () => irASeccion(boton.dataset.ir));
    }

    irASeccion('combate');
    mostrarAvisoDeLaUrl();

    Promise.all([cargarMenu(), cargarMundos(), cargarBosses()]).catch((error) => {
      console.error(error);
      aviso('No se pudo cargar el menú. Probá recargar la página.', 'error');
    });
  }

  // Si se vuelve con el botón "atrás" del navegador, la página puede venir de
  // la memoria con datos viejos: se vuelven a pedir (XP, oro, items, bosses).
  window.addEventListener('pageshow', (evento) => {
    if (!evento.persisted) return;
    Promise.all([cargarMenu(), cargarBosses()]).catch((error) => console.error(error));
  });

  document.addEventListener('DOMContentLoaded', iniciar);
})();
