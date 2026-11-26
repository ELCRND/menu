import ExcelJS from "exceljs";

const THIN = { style: "thin" };
const MEDIUM = { style: "medium" };

const BORDER_ALL_THIN = { top: THIN, left: THIN, bottom: THIN, right: THIN };

const MONTHS_RU = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

// Строгая разметка колонок приема пищи по бланку ОКУД 0504202 (графы 4..33)
const MEAL_SLOTS = [
  { key: "завтрак", title: "З А В Т Р А К", startCol: 4, endCol: 11 },
  { key: "обед", title: "О Б Е Д", startCol: 12, endCol: 20 },
  { key: "полдник", title: "П О Л Д Н И К", startCol: 21, endCol: 24 },
  { key: "ужин", title: "У Ж И Н", startCol: 25, endCol: 29 },
  {
    key: "персонал",
    title: "для обслуживающего персонала",
    startCol: 30,
    endCol: 33,
  },
];

export async function buildOkud0504202Workbook({
  date,
  diets,
  mealTimes,
  headcounts,
  matrixRows,
  organization = "",
  department = "Пищеблок",
  okpo = "",
}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ОКУД 0504202", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.25,
        bottom: 0.25,
        header: 0.1,
        footer: 0.1,
      },
    },
  });

  sheet.views = [{ showGridLines: true }];

  const [year, monthStr, dayStr] = date.split("-");
  const monthName = MONTHS_RU[Number(monthStr) - 1] || "";
  const formattedDateShort = `${dayStr}.${monthStr}.${year}`;

  // Настройка ширины всех 35 колонок
  sheet.getColumn(1).width = 26; // Наименование продукта
  sheet.getColumn(2).width = 6; // Код
  sheet.getColumn(3).width = 7; // Ед. изм.
  for (let c = 4; c <= 33; c++) {
    sheet.getColumn(c).width = 5.2; // Узкие графы приемов пищи и персонала
  }
  sheet.getColumn(34).width = 8.5; // Расход на довольствующихся
  sheet.getColumn(35).width = 7.5; // Расход на персонал

  // =========================================================================
  // 1. ВЕРХНИЙ БЛОК (ГРИФ УТВЕРЖДАЮ + ЗАГОЛОВОК + ТАБЛИЦА КАТЕГОРИЙ + КОДЫ)
  // =========================================================================

  // Левый верхний угол: УТВЕРЖДАЮ
  sheet.getCell("A1").value = "Утверждаю";
  sheet.getCell("A1").font = { name: "Times New Roman", size: 8, bold: true };

  sheet.mergeCells("A2:D2");
  sheet.getCell("A2").value = "Руководитель ______________________";
  sheet.getCell("A2").font = { name: "Times New Roman", size: 8 };

  sheet.mergeCells("A3:D3");
  sheet.getCell("A3").value =
    "учреждения        (подпись)        (расшифровка подписи)";
  sheet.getCell("A3").font = {
    name: "Times New Roman",
    size: 6.5,
    italic: true,
  };

  sheet.mergeCells("A4:D4");
  sheet.getCell("A4").value = `«___» ______________ ${year} г.`;
  sheet.getCell("A4").font = { name: "Times New Roman", size: 8 };

  // Центр-право: Заголовок документа
  sheet.mergeCells("O3:AB3");
  sheet.getCell("O3").value =
    "Меню-требование на выдачу продуктов питания № _______";
  sheet.getCell("O3").font = { name: "Times New Roman", size: 11, bold: true };
  sheet.getCell("O3").alignment = { horizontal: "center", vertical: "middle" };

  // Правый верхний угол: Таблица КОДЫ (колонки AD..AI -> 30..35)
  sheet.mergeCells("AE4:AG4");
  sheet.getCell("AE4").value = "КОДЫ";
  sheet.getCell("AE4").font = { name: "Times New Roman", size: 8, bold: true };
  sheet.getCell("AE4").alignment = { horizontal: "center", vertical: "middle" };
  applyRangeBorder(sheet, 4, 31, 4, 33, BORDER_ALL_THIN);

  sheet.mergeCells("AB5:AD5");
  sheet.getCell("AB5").value = "Форма по ОКУД";
  sheet.getCell("AB5").font = { name: "Times New Roman", size: 8 };
  sheet.getCell("AB5").alignment = { horizontal: "right", vertical: "middle" };

  sheet.mergeCells("AE5:AG5");
  sheet.getCell("AE5").value = "0504202";
  sheet.getCell("AE5").font = { name: "Times New Roman", size: 8, bold: true };
  sheet.getCell("AE5").alignment = { horizontal: "center", vertical: "middle" };
  applyRangeBorder(sheet, 5, 31, 5, 33, {
    top: MEDIUM,
    left: MEDIUM,
    bottom: THIN,
    right: MEDIUM,
  });

  // Строка даты прописью + код даты справа
  sheet.mergeCells("Q6:Z6");
  sheet.getCell("Q6").value = `на « ${dayStr} »   ${monthName}   ${year} г.`;
  sheet.getCell("Q6").font = { name: "Times New Roman", size: 9 };
  sheet.getCell("Q6").alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("AB6:AD6");
  sheet.getCell("AB6").value = "Дата";
  sheet.getCell("AB6").font = { name: "Times New Roman", size: 8 };
  sheet.getCell("AB6").alignment = { horizontal: "right", vertical: "middle" };

  sheet.mergeCells("AE6:AG6");
  sheet.getCell("AE6").value = formattedDateShort;
  sheet.getCell("AE6").font = { name: "Times New Roman", size: 8 };
  sheet.getCell("AE6").alignment = { horizontal: "center", vertical: "middle" };
  applyRangeBorder(sheet, 6, 31, 6, 33, {
    top: THIN,
    left: MEDIUM,
    bottom: THIN,
    right: MEDIUM,
  });

  // Учреждение + по ОКПО
  sheet.mergeCells("N7:AA7");
  sheet.getCell("N7").value =
    `Учреждение: ${organization || "___________________________________________________"}`;
  sheet.getCell("N7").font = { name: "Times New Roman", size: 8 };

  sheet.mergeCells("AB7:AD7");
  sheet.getCell("AB7").value = "по ОКПО";
  sheet.getCell("AB7").font = { name: "Times New Roman", size: 8 };
  sheet.getCell("AB7").alignment = { horizontal: "right", vertical: "middle" };

  sheet.mergeCells("AE7:AG7");
  sheet.getCell("AE7").value = okpo;
  sheet.getCell("AE7").font = { name: "Times New Roman", size: 8 };
  sheet.getCell("AE7").alignment = { horizontal: "center", vertical: "middle" };
  applyRangeBorder(sheet, 7, 31, 7, 33, {
    top: THIN,
    left: MEDIUM,
    bottom: MEDIUM,
    right: MEDIUM,
  });

  // Структурное подразделение и МОЛ
  sheet.mergeCells("N8:AG8");
  sheet.getCell("N8").value = `Структурное подразделение: ${department}`;
  sheet.getCell("N8").font = { name: "Times New Roman", size: 8 };

  sheet.mergeCells("N9:AG9");
  sheet.getCell("N9").value =
    "Материально ответственное лицо: _____________________________________________";
  sheet.getCell("N9").font = { name: "Times New Roman", size: 8 };

  // =========================================================================
  // 2. ВЕРХНЯЯ ЛЕВАЯ ТАБЛИЦА ДОВОЛЬСТВУЮЩИХСЯ (строки 5..11, колонки A..L)
  // =========================================================================
  sheet.mergeCells("A5:C5");
  sheet.getCell("A5").value = "Коды категорий довольствующихся (группы)";

  sheet.mergeCells("D5:D6");
  sheet.getCell("D5").value = "Плановая стоимость одного дня, руб.";

  sheet.mergeCells("E5:F6");
  sheet.getCell("E5").value =
    "Численность довольствующихся по плановой стоимости одного дня";

  sheet.mergeCells("G5:H6");
  sheet.getCell("G5").value =
    "Плановая стоимость на всех довольствующихся, руб.";

  sheet.mergeCells("I5:J6");
  sheet.getCell("I5").value = "Фактическая стоимость, руб.";

  sheet.mergeCells("K5:L6");
  sheet.getCell("K5").value = "Численность персонала, чел.";

  sheet.getCell("A6").value = "суммарных категорий";
  sheet.mergeCells("B6:C6");
  sheet.getCell("B6").value = "по плановой стоимости одного дня";

  // Нумерация граф 1..7 верхней таблицы (строка 7)
  sheet.getCell("A7").value = 1;
  sheet.mergeCells("B7:C7");
  sheet.getCell("B7").value = 2;
  sheet.getCell("D7").value = 3;
  sheet.mergeCells("E7:F7");
  sheet.getCell("E7").value = 4;
  sheet.mergeCells("G7:H7");
  sheet.getCell("G7").value = 5;
  sheet.mergeCells("I7:J7");
  sheet.getCell("I7").value = 6;
  sheet.mergeCells("K7:L7");
  sheet.getCell("K7").value = 7;

  for (let r = 5; r <= 7; r++) {
    sheet.getRow(r).height = r === 7 ? 13 : 20;
    for (let c = 1; c <= 12; c++) {
      const cell = sheet.getCell(r, c);
      cell.font = { name: "Times New Roman", size: 7, bold: r < 7 };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = BORDER_ALL_THIN;
    }
  }

  // Заполняем строки категорий довольствующихся (строки 8..10, минимум 3 строки как на бланке)
  const dietRowsCount = Math.max(3, diets.length);
  let totalPeopleAll = 0;

  for (let i = 0; i < dietRowsCount; i++) {
    const r = 8 + i;
    sheet.getRow(r).height = 14;
    sheet.mergeCells(`B${r}:C${r}`);
    sheet.mergeCells(`E${r}:F${r}`);
    sheet.mergeCells(`G${r}:H${r}`);
    sheet.mergeCells(`I${r}:J${r}`);
    sheet.mergeCells(`K${r}:L${r}`);

    const diet = diets[i];
    if (diet) {
      const count = headcounts
        .filter((h) => h.diet_id === diet.id)
        .reduce((sum, h) => sum + (h.people_count || 0), 0);
      totalPeopleAll += count;

      sheet.getCell(r, 1).value = `${diet.code} (${diet.name})`;
      sheet.getCell(r, 5).value = count > 0 ? count : "";
    }

    for (let c = 1; c <= 12; c++) {
      const cell = sheet.getCell(r, c);
      cell.font = { name: "Times New Roman", size: 7.5 };
      cell.border = BORDER_ALL_THIN;
      cell.alignment = {
        horizontal: c === 1 ? "left" : "center",
        vertical: "middle",
      };
    }
  }

  // Строка "Всего" верхней таблицы
  const totalTopRow = 8 + dietRowsCount;
  sheet.getRow(totalTopRow).height = 15;
  sheet.mergeCells(`D${totalTopRow}:F${totalTopRow}`);
  sheet.getCell(`D${totalTopRow}`).value = "Всего";
  sheet.getCell(`D${totalTopRow}`).font = {
    name: "Times New Roman",
    size: 8,
    bold: true,
  };
  sheet.getCell(`D${totalTopRow}`).alignment = {
    horizontal: "right",
    vertical: "middle",
  };

  sheet.mergeCells(`G${totalTopRow}:H${totalTopRow}`);
  sheet.mergeCells(`I${totalTopRow}:J${totalTopRow}`);
  sheet.mergeCells(`K${totalTopRow}:L${totalTopRow}`);
  for (let c = 7; c <= 12; c++) {
    sheet.getCell(totalTopRow, c).border = BORDER_ALL_THIN;
  }

  // =========================================================================
  // 3. ОСНОВНАЯ ШАХМАТНАЯ ТАБЛИЦА ПРОДУКТОВ (35 ГРАФ)
  // =========================================================================
  const tableStartRow = totalTopRow + 2;
  const hRow1 = tableStartRow; // Заголовки верхнего уровня
  const hRow2 = tableStartRow + 1; // Подзаголовки (приемы пищи)
  const hRow3 = tableStartRow + 2; // Номера граф 1..35
  const rowPortionsCount = tableStartRow + 3; // "Количество порций"
  const rowPortionsWeight = tableStartRow + 4; // "Выход - вес порций"

  sheet.getRow(hRow1).height = 18;
  sheet.getRow(hRow2).height = 24;
  sheet.getRow(hRow3).height = 14;
  sheet.getRow(rowPortionsCount).height = 15;
  sheet.getRow(rowPortionsWeight).height = 15;

  // Левая группа: Продукты питания (графы 1-2) и Единица измерения (графа 3)
  sheet.mergeCells(`A${hRow1}:B${hRow1}`);
  sheet.getCell(`A${hRow1}`).value = "Продукты питания";
  sheet.getCell(`A${hRow2}`).value = "наименование";
  sheet.getCell(`B${hRow2}`).value = "код";

  sheet.mergeCells(`C${hRow1}:C${hRow2}`);
  sheet.getCell(`C${hRow1}`).value = "Еди-\nница\nизме-\nрения";

  // Центральная группа: Количество продуктов питания, подлежащих закладке (графы 4..33)
  sheet.mergeCells(hRow1, 4, hRow1, 33);
  sheet.getCell(hRow1, 4).value =
    "Количество продуктов питания, подлежащих закладке";

  // Распределяем ваши приемы пищи по слотам (Завтрак: 4..11, Обед: 12..20, Полдник: 21..24, Ужин: 25..29)
  // и маппим активные диеты внутри каждого слота
  const mealDietColumnMap = {}; // `${mealId}_${dietId}` -> номер столбца (4..29)

  for (const slot of MEAL_SLOTS) {
    sheet.mergeCells(hRow2, slot.startCol, hRow2, slot.endCol);
    sheet.getCell(hRow2, slot.startCol).value = slot.title;

    // Ищем подходящий прием пищи из БД по названию
    const matchedMeal = mealTimes.find((m) =>
      m.name.toLowerCase().includes(slot.key),
    );

    if (matchedMeal) {
      diets.forEach((diet, dIdx) => {
        const targetCol = slot.startCol + dIdx;
        if (targetCol <= slot.endCol) {
          mealDietColumnMap[`${matchedMeal.id}_${diet.id}`] = targetCol;
        }
      });
    }
  }

  // Правая группа: Расход продуктов питания (количество) (графы 34..35)
  sheet.mergeCells(hRow1, 34, hRow1, 35);
  sheet.getCell(hRow1, 34).value = "Расход продуктов питания (количество)";
  sheet.getCell(hRow2, 34).value = "на довольствующихся";
  sheet.getCell(hRow2, 35).value = "на персонал";

  // Строка нумерации граф 1..35
  for (let c = 1; c <= 35; c++) {
    sheet.getCell(hRow3, c).value = c;
  }

  // Оформление шапки (строки hRow1..hRow3)
  for (let r = hRow1; r <= hRow3; r++) {
    for (let c = 1; c <= 35; c++) {
      const cell = sheet.getCell(r, c);
      cell.font = {
        name: "Times New Roman",
        size: r === hRow3 ? 7 : 7.5,
        bold: r < hRow3,
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = BORDER_ALL_THIN;
    }
  }

  // Служебные строки: "Количество порций" и "Выход - вес порций"
  sheet.getCell(rowPortionsCount, 1).value = "Количество порций";
  sheet.getCell(rowPortionsWeight, 1).value = "Выход - вес порций";

  // В строку "Количество порций" проставляем численность по каждому активному столу в слотах приемов пищи
  for (const slot of MEAL_SLOTS) {
    const matchedMeal = mealTimes.find((m) =>
      m.name.toLowerCase().includes(slot.key),
    );
    if (!matchedMeal) continue;

    diets.forEach((diet, dIdx) => {
      const targetCol = slot.startCol + dIdx;
      if (targetCol <= slot.endCol) {
        const count = headcounts
          .filter((h) => h.diet_id === diet.id)
          .reduce((s, h) => s + (h.people_count || 0), 0);
        if (count > 0) {
          sheet.getCell(rowPortionsCount, targetCol).value = count;
        }
      }
    });
  }

  for (const r of [rowPortionsCount, rowPortionsWeight]) {
    for (let c = 1; c <= 35; c++) {
      const cell = sheet.getCell(r, c);
      cell.font = { name: "Times New Roman", size: 7.5 };
      cell.border = BORDER_ALL_THIN;
      cell.alignment = {
        horizontal: c === 1 ? "left" : "center",
        vertical: "middle",
      };
    }
  }

  // =========================================================================
  // 4. СТРОКИ ПРОДУКТОВ ПИТАНИЯ
  // =========================================================================
  let currentRow = rowPortionsWeight + 1;

  for (const prod of matrixRows) {
    const row = sheet.getRow(currentRow);
    const isPieces = prod.unit === "шт.";

    row.height =
      prod.name.length > 32 ? Math.ceil(prod.name.length / 30) * 13 : 16;

    row.getCell(1).value = prod.name;
    row.getCell(2).value = ""; // Код продукта
    row.getCell(3).value = prod.unit;

    // Раскладываем данные по ячейкам шахматки (графы 4..29)
    for (const [key, cellData] of Object.entries(prod.cells)) {
      const targetCol = mealDietColumnMap[key];
      if (!targetCol) continue;

      const cell = row.getCell(targetCol);
      if (isPieces) {
        cell.value = cellData.pieces_label || "";
      } else if (cellData.gross_kg > 0) {
        cell.value = Number(cellData.gross_kg.toFixed(3));
        cell.numFmt = "0.000";
      }
    }

    // Графа 34: Расход продуктов питания на довольствующихся (Всего к выдаче)
    const totalCell = row.getCell(34);
    if (isPieces) {
      totalCell.value = prod.pieces_label;
    } else {
      totalCell.value = Number(prod.gross_kg.toFixed(3));
      totalCell.numFmt = "0.000";
    }

    // Оформление всех 35 ячеек строки
    for (let c = 1; c <= 35; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Times New Roman", size: 7.5, bold: c === 34 };
      cell.border = BORDER_ALL_THIN;
      cell.alignment = {
        horizontal: c === 1 ? "left" : c === 2 || c === 3 ? "center" : "right",
        vertical: "middle",
        wrapText: c === 1,
      };
    }

    currentRow++;
  }

  // =========================================================================
  // 5. ПОДПИСИ ВНИЗУ БЛАНКА
  // =========================================================================
  currentRow += 2;
  const sigLines = [
    "Меню составил: Врач-диетолог (диетсестра) ___________________ / ___________________ /",
    "Расчет произвел: Бухгалтер ___________________ / ___________________ /",
    "Продукты выдал: Кладовщик (МОЛ) ___________________ / ___________________ /",
    "Продукты принял: Заведующий производством ___________________ / ___________________ /",
  ];

  for (const text of sigLines) {
    sheet.mergeCells(currentRow, 1, currentRow, 20);
    sheet.getCell(currentRow, 1).value = text;
    sheet.getCell(currentRow, 1).font = { name: "Times New Roman", size: 8 };
    currentRow += 2;
  }

  return workbook;
}

function applyRangeBorder(sheet, r1, c1, r2, c2, border) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      sheet.getCell(r, c).border = border;
    }
  }
}
