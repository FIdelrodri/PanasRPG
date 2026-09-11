// Metodos/seed.js
// Carga inicial de datos en MongoDB local para PanasRPG.
// Requiere: npm install mongodb
// Correr con: node seed.js
// Requiere que el servicio de MongoDB esté corriendo en localhost:27017

const { MongoClient } = require("mongodb");

const uri = "mongodb://127.0.0.1:27017";
const dbName = "panasrpg";

async function seed() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Conectado a MongoDB local.");
    const db = client.db(dbName);

    // ---------- WORLDS ----------
    const worlds = [
      { _id: "world_1", name: "Bosque Inicial", order: 1, difficulty: 1, enemyCount: 8, bossId: "boss_1" },
      { _id: "world_2", name: "Cavernas Oscuras", order: 2, difficulty: 2, enemyCount: 10, bossId: "boss_2" },
      { _id: "world_3", name: "Ruinas Antiguas", order: 3, difficulty: 3, enemyCount: 10, bossId: "boss_3" },
      { _id: "world_4", name: "Picos Helados", order: 4, difficulty: 4, enemyCount: 12, bossId: "boss_4" },
      { _id: "world_5", name: "Abismo Final", order: 5, difficulty: 5, enemyCount: 12, bossId: "boss_5" },
    ];
    await db.collection("worlds").deleteMany({});
    await db.collection("worlds").insertMany(worlds);
    console.log("worlds OK");

    // ---------- ARMORS ----------
    const armors = [
      { _id: "armor_1", name: "Armadura de Cuero", damageReductionMultiplier: 2.0, tier: 1 },
      { _id: "armor_2", name: "Armadura de Bronce", damageReductionMultiplier: 1.8, tier: 2 },
      { _id: "armor_3", name: "Armadura de Hierro", damageReductionMultiplier: 1.6, tier: 3 },
      { _id: "armor_4", name: "Armadura de Acero", damageReductionMultiplier: 1.4, tier: 4 },
      { _id: "armor_5", name: "Armadura Legendaria", damageReductionMultiplier: 1.2, tier: 5 },
    ];
    await db.collection("armors").deleteMany({});
    await db.collection("armors").insertMany(armors);
    console.log("armors OK");

    // ---------- BOSSES ----------
    const bosses = [
      { _id: "boss_1", name: "Boss Mundo 1", order: 1, worldId: "world_1", hp: 500, attack: 20, defense: 10, requiredWeaponId: "weapon_boss1_key", unlockRequires: null },
      { _id: "boss_2", name: "Boss Mundo 2", order: 2, worldId: "world_2", hp: 900, attack: 30, defense: 15, requiredWeaponId: "weapon_boss2_key", unlockRequires: "boss_1" },
      { _id: "boss_3", name: "Boss Mundo 3", order: 3, worldId: "world_3", hp: 1400, attack: 40, defense: 20, requiredWeaponId: "weapon_boss3_key", unlockRequires: "boss_2" },
      { _id: "boss_4", name: "Boss Mundo 4", order: 4, worldId: "world_4", hp: 2000, attack: 55, defense: 28, requiredWeaponId: "weapon_boss4_key", unlockRequires: "boss_3" },
      { _id: "boss_5", name: "Boss Final", order: 5, worldId: "world_5", hp: 3000, attack: 70, defense: 35, requiredWeaponId: "weapon_boss5_key", unlockRequires: "boss_4" },
    ];
    await db.collection("bosses").deleteMany({});
    await db.collection("bosses").insertMany(bosses);
    console.log("bosses OK");

    // ---------- BOSS KEY WEAPONS (placeholder, editar daño real) ----------
    const bossWeapons = [
      { _id: "weapon_boss1_key", name: "Arma del Boss 1", type: "boss_key", baseDamage: 50, craftable: true, recipeId: "recipe_boss1" },
      { _id: "weapon_boss2_key", name: "Arma del Boss 2", type: "boss_key", baseDamage: 80, craftable: true, recipeId: "recipe_boss2" },
      { _id: "weapon_boss3_key", name: "Arma del Boss 3", type: "boss_key", baseDamage: 120, craftable: true, recipeId: "recipe_boss3" },
      { _id: "weapon_boss4_key", name: "Arma del Boss 4", type: "boss_key", baseDamage: 170, craftable: true, recipeId: "recipe_boss4" },
      { _id: "weapon_boss5_key", name: "Arma del Boss 5", type: "boss_key", baseDamage: 230, craftable: true, recipeId: "recipe_boss5" },
    ];
    await db.collection("weapons").deleteMany({});
    await db.collection("weapons").insertMany(bossWeapons);
    console.log("weapons OK");

    // ---------- RECIPES (materiales placeholder — falta definir items reales) ----------
    const recipes = [
      {
        _id: "recipe_boss1",
        resultItemId: "weapon_boss1_key",
        bossOrder: 1,
        materials: [
          { itemId: "item_world1_material", worldId: "world_1", quantity: 10 },
          { itemId: "item_world2_material", worldId: "world_2", quantity: 5 },
          { itemId: "item_world3_material", worldId: "world_3", quantity: 5 },
          { itemId: "item_world4_material", worldId: "world_4", quantity: 3 },
          { itemId: "item_world5_material", worldId: "world_5", quantity: 3 },
        ],
      },
      {
        _id: "recipe_boss2",
        resultItemId: "weapon_boss2_key",
        bossOrder: 2,
        materials: [
          { itemId: "item_world1_material", worldId: "world_1", quantity: 20 },
          { itemId: "item_world2_material", worldId: "world_2", quantity: 10 },
          { itemId: "item_world3_material", worldId: "world_3", quantity: 10 },
          { itemId: "item_world4_material", worldId: "world_4", quantity: 6 },
          { itemId: "item_world5_material", worldId: "world_5", quantity: 6 },
        ],
      },
      // boss_3 a boss_5: agregar cuando definas las cantidades exactas
    ];
    await db.collection("recipes").deleteMany({});
    await db.collection("recipes").insertMany(recipes);
    console.log("recipes OK (boss_1 y boss_2 cargados, faltan 3-5)");

    // ---------- SHOP (ejemplo de un tier) ----------
    const shopTiers = [
      {
        _id: "shop_tier_50",
        price: 50,
        items: [
          { itemId: "item_world1_material", dropChance: 0.3 },
          { itemId: "item_world2_material", dropChance: 0.15 },
        ],
      },
    ];
    await db.collection("shop").deleteMany({});
    await db.collection("shop").insertMany(shopTiers);
    console.log("shop OK");

    console.log("✅ Seed completo.");
  } catch (err) {
    console.error("❌ Error en el seed:", err);
  } finally {
    await client.close();
  }
}

seed();