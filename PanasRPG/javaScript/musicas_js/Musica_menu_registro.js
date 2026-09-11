document.addEventListener('DOMContentLoaded', () => {
  // CONFIGURA AQUÍ TU ARCHIVO DE MÚSICA
  const RUTA_MUSICA = '../../../audio/canciones/musica_cancion_menu.mp3'; 

  // Crear el elemento de audio en memoria
  const audio = new Audio(RUTA_MUSICA);
  audio.loop = true;

  // Intento 1: Reproducir automáticamente si el navegador lo permite
  const intentarAutoplay = () => {
    audio.play().then(() => {
      // Si la reproducción fue exitosa, limpiamos los eventos
      removerEscuchadores();
    }).catch(() => {
      // Si el navegador bloqueó el autoplay silenciosamente, esperamos interacción
      console.log('Autoplay bloqueado. Esperando primera interacción del usuario...');
    });
  };

  // Intento 2: Iniciar audio en el primer clic o tecla presionada
  const reproducirEnInteraccion = () => {
    audio.play().then(() => {
      removerEscuchadores();
    }).catch(error => console.error('Error al reproducir audio:', error));
  };

  function removerEscuchadores() {
    document.removeEventListener('click', reproducirEnInteraccion);
    document.removeEventListener('keydown', reproducirEnInteraccion);
    document.removeEventListener('touchstart', reproducirEnInteraccion);
  }

  // Escuchar posibles interacciones globales
  document.addEventListener('click', reproducirEnInteraccion);
  document.addEventListener('keydown', reproducirEnInteraccion);
  document.addEventListener('touchstart', reproducirEnInteraccion);

  // Ejecutar el intento inicial
  intentarAutoplay();
});