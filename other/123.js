// Единая функция расчета продуктов за день (и для JSON-таблицы, и для шахматки 0504202)
function calculateDailyProducts(menuId) {
  const headcounts = db
    .prepare(
      "SELECT diet_id, SUM(people_count) as total_people FROM daily_headcount WHERE daily_menu_id = ? GROUP BY diet_id",
    )
    .all(menuId);
  const peopleByDiet = Object.fromEntries(
    headcounts.map((h) => [h.diet_id, h.total_people]),
  );

  const items = db
    .prepare("SELECT * FROM daily_menu_items WHERE daily_menu_id = ?")
    .all(menuId);
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
          cells: {}, // разбивка по ключу `${meal_time_id}_${diet_id}` для формы 0504202
        };
      }

      const grossAdd = parsedGross.grams * multiplier;
      const pMinAdd = parsedGross.piecesMin * multiplier;
      const pMaxAdd = parsedGross.piecesMax * multiplier;
      const netAdd = net * multiplier;

      summary[cleanName].gross_grams += grossAdd;
      summary[cleanName].pieces_min += pMinAdd;
      summary[cleanName].pieces_max += pMaxAdd;
      summary[cleanName].net_grams += netAdd;

      const cellKey = `${item.meal_time_id}_${item.diet_id}`;
      if (!summary[cleanName].cells[cellKey]) {
        summary[cleanName].cells[cellKey] = {
          gross_grams: 0,
          pieces_min: 0,
          pieces_max: 0,
        };
      }
      summary[cleanName].cells[cellKey].gross_grams += grossAdd;
      summary[cleanName].cells[cellKey].pieces_min += pMinAdd;
      summary[cleanName].cells[cellKey].pieces_max += pMaxAdd;
    }
  }

  return Object.values(summary)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .map((p) => {
      const isPieces = p.pieces_max > 0;
      const formattedCells = {};

      for (const [key, cell] of Object.entries(p.cells)) {
        formattedCells[key] = {
          gross_kg: Number((cell.gross_grams / 1000).toFixed(3)),
          pieces_label: formatPiecesLabel(cell.pieces_min, cell.pieces_max),
        };
      }

      return {
        name: p.name,
        unit: isPieces ? "шт." : "кг",
        gross_grams: p.gross_grams,
        pieces_min: p.pieces_min,
        pieces_max: p.pieces_max,
        pieces_label: formatPiecesLabel(p.pieces_min, p.pieces_max),
        net_grams: p.net_grams,
        gross_kg: Number((p.gross_grams / 1000).toFixed(3)),
        net_kg: Number((p.net_grams / 1000).toFixed(3)),
        cells: formattedCells,
      };
    });
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
