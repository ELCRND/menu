import { ref, computed } from "vue";

export function useRecipes() {
  const recipes = ref([]);
  const search = ref("");
  const selectedSection = ref(null);
  const onlyFavorites = ref(false);
  const activeRecipe = ref(null);

  async function loadRecipes() {
    const res = await fetch("/api/recipes");
    if (!res.ok) throw new Error("Не удалось загрузить сборник ТТК");
    recipes.value = await res.json();
  }

  const sections = computed(() => {
    const set = new Set(recipes.value.map((r) => r.section).filter(Boolean));
    return Array.from(set).sort();
  });

  const filteredRecipes = computed(() => {
    const q = search.value.toLowerCase().replace("ё", "е").trim();

    return recipes.value.filter((r) => {
      if (onlyFavorites.value && !r.is_favorite) return false;
      if (selectedSection.value && r.section !== selectedSection.value)
        return false;
      if (!q) return true;

      // 1. Поиск по коду ТТК ("158.1") или базовому номеру ("158")
      const ttkCode = String(r.ttk_code || "").toLowerCase();
      const baseNum = String(r.base_recipe_number || "");
      const inNum =
        ttkCode === q || ttkCode.startsWith(`${q}.`) || baseNum === q;

      // 2. Поиск по названию блюда (с нормализацией ё -> е)
      const inTitle = (r.title || "")
        .toLowerCase()
        .replace("ё", "е")
        .includes(q);

      // 3. Поиск по составу (ингредиентам)
      const inIng = r.variants?.some((v) =>
        v.ingredients?.some((i) =>
          (i.name || "").toLowerCase().replace("ё", "е").includes(q),
        ),
      );

      return inNum || inTitle || inIng;
    });
  });

  function resetFilters() {
    search.value = "";
    selectedSection.value = null;
    onlyFavorites.value = false;
  }

  async function toggleFavorite(recipe) {
    const res = await fetch(`/api/recipes/favorites/${recipe.id}`, {
      method: "POST",
    });
    if (!res.ok) return;
    const data = await res.json();
    recipe.is_favorite = data.is_favorite;
  }

  return {
    recipes,
    search,
    selectedSection,
    onlyFavorites,
    activeRecipe,
    sections,
    filteredRecipes,
    loadRecipes,
    resetFilters,
    toggleFavorite,
  };
}
