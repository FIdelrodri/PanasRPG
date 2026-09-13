/**
 * PanasRPG/Metodos/db.js
 *
 * Módulo reusable de conexión a MongoDB. Mantiene una única conexión
 * (singleton) para que index.js y cualquier otro archivo en Metodos/
 * puedan pedir la misma instancia de la base de datos sin reconectar
 * cada vez.
 */

const { MongoClient } = require("mongodb");

// TODO: mismo URI/DB_NAME que uses en seed.js
const MONGO_URI = "mongodb://localhost:27017";
const DB_NAME = "panasrpg";

let client = null;
let db = null;

/**
 * Conecta (una sola vez) y devuelve la instancia de la base de datos.
 * Si ya hay una conexión abierta, la reutiliza.
 */
async function connectDB() {
  if (db) return db;

  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`[db.js] Conectado a MongoDB (${DB_NAME})`);

  return db;
}

/**
 * Devuelve la instancia ya conectada. Lanza error si todavía no se
 * llamó a connectDB() (por ejemplo, al arrancar index.js).
 */
function getDB() {
  if (!db) {
    throw new Error(
      "[db.js] La base de datos no está conectada todavía. Llamá a connectDB() primero."
    );
  }
  return db;
}

async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { connectDB, getDB, closeDB };