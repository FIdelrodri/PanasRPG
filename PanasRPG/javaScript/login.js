// PanasRPG/javaScript/login.js
//
// Intercepta el submit del formulario de inicio.html, llama a
// POST /login en el backend y, si las credenciales son correctas,
// redirige a Main_game.html (el backend ya deja guardada la sesión).

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.tarjeta');

  if (!form) {
    console.error('No se encontró el formulario de inicio de sesión (.tarjeta)');
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault(); // evita el submit nativo (recarga de página)

    const usuario = document.getElementById('usuario').value.trim();
    const password = document.getElementById('password').value;

    if (!usuario || !password) {
      alert('Completá usuario y contraseña');
      return;
    }

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usuario,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'No se pudo iniciar sesión');
        return;
      }

      window.location.href = '../../Vistas_generales/Main_game.html';
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      alert('Error de conexión con el servidor');
    }
  });
});
