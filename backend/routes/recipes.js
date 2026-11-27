import { Router } from "express";
import db from "../db.js";

const router = Router();

// Получить все рецепты -> GET /api/recipes
router.get("/", async (req, res) => {
  try {
    const query = `
      SELECT 
        r.*,
        (f.recipe_id IS NOT NULL) AS is_favorite,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', v.id,
                'recipe_id', v.recipe_id,
                'category', v.category,
                'output_weight', v.output_weight::float,
                'ingredients', COALESCE(
                  (
                    SELECT json_agg(
                      json_build_object(
                        'id', i.id,
                        'variant_id', i.variant_id,
                        'order', i.item_order,
                        'name', i.name,
                        'gross_weight', i.gross_weight,
                        'net_weight', i.net_weight::float
                      ) ORDER BY i.item_order
                    )
                    FROM ingredients i
                    WHERE i.variant_id = v.id
                  ),
                  '[]'::json
                )
              ) ORDER BY v.id
            )
            FROM recipe_variants v
            WHERE v.recipe_id = r.id
          ),
          '[]'::json
        ) AS variants,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', n.id,
                'recipe_id', n.recipe_id,
                'variant_id', n.variant_id,
                'var_cat', nv.category,
                'dish_name', n.dish_name,
                'variant_note', n.variant_note,
                'output_weight', n.output_weight::float,
                'proteins_total', n.proteins_total::float,
                'proteins_animal', n.proteins_animal::float,
                'fats_total', n.fats_total::float,
                'fats_vegetable', n.fats_vegetable::float,
                'saturated_fatty_acids', n.saturated_fatty_acids::float,
                'cholesterol', n.cholesterol::float,
                'mono_disaccharides', n.mono_disaccharides::float,
                'starch', n.starch::float,
                'carbs_total', n.carbs_total::float,
                'dietary_fiber', n.dietary_fiber::float,
                'na', n.na::float,
                'k', n.k::float,
                'ca', n.ca::float,
                'mg', n.mg::float,
                'p', n.p::float,
                'fe', n.fe::float,
                'vit_a', n.vit_a::float,
                'carotene', n.carotene::float,
                'retinol_equiv', n.retinol_equiv::float,
                'tocopherol_equiv', n.tocopherol_equiv::float,
                'vit_b1', n.vit_b1::float,
                'vit_b2', n.vit_b2::float,
                'vit_pp', n.vit_pp::float,
                'niacin_equiv', n.niacin_equiv::float,
                'vit_c', n.vit_c::float,
                'calories', n.calories::float
              )
            )
            FROM nutrition n
            LEFT JOIN recipe_variants nv ON n.variant_id = nv.id
            WHERE n.recipe_id = r.id
          ),
          '[]'::json
        ) AS nutrition
      FROM recipes r
      LEFT JOIN favorites f ON f.recipe_id = r.id
      ORDER BY 
        r.base_recipe_number ASC, 
        NULLIF(split_part(r.ttk_code, '.', 2), '')::int ASC NULLS FIRST;
    `;

    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error("Ошибка при получении списка ТТК:", err);
    res.status(500).json({ error: "Ошибка сервера при загрузке рецептов" });
  }
});

// Переключить избранное -> POST /api/recipes/favorites/:id
router.post("/favorites/:id", async (req, res) => {
  const recipeId = Number(req.params.id);

  if (!Number.isInteger(recipeId)) {
    return res.status(400).json({ error: "Некорректный ID рецепта" });
  }

  try {
    const { rowCount } = await db.query(
      "DELETE FROM favorites WHERE recipe_id = $1",
      [recipeId],
    );

    if (rowCount > 0) {
      return res.json({ is_favorite: false });
    }

    await db.query("INSERT INTO favorites (recipe_id) VALUES ($1)", [recipeId]);
    res.json({ is_favorite: true });
  } catch (err) {
    console.error("Ошибка при обновлении избранного:", err);
    res.status(500).json({ error: "Ошибка сервера при работе с избранным" });
  }
});

export default router;
