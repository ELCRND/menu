import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("recipes.db");

// Включаем WAL-режим для защиты от повреждения файла и внешние ключи для каскадного удаления
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// Таблица для избранного
db.exec("CREATE TABLE IF NOT EXISTS favorites (recipe_id INTEGER PRIMARY KEY)");

// Добавляем колонку sort_order в menu_template_items, если её еще нет
const cols = db.prepare("PRAGMA table_info(menu_template_items)").all();
if (!cols.some((c) => c.name === "sort_order")) {
  db.exec(
    "ALTER TABLE menu_template_items ADD COLUMN sort_order INTEGER DEFAULT 0;",
  );
  db.exec("UPDATE menu_template_items SET sort_order = id;");
}

// Очищаем «зависшие» позиции дневного меню и шаблонов, у которых удалена родительская запись
db.exec(`
  DELETE FROM daily_menu_items 
  WHERE daily_menu_id NOT IN (SELECT id FROM daily_menus);

  DELETE FROM daily_headcount 
  WHERE daily_menu_id NOT IN (SELECT id FROM daily_menus);

  DELETE FROM menu_template_items 
  WHERE template_id NOT IN (SELECT id FROM menu_templates);
`);

export default db;
