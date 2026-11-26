import { ref, computed, watch } from "vue";

// base requestr
async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = res.status !== 204 ? await res.json().catch(() => ({})) : null;
  if (!res.ok) {
    throw new Error(data?.error || `Ошибка запроса: ${res.status}`);
  }
  return data;
}

// states
export function useMenuBuilder() {
  // ___типовое_меню___ -существующие шаблоны (Типовое 7-дневное...)
  const templates = ref([]);
  // ___диета___ -существующие диеты (ОВД -...)
  const diets = ref([]);
  // ___прием_пищи___ -существующие приемы пищи (Завтрак...)
  const mealTimes = ref([]);
  // ___блюдо___ -существующие рецепты
  const recipes = ref([]);
  // ___блюдо___ -массив блюд выбраных в ___прием_пищи___
  const templateItems = ref([]);

  // ___типовое_меню___ -id
  const selectedTemplateId = ref(null);
  // ___диета___ -id
  const selectedDietId = ref(null);
  // ___день___ -id (день цикла 1,2,3,5,6,7...)
  const selectedDay = ref(1);

  // Вычисляемые сущности
  // ___типовое_меню___ ^
  const currentTemplate = computed(
    () =>
      templates.value.find((t) => t.id === selectedTemplateId.value) || null,
  );

  // ___диета___ ^
  const currentDiet = computed(
    () => diets.value.find((d) => d.id === selectedDietId.value) || null,
  );

  // ___блюдо___ ^
  const dietItems = computed(() =>
    templateItems.value.filter((item) => item.diet_id === selectedDietId.value),
  );

  // ___блюдо___ -поиск в ___прием_пищи___
  function getItemsByMeal(mealTimeId) {
    return dietItems.value.filter((i) => i.meal_time_id === mealTimeId);
  }

  // ___КБЖУ___ -подсчет
  const dailyNutrition = computed(() => {
    return dietItems.value.reduce(
      (acc, item) => {
        const m = item.portion_multiplier || 1;
        acc.calories += (item.calories || 0) * m;
        acc.proteins += (item.proteins_total || 0) * m;
        acc.fats += (item.fats_total || 0) * m;
        acc.carbs += (item.carbs_total || 0) * m;
        return acc;
      },
      { calories: 0, proteins: 0, fats: 0, carbs: 0 },
    );
  });

  // Загрузка данных
  /**
   * >get "/dictionaries" >>response { ___диета___, ___типовое_меню___, ___прием_пищи___ }
   * >get "/recipes" >>response { ___блюдо___ }
   */
  async function initDictionaries() {
    const [dict, recList] = await Promise.all([
      request("/api/menu/dictionaries"),
      request("/api/recipes"),
    ]);

    templates.value = dict.templates;
    diets.value = dict.diets;
    mealTimes.value = dict.mealTimes;
    recipes.value = recList;

    if (templates.value.length)
      selectedTemplateId.value = templates.value[0].id;
    if (diets.value.length) selectedDietId.value = diets.value[0].id;
  }

  /**
   * ___типовое_меню___ -by id
   * >get "/templates/:id" >>response { ___блюдо___ } by ___типовое_меню___ id
   */
  async function loadTemplateItems() {
    if (!selectedTemplateId.value) {
      templateItems.value = [];
      return;
    }
    templateItems.value = await request(
      `/api/menu/templates/${selectedTemplateId.value}?day=${selectedDay.value}`,
    );
  }

  watch([selectedTemplateId, selectedDay], loadTemplateItems);

  // Действия с шаблонами
  /**
   * ___типовое_меню___ -создать
   * >post "/templates"
   */
  async function createTemplate(payload) {
    const created = await request("/api/menu/templates", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    templates.value.push(created);
    selectedTemplateId.value = created.id;
    selectedDay.value = 1;
  }

  /**
   * ___типовое_меню___ -редактирование
   * >patch "/templates/:id"
   */
  async function renameTemplate(id, name) {
    const updated = await request(`/api/menu/templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    if (currentTemplate.value) currentTemplate.value.name = updated.name;
  }

  /**
   * ___типовое_меню___ -удаление
   * >de;ete "/templates/:id"
   */
  async function deleteTemplate(id) {
    await request(`/api/menu/templates/${id}`, { method: "DELETE" });
    templates.value = templates.value.filter((t) => t.id !== id);
    selectedTemplateId.value = templates.value.length
      ? templates.value[0].id
      : null;
    selectedDay.value = 1;
  }

  // Действия с блюдами
  /**
   * ___блюдо___ -добавление
   * >post "/templates/:id/items" payload { ___блюдо___ }
   */
  async function addDish(payload) {
    await request(`/api/menu/templates/${selectedTemplateId.value}/items`, {
      method: "POST",
      body: JSON.stringify({
        day_number: selectedDay.value,
        diet_id: selectedDietId.value,
        ...payload,
      }),
    });
    await loadTemplateItems();
  }

  /**
   * ___блюдо___ -редактирование
   * >patch "/templates/items/:id" payload { ___блюдо___ }
   */
  async function updateDish(itemId, payload) {
    await request(`/api/menu/templates/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    await loadTemplateItems();
  }

  /**
   * ___блюдо___ -удаление
   * >delete "/templates/items/:id" payload { ___блюдо___ }
   */
  async function removeDish(itemId) {
    await request(`/api/menu/templates/items/${itemId}`, { method: "DELETE" });
    await loadTemplateItems();
  }

  /**
   * ___блюдо___ -смена позиции в ___прием_пищи___
   * >put "/templates/items/reorder" payload { [id, id, id] }
   */
  async function moveDish(mealTimeId, index, direction) {
    const items = [...getItemsByMeal(mealTimeId)];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
    const orderedIds = items.map((i) => i.id);

    await request("/api/menu/templates/items/reorder", {
      method: "PUT",
      body: JSON.stringify({ orderedIds }),
    });
    await loadTemplateItems();
  }

  // Действия с днем и нормами
  /**
   * ___день___ -скопировать
   * >post "/templates/items/copy-day" payload { ___день___, ___диета___ id, targets, }
   */
  async function copyDay(payload) {
    await request(`/api/menu/templates/${selectedTemplateId.value}/copy-day`, {
      method: "POST",
      body: JSON.stringify({
        source_day: selectedDay.value,
        source_diet_id: selectedDietId.value,
        ...payload,
      }),
    });
    if (payload.target_days.includes(selectedDay.value)) {
      await loadTemplateItems();
    }
  }
  /**
   * ___день___ -удаление
   * >delete "/templates/:id/days/:id"
   */
  async function clearDay() {
    await request(
      `/api/menu/templates/${selectedTemplateId.value}/days/${selectedDay.value}?diet_id=${selectedDietId.value}`,
      { method: "DELETE" },
    );
    await loadTemplateItems();
  }

  /**
   * ___кбжу___ -редактирование
   * >put "/diets/:id/targets"
   */
  async function saveDietTargets(targets) {
    if (!currentDiet.value) return;
    await request(`/api/menu/diets/${currentDiet.value.id}/targets`, {
      method: "PUT",
      body: JSON.stringify(targets),
    });
    Object.assign(currentDiet.value, targets);
  }

  // Управление справочником приемов пищи
  /**
   * ___прием_пищи___ -добавить
   * >post "/meal-times"
   */
  async function addMealTime(name) {
    const created = await request("/api/menu/meal-times", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    mealTimes.value.push(created);
  }

  /**
   * ___прием_пищи___ -редактирование
   * >post "/meal-times/:id"
   */
  async function renameMealTime(meal, name) {
    const updated = await request(`/api/menu/meal-times/${meal.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    meal.name = updated.name;
  }

  /**
   * ___прием_пищи___ -редактирование
   * >put "/meal-times/reorder"
   */
  async function moveMealTime(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= mealTimes.value.length) return;

    const list = [...mealTimes.value];
    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
    mealTimes.value = list;

    await request("/api/menu/meal-times/reorder", {
      method: "PUT",
      body: JSON.stringify({ orderedIds: list.map((m) => m.id) }),
    });
  }

  /**
   * ___прием_пищи___ -удаление
   * >delete "/meal-times/:id"
   */
  async function removeMealTime(mealId) {
    await request(`/api/menu/meal-times/${mealId}`, { method: "DELETE" });
    mealTimes.value = mealTimes.value.filter((m) => m.id !== mealId);
  }

  return {
    templates,
    diets,
    mealTimes,
    recipes,
    selectedTemplateId,
    selectedDietId,
    selectedDay,
    currentTemplate,
    currentDiet,
    dietItems,
    dailyNutrition,
    getItemsByMeal,
    initDictionaries,
    createTemplate,
    renameTemplate,
    deleteTemplate,
    addDish,
    updateDish,
    removeDish,
    moveDish,
    copyDay,
    clearDay,
    saveDietTargets,
    addMealTime,
    renameMealTime,
    moveMealTime,
    removeMealTime,
  };
}
