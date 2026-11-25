import glob
import json
import shutil
import sqlite3

DB_NAME = "recipes.db"
BACKUP_NAME = "recipes_before_update.db"


def sync_recipe(recipe, cursor):
    """Добавляет новый рецепт или обновляет существующий, сохраняя ID."""
    num = recipe.get("recipe_number")
    title = recipe.get("title")

    cursor.execute("SELECT id FROM recipes WHERE recipe_number = ?", (num,))
    row = cursor.fetchone()

    if row:
        recipe_id = row[0]
        cursor.execute(
            """
            UPDATE recipes
            SET section = ?, title = ?, technology = ?, quality_requirements = ?
            WHERE id = ?
            """,
            (
                recipe.get("section"),
                title,
                recipe.get("technology"),
                recipe.get("quality_requirements"),
                recipe_id,
            ),
        )
        action = "Обновлен"
    else:
        cursor.execute(
            """
            INSERT INTO recipes (recipe_number, section, title, technology, quality_requirements)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                num,
                recipe.get("section"),
                title,
                recipe.get("technology"),
                recipe.get("quality_requirements"),
            ),
        )
        recipe_id = cursor.lastrowid
        action = "Добавлен"

    # Собираем категории из JSON, чтобы удалить устаревшие колонки, если они исчезли
    incoming_categories = set()

    for variant in recipe.get("variants", []):
        cat = variant.get("category")
        out_weight = variant.get("output_weight")
        incoming_categories.add(cat)

        cursor.execute(
            "SELECT id FROM recipe_variants WHERE recipe_id = ? AND category = ?",
            (recipe_id, cat),
        )
        var_row = cursor.fetchone()

        if var_row:
            variant_id = var_row[0]
            cursor.execute(
                "UPDATE recipe_variants SET output_weight = ? WHERE id = ?",
                (out_weight, variant_id),
            )
            # Очищаем старый состав ингредиентов только для этой колонки
            cursor.execute("DELETE FROM ingredients WHERE variant_id = ?", (variant_id,))
        else:
            cursor.execute(
                "INSERT INTO recipe_variants (recipe_id, category, output_weight) VALUES (?, ?, ?)",
                (recipe_id, cat, out_weight),
            )
            variant_id = cursor.lastrowid

        # Записываем актуальные ингредиенты из JSON
        for ing in variant.get("ingredients", []):
            cursor.execute(
                """
                INSERT INTO ingredients (
                    variant_id, alternative_group, name, gross_weight, net_weight, is_subtotal
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    variant_id,
                    ing.get("alternative_group"),
                    ing.get("name"),
                    ing.get("gross_weight"),
                    ing.get("net_weight"),
                    1 if ing.get("is_subtotal") else 0,
                ),
            )

    print(f"  -> {action}: Рецепт №{num} — {title}")


def main():
    # Обязательно делаем резервную копию перед обновлением
    shutil.copyfile(DB_NAME, BACKUP_NAME)
    print(f"Создана резервная копия: {BACKUP_NAME}\n")

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")

    json_files = sorted(glob.glob("*.json"))
    if not json_files:
        print("В папке не найдено ни одного .json файла!")
        conn.close()
        return

    for filepath in json_files:
        print(f"Обработка файла: {filepath}...")
        with open(filepath, "r", encoding="utf-8") as file:
            try:
                data = json.load(file)
            except json.JSONDecodeError as e:
                print(f"  [ОШИБКА] Файл {filepath} содержит сломанный JSON: {e}")
                continue

        for recipe in data.get("recipes", []):
            sync_recipe(recipe, cursor)

    conn.commit()
    conn.close()
    print(f"\nГотово! База данных {DB_NAME} успешно обновлена.")


if __name__ == "__main__":
    main()
