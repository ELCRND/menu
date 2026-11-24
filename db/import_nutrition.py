import glob
import json
import sqlite3

DB_NAME = "recipes.db"


def create_nutrition_table(cursor):
    """Создает таблицу пищевой ценности и связывает её с рецептами и вариантами."""
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS nutrition (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipe_id INTEGER NOT NULL,
            variant_id INTEGER,
            dish_name TEXT,
            variant_note TEXT,
            output_weight REAL,
            proteins_total REAL,
            proteins_animal REAL,
            fats_total REAL,
            fats_vegetable REAL,
            saturated_fatty_acids REAL,
            cholesterol REAL,
            mono_disaccharides REAL,
            starch REAL,
            carbs_total REAL,
            dietary_fiber REAL,
            na REAL,
            k REAL,
            ca REAL,
            mg REAL,
            p REAL,
            fe REAL,
            vit_a REAL,
            carotene REAL,
            retinol_equiv REAL,
            tocopherol_equiv REAL,
            vit_b1 REAL,
            vit_b2 REAL,
            vit_pp REAL,
            niacin_equiv REAL,
            vit_c REAL,
            calories REAL,
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
            FOREIGN KEY (variant_id) REFERENCES recipe_variants(id) ON DELETE SET NULL
        );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_nutr_recipe ON nutrition(recipe_id);")


def process_nutrition_file(filepath, cursor):
    with open(filepath, "r", encoding="utf-8") as file:
        try:
            data = json.load(file)
        except json.JSONDecodeError as e:
            print(f"[ОШИБКА] Сломанный JSON в {filepath}: {e}")
            return

    # Пропускаем файлы, которые относятся к основным рецептам, а не к КБЖУ
    if "nutrition_data" not in data:
        return

    print(f"Импорт КБЖУ из файла: {filepath}...")
    added = 0

    for item in data["nutrition_data"]:
        rec_num = item.get("recipe_number")
        var_note = item.get("variant_note")
        out_weight = item.get("output_weight")

        # 1. Ищем рецепт в основной таблице recipes
        cursor.execute("SELECT id FROM recipes WHERE recipe_number = ?", (rec_num,))
        rec_row = cursor.fetchone()
        if not rec_row:
            print(f"  [!] Пропуск: рецепт №{rec_num} еще не загружен в таблицу recipes.")
            continue
        recipe_id = rec_row[0]

        # 2. Ищем точный вариант (колонку I, II или III) по совпадению выхода блюда
        variant_id = None
        if out_weight is not None:
            cursor.execute(
                "SELECT id FROM recipe_variants WHERE recipe_id = ? AND output_weight = ?",
                (recipe_id, out_weight),
            )
            var_row = cursor.fetchone()
            if var_row:
                variant_id = var_row[0]

        # 3. Защита от дублей при повторном запуске скрипта
        cursor.execute(
            """
            SELECT id FROM nutrition
            WHERE recipe_id = ? AND variant_note IS ? AND output_weight IS ?
            """,
            (recipe_id, var_note, out_weight),
        )
        if cursor.fetchone():
            continue

        # 4. Записываем данные в таблицу nutrition
        cursor.execute(
            """
            INSERT INTO nutrition (
                recipe_id, variant_id, dish_name, variant_note, output_weight,
                proteins_total, proteins_animal, fats_total, fats_vegetable,
                saturated_fatty_acids, cholesterol, mono_disaccharides, starch,
                carbs_total, dietary_fiber, na, k, ca, mg, p, fe,
                vit_a, carotene, retinol_equiv, tocopherol_equiv,
                vit_b1, vit_b2, vit_pp, niacin_equiv, vit_c, calories
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                recipe_id,
                variant_id,
                item.get("dish_name"),
                var_note,
                out_weight,
                item.get("proteins_total"),
                item.get("proteins_animal"),
                item.get("fats_total"),
                item.get("fats_vegetable"),
                item.get("saturated_fatty_acids"),
                item.get("cholesterol"),
                item.get("mono_disaccharides"),
                item.get("starch"),
                item.get("carbs_total"),
                item.get("dietary_fiber"),
                item.get("na"),
                item.get("k"),
                item.get("ca"),
                item.get("mg"),
                item.get("p"),
                item.get("fe"),
                item.get("vit_a"),
                item.get("carotene"),
                item.get("retinol_equiv"),
                item.get("tocopherol_equiv"),
                item.get("vit_b1"),
                item.get("vit_b2"),
                item.get("vit_pp"),
                item.get("niacin_equiv"),
                item.get("vit_c"),
                item.get("calories"),
            ),
        )
        added += 1

    print(f"  -> Добавлено записей КБЖУ: {added}")


def main():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    create_nutrition_table(cursor)

    for filepath in sorted(glob.glob("*.json")):
        process_nutrition_file(filepath, cursor)

    conn.commit()
    conn.close()
    print("Готово!")


if __name__ == "__main__":
    main()
