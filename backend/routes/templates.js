import { Router } from "express";
import db from "../db.js";

const router = Router();

// Получить справочники (столы, приемы пищи, шаблоны) -> GET /api/menu/dictionaries
router.get("/dictionaries", (req, res) => {
  const diets = db.prepare("SELECT * FROM diets ORDER BY id").all();
  const mealTimes = db
    .prepare("SELECT * FROM meal_times ORDER BY sort_order")
    .all();
  const templates = db
    .prepare("SELECT * FROM menu_templates ORDER BY id")
    .all();

  res.json({ diets, mealTimes, templates });
});

// Получить позиции шаблона меню -> GET /api/menu/templates/:id
router.get("/templates/:id", (req, res) => {
  const templateId = Number(req.params.id);
  const { day } = req.query;

  let query = `
    SELECT 
      mti.*,
      r.title AS recipe_title,
      r.recipe_number,
      rv.category AS variant_category,
      rv.output_weight,
      ROUND(n.calories * COALESCE(rv.output_weight / NULLIF(n.output_weight, 0), 1.0), 1) AS calories,
      ROUND(n.proteins_total * COALESCE(rv.output_weight / NULLIF(n.output_weight, 0), 1.0), 2) AS proteins_total,
      ROUND(n.fats_total * COALESCE(rv.output_weight / NULLIF(n.output_weight, 0), 1.0), 2) AS fats_total,
      ROUND(n.carbs_total * COALESCE(rv.output_weight / NULLIF(n.output_weight, 0), 1.0), 2) AS carbs_total
    FROM menu_template_items mti
    JOIN recipes r ON r.id = mti.recipe_id
    JOIN recipe_variants rv ON rv.id = mti.variant_id
    LEFT JOIN (
      SELECT 
        recipe_id, 
        output_weight, 
        calories, 
        proteins_total, 
        fats_total, 
        carbs_total
      FROM nutrition
      GROUP BY recipe_id
    ) n ON n.recipe_id = mti.recipe_id
    WHERE mti.template_id = ?
  `;
  const params = [templateId];

  if (day) {
    query += " AND mti.day_number = ?";
    params.push(Number(day));
  }

  query += " ORDER BY mti.day_number, mti.meal_time_id, mti.sort_order, mti.id";
  const items = db.prepare(query).all(...params);

  res.json(items);
});

// Добавить блюдо в шаблон -> POST /api/menu/templates/:id/items
router.post("/templates/:id/items", (req, res) => {
  const templateId = Number(req.params.id);
  const {
    day_number,
    diet_id,
    meal_time_id,
    recipe_id,
    variant_id,
    portion_multiplier = 1.0,
  } = req.body;

  const info = db
    .prepare(
      `
      INSERT INTO menu_template_items 
      (template_id, day_number, diet_id, meal_time_id, recipe_id, variant_id, portion_multiplier)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      templateId,
      day_number,
      diet_id,
      meal_time_id,
      recipe_id,
      variant_id,
      portion_multiplier,
    );

  res.json({ id: Number(info.lastInsertRowid) });
});

// Удалить блюдо из шаблона -> DELETE /api/menu/templates/items/:itemId
router.delete("/templates/items/:itemId", (req, res) => {
  const itemId = Number(req.params.itemId);
  db.prepare("DELETE FROM menu_template_items WHERE id = ?").run(itemId);
  res.json({ deleted: true });
});

// Обновить целевые нормы КБЖУ для диетического стола -> PUT /api/menu/diets/:id/targets
router.put("/diets/:id/targets", (req, res) => {
  const dietId = Number(req.params.id);
  const { target_calories, target_proteins, target_fats, target_carbs } =
    req.body;

  db.prepare(
    `
    UPDATE diets
    SET target_calories = ?, target_proteins = ?, target_fats = ?, target_carbs = ?
    WHERE id = ?
  `,
  ).run(
    Number(target_calories) || 0,
    Number(target_proteins) || 0,
    Number(target_fats) || 0,
    Number(target_carbs) || 0,
    dietId,
  );

  res.json({ updated: true });
});

// Редактировать колонку ТТК и выход порции у блюда в шаблоне -> PATCH /api/menu/templates/items/:itemId
router.patch("/templates/items/:itemId", (req, res) => {
  const itemId = Number(req.params.itemId);
  const { variant_id, portion_multiplier } = req.body;

  db.prepare(
    `
    UPDATE menu_template_items
    SET variant_id = ?, portion_multiplier = ?
    WHERE id = ?
  `,
  ).run(Number(variant_id), Number(portion_multiplier), itemId);

  res.json({ updated: true });
});

// Изменить порядок блюд в приеме пищи -> PUT /api/menu/templates/items/reorder
router.put("/templates/items/reorder", (req, res) => {
  const { orderedIds } = req.body; // массив ID блюд в новом порядке: [14, 12, 15]

  const updateStmt = db.prepare(
    "UPDATE menu_template_items SET sort_order = ? WHERE id = ?",
  );
  db.exec("BEGIN TRANSACTION;");
  try {
    orderedIds.forEach((id, index) => {
      updateStmt.run((index + 1) * 10, Number(id));
    });
    db.exec("COMMIT;");
    res.json({ reordered: true });
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ error: err.message });
  }
});

export default router;
