// Reproduce visualmente el combate calculado por el servidor y confirma
// sus cambios de cuenta únicamente cuando el jugador vuelve a la sala.
(() => {
  'use strict';

  const URL_INICIO = '../Menus/inicio/inicio.html';
  const URL_MENU = 'Main_game.html';
  const INTERVALO_TURNO = 2000;
  const estado = {
    paquete: null,
    resultado: null,
    terminado: false,
    saltar: false,
    confirmado: false,
    cancelarEspera: null,
    confirmando: false,
  };

  const $ = (id) => document.getElementById(id);
  const numero = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });

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
    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok || !datos || datos.ok === false) {
      const error = new Error((datos && datos.error) || 'No se pudo conectar con el servidor');
      error.status = respuesta.status;
      throw error;
    }
    return datos;
  }

  function aviso(mensaje) {
    const caja = $('aviso');
    caja.textContent = mensaje;
    caja.classList.add('aviso--error', 'aviso--visible');
    setTimeout(() => caja.classList.remove('aviso--visible'), 5000);
  }

  function mundoNumero(paquete) {
    const id = paquete.mundo && paquete.mundo.worldId;
    const numeroMundo = id && id.match(/\d+/);
    if (numeroMundo) return numeroMundo[0];
    const boss = paquete.objetivo.id.match(/\d+/);
    return boss ? boss[0] : '1';
  }

  function asignarImagen(imagen, rutas) {
    const placeholder = imagen.parentElement.querySelector('.personaje__placeholder');
    let indice = 0;
    imagen.alt = '';
    imagen.onerror = () => {
      indice += 1;
      if (indice < rutas.length) {
        imagen.src = rutas[indice];
      } else {
        imagen.hidden = true;
        placeholder.hidden = false;
      }
    };
    placeholder.hidden = true;
    imagen.hidden = false;
    imagen.src = rutas[0];
  }

  function prepararEscena(paquete) {
    const objetivo = paquete.objetivo;
    const mundo = mundoNumero(paquete);
    const fondoMundo = `../../assets/Mapas/Fondo_Mundo_${mundo}.jpg`;
    if (objetivo.kind === 'boss') {
      const fondoBoss = `../../assets/Mapas/Fondo_Boss_${objetivo.id}.jpg`;
      const prueba = new Image();
      prueba.onload = () => { document.body.style.backgroundImage = `url("${fondoBoss}")`; };
      prueba.onerror = () => { document.body.style.backgroundImage = `url("${fondoMundo}")`; };
      prueba.src = fondoBoss;
    } else {
      document.body.style.backgroundImage = `url("${fondoMundo}")`;
    }

    const armadura = paquete.equipo.armadura;
    const imagenArmadura = armadura
      ? `../../assets/Personajes/Protagonista/${armadura.armorId}_armadura.png`
      : '../../assets/Personajes/Protagonista/sin_armadura.png';
    asignarImagen($('jugador-imagen'), [
      imagenArmadura,
      '../../assets/Personajes/Protagonista/sin_armadura.png',
    ]);

    const imagenEnemigo = objetivo.kind === 'boss'
      ? `../../assets/Personajes/Enemigos/boss_${objetivo.id}.png`
      : `../../assets/Personajes/Enemigos/enemigo_${mundo}_${objetivo.worldEnemyIndex || 1}.png`;
    asignarImagen($('enemigo-imagen'), [
      imagenEnemigo,
      '../../assets/Personajes/Enemigos/404_enemigo.jpg',
    ]);

    $('bt-tipo').textContent = objetivo.kind === 'boss'
      ? 'Combate contra boss'
      : `Mundo ${mundo}${paquete.mundo ? ` · ${paquete.mundo.name}` : ''}`;
    $('bt-titulo').textContent = objetivo.name;
    document.title = `PanasRPG — Batalla contra ${objetivo.name}`;
    $('jugador-nombre').textContent = paquete.jugador.username;
    $('enemigo-nombre').textContent = objetivo.name;
    configurarVida('jugador', paquete.jugador.stats.hp, paquete.jugador.stats.hp);
    configurarVida('enemigo', objetivo.stats.hp, objetivo.stats.hp);
    if (paquete.puedeSaltar) $('btn-saltar').hidden = false;
  }

  function esperar(ms) {
    return new Promise((resolve) => {
      const temporizador = setTimeout(() => {
        estado.cancelarEspera = null;
        resolve();
      }, ms);
      estado.cancelarEspera = () => {
        clearTimeout(temporizador);
        estado.cancelarEspera = null;
        resolve();
      };
    });
  }

  function configurarVida(prefijo, actual, maximo) {
    const barra = $(`${prefijo}-vida`);
    const porcentaje = maximo > 0 ? Math.max(0, Math.min(100, actual / maximo * 100)) : 0;
    $(`${prefijo}-vida-relleno`).style.width = `${porcentaje}%`;
    $(`${prefijo}-vida-texto`).textContent = `${numero(actual)} / ${numero(maximo)}`;
    barra.setAttribute('aria-valuemax', String(maximo));
    barra.setAttribute('aria-valuenow', String(actual));
  }

  function burbujaDanio(actor, golpe) {
    const escena = $('arena');
    const objetivo = actor === 'jugador' ? $('enemigo') : $('jugador');
    const burbuja = document.createElement('span');
    burbuja.className = 'danio-flotante';
    if (golpe.esquivado) {
      burbuja.textContent = '¡Esquiva!';
      burbuja.classList.add('danio-flotante--esquiva');
    } else {
      burbuja.textContent = golpe.critico ? `¡Crítico! -${numero(golpe.danio)}` : `-${numero(golpe.danio)}`;
      if (golpe.critico) burbuja.classList.add('danio-flotante--critico');
    }
    const escenaRect = escena.getBoundingClientRect();
    const objetivoRect = objetivo.getBoundingClientRect();
    burbuja.style.left = `${objetivoRect.left - escenaRect.left + objetivoRect.width / 2}px`;
    burbuja.style.top = `${objetivoRect.top - escenaRect.top + objetivoRect.height / 3}px`;
    escena.append(burbuja);
    burbuja.addEventListener('animationend', () => burbuja.remove(), { once: true });
  }

  async function reproducir(resultado) {
    const maxJugador = resultado.preparacion.jugadorConPociones.hp;
    const maxEnemigo = resultado.resumen.objetivo.hpInicial;
    $('jugador').classList.toggle('personaje--derrotado', false);
    configurarVida('jugador', maxJugador, maxJugador);
    configurarVida('enemigo', maxEnemigo, maxEnemigo);

    for (let indice = 0; indice < resultado.log.length; indice += 1) {
      if (estado.saltar) break;
      const golpe = resultado.log[indice];
      const atacante = golpe.actor === 'jugador' ? $('jugador') : $('enemigo');
      const defensor = golpe.actor === 'jugador' ? $('enemigo') : $('jugador');
      const claseAtaque = golpe.actor === 'jugador'
        ? 'personaje--atacando-jugador'
        : 'personaje--atacando-enemigo';
      atacante.classList.remove('personaje--atacando-jugador', 'personaje--atacando-enemigo');
      void atacante.offsetWidth;
      atacante.classList.add(claseAtaque);
      $('estado-combate').textContent = golpe.actor === 'jugador'
        ? `${estado.paquete.jugador.username} ataca`
        : `${estado.paquete.objetivo.name} ataca`;
      await esperar(420);
      if (estado.saltar) break;

      burbujaDanio(golpe.actor, golpe);
      defensor.classList.remove('personaje--danado');
      void defensor.offsetWidth;
      if (!golpe.esquivado) defensor.classList.add('personaje--danado');

      configurarVida('jugador', golpe.jugadorHp, maxJugador);
      configurarVida('enemigo', golpe.objetivoHp, maxEnemigo);
      await esperar(INTERVALO_TURNO - 420);
    }

    estado.terminado = true;
    $('estado-combate').textContent = resultado.victoria
      ? `${estado.paquete.objetivo.name} fue derrotado`
      : 'La batalla terminó en derrota';
    mostrarResultado(resultado);
  }

  function lineaBotin(etiqueta, valor) {
    const linea = document.createElement('div');
    linea.className = 'botin__linea';
    const nombre = document.createElement('span');
    nombre.textContent = etiqueta;
    const cantidad = document.createElement('strong');
    cantidad.textContent = valor;
    linea.append(nombre, cantidad);
    return linea;
  }

  function mostrarResultado(resultado) {
    $('btn-saltar').hidden = true;
    const tarjeta = $('resultado-tarjeta');
    tarjeta.className = `resultado-tarjeta resultado-tarjeta--${resultado.victoria ? 'victoria' : 'derrota'}`;
    const titulo = document.createElement('h2');
    titulo.id = 'resultado-titulo';
    titulo.className = 'resultado__titulo';
    titulo.textContent = resultado.victoria ? '¡Victoria!' : 'Derrota';
    const detalle = document.createElement('p');
    detalle.className = 'resultado__detalle';
    detalle.textContent = resultado.victoria
      ? `Venciste a ${resultado.paquete.objetivo.name} en ${resultado.rondas} ${resultado.rondas === 1 ? 'ronda' : 'rondas'}.`
      : resultado.motivo === 'vida'
        ? `${resultado.paquete.objetivo.name} te derrotó.`
        : `La batalla llegó al límite de ${resultado.preparacion.maxRondas} rondas.`;
    const botin = document.createElement('div');
    botin.className = 'botin';
    const recompensas = resultado.recompensas;
    if (resultado.victoria) {
      botin.append(
        lineaBotin('Experiencia', `+${numero(recompensas.xp)} XP`),
        lineaBotin('Oro', `+${numero(recompensas.oro)}`)
      );
      if (recompensas.drops.length) {
        for (const drop of recompensas.drops) {
          botin.append(lineaBotin(drop.name, `×${numero(drop.cantidad)}`));
        }
      } else if (resultado.paquete.objetivo.kind === 'enemigo') {
        botin.append(lineaBotin('Botín', 'No encontraste materiales'));
      }
      if (recompensas.subioNivel) {
        botin.append(lineaBotin('Nuevo nivel', numero(recompensas.nivelDespues)));
      }
    } else {
      const sinBotin = document.createElement('p');
      sinBotin.className = 'resultado__detalle';
      sinBotin.textContent = 'No obtuviste XP, oro ni botín.';
      botin.append(sinBotin);
    }

    const aviso = document.createElement('p');
    aviso.className = 'resultado__aviso';
    aviso.textContent = resultado.pocionesGastadas.length
      ? `Se gastarán al volver: ${resultado.pocionesGastadas.map((p) => p.name).join(', ')}.`
      : 'Las recompensas se guardarán al volver a la sala.';

    const error = document.createElement('p');
    error.id = 'error-confirmacion';
    error.className = 'error-confirmacion';
    error.hidden = true;
    const botones = document.createElement('div');
    botones.className = 'resultado__botones';
    const volver = document.createElement('button');
    volver.type = 'button';
    volver.className = 'boton boton--grande';
    volver.id = 'btn-confirmar';
    volver.textContent = 'Volver a la sala';
    volver.addEventListener('click', confirmarYVolver);
    botones.append(volver);
    tarjeta.replaceChildren(titulo, detalle, botin, aviso, error, botones);
    $('resultado-modal').hidden = false;
    $('btn-volver').disabled = false;
    volver.focus({ preventScroll: true });
  }

  async function confirmarYVolver() {
    if (estado.confirmado || estado.confirmando) return;
    estado.confirmando = true;
    $('btn-confirmar').disabled = true;
    $('btn-confirmar').textContent = 'Guardando…';
    $('btn-volver').disabled = true;
    try {
      await pedir('/api/combate/confirmar', { method: 'POST' });
      estado.confirmado = true;
      window.location.href = URL_MENU;
    } catch (error) {
      if (error.sesion) return;
      const caja = $('error-confirmacion');
      caja.textContent = error.message;
      caja.hidden = false;
      $('btn-confirmar').disabled = false;
      $('btn-confirmar').textContent = 'Reintentar y volver a la sala';
      $('btn-volver').disabled = false;
      estado.confirmando = false;
    }
  }

  async function comenzarPelea() {
    $('estado-combate').textContent = 'La pelea comenzó';
    try {
      const datos = await pedir('/api/combate/resolver', { method: 'POST' });
      estado.resultado = datos.resultado;
      if (estado.saltar) {
        estado.terminado = true;
        configurarVida('jugador', datos.resultado.resumen.jugador.hpFinal, datos.resultado.resumen.jugador.hpInicial);
        configurarVida('enemigo', datos.resultado.resumen.objetivo.hpFinal, datos.resultado.resumen.objetivo.hpInicial);
        mostrarResultado(datos.resultado);
        return;
      }
      await reproducir(datos.resultado);
    } catch (error) {
      if (error.sesion) return;
      aviso(error.message);
      $('estado-combate').textContent = 'No se pudo iniciar el combate';
    }
  }

  async function iniciar() {
    try {
      const datos = await pedir('/api/combate/actual');
      estado.paquete = datos.paquete;
      prepararEscena(datos.paquete);
      const musica = $('musica-batalla');
      musica.volume = 0.35;
      musica.play().then(() => {
        $('btn-musica').textContent = 'Silenciar música';
        $('btn-musica').setAttribute('aria-pressed', 'true');
      }).catch(() => {
        $('btn-musica').textContent = 'Activar música';
      });
      $('btn-musica').addEventListener('click', async () => {
        if (musica.paused) {
          try {
            await musica.play();
            $('btn-musica').textContent = 'Silenciar música';
            $('btn-musica').setAttribute('aria-pressed', 'true');
          } catch (_) {
            aviso('No se pudo reproducir la música de batalla.');
          }
        } else {
          musica.pause();
          $('btn-musica').textContent = 'Activar música';
          $('btn-musica').setAttribute('aria-pressed', 'false');
        }
      });
      $('btn-saltar').addEventListener('click', () => {
        estado.saltar = true;
        if (estado.cancelarEspera) estado.cancelarEspera();
        $('estado-combate').textContent = 'Saltando la pelea…';
        if (estado.resultado && !estado.terminado) {
          estado.terminado = true;
          configurarVida('jugador', estado.resultado.resumen.jugador.hpFinal, estado.resultado.resumen.jugador.hpInicial);
          configurarVida('enemigo', estado.resultado.resumen.objetivo.hpFinal, estado.resultado.resumen.objetivo.hpInicial);
          mostrarResultado(estado.resultado);
        }
      });

      if (datos.resultado) {
        if (datos.resultado.confirmado) {
          window.location.replace(URL_MENU);
          return;
        }
        estado.resultado = datos.resultado;
        if (estado.saltar) {
          estado.terminado = true;
          mostrarResultado(datos.resultado);
        } else {
          await reproducir(datos.resultado);
        }
      } else {
        await comenzarPelea();
      }
    } catch (error) {
      if (error.sesion) return;
      aviso(error.message);
      $('estado-combate').textContent = 'No se pudo cargar la batalla';
    }
  }

  $('btn-volver').addEventListener('click', () => {
    if (!estado.terminado) return;
    confirmarYVolver();
  });

  window.addEventListener('pagehide', () => {
    if (estado.confirmado) return;
    fetch('/api/combate/actual', {
      method: 'DELETE',
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {});
  });

  document.addEventListener('DOMContentLoaded', iniciar);
})();
