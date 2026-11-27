import sqlite3

conn = sqlite3.connect("recipes.db")
cursor = conn.cursor()

# Для записей nutrition, где variant_id не определился по точному весу,
# привязываем к III колонке рецепта (или к единственной колонке, если она одна)
cursor.execute("""
    UPDATE nutrition
    SET variant_id = COALESCE(
        (SELECT id FROM recipe_variants WHERE recipe_id = nutrition.recipe_id AND category = 'III' LIMIT 1),
        (SELECT id FROM recipe_variants WHERE recipe_id = nutrition.recipe_id ORDER BY id DESC LIMIT 1)
    )
    WHERE variant_id IS NULL;
""")

print(f"Обновлено привязок в таблице nutrition: {cursor.rowcount}")
conn.commit()
conn.close()
