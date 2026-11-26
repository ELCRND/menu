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
    const q = search.value.toLowerCase().trim();

    return recipes.value.filter((r) => {
      if (onlyFavorites.value && !r.is_favorite) return false;
      if (selectedSection.value && r.section !== selectedSection.value)
        return false;
      if (!q) return true;

      const inTitle = r.title.toLowerCase().includes(q);
      const inNum = String(r.recipe_number) === q;
      const inIng = r.variants?.some((v) =>
        v.ingredients?.some((i) => i.name.toLowerCase().includes(q)),
      );
      return inTitle || inNum || inIng;
    });
  });

  function resetFilters() {
    search.value = "";
    selectedSection.value = null;
    onlyFavorites.value = false;
  }

  async function toggleFavorite(recipe) {
    const res = await fetch(`/api/favorites/${recipe.id}`, { method: "POST" });
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
