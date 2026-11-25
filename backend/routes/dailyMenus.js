import { Router } from "express";
import db from "../db.js";

const router = Router();

// Сформировать меню на дату -> POST /api/daily-menus/generate
router.post("/generate", (req, res) => {
  const { menu_date, template_id, day_number, headcounts } = req.body;

  db.exec("BEGIN TRANSACTION;");
  try {
    db.prepare("DELETE FROM daily_menus WHERE menu_date = ?").run(menu_date);

    const menuInfo = db
      .prepare(
        "INSERT INTO daily_menus (menu_date, template_id, day_number) VALUES (?, ?, ?)",
      )
      .run(menu_date, template_id, day_number);
    const dailyMenuId = Number(menuInfo.lastInsertRowid);

    const insertHeadcount = db.prepare(`
      INSERT INTO daily_headcount (daily_menu_id, diet_id, people_count, is_pureed)
      VALUES (?, ?, ?, ?)
    `);
    for (const hc of headcounts) {
      if (hc.people_count > 0) {
        insertHeadcount.run(
          dailyMenuId,
          hc.diet_id,
          hc.people_count,
          hc.is_pureed ? 1 : 0,
        );
      }
    }

    const activeDietIds = headcounts
      .filter((h) => h.people_count > 0)
      .map((h) => h.diet_id);
    if (activeDietIds.length > 0) {
      const placeholders = activeDietIds.map(() => "?").join(",");
      const templateItems = db
        .prepare(
          `
          SELECT * FROM menu_template_items 
          WHERE template_id = ? AND day_number = ? AND diet_id IN (${placeholders})
          ORDER BY sort_order, id
        `,
        )
        .all(template_id, day_number, ...activeDietIds);

      const insertDailyItem = db.prepare(`
        INSERT INTO daily_menu_items 
        (daily_menu_id, diet_id, meal_time_id, recipe_id, variant_id, portion_multiplier)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of templateItems) {
        insertDailyItem.run(
          dailyMenuId,
          item.diet_id,
          item.meal_time_id,
          item.recipe_id,
          item.variant_id,
          item.portion_multiplier,
        );
      }
    }

    db.exec("COMMIT;");
    res.json({ daily_menu_id: dailyMenuId, menu_date });
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ error: err.message });
  }
});

// Расчет сводной продуктовой ведомости -> GET /api/daily-menus/:date/products-summary
router.get("/:date/products-summary", (req, res) => {
  const { date } = req.params;
  const menu = db
    .prepare("SELECT * FROM daily_menus WHERE menu_date = ?")
    .get(date);
  if (!menu)
    return res.status(404).json({ error: "Меню на эту дату не найдено" });

  const headcounts = db
    .prepare(
      "SELECT diet_id, SUM(people_count) as total_people FROM daily_headcount WHERE daily_menu_id = ? GROUP BY diet_id",
    )
    .all(menu.id);
  const peopleByDiet = Object.fromEntries(
    headcounts.map((h) => [h.diet_id, h.total_people]),
  );

  const items = db
    .prepare("SELECT * FROM daily_menu_items WHERE daily_menu_id = ?")
    .all(menu.id);
  const getIngredients = db.prepare(
    "SELECT * FROM ingredients WHERE variant_id = ? AND is_subtotal = 0 ORDER BY id",
  );

  const summary = {};

  for (const item of items) {
    const people = peopleByDiet[item.diet_id] || 0;
    if (people === 0) continue;

    const allIngs = getIngredients.all(item.variant_id);
    const selectedAlts = item.selected_alternatives
      ? JSON.parse(item.selected_alternatives)
      : {};

    const groups = {};
    for (const ing of allIngs) {
      if (!groups[ing.alternative_group]) groups[ing.alternative_group] = [];
      groups[ing.alternative_group].push(ing);
    }

    for (const [groupId, groupIngs] of Object.entries(groups)) {
      const chosenId = selectedAlts[groupId];
      const activeIng =
        groupIngs.find((i) => Number(i.id) === chosenId) || groupIngs[0];

      const cleanName = activeIng.name.replace(/^>\s*/, "").trim();
      const net =
        parseFloat(String(activeIng.net_weight ?? 0).replace(",", ".")) || 0;
      const parsedGross = parseGrossField(
        activeIng.gross_weight,
        net,
        cleanName,
      );
      const multiplier = people * (item.portion_multiplier || 1.0);

      if (!summary[cleanName]) {
        summary[cleanName] = {
          name: cleanName,
          gross_grams: 0,
          pieces_min: 0,
          pieces_max: 0,
          net_grams: 0,
        };
      }

      summary[cleanName].gross_grams += parsedGross.grams * multiplier;
      summary[cleanName].pieces_min += parsedGross.piecesMin * multiplier;
      summary[cleanName].pieces_max += parsedGross.piecesMax * multiplier;
      summary[cleanName].net_grams += net * multiplier;
    }

    const result = Object.values(summary)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => {
        const minP = Number(p.pieces_min.toFixed(2));
        const maxP = Number(p.pieces_max.toFixed(2));
        let pieces_label = "";

        if (maxP > 0) {
          pieces_label = minP === maxP ? `${minP} шт.` : `${minP}–${maxP} шт.`;
        }

        return {
          ...p,
          pieces_label,
          gross_kg: Number((p.gross_grams / 1000).toFixed(3)),
          net_kg: Number((p.net_grams / 1000).toFixed(3)),
        };
      });
  }

  const result = Object.values(summary)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({
      ...p,
      gross_kg: Number((p.gross_grams / 1000).toFixed(3)),
      net_kg: Number((p.net_grams / 1000).toFixed(3)),
    }));

  res.json(result);
});

// 1. Загрузить уже созданное меню на конкретную дату -> GET /api/daily-menus/:date
router.get("/:date", (req, res) => {
  const { date } = req.params;
  const menu = db
    .prepare("SELECT * FROM daily_menus WHERE menu_date = ?")
    .get(date);
  if (!menu) return res.json(null);

  const headcounts = db
    .prepare("SELECT * FROM daily_headcount WHERE daily_menu_id = ?")
    .all(menu.id);

  const items = db
    .prepare(
      `
      SELECT 
        dmi.*,
        r.title AS recipe_title,
        r.recipe_number,
        rv.category AS variant_category,
        rv.output_weight,
        d.code AS diet_code,
        mt.name AS meal_name
      FROM daily_menu_items dmi
      JOIN recipes r ON r.id = dmi.recipe_id
      JOIN recipe_variants rv ON rv.id = dmi.variant_id
      JOIN diets d ON d.id = dmi.diet_id
      JOIN meal_times mt ON mt.id = dmi.meal_time_id
      WHERE dmi.daily_menu_id = ?
      ORDER BY mt.sort_order, d.id, dmi.id
    `,
    )
    .all(menu.id);

  // Подтягиваем доступные варианты взаимозаменяемых продуктов для каждого блюда
  const getIngredients = db.prepare(
    "SELECT id, alternative_group, name FROM ingredients WHERE variant_id = ? AND is_subtotal = 0 ORDER BY id",
  );

  const enrichedItems = items.map((item) => {
    const ings = getIngredients.all(item.variant_id);
    const groups = {};
    for (const ing of ings) {
      if (!groups[ing.alternative_group]) groups[ing.alternative_group] = [];
      groups[ing.alternative_group].push(ing);
    }
    // Оставляем только те группы, где больше 1 варианта на выбор
    const alternatives = Object.entries(groups)
      .filter(([, list]) => list.length > 1)
      .map(([groupId, list]) => ({ groupId, options: list }));

    return {
      ...item,
      selected_alternatives: item.selected_alternatives
        ? JSON.parse(item.selected_alternatives)
        : {},
      alternatives,
    };
  });

  res.json({ menu, headcounts, items: enrichedItems });
});

// 2. Сохранить замену альтернативного продукта для блюда -> PATCH /api/daily-menus/items/:itemId/alternatives
router.patch("/items/:itemId/alternatives", (req, res) => {
  const itemId = Number(req.params.itemId);
  const { selected_alternatives } = req.body; // объект вида { "1": 45 }

  db.prepare(
    "UPDATE daily_menu_items SET selected_alternatives = ? WHERE id = ?",
  ).run(JSON.stringify(selected_alternatives), itemId);

  res.json({ updated: true });
});

// 3. Раздаточная ведомость (порционник для кухни и отделений) -> GET /api/daily-menus/:date/distribution
router.get("/:date/distribution", (req, res) => {
  const { date } = req.params;
  const menu = db
    .prepare("SELECT * FROM daily_menus WHERE menu_date = ?")
    .get(date);
  if (!menu) return res.status(404).json({ error: "Меню не найдено" });

  const rows = db
    .prepare(
      `
      SELECT 
        mt.id AS meal_time_id,
        mt.name AS meal_name,
        r.recipe_number,
        r.title AS recipe_title,
        d.code AS diet_code,
        rv.output_weight,
        dmi.portion_multiplier,
        SUM(CASE WHEN dh.is_pureed = 0 THEN dh.people_count ELSE 0 END) AS regular_count,
        SUM(CASE WHEN dh.is_pureed = 1 THEN dh.people_count ELSE 0 END) AS pureed_count
      FROM daily_menu_items dmi
      JOIN meal_times mt ON mt.id = dmi.meal_time_id
      JOIN recipes r ON r.id = dmi.recipe_id
      JOIN diets d ON d.id = dmi.diet_id
      JOIN recipe_variants rv ON rv.id = dmi.variant_id
      JOIN daily_headcount dh ON dh.daily_menu_id = dmi.daily_menu_id AND dh.diet_id = dmi.diet_id
      WHERE dmi.daily_menu_id = ?
      GROUP BY mt.id, r.id, d.id, dmi.id
      ORDER BY mt.sort_order, d.id, dmi.id
    `,
    )
    .all(menu.id);

  res.json(rows);
});

router.put("/:date/headcount", (req, res) => {
  const { date } = req.params;
  const { headcounts } = req.body; // [{ diet_id, people_count, is_pureed }, ...]

  const menu = db
    .prepare("SELECT id FROM daily_menus WHERE menu_date = ?")
    .get(date);
  if (!menu)
    return res
      .status(404)
      .json({ error: "Сначала сформируйте меню на эту дату" });

  db.exec("BEGIN TRANSACTION;");
  try {
    db.prepare("DELETE FROM daily_headcount WHERE daily_menu_id = ?").run(
      menu.id,
    );

    const insert = db.prepare(`
      INSERT INTO daily_headcount (daily_menu_id, diet_id, people_count, is_pureed)
      VALUES (?, ?, ?, ?)
    `);

    for (const hc of headcounts) {
      if (hc.people_count > 0) {
        insert.run(menu.id, hc.diet_id, hc.people_count, hc.is_pureed ? 1 : 0);
      }
    }

    db.exec("COMMIT;");
    res.json({ updated: true });
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ error: err.message });
  }
});

// Вспомогательная функция для разбора одного числа или дроби ("1/4", "1 1/2", "0.5")
function parseSingleNumber(str) {
  const cleaned = str.replace(/[^\d./\s]/g, "").trim();
  if (!cleaned) return 0;

  let value = 0;
  if (cleaned.includes("/")) {
    const parts = cleaned.split(/\s+/);
    for (const part of parts) {
      if (part.includes("/")) {
        const [num, den] = part.split("/").map(Number);
        if (den) value += num / den;
      } else {
        value += parseFloat(part) || 0;
      }
    }
  } else {
    value = parseFloat(cleaned) || 0;
  }
  return value;
}

// Разбирает вес из ТТК: дроби ("1/4"), диапазоны ("2–4 шт."), запятые, прочерки
function parseGrossField(rawValue, netWeight, name = "") {
  if (rawValue === null || rawValue === undefined) {
    return { isPieces: false, piecesMin: 0, piecesMax: 0, grams: netWeight };
  }

  const str = String(rawValue).toLowerCase().replace(",", ".").trim();

  if (!str || str === "-" || str === "—") {
    return { isPieces: false, piecesMin: 0, piecesMax: 0, grams: netWeight };
  }

  const isPieces = str.includes("шт");
  // Убираем единицы измерения, но ОСТАВЛЯЕМ дефисы и тире (-, –, —) для определения диапазона
  const withoutUnits = str.replace(/шт\.?|г\.?/g, "").trim();

  let minVal = 0;
  let maxVal = 0;

  // Проверяем, есть ли диапазон (например, "2-4" или "2–4")
  const rangeMatch = withoutUnits.match(/^([\d./\s]+)[-–—]([\d./\s]+)$/);
  if (rangeMatch) {
    minVal = parseSingleNumber(rangeMatch[1]);
    maxVal = parseSingleNumber(rangeMatch[2]);
  } else {
    minVal = parseSingleNumber(withoutUnits);
    maxVal = minVal;
  }

  if (isPieces) {
    const isEgg = String(name).toLowerCase().includes("яйц");
    // Коэффициент 1.136 (12% отхода на скорлупу) применяем ТОЛЬКО для яиц
    const estimatedGrams =
      netWeight > 0 ? (isEgg ? netWeight * 1.136 : netWeight) : 0;
    return {
      isPieces: true,
      piecesMin: minVal,
      piecesMax: maxVal,
      grams: estimatedGrams,
    };
  }

  // Если диапазон указан в граммах (например, "100-120"), берем среднее значение
  const avgGrams = (minVal + maxVal) / 2;
  return { isPieces: false, piecesMin: 0, piecesMax: 0, grams: avgGrams };
}

export default router;
