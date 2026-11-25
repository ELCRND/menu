<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

// Справочники и данные
const templates = ref([])
const diets = ref([])
const mealTimes = ref([])
const recipes = ref([])
const templateItems = ref([])

// Текущий выбор пользователя
const selectedTemplateId = ref(null)
const selectedDietId = ref(null)
const selectedDay = ref(1)

// Состояние модального окна редактирования блюда
const editModalVisible = ref(false)
const editingItem = ref(null)
const editVariantId = ref(null)
const editOutputGrams = ref(0)

// Состояние модального окна добавления блюда
const addModalVisible = ref(false)
const targetMealTimeId = ref(null)
const recipeSearch = ref('')
const chosenRecipe = ref(null)
const chosenVariantId = ref(null)
const portionMultiplier = ref(1.0)

// Находим полный объект рецепта из справочника для редактируемой позиции
const editingRecipeObj = computed(() => {
    if (!editingItem.value) return null
    return recipes.value.find(r => r.id === editingItem.value.recipe_id)
})

const editingVariantObj = computed(() => {
    if (!editingRecipeObj.value || !editVariantId.value) return null
    return editingRecipeObj.value.variants.find(v => v.id === editVariantId.value)
})

// При смене колонки в окне редактирования подставляем её базовый выход
watch(editVariantId, (newVarId, oldVarId) => {
    if (!oldVarId || !editingVariantObj.value) return
    editOutputGrams.value = editingVariantObj.value.output_weight
})

function openEditModal(item) {
    editingItem.value = item
    editVariantId.value = item.variant_id
    editOutputGrams.value = Math.round((item.output_weight || 0) * (item.portion_multiplier || 1))
    editModalVisible.value = true
}

async function saveEditedDish() {
    if (!editingItem.value || !editingVariantObj.value) return
    const baseWeight = editingVariantObj.value.output_weight || 1
    const newMultiplier = editOutputGrams.value / baseWeight

    await fetch(`/api/menu/templates/items/${editingItem.value.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            variant_id: editVariantId.value,
            portion_multiplier: newMultiplier
        })
    })

    editModalVisible.value = false
    await loadTemplateItems()
}

// Перемещение блюда вверх (-1) или вниз (+1) внутри приема пищи
async function moveDish(mealTimeId, index, direction) {
    const mealItems = [...getItemsByMeal(mealTimeId)]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= mealItems.length) return

    // Меняем элементы местами в массиве
    const temp = mealItems[index]
    mealItems[index] = mealItems[targetIndex]
    mealItems[targetIndex] = temp

    const orderedIds = mealItems.map(i => i.id)

    await fetch('/api/menu/templates/items/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds })
    })

    await loadTemplateItems()
}

onMounted(async () => {
    const [dictRes, recRes] = await Promise.all([
        fetch('/api/menu/dictionaries'),
        fetch('/api/recipes')
    ])
    const dict = await dictRes.json()
    templates.value = dict.templates
    diets.value = dict.diets
    mealTimes.value = dict.mealTimes
    recipes.value = await recRes.json()

    if (templates.value.length) selectedTemplateId.value = templates.value[0].id
    if (diets.value.length) selectedDietId.value = diets.value[0].id
})

// Загружаем позиции шаблона при смене шаблона или дня
async function loadTemplateItems() {
    if (!selectedTemplateId.value) return
    const res = await fetch(`/api/menu/templates/${selectedTemplateId.value}?day=${selectedDay.value}`)
    templateItems.value = await res.json()

}

watch([selectedTemplateId, selectedDay], loadTemplateItems)

const currentTemplate = computed(() =>
    templates.value.find(t => t.id === selectedTemplateId.value)
)

const currentDiet = computed(() =>
    diets.value.find(d => d.id === selectedDietId.value)
)

// Блюда только для выбранного стола на текущий день
const dietItems = computed(() =>
    templateItems.value.filter(item => item.diet_id === selectedDietId.value)
)

// Группировка блюд по приемам пищи
function getItemsByMeal(mealTimeId) {
    return dietItems.value.filter(i => i.meal_time_id === mealTimeId)
}



// Суммарный КБЖУ за весь день по выбранному столу
const dailyNutrition = computed(() => {
    return dietItems.value.reduce(
        (acc, item) => {
            const m = item.portion_multiplier || 1
            acc.calories += (item.calories || 0) * m
            acc.proteins += (item.proteins_total || 0) * m
            acc.fats += (item.fats_total || 0) * m
            acc.carbs += (item.carbs_total || 0) * m
            return acc
        },
        { calories: 0, proteins: 0, fats: 0, carbs: 0 }
    )
})

// Открыть окно добавления блюда в конкретный прием пищи
function openAddModal(mealTimeId) {
    targetMealTimeId.value = mealTimeId
    recipeSearch.value = ''
    chosenRecipe.value = null
    chosenVariantId.value = null
    portionMultiplier.value = 1.0
    addModalVisible.value = true
}

const filteredRecipesForModal = computed(() => {
    const q = recipeSearch.value.toLowerCase().trim()
    if (!q) return recipes.value.slice(0, 30)
    return recipes.value.filter(
        r => r.title.toLowerCase().includes(q) || String(r.recipe_number) === q
    )
})

// При выборе рецепта автоматически подставляем колонку по умолчанию из настроек диеты
function selectRecipeForAdd(recipe) {
    chosenRecipe.value = recipe
    const defCat = currentDiet.value?.default_category
    const match = recipe.variants.find(v => v.category === defCat) || recipe.variants[0]
    chosenVariantId.value = match ? match.id : null
}

async function confirmAddDish() {
    if (!chosenRecipe.value || !chosenVariantId.value) return

    await fetch(`/api/menu/templates/${selectedTemplateId.value}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            day_number: selectedDay.value,
            diet_id: selectedDietId.value,
            meal_time_id: targetMealTimeId.value,
            recipe_id: chosenRecipe.value.id,
            variant_id: chosenVariantId.value,
            portion_multiplier: calculatedMultiplier.value
        })
    })

    addModalVisible.value = false
    await loadTemplateItems()
}

async function removeDish(itemId) {
    await fetch(`/api/menu/templates/items/${itemId}`, { method: 'DELETE' })
    await loadTemplateItems()
}

// Целевой выход в граммах (редактируемое поле в модальном окне)
const customOutputGrams = ref(0)

// Находим выбранный вариант (колонку) блюда
const selectedVariantObj = computed(() => {
    if (!chosenRecipe.value || !chosenVariantId.value) return null
    return chosenRecipe.value.variants.find(v => v.id === chosenVariantId.value)
})

// При выборе рецепта или смене колонки ТТК подставляем её стандартный выход
watch(selectedVariantObj, (newVar) => {
    if (newVar && newVar.output_weight) {
        customOutputGrams.value = newVar.output_weight
    }
})

// Вычисляем точный коэффициент для сохранения в БД
const calculatedMultiplier = computed(() => {
    const base = selectedVariantObj.value?.output_weight
    if (!base || !customOutputGrams.value) return 1.0
    return customOutputGrams.value / base
})

const isEditingTargets = ref(false)
const targetsForm = ref({
    target_calories: 0,
    target_proteins: 0,
    target_fats: 0,
    target_carbs: 0
})

function startEditTargets() {
    if (!currentDiet.value) return
    targetsForm.value = {
        target_calories: currentDiet.value.target_calories || 0,
        target_proteins: currentDiet.value.target_proteins || 0,
        target_fats: currentDiet.value.target_fats || 0,
        target_carbs: currentDiet.value.target_carbs || 0
    }
    isEditingTargets.value = true
}

async function saveTargets() {
    if (!currentDiet.value) return
    const dietId = currentDiet.value.id

    await fetch(`/api/menu/diets/${dietId}/targets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetsForm.value)
    })

    // Обновляем локальный объект диеты, чтобы цифры сразу изменились без перезагрузки
    Object.assign(currentDiet.value, targetsForm.value)
    isEditingTargets.value = false
}

// Процент выполнения нормы (ограничиваем ширину полоски до 100%, чтобы не вылезала за карточку)
function getProgressWidth(actual, target) {
    if (!target || target <= 0) return '0%'
    const pct = (actual / target) * 100
    return `${Math.min(100, Math.round(pct))}%`
}

// Цвет полоски: красный при переборе (>105%), основной цвет карточки — в пределах нормы
function getProgressColor(actual, target, defaultBgClass) {
    if (!target || target <= 0) return defaultBgClass
    const pct = (actual / target) * 100
    if (pct > 105) return 'bg-[#ef4444]' // перебор нормы
    return defaultBgClass
}


</script>

<template>
    <div class="max-w-7xl mx-auto p-4 sm:p-6">
        <!-- Верхняя панель управления шаблоном и диетой -->
        <div class="bg-[#1c2636] border border-[#2b394e] rounded-xl p-4 mb-5 shadow-lg">
            <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div class="flex flex-wrap items-center gap-3">
                    <Select
                        v-model="selectedTemplateId"
                        :options="templates"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Выберите шаблон меню"
                        class="w-72 xui-select"
                    />

                    <Select
                        v-model="selectedDietId"
                        :options="diets"
                        optionValue="id"
                        placeholder="Выберите стол"
                        class="w-64 xui-select"
                    >
                        <template #value="{ value }">
                            <span
                                v-if="currentDiet"
                                class="font-semibold text-[#13b890]"
                            >
                                {{ currentDiet.code }} — {{ currentDiet.name }}
                            </span>
                        </template>
                        <template #option="{ option }">
                            <div>
                                <span class="font-mono font-bold text-[#13b890]">{{ option.code }}</span>
                                <span class="ml-2 text-xs text-[#94a3b8]">{{ option.name }}</span>
                            </div>
                        </template>
                    </Select>
                </div>

                <!-- Переключатель дней цикла -->
                <div
                    v-if="currentTemplate"
                    class="flex items-center gap-1.5 flex-wrap"
                >
                    <span class="text-xs text-[#8a99ad] mr-1">День цикла:</span>
                    <button
                        v-for="day in currentTemplate.days_count"
                        :key="day"
                        type="button"
                        @click="selectedDay = day"
                        class="w-8 h-8 rounded-lg font-mono text-xs font-semibold border transition-all cursor-pointer"
                        :class="selectedDay === day
                            ? 'bg-[#10a37f] border-[#13b890] text-white shadow-sm'
                            : 'bg-[#151e29] border-[#2b394e] text-[#94a3b8] hover:border-[#10a37f]'"
                    >
                        {{ day }}
                    </button>
                </div>
            </div>

            <!-- Сводная панель КБЖУ за день с редактируемыми нормами -->
            <div
                v-if="currentDiet"
                class="pt-3 border-t border-[#2b394e]"
            >
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[11px] text-[#8a99ad]">
                        Суточный баланс рационов (нажмите на норму для изменения):
                    </span>
                    <div class="flex items-center gap-2">
                        <button
                            v-if="!isEditingTargets"
                            type="button"
                            @click="startEditTargets"
                            class="text-[11px] text-[#13b890] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                            <i class="pi pi-pencil text-[10px]"></i>
                            <span>Изменить нормы</span>
                        </button>
                        <template v-else>
                            <button
                                type="button"
                                @click="saveTargets"
                                class="px-2 py-0.5 rounded bg-[#10a37f] text-white text-[11px] font-medium cursor-pointer"
                            >
                                Сохранить
                            </button>
                            <button
                                type="button"
                                @click="isEditingTargets = false"
                                class="px-2 py-0.5 rounded bg-[#222e42] text-[#cbd5e1] text-[11px] cursor-pointer"
                            >
                                Отмена
                            </button>
                        </template>
                    </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <!-- Калорийность -->
                    <div
                        @click="!isEditingTargets && startEditTargets()"
                        class="relative overflow-hidden bg-[#151e29] border border-[#2b394e] hover:border-[#364761] rounded-lg px-3 py-2.5 flex justify-between items-center cursor-pointer transition-colors"
                    >
                        <span class="text-[#8a99ad]">Калорийность:</span>
                        <div class="font-mono font-semibold text-[#13b890] flex items-center gap-1">
                            <span>{{ Math.round(dailyNutrition.calories) }} /</span>
                            <input
                                v-if="isEditingTargets"
                                type="number"
                                v-model.number="targetsForm.target_calories"
                                @click.stop
                                @keyup.enter="saveTargets"
                                class="w-16 h-6 px-1.5 rounded bg-[#1c2636] border border-[#10a37f] text-white text-right text-xs outline-none"
                            />
                            <span v-else>{{ currentDiet.target_calories }}</span>
                            <span>ккал</span>
                        </div>
                        <!-- Прогресс-бар -->
                        <div class="absolute bottom-0 left-0 right-0 h-1 bg-[#1c2636]">
                            <div
                                class="h-full transition-all duration-300"
                                :class="getProgressColor(dailyNutrition.calories, currentDiet.target_calories, 'bg-[#10a37f]')"
                                :style="{ width: getProgressWidth(dailyNutrition.calories, currentDiet.target_calories) }"
                            ></div>
                        </div>
                    </div>

                    <!-- Белки -->
                    <div
                        @click="!isEditingTargets && startEditTargets()"
                        class="relative overflow-hidden bg-[#151e29] border border-[#2b394e] hover:border-[#364761] rounded-lg px-3 py-2.5 flex justify-between items-center cursor-pointer transition-colors"
                    >
                        <span class="text-[#8a99ad]">Белки:</span>
                        <div class="font-mono font-semibold text-[#60a5fa] flex items-center gap-1">
                            <span>{{ dailyNutrition.proteins.toFixed(1) }} /</span>
                            <input
                                v-if="isEditingTargets"
                                type="number"
                                step="0.5"
                                v-model.number="targetsForm.target_proteins"
                                @click.stop
                                @keyup.enter="saveTargets"
                                class="w-14 h-6 px-1.5 rounded bg-[#1c2636] border border-[#10a37f] text-white text-right text-xs outline-none"
                            />
                            <span v-else>{{ currentDiet.target_proteins }}</span>
                            <span>г</span>
                        </div>
                        <!-- Прогресс-бар -->
                        <div class="absolute bottom-0 left-0 right-0 h-1 bg-[#1c2636]">
                            <div
                                class="h-full transition-all duration-300"
                                :class="getProgressColor(dailyNutrition.proteins, currentDiet.target_proteins, 'bg-[#3b82f6]')"
                                :style="{ width: getProgressWidth(dailyNutrition.proteins, currentDiet.target_proteins) }"
                            ></div>
                        </div>
                    </div>

                    <!-- Жиры -->
                    <div
                        @click="!isEditingTargets && startEditTargets()"
                        class="relative overflow-hidden bg-[#151e29] border border-[#2b394e] hover:border-[#364761] rounded-lg px-3 py-2.5 flex justify-between items-center cursor-pointer transition-colors"
                    >
                        <span class="text-[#8a99ad]">Жиры:</span>
                        <div class="font-mono font-semibold text-[#fbbf24] flex items-center gap-1">
                            <span>{{ dailyNutrition.fats.toFixed(1) }} /</span>
                            <input
                                v-if="isEditingTargets"
                                type="number"
                                step="0.5"
                                v-model.number="targetsForm.target_fats"
                                @click.stop
                                @keyup.enter="saveTargets"
                                class="w-14 h-6 px-1.5 rounded bg-[#1c2636] border border-[#10a37f] text-white text-right text-xs outline-none"
                            />
                            <span v-else>{{ currentDiet.target_fats }}</span>
                            <span>г</span>
                        </div>
                        <!-- Прогресс-бар -->
                        <div class="absolute bottom-0 left-0 right-0 h-1 bg-[#1c2636]">
                            <div
                                class="h-full transition-all duration-300"
                                :class="getProgressColor(dailyNutrition.fats, currentDiet.target_fats, 'bg-[#f59e0b]')"
                                :style="{ width: getProgressWidth(dailyNutrition.fats, currentDiet.target_fats) }"
                            ></div>
                        </div>
                    </div>

                    <!-- Углеводы -->
                    <div
                        @click="!isEditingTargets && startEditTargets()"
                        class="relative overflow-hidden bg-[#151e29] border border-[#2b394e] hover:border-[#364761] rounded-lg px-3 py-2.5 flex justify-between items-center cursor-pointer transition-colors"
                    >
                        <span class="text-[#8a99ad]">Углеводы:</span>
                        <div class="font-mono font-semibold text-[#c084fc] flex items-center gap-1">
                            <span>{{ dailyNutrition.carbs.toFixed(1) }} /</span>
                            <input
                                v-if="isEditingTargets"
                                type="number"
                                step="0.5"
                                v-model.number="targetsForm.target_carbs"
                                @click.stop
                                @keyup.enter="saveTargets"
                                class="w-16 h-6 px-1.5 rounded bg-[#1c2636] border border-[#10a37f] text-white text-right text-xs outline-none"
                            />
                            <span v-else>{{ currentDiet.target_carbs }}</span>
                            <span>г</span>
                        </div>
                        <!-- Прогресс-бар -->
                        <div class="absolute bottom-0 left-0 right-0 h-1 bg-[#1c2636]">
                            <div
                                class="h-full transition-all duration-300"
                                :class="getProgressColor(dailyNutrition.carbs, currentDiet.target_carbs, 'bg-[#a855f7]')"
                                :style="{ width: getProgressWidth(dailyNutrition.carbs, currentDiet.target_carbs) }"
                            ></div>
                        </div>
                    </div>
                </div>

            </div>
        </div>

        <!-- Сетка приемов пищи -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
                v-for="meal in mealTimes"
                :key="meal.id"
                class="bg-[#1c2636] border border-[#2b394e] rounded-xl overflow-hidden flex flex-col justify-between shadow-md"
            >
                <div>
                    <div class="px-4 py-3 bg-[#182130] border-b border-[#2b394e] flex items-center justify-between">
                        <span class="font-semibold text-sm text-white">{{ meal.name }}</span>
                        <Button
                            label="Добавить блюдо"
                            icon="pi pi-plus"
                            class="xui-btn xui-btn-teal !py-1 !px-2.5 !text-xs"
                            @click="openAddModal(meal.id)"
                        />
                    </div>

                    <div class="p-3 space-y-2">
                        <div
                            v-if="!getItemsByMeal(meal.id).length"
                            class="text-center py-6 text-xs text-[#64748b] border border-dashed border-[#2b394e] rounded-lg"
                        >
                            Блюда не назначены
                        </div>

                        <div
                            v-for="(item, idx) in getItemsByMeal(meal.id)"
                            :key="item.id"
                            class="p-2.5 rounded-lg bg-[#151e29] border border-[#2b394e] flex items-center justify-between gap-2 hover:border-[#364761]"
                        >

                            <!-- Информация о блюде -->
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <span
                                        class="px-2 py-0.5 rounded bg-[#10a37f]/15 text-[#13b890] font-mono text-[11px] font-semibold"
                                    >
                                        № {{ item.recipe_number }}
                                    </span>
                                    <span class="text-xs font-medium text-white truncate">
                                        {{ item.recipe_title }}
                                    </span>
                                </div>
                                <div class="flex flex-wrap items-center gap-2 text-[11px] text-[#8a99ad] font-mono">
                                    <span>Кол: {{ item.variant_category }}</span>
                                    <span>·</span>
                                    <span class="text-[#cbd5e1]">
                                        Выход: {{ Math.round((item.output_weight || 0) * item.portion_multiplier) }} г
                                    </span>
                                    <span>·</span>
                                    <span>{{ Math.round((item.calories || 0) * item.portion_multiplier) }} ккал</span>
                                </div>
                            </div>

                            <!-- Кнопки изменения позиции (Вверх / Вниз) -->
                            <div class="flex flex-col gap-0.5 shrink-0 mr-10">
                                <button
                                    type="button"
                                    :disabled="idx === 0"
                                    @click="moveDish(meal.id, idx, -1)"
                                    title="Поднять выше"
                                    class="w-5 h-5 rounded bg-[#1c2636] hover:bg-[#222e42] disabled:opacity-50 text-[#8a99ad] hover:text-white flex items-center justify-center cursor-pointer disabled:cursor-default"
                                >
                                    <i class="pi pi-chevron-up text-[9px]"></i>
                                </button>
                                <button
                                    type="button"
                                    :disabled="idx === getItemsByMeal(meal.id).length - 1"
                                    @click="moveDish(meal.id, idx, 1)"
                                    title="Опустить ниже"
                                    class="w-5 h-5 rounded bg-[#1c2636] hover:bg-[#222e42] disabled:opacity-50 text-[#8a99ad] hover:text-white flex items-center justify-center cursor-pointer disabled:cursor-default"
                                >
                                    <i class="pi pi-chevron-down text-[9px]"></i>
                                </button>
                            </div>


                            <!-- Кнопки редактирования и удаления -->
                            <div class="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    @click="openEditModal(item)"
                                    title="Изменить колонку или граммовку"
                                    class="w-7 h-7 rounded-lg bg-[#222e42] hover:bg-[#10a37f]/20 text-[#8a99ad] hover:text-[#13b890] border border-[#364761] flex items-center justify-center cursor-pointer transition-colors"
                                >
                                    <i class="pi pi-pencil text-xs"></i>
                                </button>
                                <button
                                    type="button"
                                    @click="removeDish(item.id)"
                                    title="Убрать блюдо"
                                    class="w-7 h-7 rounded-lg bg-[#222e42] hover:bg-[#ef4444]/20 text-[#8a99ad] hover:text-[#f87171] border border-[#364761] flex items-center justify-center cursor-pointer transition-colors"
                                >
                                    <i class="pi pi-trash text-xs"></i>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>

        <!-- Модальное окно добавления блюда из картотеки -->
        <Dialog
            v-model:visible="addModalVisible"
            modal
            header="Выбор блюда из картотеки ТТК"
            class="w-11/12 max-w-2xl xui-dialog"
            contentClass="!bg-[#1c2636] !text-[#e2e8f0]"
        >
            <div class="space-y-4 pt-2">
                <InputText
                    v-model="recipeSearch"
                    placeholder="Введите номер рецепта или название блюда..."
                    class="w-full xui-input"
                />

                <!-- Список найденных рецептов -->
                <div class="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    <div
                        v-for="rec in filteredRecipesForModal"
                        :key="rec.id"
                        @click="selectRecipeForAdd(rec)"
                        class="p-2.5 rounded-lg border cursor-pointer flex items-center justify-between transition-colors"
                        :class="chosenRecipe?.id === rec.id
                            ? 'bg-[#10a37f]/15 border-[#10a37f] text-white'
                            : 'bg-[#151e29] border-[#2b394e] text-[#cbd5e1] hover:border-[#364761]'"
                    >
                        <div class="flex items-center gap-2.5 min-w-0">
                            <span class="font-mono text-xs text-[#13b890] font-semibold">№{{ rec.recipe_number }}</span>
                            <span class="text-xs truncate">{{ rec.title }}</span>
                        </div>
                        <span class="text-[11px] text-[#8a99ad] shrink-0">{{ rec.section }}</span>
                    </div>
                </div>

                <!-- Выбор колонки ТТК и коэффициента порции -->
                <div
                    v-if="chosenRecipe"
                    class="p-3.5 rounded-xl bg-[#151e29] border border-[#2b394e] space-y-3"
                >
                    <div class="text-xs font-semibold text-white">
                        Параметры закладки для: <span class="text-[#13b890]">{{ chosenRecipe.title }}</span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-[11px] text-[#8a99ad] mb-1">Колонка ТТК (выход):</label>
                            <Select
                                v-model="chosenVariantId"
                                :options="chosenRecipe.variants"
                                optionValue="id"
                                class="w-full xui-select"
                            >
                                <template #option="{ option }">
                                    <span>{{ option.category }} колонка — {{ option.output_weight }} г</span>
                                </template>
                                <template #value="{ value }">
                                    <span v-if="chosenRecipe.variants.find(v => v.id === value)">
                                        {{chosenRecipe.variants.find(v => v.id === value).category}} колонка —
                                        {{chosenRecipe.variants.find(v => v.id === value).output_weight}} г
                                    </span>
                                </template>
                            </Select>
                        </div>

                        <div>
                            <label class="block text-[11px] text-[#8a99ad] mb-1">
                                Выход порции, г (база: {{ selectedVariantObj?.output_weight || 0 }} г):
                            </label>
                            <div class="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    v-model.number="customOutputGrams"
                                    @focus="$event.target.select()"
                                    class="w-full h-8.5 px-3 rounded-lg bg-[#1c2636] border border-[#2b394e] text-white font-mono text-sm focus:border-[#10a37f] outline-none"
                                />

                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end gap-2 pt-2">
                        <Button
                            label="Отмена"
                            class="xui-btn xui-btn-slate"
                            @click="addModalVisible = false"
                        />
                        <Button
                            label="Добавить в меню"
                            icon="pi pi-check"
                            class="xui-btn xui-btn-teal"
                            @click="confirmAddDish"
                        />
                    </div>
                </div>
            </div>
        </Dialog>

        <!-- Модальное окно редактирования позиции -->
        <Dialog
            v-model:visible="editModalVisible"
            modal
            header="Редактирование порции блюда"
            class="w-11/12 max-w-md xui-dialog"
            contentClass="!bg-[#1c2636] !text-[#e2e8f0]"
        >
            <div
                v-if="editingRecipeObj"
                class="space-y-4 pt-2"
            >
                <div class="text-xs font-semibold text-white">
                    №{{ editingRecipeObj.recipe_number }} {{ editingRecipeObj.title }}
                </div>

                <div>
                    <label class="block text-[11px] text-[#8a99ad] mb-1">Колонка ТТК:</label>
                    <Select
                        v-model="editVariantId"
                        :options="editingRecipeObj.variants"
                        optionValue="id"
                        class="w-full xui-select"
                    >
                        <template #option="{ option }">
                            <span>{{ option.category }} колонка — {{ option.output_weight }} г</span>
                        </template>
                        <template #value="{ value }">
                            <span v-if="editingRecipeObj.variants.find(v => v.id === value)">
                                {{editingRecipeObj.variants.find(v => v.id === value).category}} колонка —
                                {{editingRecipeObj.variants.find(v => v.id === value).output_weight}} г
                            </span>
                        </template>
                    </Select>
                </div>

                <div>
                    <label class="block text-[11px] text-[#8a99ad] mb-1">
                        Выход порции, г (база: {{ editingVariantObj?.output_weight || 0 }} г):
                    </label>
                    <input
                        type="number"
                        min="1"
                        v-model.number="editOutputGrams"
                        @focus="$event.target.select()"
                        @keyup.enter="saveEditedDish"
                        class="w-full h-10 px-3 rounded-lg bg-[#151e29] border border-[#2b394e] text-white font-mono text-sm focus:border-[#10a37f] outline-none"
                    />
                </div>

                <div class="flex justify-end gap-2 pt-2">
                    <Button
                        label="Отмена"
                        class="xui-btn xui-btn-slate"
                        @click="editModalVisible = false"
                    />
                    <Button
                        label="Сохранить"
                        icon="pi pi-check"
                        class="xui-btn xui-btn-teal"
                        @click="saveEditedDish"
                    />
                </div>
            </div>
        </Dialog>

    </div>
</template>
