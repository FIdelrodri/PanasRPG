// PanasRPG/javaScript/registro.js
//
// Intercepta el submit del formulario de registro.html, valida que las
// contraseñas coincidan, y llama a POST /registro en el backend.

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.tarjeta');

  if (!form) {
    console.error('No se encontró el formulario de registro (.tarjeta)');
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault(); // evita el submit nativo (recarga de página)

    const usuario = document.getElementById('usuario').value.trim();
    const password = document.getElementById('password').value;
    const password1 = document.getElementById('password1').value;

    if (!usuario || !password || !password1) {
      alert('Completá todos los campos');
      return;
    }

    if (password !== password1) {
      alert('Las contraseñas no coinciden');
      return;
    }

    try {
      const response = await fetch('/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usuario,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'No se pudo crear el usuario');
        return;
      }

      alert('¡Cuenta creada! Ya podés iniciar sesión.');
      window.location.href = '../inicio/inicio.html';
    } catch (err) {
      console.error('Error al registrar:', err);
      alert('Error de conexión con el servidor');
    }
  });
});
