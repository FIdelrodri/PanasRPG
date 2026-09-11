const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Servir todos los archivos estáticos de la carpeta (HTML, CSS, JS, imágenes)
app.use(express.static(__dirname));

// Ruta principal: envía el archivo index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});