<script setup>
import { ref } from 'vue'
// import RecipesCatalog from './components/RecipesCatalog.vue'
// import TemplateBuilder from './components/TemplateBuilder.vue'
// import DailyMenuManager from './components/DailyMenuManager.vue'
import MenuBuilderPage from './components/menu-builder/MenuBuilderPage.vue';
import RecipesPage from './components/recipes/RecipesPage.vue';
import DailyMenuPage from './components/daily-menu/DailyMenuPage.vue';

const activeTab = ref('catalog') // 'catalog' | 'templates' | 'daily'
</script>

<template>
  <div class="min-h-screen bg-[#151e29] text-[#e2e8f0] font-sans antialiased">
    <header class="bg-[#182130] border-b border-[#2b394e] sticky top-0 z-30 no-print">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-[#10a37f] text-white flex items-center justify-center shadow-sm">
            <i class="pi pi-server text-sm"></i>
          </div>
          <span class="font-semibold text-sm text-white tracking-tight">ДИПИ · Диетпитание</span>
        </div>

        <nav class="flex items-center gap-2">
          <button
            type="button"
            @click="activeTab = 'catalog'"
            class="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer border"
            :class="activeTab === 'catalog'
              ? 'bg-[#10a37f] border-[#13b890] text-white shadow-sm'
              : 'bg-[#222e42] border-[#364761] text-[#cbd5e1] hover:border-[#10a37f]'"
          >
            <i class="pi pi-book text-xs"></i>
            <span>Картотека ТТК</span>
          </button>

          <button
            type="button"
            @click="activeTab = 'templates'"
            class="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer border"
            :class="activeTab === 'templates'
              ? 'bg-[#10a37f] border-[#13b890] text-white shadow-sm'
              : 'bg-[#222e42] border-[#364761] text-[#cbd5e1] hover:border-[#10a37f]'"
          >
            <i class="pi pi-calendar text-xs"></i>
            <span>Типовое меню</span>
          </button>

          <button
            type="button"
            @click="activeTab = 'daily'"
            class="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer border"
            :class="activeTab === 'daily'
              ? 'bg-[#10a37f] border-[#13b890] text-white shadow-sm'
              : 'bg-[#222e42] border-[#364761] text-[#cbd5e1] hover:border-[#10a37f]'"
          >
            <i class="pi pi-list-check text-xs"></i>
            <span>Меню на день</span>
          </button>
        </nav>
      </div>
    </header>

    <!-- Контент активной вкладки -->
    <main>
      <!-- <RecipesCatalog v-if="activeTab === 'catalog'" /> -->
      <!-- <TemplateBuilder v-else-if="activeTab === 'templates'" /> -->
      <RecipesPage v-if="activeTab === 'catalog'" />
      <MenuBuilderPage v-else-if="activeTab === 'templates'" />
      <DailyMenuPage v-else-if="activeTab === 'daily'" />

    </main>
  </div>
</template>
