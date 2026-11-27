import sqlite3

DB_NAME = "recipes.db"


def migrate():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # Обязательно включаем поддержку внешних ключей в SQLite
    cursor.execute("PRAGMA foreign_keys = ON;")

    print("1. Создание новых таблиц...")

    # Справочник диетических столов
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS diets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            default_category TEXT,
            target_calories INTEGER,
            target_proteins REAL,
            target_fats REAL,
            target_carbs REAL
        );
    """)

    # Справочник приемов пищи
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS meal_times (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            sort_order INTEGER NOT NULL
        );
    """)

    # Шаблоны типового (цикличного) меню
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS menu_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            days_count INTEGER NOT NULL DEFAULT 7,
            is_active INTEGER DEFAULT 1
        );
    """)

    # Позиции типового меню
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS menu_template_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER NOT NULL,
            day_number INTEGER NOT NULL,
            diet_id INTEGER NOT NULL,
            meal_time_id INTEGER NOT NULL,
            recipe_id INTEGER NOT NULL,
            variant_id INTEGER NOT NULL,
            portion_multiplier REAL DEFAULT 1.0,
            FOREIGN KEY (template_id) REFERENCES menu_templates(id) ON DELETE CASCADE,
            FOREIGN KEY (diet_id) REFERENCES diets(id),
            FOREIGN KEY (meal_time_id) REFERENCES meal_times(id),
            FOREIGN KEY (recipe_id) REFERENCES recipes(id),
            FOREIGN KEY (variant_id) REFERENCES recipe_variants(id)
        );
    """)

    # Ежедневное меню-раскладка на конкретную дату
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_menus (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            menu_date TEXT NOT NULL UNIQUE,
            template_id INTEGER,
            day_number INTEGER,
            status TEXT DEFAULT 'draft',
            FOREIGN KEY (template_id) REFERENCES menu_templates(id)
        );
    """)

    # Количество питающихся по столам на конкретную дату
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_headcount (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            daily_menu_id INTEGER NOT NULL,
            diet_id INTEGER NOT NULL,
            people_count INTEGER NOT NULL DEFAULT 0,
            is_pureed INTEGER DEFAULT 0,
            UNIQUE(daily_menu_id, diet_id, is_pureed),
            FOREIGN KEY (daily_menu_id) REFERENCES daily_menus(id) ON DELETE CASCADE,
            FOREIGN KEY (diet_id) REFERENCES diets(id)
        );
    """)

    # Фактические блюда на конкретную дату
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            daily_menu_id INTEGER NOT NULL,
            diet_id INTEGER NOT NULL,
            meal_time_id INTEGER NOT NULL,
            recipe_id INTEGER NOT NULL,
            variant_id INTEGER NOT NULL,
            portion_multiplier REAL DEFAULT 1.0,
            selected_alternatives TEXT,
            FOREIGN KEY (daily_menu_id) REFERENCES daily_menus(id) ON DELETE CASCADE,
            FOREIGN KEY (diet_id) REFERENCES diets(id),
            FOREIGN KEY (meal_time_id) REFERENCES meal_times(id),
            FOREIGN KEY (recipe_id) REFERENCES recipes(id),
            FOREIGN KEY (variant_id) REFERENCES recipe_variants(id)
        );
    """)

    print("2. Заполнение базовых справочников для ДИПИ...")

    # Стандартные приемы пищи для интерната
    meal_times = [
        ("Завтрак", 10),
        ("Второй завтрак", 20),
        ("Обед", 30),
        ("Полдник", 40),
        ("Ужин", 50),
        ("Второй ужин (на ночь)", 60),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO meal_times (name, sort_order) VALUES (?, ?);",
        meal_times,
    )

    # Основные стандартные диеты (Приказ Минздрава №330н)
    diets = [
        ("ОВД", "Основной вариант стандартной диеты", "I", 2200, 85, 75, 300),
        ("ЩД", "Щадящая диета", "I", 2150, 85, 70, 290),
        ("ВБД", "Высокобелковая диета", "I", 2400, 110, 80, 310),
        ("НКД", "Низкокалорийная диета (в т.ч. для диабетиков)", "I", 1600, 75, 60, 180),
        ("НБД", "Низкобелковая диета", "I", 2100, 40, 80, 300),
    ]
    cursor.executemany(
        """
        INSERT OR IGNORE INTO diets 
        (code, name, default_category, target_calories, target_proteins, target_fats, target_carbs) 
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """,
        diets,
    )

    # Создадим один стартовый шаблон меню, чтобы сразу было с чем работать на фронтенде
    cursor.execute("SELECT COUNT(*) FROM menu_templates;")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO menu_templates (name, days_count) VALUES (?, ?);",
            ("Типовое 7-дневное меню (базовое)", 7),
        )

    conn.commit()
    conn.close()
    print("\nМиграция успешно завершена! База recipes.db обновлена.")


if __name__ == "__main__":
    migrate()
