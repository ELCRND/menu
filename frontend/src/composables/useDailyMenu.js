import { ref, computed, watch } from "vue";

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = res.status !== 204 ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new Error(data?.error || `Ошибка запроса: ${res.status}`);
  }
  return data;
}

export function useDailyMenu() {
  // Справочники
  const templates = ref([]);
  const diets = ref([]);
  const mealTimes = ref([]);

  // Параметры генерации
  const selectedDate = ref(new Date().toISOString().slice(0, 10));
  const selectedTemplateId = ref(null);
  const selectedDay = ref(1);
  const headcountForm = ref([]);

  // Данные сформированного меню
  const dailyData = ref(null);
  const productsSummary = ref([]);
  const distributionList = ref([]);
  const isLoading = ref(false);

  const totalPeople = computed(() =>
    headcountForm.value.reduce(
      (sum, row) => sum + (row.regular || 0) + (row.pureed || 0),
      0,
    ),
  );

  const currentTemplate = computed(
    () =>
      templates.value.find((t) => t.id === selectedTemplateId.value) || null,
  );

  // Вспомогательная сборка формы контингента из списка записей БД
  function mapHeadcountsToForm(savedHeadcounts = []) {
    headcountForm.value = diets.value.map((d) => {
      const reg = savedHeadcounts.find(
        (h) => h.diet_id === d.id && h.is_pureed === 0,
      );
      const pur = savedHeadcounts.find(
        (h) => h.diet_id === d.id && h.is_pureed === 1,
      );
      return {
        diet_id: d.id,
        code: d.code,
        name: d.name,
        regular: reg ? reg.people_count : 0,
        pureed: pur ? pur.people_count : 0,
      };
    });
  }

  // Упаковка формы в payload для отправки на сервер
  function buildHeadcountsPayload() {
    const payload = [];
    for (const row of headcountForm.value) {
      if (row.regular > 0) {
        payload.push({
          diet_id: row.diet_id,
          people_count: row.regular,
          is_pureed: 0,
        });
      }
      if (row.pureed > 0) {
        payload.push({
          diet_id: row.diet_id,
          people_count: row.pureed,
          is_pureed: 1,
        });
      }
    }
    return payload;
  }

  async function init() {
    const dict = await request("/api/menu/dictionaries");
    templates.value = dict.templates;
    diets.value = dict.diets;
    mealTimes.value = dict.mealTimes;

    if (templates.value.length) selectedTemplateId.value = templates.value.id;
    mapHeadcountsToForm();
    await loadDailyMenu();
  }

  async function loadReports() {
    const [products, distribution] = await Promise.all([
      request(`/api/daily-menus/${selectedDate.value}/products-summary`),
      request(`/api/daily-menus/${selectedDate.value}/distribution`),
    ]);
    productsSummary.value = products;
    distributionList.value = distribution;
  }

  async function loadDailyMenu() {
    isLoading.value = true;
    try {
      const data = await request(`/api/daily-menus/${selectedDate.value}`);
      dailyData.value = data;

      if (data) {
        if (data.menu.template_id)
          selectedTemplateId.value = data.menu.template_id;
        if (data.menu.day_number) selectedDay.value = data.menu.day_number;
        mapHeadcountsToForm(data.headcounts);
        await loadReports();
      } else {
        mapHeadcountsToForm();
        productsSummary.value = [];
        distributionList.value = [];
      }
    } finally {
      isLoading.value = false;
    }
  }

  watch(selectedDate, loadDailyMenu);

  async function generateMenu() {
    if (!selectedTemplateId.value || totalPeople.value === 0) return;

    await request("/api/daily-menus/generate", {
      method: "POST",
      body: JSON.stringify({
        menu_date: selectedDate.value,
        template_id: selectedTemplateId.value,
        day_number: selectedDay.value,
        headcounts: buildHeadcountsPayload(),
      }),
    });
    await loadDailyMenu();
  }

  async function saveOnlyHeadcount() {
    await request(`/api/daily-menus/${selectedDate.value}/headcount`, {
      method: "PUT",
      body: JSON.stringify({ headcounts: buildHeadcountsPayload() }),
    });
    await loadReports();
  }

  async function updateAlternative(item, groupId, ingredientId) {
    const updatedAlts = {
      ...item.selected_alternatives,
      [groupId]: ingredientId,
    };
    item.selected_alternatives = updatedAlts;

    await request(`/api/daily-menus/items/${item.id}/alternatives`, {
      method: "PATCH",
      body: JSON.stringify({ selected_alternatives: updatedAlts }),
    });
    await loadReports();
  }

  async function copyHeadcountFromYesterday() {
    const current = new Date(selectedDate.value);
    current.setDate(current.getDate() - 1);
    const yesterdayStr = current.toISOString().slice(0, 10);

    const yesterdayData = await request(`/api/daily-menus/${yesterdayStr}`);
    if (!yesterdayData?.headcounts?.length) {
      return { ok: false, date: yesterdayStr };
    }

    mapHeadcountsToForm(yesterdayData.headcounts);
    return { ok: true, date: yesterdayStr };
  }

  return {
    templates,
    diets,
    mealTimes,
    selectedDate,
    selectedTemplateId,
    selectedDay,
    headcountForm,
    dailyData,
    productsSummary,
    distributionList,
    isLoading,
    totalPeople,
    currentTemplate,
    init,
    generateMenu,
    saveOnlyHeadcount,
    updateAlternative,
    copyHeadcountFromYesterday,
  };
}
