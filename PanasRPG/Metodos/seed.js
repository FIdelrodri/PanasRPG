/**
 * PanasRPG/Metodos/seed.js
 *
 * Lee el JSON maestro (PanasRPG/Nosql/sistema_completo.json) y reparte
 * cada sección en su propia colección de MongoDB.
 *
 * Ejecutar desde D:\www con:
 *   node PanasRPG/Metodos/seed.js
 *
 * Ajustá el require de conexión si tu db.js expone otra firma
 * (por ejemplo, si ya devuelve directamente el objeto `db`).
 */

const path = require("path");
const { MongoClient } = require("mongodb");

// TODO: reemplazar por el connection string real / el que usa db.js
const MONGO_URI = "mongodb://localhost:27017";
const DB_NAME = "panasrpg";

// Ruta al JSON maestro. Ajustar si lo ubicás en otro lado.
const masterData = require(path.join(
  __dirname,
  "..",
  "Nosql",
  "sistema_completo.json"
));

// Colecciones que se insertan tal cual como arrays de documentos
const ARRAY_COLLECTIONS = {
  worlds: "worlds",
  materials: "materials",
  weapons: "weapons",
  armors: "armors",
  potions: "potions",
  enemies: "enemies",
  bosses: "bosses",
  craftingRecipes: "recipes",
};

// Claves de configuración estática que se juntan en un solo documento
const CONFIG_KEYS = [
  "rules",
  "progression",
  "player",
  "combat",
  "shop",
  "bossPreparationTargets",
];

async function seed() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log(`Conectado a MongoDB (${DB_NAME}). Sembrando...\n`);

    // 1) Colecciones que son arrays directos
    for (const [jsonKey, collectionName] of Object.entries(ARRAY_COLLECTIONS)) {
      const data = masterData[jsonKey];

      if (!Array.isArray(data)) {
        console.warn(`⚠️  "${jsonKey}" no es un array o no existe. Se omite.`);
        continue;
      }

      const collection = db.collection(collectionName);
      await collection.deleteMany({}); // idempotente: limpia antes de re-sembrar
      const result = await collection.insertMany(data);
      console.log(
        `✔ ${collectionName}: ${result.insertedCount} documentos insertados`
      );
    }

    // 2) gameConfig: un único documento con toda la config estática
    const gameConfig = { _id: "gameConfig" };
    for (const key of CONFIG_KEYS) {
      if (masterData[key] !== undefined) {
        gameConfig[key] = masterData[key];
      }
    }

    // Fórmulas de XP acordadas (no están en el JSON maestro, se agregan acá):
    // - XP por enemigo: progressionRank * 15
    // - XP por boss: progressionRank * 15 * 25
    // - XP para subir de nivel: round(100 * 1.12^(level-1))
    gameConfig.progressionXP = {
      xpPerEnemyFormula: "progressionRank * 15",
      xpPerBossFormula: "progressionRank * 15 * 25",
      xpToNextLevelFormula: "round(100 * 1.12^(level-1))",
      enemyMultiplier: 15,
      bossMultiplier: 15 * 25,
      levelCurveBase: 100,
      levelCurveGrowth: 1.12,
    };

    const configCollection = db.collection("gameConfig");
    await configCollection.deleteOne({ _id: "gameConfig" });
    await configCollection.insertOne(gameConfig);
    console.log(`✔ gameConfig: documento único insertado`);

    console.log("\nSeed completo.");
  } catch (err) {
    console.error("Error durante el seed:", err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

seed();