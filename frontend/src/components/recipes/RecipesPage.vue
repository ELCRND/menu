<script setup>
import { onMounted } from 'vue'
import { useRecipes } from '@/composables/useRecipes'

import RecipesHeader from './RecipesHeader.vue'
import RecipeCard from './RecipeCard.vue'
import RecipeDetailModal from './modals/RecipeDetailModal.vue'

const {
    recipes,
    search,
    selectedSection,
    onlyFavorites,
    activeRecipe,
    sections,
    filteredRecipes,
    loadRecipes,
    resetFilters,
    toggleFavorite
} = useRecipes()

onMounted(loadRecipes)
</script>

<template>
    <div class="min-h-screen bg-[#151e29] text-[#e2e8f0] font-sans antialiased no-print">
        <div class="max-w-7xl mx-auto p-4 sm:p-6">
            <RecipesHeader
                v-model:search="search"
                v-model:section="selectedSection"
                v-model:onlyFavorites="onlyFavorites"
                :totalCount="recipes.length"
                :foundCount="filteredRecipes.length"
                :sections="sections"
                @reset="resetFilters"
            />

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <RecipeCard
                    v-for="recipe in filteredRecipes"
                    :key="recipe.id"
                    :recipe="recipe"
                    @select="activeRecipe = recipe"
                    @toggle-favorite="toggleFavorite(recipe)"
                />
            </div>
        </div>
    </div>

    <RecipeDetailModal v-model:recipe="activeRecipe" />
</template>
