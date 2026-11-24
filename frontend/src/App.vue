<script setup>
import { ref, computed, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const recipes = ref([])
const search = ref('')
const selectedSection = ref(null)
const onlyFavorites = ref(false)
const activeRecipe = ref(null)

onMounted(async () => {
  const res = await fetch('/api/recipes')
  recipes.value = await res.json()
})

const sections = computed(() => {
  const set = new Set(recipes.value.map(r => r.section).filter(Boolean))
  return Array.from(set).sort()
})

const filteredRecipes = computed(() => {
  return recipes.value.filter(r => {
    if (onlyFavorites.value && !r.is_favorite) return false
    if (selectedSection.value && r.section !== selectedSection.value) return false
    if (search.value) {
      const q = search.value.toLowerCase()
      const inTitle = r.title.toLowerCase().includes(q)
      const inNum = String(r.recipe_number) === q.trim()
      const inIng = r.variants.some(v =>
        v.ingredients.some(i => i.name.toLowerCase().includes(q))
      )
      return inTitle || inNum || inIng
    }
    return true
  })
})

async function toggleFav(recipe) {
  const res = await fetch(`/api/favorites/${recipe.id}`, {
    method: 'POST'
  })
  const data = await res.json()
  recipe.is_favorite = data.is_favorite
}

const activeRows = computed(() => {
  if (!activeRecipe.value?.variants?.length) return []
  const variants = activeRecipe.value.variants
  const baseIngredients = variants[0].ingredients || []

  return baseIngredients.map((baseIng, idx) => ({
    name: baseIng.name,
    is_subtotal: Boolean(baseIng.is_subtotal),
    cells: variants.map(v => {
      const item = v.ingredients[idx]
      return {
        gross: item?.gross_weight ?? '-',
        net: item?.net_weight ?? '-'
      }
    })
  }))
})

function printCard() {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-[#151e29] text-[#e2e8f0] font-sans antialiased no-print">
    <div class="max-w-7xl mx-auto p-4 sm:p-6">

      <!-- Верхний статус-бар со статистикой и тегами (как верхний блок Inbounds) -->
      <div
        class="bg-[#1c2636] border border-[#2b394e] rounded-xl px-5 py-4 mb-5 flex flex-wrap items-center justify-between gap-4 shadow-lg"
      >
        <div class="flex items-center gap-3.5">
          <div
            class="w-10 h-10 rounded-lg bg-[#10a37f] text-white flex items-center justify-center shadow-md shadow-[#10a37f]/20"
          >
            <i class="pi pi-book text-base"></i>
          </div>
          <div>
            <div class="flex items-center gap-2.5 flex-wrap">
              <h1 class="text-base font-semibold text-white tracking-tight">Сборник технологических карт</h1>
              <span
                class="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#10a37f]/15 text-[#13b890] border border-[#10a37f]/35"
              >
                v2.3.10
              </span>
              <span
                class="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#6366f1]/15 text-[#a5b4fc] border border-[#6366f1]/35"
              >
                ТТК База
              </span>
            </div>
            <p class="text-xs text-[#8a99ad] mt-0.5">Управление рецептурами, закладкой сырья и КБЖУ</p>
          </div>
        </div>

        <!-- Плашки сводной статистики -->
        <div class="flex flex-wrap items-center gap-2.5 text-xs">
          <div class="flex items-center gap-2 bg-[#151e29] border border-[#2b394e] rounded-lg px-3 py-1.5">
            <span class="text-[#8a99ad]">Всего карт:</span>
            <span
              class="px-2 py-0.5 rounded-full font-mono font-semibold bg-[#10a37f]/15 text-[#13b890] border border-[#10a37f]/30"
            >
              {{ recipes.length }}
            </span>
          </div>
          <div class="flex items-center gap-2 bg-[#151e29] border border-[#2b394e] rounded-lg px-3 py-1.5">
            <span class="text-[#8a99ad]">Найдено:</span>
            <span
              class="px-2 py-0.5 rounded-full font-mono font-semibold bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/30"
            >
              {{ filteredRecipes.length }}
            </span>
          </div>
          <div class="flex items-center gap-2 bg-[#151e29] border border-[#2b394e] rounded-lg px-3 py-1.5">
            <span class="text-[#8a99ad]">Разделов:</span>
            <span
              class="px-2 py-0.5 rounded-full font-mono font-semibold bg-[#a855f7]/15 text-[#c084fc] border border-[#a855f7]/30"
            >
              {{ sections.length }}
            </span>
          </div>
        </div>
      </div>

      <!-- Панель действий и поиска -->
      <div class="bg-[#1c2636] border border-[#2b394e] rounded-xl p-4 mb-6 shadow-md">
        <div class="h-10 flex flex-wrap items-center gap-3 ">
          <Button
            :label="onlyFavorites ? 'Избранное: Вкл' : 'Все карты'"
            :icon="onlyFavorites ? 'pi pi-star-fill' : 'pi pi-star'"
            @click="onlyFavorites = !onlyFavorites"
            class="xui-btn h-full"
            :class="onlyFavorites ? 'xui-btn-teal' : 'xui-btn-slate'"
          />

          <Select
            v-model="selectedSection"
            :options="sections"
            placeholder="Все разделы"
            showClear
            class="w-full h-full  sm:w-56 xui-select "
            labelClass="flex items-center"
          />

          <div class="relative flex-1 min-w-60 bg-red h-full ">
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a99ad] text-xs z-10"></i>
            <InputText
              v-model="search"
              placeholder="Поиск по №, названию или сырью..."
              class="w-full h-full !pl-9  xui-input"
            />
          </div>

          <Button
            v-if="search || selectedSection || onlyFavorites"
            label="Сбросить"
            icon="pi pi-filter-slash"
            @click="search = ''; selectedSection = null; onlyFavorites = false"
            class="h-full xui-btn xui-btn-danger"
          />
        </div>
      </div>

      <!-- Сетка карточек -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          v-for="recipe in filteredRecipes"
          :key="recipe.id"
          @click="activeRecipe = recipe"
          class="group cursor-pointer flex flex-col justify-between rounded-xl border border-[#2b394e] bg-[#1c2636] overflow-hidden hover:border-[#10a37f] hover:shadow-lg hover:shadow-[#10a37f]/10 transition-all duration-200"
        >
          <div>
            <!-- Верхний блок с изображением -->
            <div class="relative h-32 bg-[#151e29] border-b border-[#2b394e] overflow-hidden">
              <img
                :src="recipe.image_url || 'placeholder-600x400.webp'"
                :alt="recipe.title"
                class="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-[#1c2636] via-[#1c2636]/20 to-transparent"></div>

              <!-- Плашка номера как на скриншоте (vless / ID) -->
              <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                <span
                  class="px-2.5 py-0.5 rounded-full bg-[#151e29]/90 backdrop-blur-sm border border-[#10a37f]/45 text-[#13b890] font-mono text-xs font-semibold"
                >
                  № {{ recipe.recipe_number }}
                </span>
                <span
                  v-if="recipe.variants?.length"
                  class="px-2 py-0.5 rounded-full bg-[#151e29]/90 backdrop-blur-sm border border-[#6366f1]/45 text-[#a5b4fc] font-mono text-[11px]"
                >
                  {{ recipe.variants.length }} кол.
                </span>
              </div>

              <!-- Кнопка избранного с плотным фоном -->
              <button
                type="button"
                @click.stop="toggleFav(recipe)"
                aria-label="Добавить в избранное"
                class="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg border flex items-center justify-center transition-all shadow-sm"
                :class="recipe.is_favorite
                  ? 'bg-[#f59e0b]/40 border-[#f59e0b]/50 text-[#fbbf24]'
                  : 'bg-[#222e42]/90 border-[#364761] text-[#8a99ad] hover:text-white hover:border-[#10a37f]'"
              >
                <i
                  :class="recipe.is_favorite ? 'pi pi-star-fill' : 'pi pi-star'"
                  class="text-xs"
                ></i>
              </button>
            </div>

            <!-- Контент и теги карточки -->
            <div class="p-4">
              <div class="flex flex-wrap items-center gap-1.5 mb-2.5">
                <span
                  v-if="recipe.section"
                  class="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#10a37f]/15 text-[#13b890] border border-[#10a37f]/35 truncate max-w-full"
                >
                  {{ recipe.section }}
                </span>
                <span
                  v-if="recipe.variants?.[0]?.output_weight"
                  class="px-2 py-0.5 rounded-full text-[11px] font-mono bg-[#222e42] text-[#94a3b8] border border-[#364761]"
                >
                  Выход: {{ recipe.variants[0].output_weight }} г
                </span>
              </div>

              <h3
                class="text-sm font-semibold text-white leading-snug mb-2 group-hover:text-[#13b890] transition-colors"
              >
                {{ recipe.title }}
              </h3>

              <p class="text-xs text-[#8a99ad] line-clamp-3 leading-relaxed">
                {{ recipe.technology || 'Описание технологии не указано.' }}
              </p>
            </div>
          </div>

          <!-- Нижний футер карточки с кнопкой-плашкой -->
          <div class="px-4 py-2.5 bg-[#182130] border-t border-[#2b394e] flex justify-between items-center">
            <span
              class="px-2.5 py-1 rounded-md bg-[#222e42] group-hover:bg-[#10a37f] text-[#cbd5e1] group-hover:text-white border border-[#364761] group-hover:border-[#10a37f] text-[11px] font-medium transition-colors flex items-center gap-1.5"
            >
              <i class="pi pi-table text-[10px]"></i>
              Открыть ТТК
            </span>
            <span
              class="px-2 py-0.5 rounded-full bg-[#151e29] border border-[#2b394e] text-[11px] font-mono text-[#64748b] group-hover:text-[#13b890] group-hover:border-[#10a37f]/40 transition-colors"
            >
              ID:{{ recipe.id }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Модальное окно ТТК в единой палитре 3x-ui -->
  <Dialog
    v-if="activeRecipe"
    :visible="!!activeRecipe"
    @update:visible="activeRecipe = null"
    modal
    :showHeader="false"
    class="w-11/12 max-w-4xl xui-dialog"
    contentClass="!p-0 !bg-[#1c2636] !border !border-[#2b394e] !rounded-xl overflow-hidden shadow-2xl"
  >
    <div
      id="print-area"
      class="bg-[#1c2636] text-[#e2e8f0]"
    >

      <!-- Шапка модального окна -->
      <div
        class="flex flex-wrap items-start justify-between gap-4 border-b border-[#2b394e] px-6 py-4 bg-[#182130] print-header"
      >
        <div>
          <div class="flex flex-wrap items-center gap-2 mb-1.5">
            <span
              class="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#10a37f]/15 text-[#13b890] border border-[#10a37f]/35 print-tag"
            >
              ТТК № {{ activeRecipe.recipe_number }}
            </span>
            <span
              v-if="activeRecipe.section"
              class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#6366f1]/15 text-[#a5b4fc] border border-[#6366f1]/35 print-tag"
            >
              {{ activeRecipe.section }}
            </span>
            <span
              class="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#222e42] text-[#94a3b8] border border-[#364761] no-print"
            >
              Колонок: {{ activeRecipe.variants?.length || 0 }}
            </span>
          </div>
          <h2 class="text-base sm:text-lg font-semibold text-white print-title">
            {{ activeRecipe.title }}
          </h2>
        </div>

        <div class="h-10 flex items-center gap-4 no-print shrink-0">
          <Button
            label="Печать ТТК"
            icon="pi pi-print"
            class="h-full xui-btn xui-btn-teal"
            @click="printCard"
          />
          <button
            type="button"
            @click="activeRecipe = null"
            class="px-3 h-full rounded-lg bg-[#222e42] hover:bg-[#ef4444]/20 border border-[#364761] hover:border-[#ef4444]/50 text-[#cbd5e1] hover:text-[#f87171] text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <i class="pi pi-times text-xs"></i>
            <span>Закрыть</span>
          </button>
        </div>
      </div>

      <div class="p-6">
        <!-- Таблица закладки сырья -->
        <div class="overflow-x-auto mb-6 rounded-xl border border-[#2b394e] bg-[#151e29] print-border">
          <table class="w-full border-collapse text-xs">
            <thead>
              <tr class="bg-[#222e42] text-white print-th">
                <th
                  rowspan="2"
                  class="border border-[#2b394e] px-3.5 py-2.5 text-left font-semibold print-border"
                >
                  Наименование сырья и продуктов
                </th>
                <th
                  v-for="v in activeRecipe.variants"
                  :key="v.id"
                  colspan="2"
                  class="border border-[#2b394e] px-2 py-2 text-center font-semibold print-border print-text"
                >
                  <span
                    class="px-2.5 py-0.5 rounded-full bg-[#10a37f]/15 text-[#13b890] border border-[#10a37f]/35 print-tag"
                  >
                    {{ v.category }} колонка
                  </span>
                </th>
              </tr>
              <tr class="bg-[#1c2636] text-[#8a99ad] print-th">
                <template
                  v-for="v in activeRecipe.variants"
                  :key="'sub-' + v.id"
                >
                  <th class="border border-[#2b394e] px-2 py-1.5 text-center w-20 font-medium print-border">Брутто, г
                  </th>
                  <th class="border border-[#2b394e] px-2 py-1.5 text-center w-20 font-medium print-border">Нетто, г
                  </th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, rIdx) in activeRows"
                :key="rIdx"
                :class="row.is_subtotal ? 'bg-[#222e42]/70 italic text-white font-medium' : 'hover:bg-[#1c2636]'"
                class="transition-colors"
              >
                <td class="border border-[#2b394e] px-3.5 py-2 print-border">
                  {{ row.name }}
                </td>
                <template
                  v-for="(cell, cIdx) in row.cells"
                  :key="cIdx"
                >
                  <td
                    class="border border-[#2b394e] px-2 py-2 text-center font-mono text-[#94a3b8] print-border print-text"
                  >
                    {{ cell.gross }}
                  </td>
                  <td
                    class="border border-[#2b394e] px-2 py-2 text-center font-mono text-white print-border print-text">
                    <span class="px-2 py-0.5 rounded bg-[#222e42] border border-[#364761]/60 print-tag">
                      {{ cell.net }}
                    </span>
                  </td>
                </template>
              </tr>
              <!-- Итоговая строка Выход -->
              <tr class="bg-[#182130] font-semibold print-th print-text">
                <td class="border border-[#2b394e] px-3.5 py-2.5 text-white print-border print-text">
                  Выход готового блюда
                </td>
                <template
                  v-for="v in activeRecipe.variants"
                  :key="'out-' + v.id"
                >
                  <td class="border border-[#2b394e] px-2 py-2.5 text-center font-mono text-[#64748b] print-border">—
                  </td>
                  <td class="border border-[#2b394e] px-2 py-2.5 text-center font-mono print-border">
                    <span
                      class="px-2.5 py-0.5 rounded-full bg-[#10a37f]/20 text-[#13b890] border border-[#10a37f]/40 print-tag"
                    >
                      {{ v.output_weight }}
                    </span>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Текстовые блоки ТТК -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-xs leading-relaxed">
          <div class="p-4 rounded-xl bg-[#151e29] border border-[#2b394e] print-box">
            <div class="mb-2">
              <span
                class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#10a37f]/15 text-[#13b890] border border-[#10a37f]/35 print-tag"
              >
                Технология приготовления
              </span>
            </div>
            <div class="whitespace-pre-line text-[#cbd5e1] print-text">
              {{ activeRecipe.technology }}
            </div>
          </div>

          <div class="p-4 rounded-xl bg-[#151e29] border border-[#2b394e] print-box">
            <div class="mb-2">
              <span
                class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#6366f1]/15 text-[#a5b4fc] border border-[#6366f1]/35 print-tag"
              >
                Требования к качеству
              </span>
            </div>
            <div class="whitespace-pre-line text-[#cbd5e1] print-text">
              {{ activeRecipe.quality_requirements }}
            </div>
          </div>
        </div>

        <!-- Таблица КБЖУ -->
        <div v-if="activeRecipe.nutrition.length">
          <div class="flex items-center gap-2 mb-2.5">
            <span
              class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#222e42] text-[#e2e8f0] border border-[#364761] print-tag"
            >
              Пищевая и энергетическая ценность (на выход блюда)
            </span>
          </div>
          <div class="overflow-x-auto rounded-xl border border-[#2b394e] bg-[#151e29] print-border">
            <table class="w-full border-collapse text-xs">
              <thead>
                <tr class="bg-[#222e42] text-[#cbd5e1] print-th">
                  <th class="border border-[#2b394e] px-3.5 py-2 text-left font-medium print-border">Вариант сырья</th>
                  <th class="border border-[#2b394e] px-2 py-2 text-center w-16 font-medium print-border">Кол.</th>
                  <th class="border border-[#2b394e] px-2 py-2 text-center w-20 font-medium print-border">Выход, г</th>
                  <th class="border border-[#2b394e] px-2 py-2 text-center w-20 font-medium print-border">Белки, г</th>
                  <th class="border border-[#2b394e] px-2 py-2 text-center w-20 font-medium print-border">Жиры, г</th>
                  <th class="border border-[#2b394e] px-2 py-2 text-center w-24 font-medium print-border">Углеводы, г
                  </th>
                  <th
                    class="border border-[#2b394e] px-2 py-2 text-center w-20 font-medium text-[#13b890] print-border print-text"
                  >Ккал</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="n in activeRecipe.nutrition"
                  :key="n.id"
                  class="hover:bg-[#1c2636] transition-colors"
                >
                  <td class="border border-[#2b394e] px-3.5 py-2 print-border">{{ n.variant_note || 'Основной вариант'
                  }}</td>
                  <td class="border border-[#2b394e] px-2 py-2 text-center font-mono print-border">
                    <span
                      class="px-2 py-0.5 rounded-full bg-[#222e42] text-[#94a3b8] border border-[#364761] print-tag">
                      {{ n.var_cat || '—' }}
                    </span>
                  </td>
                  <td class="border border-[#2b394e] px-2 py-2 text-center font-mono print-border">{{ n.output_weight ??
                    '—' }}
                  </td>
                  <td
                    class="border border-[#2b394e] px-2 py-2 text-center font-mono text-[#60a5fa] print-border print-text"
                  >{{
                    n.proteins_total ?? '—' }}</td>
                  <td
                    class="border border-[#2b394e] px-2 py-2 text-center font-mono text-[#fbbf24] print-border print-text"
                  >{{
                    n.fats_total ?? '—' }}</td>
                  <td
                    class="border border-[#2b394e] px-2 py-2 text-center font-mono text-[#c084fc] print-border print-text"
                  >{{
                    n.carbs_total ?? '—' }}</td>
                  <td class="border border-[#2b394e] px-2 py-2 text-center font-mono font-semibold print-border">
                    <span
                      class="px-2.5 py-0.5 rounded-full bg-[#10a37f]/20 text-[#13b890] border border-[#10a37f]/40 print-tag"
                    >
                      {{ n.calories ?? '—' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  </Dialog>
</template>

<style>
/* Инпуты и селекты в палитре 3x-ui */
.xui-input.p-inputtext,
.xui-select.p-select {
  background-color: #151e29 !important;
  border: 1px solid #2b394e !important;
  color: #e2e8f0 !important;
  border-radius: 8px !important;
  font-size: 0.8125rem !important;
  transition: all 0.2s !important;
}

.xui-input.p-inputtext::placeholder {
  color: #64748b !important;
}

.xui-input.p-inputtext:hover,
.xui-select.p-select:hover {
  border-color: #10a37f !important;
}

.xui-input.p-inputtext:focus,
.xui-select.p-select.p-focus {
  border-color: #10a37f !important;
  box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.22) !important;
}

/* Кнопки с выраженным фоном */
.xui-btn.p-button {
  border-radius: 8px !important;
  font-size: 0.8125rem !important;
  font-weight: 500 !important;
  padding: 0.5rem 0.95rem !important;
  transition: all 0.2s !important;
}

.xui-btn-teal.p-button {
  background-color: #10a37f !important;
  border: 1px solid #13b890 !important;
  color: #ffffff !important;
  box-shadow: 0 2px 8px rgba(16, 163, 127, 0.25) !important;
}

.xui-btn-teal.p-button:hover {
  background-color: #13b890 !important;
  border-color: #34d399 !important;
}

.xui-btn-slate.p-button {
  background-color: #222e42 !important;
  border: 1px solid #364761 !important;
  color: #e2e8f0 !important;
}

.xui-btn-slate.p-button:hover {
  background-color: #2b394e !important;
  border-color: #10a37f !important;
  color: #13b890 !important;
}

.xui-btn-danger.p-button {
  background-color: rgba(239, 68, 68, 0.15) !important;
  border: 1px solid rgba(239, 68, 68, 0.4) !important;
  color: #f87171 !important;
}

.xui-btn-danger.p-button:hover {
  background-color: rgba(239, 68, 68, 0.25) !important;
  border-color: #ef4444 !important;
}

/* Выпадающая панель Select */
.p-select-overlay {
  background-color: #1c2636 !important;
  border: 1px solid #2b394e !important;
  color: #e2e8f0 !important;
  border-radius: 8px !important;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.45) !important;
}

.p-select-option {
  color: #cbd5e1 !important;
  font-size: 0.8125rem !important;
}

.p-select-option:hover,
.p-select-option.p-focus {
  background-color: #222e42 !important;
  color: #ffffff !important;
}

.p-select-option.p-select-option-selected {
  background-color: rgba(16, 163, 127, 0.2) !important;
  color: #13b890 !important;
}

/* Адаптация под печать (строгий белый лист) */
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm;
  }

  html,
  body {
    background: #ffffff !important;
    color: #000000 !important;
    height: auto !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* Скрываем основной интерфейс и лишние элементы */
  .no-print,
  .p-toast,
  .p-select-overlay {
    display: none !important;
  }

  /* Сбрасываем flex-центрирование и скролл модального окна PrimeVue */
  .p-dialog-mask {
    position: static !important;
    display: block !important;
    background: transparent !important;
    padding: 0 !important;
    margin: 0 !important;
    height: auto !important;
    overflow: visible !important;
  }

  .xui-dialog.p-dialog {
    position: static !important;
    width: 100% !important;
    max-width: 100% !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
    transform: none !important;
  }

  .xui-dialog .p-dialog-content {
    background: #ffffff !important;
    border: none !important;
    padding: 0 !important;
    overflow: visible !important;
  }

  /* Область печати в нормальном потоке документа */
  #print-area {
    position: static !important;
    width: 100% !important;
    background: #ffffff !important;
    color: #000000 !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  .print-header {
    background: #ffffff !important;
    border-bottom: 2px solid #000000 !important;
    padding: 0 0 10px 0 !important;
    margin: 12px !important;
  }

  .print-title,
  .print-text {
    color: #000000 !important;
  }

  .print-tag {
    background: transparent !important;
    border: none !important;
    color: #000000 !important;
    padding: 0 !important;
  }

  /* Запрещаем разрыв таблиц и текстовых блоков посередине */
  table {
    page-break-inside: auto !important;
    break-inside: auto !important;
  }

  tr,
  .print-box {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  thead {
    display: table-header-group !important;
  }

  .print-border {
    border-color: #1f2937 !important;
    border-radius: 0 !important;
  }

  .print-th {
    background: #f3f4f6 !important;
    color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .print-box {
    background: #ffffff !important;
    border: 1px solid #9ca3af !important;
    border-radius: 4px !important;
    padding: 10px !important;
  }
}
</style>
