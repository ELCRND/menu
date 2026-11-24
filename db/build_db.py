import glob
import json
import sqlite3

DB_NAME = "recipes.db"


def create_tables(cursor):
    """Создает структуру таблиц в базе данных."""
    cursor.execute("PRAGMA foreign_keys = ON;")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipe_number INTEGER UNIQUE,
            section TEXT,
            title TEXT NOT NULL,
            technology TEXT,
            quality_requirements TEXT
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recipe_variants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipe_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            output_weight REAL,
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            variant_id INTEGER NOT NULL,
            alternative_group INTEGER NOT NULL,
            name TEXT NOT NULL,
            gross_weight TEXT,
            net_weight REAL,
            is_subtotal INTEGER DEFAULT 0,
            FOREIGN KEY (variant_id) REFERENCES recipe_variants(id) ON DELETE CASCADE
        );
    """)


def process_json_file(filepath, cursor):
    """Читает один JSON-файл и записывает его в базу."""
    print(f"Обработка файла: {filepath}...")

    with open(filepath, "r", encoding="utf-8") as file:
        try:
            data = json.load(file)
        except json.JSONDecodeError as e:
            print(f"  [ОШИБКА] Файл {filepath} содержит сломанный JSON: {e}")
            return

    for recipe in data.get("recipes", []):
        num = recipe.get("recipe_number")
        title = recipe.get("title")

        cursor.execute("SELECT id FROM recipes WHERE recipe_number = ?", (num,))
        if cursor.fetchone():
            print(f"  -> Пропуск: Рецепт №{num} ({title}) уже записан.")
            continue

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

        for variant in recipe.get("variants", []):
            cursor.execute(
                """
                INSERT INTO recipe_variants (recipe_id, category, output_weight)
                VALUES (?, ?, ?)
                """,
                (recipe_id, variant.get("category"), variant.get("output_weight")),
            )

            variant_id = cursor.lastrowid

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

        print(f"  -> Успешно добавлен: Рецепт №{num} — {title}")


def main():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    create_tables(cursor)

    json_files = sorted(glob.glob("*.json"))

    if not json_files:
        print("В папке не найдено ни одного .json файла!")
        return

    for filepath in json_files:
        process_json_file(filepath, cursor)

    conn.commit()
    conn.close()
    print(f"\nГотово! База данных сохранена в файл: {DB_NAME}")


if __name__ == "__main__":
    main()
