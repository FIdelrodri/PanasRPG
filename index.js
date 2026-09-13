const express = require('express');
const path = require('path');
const { connectDB } = require('./PanasRPG/Metodos/db');

const app = express();
const PORT = 3000;

app.use(express.json());

// Servir todos los archivos estáticos de la carpeta (HTML, CSS, JS, imágenes)
app.use(express.static(__dirname));

// Ruta principal: envía el menú de registro
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'PanasRPG', 'Vistas', 'Menus', 'Registro', 'registro.html'));
});

// -------------------- REGISTRO --------------------

app.post('/registro', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ ok: false, error: 'Falta username o password' });
    }

    const db = require('./PanasRPG/Metodos/db').getDB();
    const usuarios = db.collection('usuarios');

    const existente = await usuarios.findOne({ username });
    if (existente) {
      return res
        .status(409)
        .json({ ok: false, error: 'Ese nombre de usuario ya existe' });
    }

    const nuevoUsuario = {
      username,
      password, // texto plano, decisión ya tomada para el prototipo
      gold: 0,
      level: 1,
      xp: 0,
      materials: {}, // { materialId: cantidad }
      ownedWeapons: [], // ids de armas únicas obtenidas
      ownedArmors: [], // ids de sets de armadura únicos obtenidos
      ownedPotions: {}, // { potionId: cantidad }
      equipped: {
        weaponId: null,
        armorId: null,
        potionIds: [], // hasta 3 por combate
      },
      defeatedBosses: [], // ["B1", "B2", ...]
      createdAt: new Date(),
    };

    const result = await usuarios.insertOne(nuevoUsuario);

    return res.status(201).json({
      ok: true,
      userId: result.insertedId,
      message: 'Usuario creado correctamente',
    });
  } catch (err) {
    console.error('Error en /registro:', err);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

// -------------------- ARRANQUE --------------------

async function start() {
  await connectDB(); // conecta una sola vez y queda disponible vía getDB()

  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

start();