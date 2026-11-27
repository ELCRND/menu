-- 1. Справочник диет и приемов пищи
CREATE TABLE diets (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    default_category VARCHAR(50),
    target_calories INT,
    target_proteins NUMERIC(8, 2),
    target_fats NUMERIC(8, 2),
    target_carbs NUMERIC(8, 2)
);

CREATE TABLE meal_times (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);

-- 2. Справочник ТТК (индивидуальные неделимые блюда)
CREATE TABLE recipes (
    id SERIAL PRIMARY KEY,
    base_recipe_number INT NOT NULL,
    ttk_code VARCHAR(20) UNIQUE NOT NULL,
    section VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    technology TEXT,
    quality_requirements TEXT,
    footnotes TEXT
);

CREATE INDEX idx_recipes_base_num ON recipes(base_recipe_number);
CREATE INDEX idx_recipes_title ON recipes(LOWER(title));

-- 3. Варианты закладки (колонки I, II, III)
CREATE TABLE recipe_variants (
    id SERIAL PRIMARY KEY,
    recipe_id INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    output_weight NUMERIC(10, 2) NOT NULL,
    UNIQUE(recipe_id, category)
);

-- 4. Ингредиенты (чистый список без альтернатив)
CREATE TABLE ingredients (
    id SERIAL PRIMARY KEY,
    variant_id INT NOT NULL REFERENCES recipe_variants(id) ON DELETE CASCADE,
    item_order INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    gross_weight VARCHAR(50) NOT NULL,
    net_weight NUMERIC(10, 3) NOT NULL
);

-- 5. Таблица КБЖУ
CREATE TABLE nutrition (
    id SERIAL PRIMARY KEY,
    recipe_id INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    variant_id INT REFERENCES recipe_variants(id) ON DELETE SET NULL,
    dish_name VARCHAR(255),
    variant_note TEXT,
    output_weight NUMERIC(10, 2) NOT NULL,
    proteins_total NUMERIC(8, 2),
    proteins_animal NUMERIC(8, 2),
    fats_total NUMERIC(8, 2),
    fats_vegetable NUMERIC(8, 2),
    saturated_fatty_acids NUMERIC(8, 2),
    cholesterol NUMERIC(8, 2),
    mono_disaccharides NUMERIC(8, 2),
    starch NUMERIC(8, 2),
    carbs_total NUMERIC(8, 2),
    dietary_fiber NUMERIC(8, 2),
    na NUMERIC(8, 2),
    k NUMERIC(8, 2),
    ca NUMERIC(8, 2),
    mg NUMERIC(8, 2),
    p NUMERIC(8, 2),
    fe NUMERIC(8, 2),
    vit_a NUMERIC(8, 2),
    carotene NUMERIC(8, 2),
    retinol_equiv NUMERIC(8, 2),
    tocopherol_equiv NUMERIC(8, 3),
    vit_b1 NUMERIC(8, 3),
    vit_b2 NUMERIC(8, 3),
    vit_pp NUMERIC(8, 3),
    niacin_equiv NUMERIC(8, 3),
    vit_c NUMERIC(8, 2),
    calories NUMERIC(8, 2),
    UNIQUE(recipe_id)
);

-- 6. Шаблоны цикличного меню
CREATE TABLE menu_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    days_count INT NOT NULL DEFAULT 7,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE menu_template_items (
    id SERIAL PRIMARY KEY,
    template_id INT NOT NULL REFERENCES menu_templates(id) ON DELETE CASCADE,
    day_number INT NOT NULL,
    diet_id INT NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    meal_time_id INT NOT NULL REFERENCES meal_times(id) ON DELETE CASCADE,
    recipe_id INT NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
    variant_id INT NOT NULL REFERENCES recipe_variants(id) ON DELETE RESTRICT,
    portion_multiplier NUMERIC(5, 2) NOT NULL DEFAULT 1.0,
    sort_order INT NOT NULL DEFAULT 0
);

-- 7. Ежедневное меню и контингент (количество питающихся)
CREATE TABLE daily_menus (
    id SERIAL PRIMARY KEY,
    menu_date DATE NOT NULL,
    template_id INT REFERENCES menu_templates(id) ON DELETE SET NULL,
    day_number INT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    UNIQUE(menu_date)
);

CREATE TABLE daily_headcount (
    id SERIAL PRIMARY KEY,
    daily_menu_id INT NOT NULL REFERENCES daily_menus(id) ON DELETE CASCADE,
    diet_id INT NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    people_count INT NOT NULL DEFAULT 0,
    is_pureed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE daily_menu_items (
    id SERIAL PRIMARY KEY,
    daily_menu_id INT NOT NULL REFERENCES daily_menus(id) ON DELETE CASCADE,
    diet_id INT NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    meal_time_id INT NOT NULL REFERENCES meal_times(id) ON DELETE CASCADE,
    recipe_id INT NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
    variant_id INT NOT NULL REFERENCES recipe_variants(id) ON DELETE RESTRICT,
    portion_multiplier NUMERIC(5, 2) NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS favorites (
    recipe_id INT PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
