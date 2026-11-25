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

// Создать новый шаблон меню (7, 10 или 14 дней) -> POST /api/menu/templates
router.post("/templates", (req, res) => {
  const { name, days_count = 14, copy_from_id = null } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Укажите название шаблона" });
  }

  db.exec("BEGIN TRANSACTION;");
  try {
    const info = db
      .prepare("INSERT INTO menu_templates (name, days_count) VALUES (?, ?)")
      .run(name.trim(), Number(days_count));
    const newTemplateId = Number(info.lastInsertRowid);

    // Если выбрано копирование из другого шаблона — переносим его блюда
    if (copy_from_id) {
      const sourceItems = db
        .prepare("SELECT * FROM menu_template_items WHERE template_id = ?")
        .all(Number(copy_from_id));

      const insertItem = db.prepare(`
        INSERT INTO menu_template_items 
        (template_id, day_number, diet_id, meal_time_id, recipe_id, variant_id, portion_multiplier, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of sourceItems) {
        if (item.day_number <= Number(days_count)) {
          insertItem.run(
            newTemplateId,
            item.day_number,
            item.diet_id,
            item.meal_time_id,
            item.recipe_id,
            item.variant_id,
            item.portion_multiplier,
            item.sort_order || 0,
          );
        }
      }
    }

    db.exec("COMMIT;");
    res.json({
      id: newTemplateId,
      name: name.trim(),
      days_count: Number(days_count),
    });
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ error: err.message });
  }
});

// Удалить шаблон меню -> DELETE /api/menu/templates/:id
router.delete("/templates/:id", (req, res) => {
  const templateId = Number(req.params.id);
  db.prepare("DELETE FROM menu_templates WHERE id = ?").run(templateId);
  res.json({ deleted: true });
});

// Переименовать шаблон меню -> PATCH /api/menu/templates/:id
router.patch("/templates/:id", (req, res) => {
  const templateId = Number(req.params.id);
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Название не может быть пустым" });
  }

  db.prepare("UPDATE menu_templates SET name = ? WHERE id = ?").run(
    name.trim(),
    templateId,
  );
  res.json({ id: templateId, name: name.trim() });
});

// Удалить шаблон меню -> DELETE /api/menu/templates/:id
router.delete("/templates/:id", (req, res) => {
  const templateId = Number(req.params.id);

  db.exec("BEGIN TRANSACTION;");
  try {
    // Отвязываем шаблон от архивных ежедневных меню, чтобы не сработал запрет внешнего ключа
    db.prepare(
      "UPDATE daily_menus SET template_id = NULL WHERE template_id = ?",
    ).run(templateId);
    // Удаляем сам шаблон (его позиции удалятся автоматически по ON DELETE CASCADE)
    db.prepare("DELETE FROM menu_templates WHERE id = ?").run(templateId);

    db.exec("COMMIT;");
    res.json({ deleted: true });
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ error: err.message });
  }
});

// Копировать рацион дня на другой день цикла и/или другой стол -> POST /api/menu/templates/:id/copy-day
router.post("/templates/:id/copy-day", (req, res) => {
  const templateId = Number(req.params.id);
  const {
    source_day,
    source_diet_id,
    target_days, // массив номеров дней, например: [8] или [2, 3, 4]
    target_diet_id,
    replace_existing = true, // перезаписывать ли блюда в целевом дне
  } = req.body;

  if (!target_days || !target_days.length) {
    return res
      .status(400)
      .json({ error: "Выберите хотя бы один целевой день" });
  }

  db.exec("BEGIN TRANSACTION;");
  try {
    // 1. Берем все блюда исходного дня и стола с сохранением порядка сортировки
    const sourceItems = db
      .prepare(
        `
        SELECT meal_time_id, recipe_id, variant_id, portion_multiplier, sort_order
        FROM menu_template_items
        WHERE template_id = ? AND day_number = ? AND diet_id = ?
        ORDER BY sort_order, id
      `,
      )
      .all(templateId, Number(source_day), Number(source_diet_id));

    if (!sourceItems.length) {
      db.exec("ROLLBACK;");
      return res
        .status(400)
        .json({ error: "В исходном дне нет блюд для копирования" });
    }

    const deleteTarget = db.prepare(`
      DELETE FROM menu_template_items
      WHERE template_id = ? AND day_number = ? AND diet_id = ?
    `);

    const insertItem = db.prepare(`
      INSERT INTO menu_template_items
      (template_id, day_number, diet_id, meal_time_id, recipe_id, variant_id, portion_multiplier, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const destDietId = Number(target_diet_id || source_diet_id);

    for (const day of target_days) {
      const destDay = Number(day);
      // Пропускаем копирование самого в себя
      if (
        destDay === Number(source_day) &&
        destDietId === Number(source_diet_id)
      ) {
        continue;
      }

      if (replace_existing) {
        deleteTarget.run(templateId, destDay, destDietId);
      }

      for (const item of sourceItems) {
        insertItem.run(
          templateId,
          destDay,
          destDietId,
          item.meal_time_id,
          item.recipe_id,
          item.variant_id,
          item.portion_multiplier,
          item.sort_order || 0,
        );
      }
    }

    db.exec("COMMIT;");
    res.json({ copied: true, count: sourceItems.length });
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ error: err.message });
  }
});

// 1. Добавить новый прием пищи -> POST /api/menu/meal-times
router.post("/meal-times", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Укажите название приема пищи" });
  }

  // Находим максимальный sort_order, чтобы новый прием добавился в конец списка
  const maxRow = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM meal_times")
    .get();
  const nextOrder = Number(maxRow.max_order) + 10;

  try {
    const info = db
      .prepare("INSERT INTO meal_times (name, sort_order) VALUES (?, ?)")
      .run(name.trim(), nextOrder);

    res.json({
      id: Number(info.lastInsertRowid),
      name: name.trim(),
      sort_order: nextOrder,
    });
  } catch (err) {
    res.status(400).json({ error: "Такой прием пищи уже существует" });
  }
});

// 2. Переименовать прием пищи -> PATCH /api/menu/meal-times/:id
router.patch("/meal-times/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Название не может быть пустым" });
  }

  try {
    db.prepare("UPDATE meal_times SET name = ? WHERE id = ?").run(
      name.trim(),
      id,
    );
    res.json({ id, name: name.trim() });
  } catch (err) {
    res
      .status(400)
      .json({ error: "Прием пищи с таким названием уже существует" });
  }
});

// 3. Изменить порядок приемов пищи -> PUT /api/menu/meal-times/reorder
router.put("/meal-times/reorder", (req, res) => {
  const { orderedIds } = req.body; // массив ID в новом порядке

  const updateStmt = db.prepare(
    "UPDATE meal_times SET sort_order = ? WHERE id = ?",
  );
  db.exec("BEGIN TRANSACTION;");
  try {
    orderedIds.forEach((id, idx) => {
      updateStmt.run((idx + 1) * 10, Number(id));
    });
    db.exec("COMMIT;");
    res.json({ reordered: true });
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ error: err.message });
  }
});

// 4. Удалить прием пищи (с подробным списком, где он используется) -> DELETE /api/menu/meal-times/:id
router.delete("/meal-times/:id", (req, res) => {
  const id = Number(req.params.id);

  // Ищем привязки в шаблонах
  const tplRows = db
    .prepare(
      `
      SELECT mt.name AS tpl_name, mti.day_number, d.code AS diet_code, COUNT(*) AS cnt
      FROM menu_template_items mti
      JOIN menu_templates mt ON mt.id = mti.template_id
      JOIN diets d ON d.id = mti.diet_id
      WHERE mti.meal_time_id = ?
      GROUP BY mt.id, mti.day_number, d.id
    `,
    )
    .all(id);

  // Ищем привязки в ежедневных меню
  const dailyRows = db
    .prepare(
      `
      SELECT dm.menu_date, COUNT(*) AS cnt
      FROM daily_menu_items dmi
      JOIN daily_menus dm ON dm.id = dmi.daily_menu_id
      WHERE dmi.meal_time_id = ?
      GROUP BY dm.menu_date
    `,
    )
    .all(id);

  if (tplRows.length > 0 || dailyRows.length > 0) {
    const details = [];
    if (tplRows.length > 0) {
      const list = tplRows
        .map(
          (r) =>
            `«${r.tpl_name}» (День ${r.day_number}, стол ${r.diet_code}: ${r.cnt} шт.)`,
        )
        .join(", ");
      details.push(`В шаблонах: ${list}`);
    }
    if (dailyRows.length > 0) {
      const dates = dailyRows
        .map((r) => `${r.menu_date} (${r.cnt} шт.)`)
        .join(", ");
      details.push(`В меню на день за даты: ${dates}`);
    }

    return res.status(400).json({
      error: `Прием пищи используется. ${details.join(". ")}.`,
    });
  }

  db.prepare("DELETE FROM meal_times WHERE id = ?").run(id);
  res.json({ deleted: true });
});

// Очистить все блюда выбранного дня и стола в шаблоне -> DELETE /api/menu/templates/:id/days/:day
router.delete("/templates/:id/days/:day", (req, res) => {
  const templateId = Number(req.params.id);
  const dayNumber = Number(req.params.day);
  const { diet_id } = req.query; // необязательно: если передан diet_id, чистим только этот стол

  if (diet_id) {
    db.prepare(
      `
      DELETE FROM menu_template_items
      WHERE template_id = ? AND day_number = ? AND diet_id = ?
    `,
    ).run(templateId, dayNumber, Number(diet_id));
  } else {
    db.prepare(
      `
      DELETE FROM menu_template_items
      WHERE template_id = ? AND day_number = ?
    `,
    ).run(templateId, dayNumber);
  }

  res.json({ cleared: true });
});

export default router;
