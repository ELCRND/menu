<script setup>
import { ref, onMounted } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import ConfirmDialog from 'primevue/confirmdialog'
import { useMenuBuilder } from '@/composables/useMenuBuilder'

import MenuTopBar from './MenuTopBar.vue'
import DailyNutritionBar from './DailyNutritionBar.vue'
import MealTimeCard from './MealTimeCard.vue'
import AddDishModal from './modals/AddDishModal.vue'
import EditDishModal from './modals/EditDishModal.vue'
import CopyDayModal from './modals/CopyDayModal.vue'
import MealTimesSettingsModal from './modals/MealTimesSettingsModal.vue'
import TemplateFormModal from './modals/TemplateFormModal.vue'

const confirm = useConfirm()

const {
    templates, diets, mealTimes, recipes,
    selectedTemplateId, selectedDietId, selectedDay,
    currentTemplate, currentDiet, dietItems, dailyNutrition,
    getItemsByMeal, initDictionaries,
    createTemplate, renameTemplate, deleteTemplate,
    addDish, updateDish, removeDish, moveDish,
    copyDay, clearDay, saveDietTargets,
    addMealTime, renameMealTime, moveMealTime, removeMealTime
} = useMenuBuilder()

onMounted(initDictionaries)

// modals
const modals = ref({
    addDish: false,
    editDish: false,
    copyDay: false,
    mealTimes: false,
    templateForm: false
})

// ___прием_пищи___ -id"
const activeMealTimeId = ref(null)
// ___блюдо___
const editingItem = ref(null)
//  ___типовое_меню___ -состояние модалки
const templateModalMode = ref('create') // 'create' | 'rename'

// ___блюдо___ -добавить
function handleOpenAddDish(mealTimeId) {
    activeMealTimeId.value = mealTimeId
    modals.value.addDish = true
}
// ___блюдо___ -редактировать
function handleOpenEditDish(item) {
    editingItem.value = item
    modals.value.editDish = true
}

//  ___типовое_меню___ -открыть
function handleOpenTemplateModal(mode) {
    templateModalMode.value = mode
    modals.value.templateForm = true
}

// ___типовое_меню___ -подтверждение удаления через ConfirmDialog
function confirmDeleteTemplate() {
    if (!currentTemplate.value) return
    confirm.require({
        header: 'Подтверждение удаления',
        message: `Удалить шаблон «${currentTemplate.value.name}»? Все назначенные блюда в этом шаблоне будут удалены безвозвратно.`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Да, удалить',
        rejectLabel: 'Отмена',
        acceptClass: 'xui-btn xui-btn-danger',
        rejectClass: 'xui-btn xui-btn-slate',
        accept: () => deleteTemplate(currentTemplate.value.id)
    })
}

// ___день___ -подтверждение удаления через ConfirmDialog
function confirmClearDay() {
    if (!currentDiet.value) return
    confirm.require({
        header: 'Очистка рациона дня',
        message: `Удалить все блюда (${dietItems.value.length} шт.) из Дня ${selectedDay.value} для стола ${currentDiet.value.code}?`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Да, очистить',
        rejectLabel: 'Отмена',
        acceptClass: 'xui-btn xui-btn-danger',
        rejectClass: 'xui-btn xui-btn-slate',
        accept: clearDay
    })
}
</script>

<template>
    <div class="max-w-7xl mx-auto p-4 sm:p-6">
        <!-- Подтверждение удаления -->
        <ConfirmDialog />

        <!-- Верхняя панель + КБЖУ -->
        <div class="bg-[#1c2636] border border-[#2b394e] rounded-xl p-4 mb-5 shadow-lg">
            <MenuTopBar
                v-model:templateId="selectedTemplateId"
                v-model:dietId="selectedDietId"
                v-model:day="selectedDay"
                :templates="templates"
                :diets="diets"
                :currentTemplate="currentTemplate"
                :currentDiet="currentDiet"
                :hasItems="dietItems.length > 0"
                @create-template="handleOpenTemplateModal('create')"
                @rename-template="handleOpenTemplateModal('rename')"
                @delete-template="confirmDeleteTemplate"
                @copy-day="modals.copyDay = true"
                @clear-day="confirmClearDay"
                @manage-meal-times="modals.mealTimes = true"
            />

            <DailyNutritionBar
                v-if="currentDiet"
                :diet="currentDiet"
                :actual="dailyNutrition"
                @save-targets="saveDietTargets"
            />
        </div>

        <!-- Сетка приемов пищи -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MealTimeCard
                v-for="meal in mealTimes"
                :key="meal.id"
                :meal="meal"
                :items="getItemsByMeal(meal.id)"
                @add="handleOpenAddDish(meal.id)"
                @edit="handleOpenEditDish"
                @remove="removeDish"
                @move="(idx, dir) => moveDish(meal.id, idx, dir)"
            />
        </div>

        <!-- Модалки -->
        <AddDishModal
            v-model:visible="modals.addDish"
            :recipes="recipes"
            :defaultCategory="currentDiet?.default_category"
            @confirm="(payload) => addDish({ meal_time_id: activeMealTimeId, ...payload })"
        />

        <EditDishModal
            v-model:visible="modals.editDish"
            :item="editingItem"
            :recipes="recipes"
            @confirm="(payload) => updateDish(editingItem.id, payload)"
        />

        <CopyDayModal
            v-model:visible="modals.copyDay"
            :template="currentTemplate"
            :diets="diets"
            :sourceDiet="currentDiet"
            :sourceDay="selectedDay"
            :itemsCount="dietItems.length"
            @confirm="copyDay"
        />

        <TemplateFormModal
            v-model:visible="modals.templateForm"
            :mode="templateModalMode"
            :templates="templates"
            :currentTemplate="currentTemplate"
            @create="createTemplate"
            @rename="(name) => renameTemplate(currentTemplate.id, name)"
        />

        <MealTimesSettingsModal
            v-model:visible="modals.mealTimes"
            :mealTimes="mealTimes"
            @add="addMealTime"
            @rename="renameMealTime"
            @move="moveMealTime"
            @remove="removeMealTime"
        />
    </div>
</template>
