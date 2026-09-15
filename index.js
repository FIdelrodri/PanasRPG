const express = require('express');
const path = require('path');
const session = require('express-session');
const { connectDB } = require('./PanasRPG/Metodos/db');

const app = express();
const PORT = 3000;

app.use(express.json());

// -------------------- SESIÓN --------------------
// Guarda quién inició sesión (userId/username) en una cookie firmada.
// TODO: mover "secret" a una variable de entorno antes de producción.
app.use(session({
  secret: 'panasrpg_dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 2, // 2 horas
  },
}));

// -------------------- PROTECCIÓN DE VISTAS --------------------
// Cualquier ruta acá listada solo se sirve si hay una sesión válida
// (es decir, si el usuario ya inició sesión con usuario+contraseña
// correctos en /login). Si no hay sesión, se lo redirige al login.
const RUTAS_PROTEGIDAS = [
  '/PanasRPG/Vistas/Vistas_generales/Main_game.html',
  '/PanasRPG/Vistas/Vistas_generales/Main_batalla.html',
];

function requireLogin(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect('/PanasRPG/Vistas/Menus/inicio/inicio.html');
}

app.use((req, res, next) => {
  if (RUTAS_PROTEGIDAS.includes(req.path)) {
    return requireLogin(req, res, next);
  }
  return next();
});

// Servir todos los archivos estáticos de la carpeta (HTML, CSS, JS, imágenes)
// Se registra DESPUÉS del chequeo de rutas protegidas de arriba, para que
// ese chequeo pueda cortar el acceso antes de que express.static entregue
// el archivo.
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

// -------------------- LOGIN --------------------

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ ok: false, error: 'Falta username o password' });
    }

    const db = require('./PanasRPG/Metodos/db').getDB();
    const usuarios = db.collection('usuarios');

    const usuario = await usuarios.findOne({ username });

    // Se valida en un solo paso (usuario inexistente o contraseña
    // incorrecta) para no revelar cuál de los dos datos falló.
    if (!usuario || usuario.password !== password) {
      return res
        .status(401)
        .json({ ok: false, error: 'Usuario o contraseña incorrectos' });
    }

    // Credenciales correctas: se guarda la sesión. Recién a partir de
    // acá el usuario puede acceder a Main_game.html y Main_batalla.html.
    req.session.userId = usuario._id;
    req.session.username = usuario.username;

    return res.status(200).json({
      ok: true,
      message: 'Sesión iniciada correctamente',
    });
  } catch (err) {
    console.error('Error en /login:', err);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error en /logout:', err);
      return res.status(500).json({ ok: false, error: 'No se pudo cerrar sesión' });
    }
    res.clearCookie('connect.sid');
    return res.status(200).json({ ok: true });
  });
});

// -------------------- ARRANQUE --------------------

async function start() {
  await connectDB(); // conecta una sola vez y queda disponible vía getDB()

  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

start();