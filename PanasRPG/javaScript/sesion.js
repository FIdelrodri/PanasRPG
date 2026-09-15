// PanasRPG/javaScript/sesion.js
//
// Lógica común para las vistas protegidas (Main_game.html y
// Main_batalla.html): maneja el botón de "Cerrar sesión".
// Si no hay botón con id="btn-logout" en la página, no hace nada.

document.addEventListener('DOMContentLoaded', () => {
  const btnLogout = document.getElementById('btn-logout');

  if (!btnLogout) return;

  btnLogout.addEventListener('click', async () => {
    try {
      await fetch('/logout', { method: 'POST' });
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      window.location.href = '../Menus/inicio/inicio.html';
    }
  });
});
