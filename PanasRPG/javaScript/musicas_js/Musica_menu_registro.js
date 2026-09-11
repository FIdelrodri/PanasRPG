document.addEventListener('DOMContentLoaded', () => {
  // CONFIGURACIÓN
  const RUTA_MUSICA = '../../../PanasRPG/audio/canciones/musica_cancion_menu.mp3'; 
  const VOLUMEN_INICIAL = 0.5; // Ajusta el volumen aquí (0.0 = silencio, 1.0 = máximo)

  // Crear el elemento de audio en memoria
  const audio = new Audio(RUTA_MUSICA);
  audio.loop = true;
  audio.volume = VOLUMEN_INICIAL; // Aplicar volumen configurado

  // Intento 1: Reproducir automáticamente si el navegador lo permite
  const intentarAutoplay = () => {
    audio.play().then(() => {
      removerEscuchadores();
    }).catch(() => {
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