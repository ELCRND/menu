import glob
import json
import re
import psycopg2
from psycopg2.extras import execute_values

DB_CONFIG = {
    "dbname": "ttk_db",
    "user": "ttk_user",
    "password": "0042",
    "host": "localhost",
    "port": 5432,
}


def get_word_tokens(text: str) -> set:
    if not text:
        return set()
    # Удаляем пояснения в скобках, например "(лопаточная, боковая)"
    text = re.sub(r"\(.*?\)", "", text)
    text = text.lower().replace("ё", "е")
    words = re.findall(r"[а-яa-z0-9]+", text)
    stop_words = {"с", "со", "и", "или", "либо", "на", "в", "из", "под", "для", "по", "без", "кроме"}
    tokens = set()
    for w in words:
        if w in stop_words:
            continue
        stem = w[:-2] if len(w) > 5 else (w[:-1] if len(w) > 3 else w)
        tokens.add(stem)
    return tokens


def seed_dictionaries(cur):
    """Заполняет базовые справочники приемов пищи и диет, если таблицы пустые."""
    cur.execute("SELECT COUNT(*) FROM meal_times;")
    if cur.fetchone() == 0:
        meal_times = [
            ("Завтрак", 1),
            ("Второй завтрак", 2),
            ("Обед", 3),
            ("Полдник", 4),
            ("Ужин", 5),
            ("На ночь", 6),
        ]
        execute_values(
            cur,
            "INSERT INTO meal_times (name, sort_order) VALUES %s;",
            meal_times,
        )

    cur.execute("SELECT COUNT(*) FROM diets;")
    if cur.fetchone() == 0:
        diets = [
            ("ОВД", "Основной вариант стандартной диеты", "I, II", 2200, 85.0, 75.0, 300.0),
            ("ЩД", "Щадящая диета", "II", 2100, 80.0, 70.0, 280.0),
            ("ВБД", "Высокобелковая диета", "I", 2400, 115.0, 85.0, 290.0),
            ("НБД", "Низкобелковая диета", "III", 2000, 45.0, 75.0, 290.0),
            ("НКД", "Низкокалорийная диета", "III", 1500, 75.0, 55.0, 170.0),
        ]
        execute_values(
            cur,
            """
            INSERT INTO diets (
                code, name, default_category, target_calories,
                target_proteins, target_fats, target_carbs
            ) VALUES %s;
            """,
            diets,
        )


def load_json_files(paths_pattern: str) -> list:
    """Читает все JSON-файлы по маске и объединяет их в единый список."""
    records = []
    files = sorted(glob.glob(paths_pattern))
    if not files:
        print(f"Внимание: не найдены файлы по маске {paths_pattern}")
    for file_path in files:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            items = []
            if isinstance(data, dict):
                items = data.get("ttk_list") or data.get("recipes") or []
            elif isinstance(data, list):
                items = data
            for item in items:
                item["_source_file"] = file_path
            records.extend(items)
    return records


def find_best_nutrition(ttk_title: str, candidates: list):
    """Подбирает наиболее подходящую запись КБЖУ для ТТК из кандидатов с тем же номером."""
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]

    ttk_tokens = get_word_tokens(ttk_title)
    if not ttk_tokens:
        return None

    best_cand = None
    best_score = -1.0

    for cand in candidates:
        cand_tokens = cand["_tokens"]
        if not cand_tokens:
            continue
        intersection = len(ttk_tokens & cand_tokens)
        union = len(ttk_tokens | cand_tokens)
        score = intersection / union
        if score > best_score:
            best_score = score
            best_cand = cand

    # Порог отсечения случайных совпадений
    return best_cand if best_score >= 0.25 else None


def import_all(recipes_pattern: str, nutrition_pattern: str, reset_recipes: bool = True):
    ttk_list = load_json_files(recipes_pattern)
    nutrition_list = load_json_files(nutrition_pattern)

    if not ttk_list:
        print("Импорт прерван: список рецептов пуст.")
        return

    # Группируем все варианты КБЖУ по номеру рецепта и заранее считаем токены названий
    nutrition_by_recipe = {}
    for item in nutrition_list:
        r_num = int(item["recipe_number"])
        full_name = f"{item.get('dish_name', '')} {item.get('variant_note') or ''}".strip()
        item["_tokens"] = get_word_tokens(full_name)
        item["_full_name"] = full_name
        nutrition_by_recipe.setdefault(r_num, []).append(item)

    try:
        conn = psycopg2.connect(**DB_CONFIG)
    except UnicodeDecodeError as e:
        print("Ошибка подключения к PostgreSQL:", e.object.decode("cp1251", errors="replace"))
        raise

    cur = conn.cursor()

    total_recipes = 0
    matched_nutrition = 0
    unmatched_recipes = []

    try:
        if reset_recipes:
            # Очищаем таблицы рецептов, вариантов, ингредиентов и КБЖУ перед перезаливкой
            cur.execute("TRUNCATE TABLE recipes RESTART IDENTITY CASCADE;")

        seed_dictionaries(cur)

        for ttk in ttk_list:
            base_num = ttk.get("base_recipe_number") or ttk.get("recipe_number")
            if base_num is None:
                raise ValueError(f"Отсутствует номер рецепта в файле {ttk.get('_source_file')}")
            base_num = int(base_num)
            ttk_code = str(ttk.get("ttk_code") or base_num)

            # 1. Вставляем карточку ТТК в recipes
            cur.execute(
                """
                INSERT INTO recipes (
                    base_recipe_number, ttk_code, section, title,
                    technology, quality_requirements, footnotes
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (
                    base_num,
                    ttk_code,
                    ttk["section"],
                    ttk["title"],
                    ttk.get("technology"),
                    ttk.get("quality_requirements"),
                    ttk.get("footnotes"),
                ),
            )
            recipe_id = cur.fetchone()[0]
            total_recipes += 1

            variants_by_weight = {}
            first_variant_id = None

            # 2. Вставляем варианты (колонки I, II, III) в recipe_variants
            for idx, var in enumerate(ttk.get("variants", [])):
                out_weight = float(var["output_weight"])
                cur.execute(
                    """
                    INSERT INTO recipe_variants (recipe_id, category, output_weight)
                    VALUES (%s, %s, %s)
                    RETURNING id;
                    """,
                    (recipe_id, var["category"], out_weight),
                )
                variant_id = cur.fetchone()[0]

                if idx == 0:
                    first_variant_id = variant_id
                variants_by_weight[out_weight] = variant_id

                # 3. Пакетно вставляем ингредиенты в ingredients
                ingredients_rows = [
                    (
                        variant_id,
                        int(ing["order"]),
                        ing["name"],
                        str(ing["gross_weight"]),
                        float(ing["net_weight"]),
                    )
                    for ing in var.get("ingredients", [])
                ]
                if ingredients_rows:
                    execute_values(
                        cur,
                        """
                        INSERT INTO ingredients (
                            variant_id, item_order, name, gross_weight, net_weight
                        ) VALUES %s;
                        """,
                        ingredients_rows,
                    )

                 # 4. Ищем и привязываем КБЖУ в nutrition
            candidates = nutrition_by_recipe.get(base_num, [])
            nut = find_best_nutrition(ttk["title"], candidates)

            if nut:
                target_weight = float(nut["output_weight"])
                linked_variant_id = variants_by_weight.get(target_weight, first_variant_id)

                cur.execute(
                    """
                    INSERT INTO nutrition (
                        recipe_id, variant_id, dish_name, variant_note, output_weight,
                        proteins_total, proteins_animal, fats_total, fats_vegetable,
                        saturated_fatty_acids, cholesterol, mono_disaccharides, starch,
                        carbs_total, dietary_fiber, na, k, ca, mg, p, fe,
                        vit_a, carotene, retinol_equiv, tocopherol_equiv,
                        vit_b1, vit_b2, vit_pp, niacin_equiv, vit_c, calories
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s
                    );
                    """,
                    (
                        recipe_id,
                        linked_variant_id,
                        nut.get("dish_name"),
                        nut.get("variant_note"),
                        target_weight,
                        nut.get("proteins_total"),
                        nut.get("proteins_animal"),
                        nut.get("fats_total"),
                        nut.get("fats_vegetable"),
                        nut.get("saturated_fatty_acids"),
                        nut.get("cholesterol"),
                        nut.get("mono_disaccharides"),
                        nut.get("starch"),
                        nut.get("carbs_total"),
                        nut.get("dietary_fiber"),
                        nut.get("na"),
                        nut.get("k"),
                        nut.get("ca"),
                        nut.get("mg"),
                        nut.get("p"),
                        nut.get("fe"),
                        nut.get("vit_a"),
                        nut.get("carotene"),
                        nut.get("retinol_equiv"),
                        nut.get("tocopherol_equiv"),
                        nut.get("vit_b1"),
                        nut.get("vit_b2"),
                        nut.get("vit_pp"),
                        nut.get("niacin_equiv"),
                        nut.get("vit_c"),
                        nut.get("calories"),
                    ),
                )
                matched_nutrition += 1
            else:
                unmatched_recipes.append(f"{ttk_code} — {ttk['title']}")

        conn.commit()
        print(f"Успешно импортировано ТТК: {total_recipes}")
        print(f"Успешно привязано КБЖУ: {matched_nutrition}")

        if unmatched_recipes:
            print(f"\nНе найдено КБЖУ для {len(unmatched_recipes)} ТТК:")
            for item in unmatched_recipes:
                print(f"  - {item}")

    except Exception as e:
        conn.rollback()
        print(f"Ошибка при импорте, транзакция отменена: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    import_all(
        recipes_pattern="./data/recipes/*.json",
        nutrition_pattern="./data/nutrition/*.json",
        reset_recipes=True,
    )

