import express from "express";
import cors from "cors";
import { DatabaseSync } from "node:sqlite";

const app = express();
const db = new DatabaseSync("recipes.db");
const PORT = 8000;

app.use(cors());
app.use(express.json());

// Создаем таблицу для избранного, если её еще нет
db.exec("CREATE TABLE IF NOT EXISTS favorites (recipe_id INTEGER PRIMARY KEY)");

app.get("/api/recipes", (req, res) => {
  const hasNutr = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='nutrition'",
    )
    .get();

  const recipes = db
    .prepare(
      `
      SELECT r.*, CASE WHEN f.recipe_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
      FROM recipes r
      LEFT JOIN favorites f ON f.recipe_id = r.id
      ORDER BY r.recipe_number
    `,
    )
    .all();

  const getVariants = db.prepare(
    "SELECT * FROM recipe_variants WHERE recipe_id = ? ORDER BY id",
  );
  const getIngredients = db.prepare(
    "SELECT * FROM ingredients WHERE variant_id = ? ORDER BY id",
  );
  const getNutrition = hasNutr
    ? db.prepare(`
        SELECT n.*, v.category AS var_cat
        FROM nutrition n
        LEFT JOIN recipe_variants v ON n.variant_id = v.id
        WHERE n.recipe_id = ?
      `)
    : null;

  const result = recipes.map((r) => {
    const variants = getVariants.all(r.id).map((v) => ({
      ...v,
      ingredients: getIngredients.all(v.id),
    }));

    return {
      ...r,
      is_favorite: Boolean(r.is_favorite),
      variants,
      nutrition: getNutrition ? getNutrition.all(r.id) : [],
    };
  });

  res.json(result);
});

app.post("/api/favorites/:id", (req, res) => {
  const recipeId = Number(req.params.id);
  const exists = db
    .prepare("SELECT 1 FROM favorites WHERE recipe_id = ?")
    .get(recipeId);

  if (exists) {
    db.prepare("DELETE FROM favorites WHERE recipe_id = ?").run(recipeId);
    return res.json({ is_favorite: false });
  }

  db.prepare("INSERT INTO favorites (recipe_id) VALUES (?)").run(recipeId);
  res.json({ is_favorite: true });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://127.0.0.1:${PORT}`);
});
