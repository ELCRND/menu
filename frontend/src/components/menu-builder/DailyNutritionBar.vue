<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
    diet: { type: Object, required: true },
    actual: { type: Object, required: true }
})

const emit = defineEmits(['save-targets'])

const isEditing = ref(false)
const form = ref({
    target_calories: 0,
    target_proteins: 0,
    target_fats: 0,
    target_carbs: 0
})

function startEdit() {
    form.value = {
        target_calories: props.diet.target_calories || 0,
        target_proteins: props.diet.target_proteins || 0,
        target_fats: props.diet.target_fats || 0,
        target_carbs: props.diet.target_carbs || 0
    }
    isEditing.value = true
}

function save() {
    emit('save-targets', { ...form.value })
    isEditing.value = false
}

// Единая конфигурация всех 4 карточек
const nutrientCards = computed(() => [
    {
        key: 'target_calories',
        label: 'Калорийность',
        unit: 'ккал',
        actual: Math.round(props.actual.calories),
        target: props.diet.target_calories,
        step: 1,
        textColor: 'text-[#13b890]',
        barColor: 'bg-[#10a37f]',
        inputWidth: 'w-16'
    },
    {
        key: 'target_proteins',
        label: 'Белки',
        unit: 'г',
        actual: props.actual.proteins.toFixed(1),
        target: props.diet.target_proteins,
        step: 0.5,
        textColor: 'text-[#60a5fa]',
        barColor: 'bg-[#3b82f6]',
        inputWidth: 'w-14'
    },
    {
        key: 'target_fats',
        label: 'Жиры',
        unit: 'г',
        actual: props.actual.fats.toFixed(1),
        target: props.diet.target_fats,
        step: 0.5,
        textColor: 'text-[#fbbf24]',
        barColor: 'bg-[#f59e0b]',
        inputWidth: 'w-14'
    },
    {
        key: 'target_carbs',
        label: 'Углеводы',
        unit: 'г',
        actual: props.actual.carbs.toFixed(1),
        target: props.diet.target_carbs,
        step: 0.5,
        textColor: 'text-[#c084fc]',
        barColor: 'bg-[#a855f7]',
        inputWidth: 'w-16'
    }
])

function getProgressWidth(actualVal, targetVal) {
    if (!targetVal || targetVal <= 0) return '0%'
    const pct = (Number(actualVal) / targetVal) * 100
    return `${Math.min(100, Math.round(pct))}%`
}

function getProgressColor(actualVal, targetVal, defaultBg) {
    if (!targetVal || targetVal <= 0) return defaultBg
    const pct = (Number(actualVal) / targetVal) * 100
    return pct > 105 ? 'bg-[#ef4444]' : defaultBg
}
</script>

<template>
    <div class="pt-3 border-t border-[#2b394e]">
        <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-[#8a99ad]">
                Суточный баланс рационов (нажмите на норму для изменения):
            </span>
            <div class="flex items-center gap-2">
                <button
                    v-if="!isEditing"
                    type="button"
                    @click="startEdit"
                    class="text-[11px] text-[#13b890] hover:underline flex items-center gap-1 cursor-pointer"
                >
                    <i class="pi pi-pencil text-[10px]"></i>
                    <span>Изменить нормы</span>
                </button>
                <template v-else>
                    <button
                        type="button"
                        @click="save"
                        class="px-2 py-0.5 rounded bg-[#10a37f] text-white text-[11px] font-medium cursor-pointer"
                    >
                        Сохранить
                    </button>
                    <button
                        type="button"
                        @click="isEditing = false"
                        class="px-2 py-0.5 rounded bg-[#222e42] text-[#cbd5e1] text-[11px] cursor-pointer"
                    >
                        Отмена
                    </button>
                </template>
            </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div
                v-for="card in nutrientCards"
                :key="card.key"
                @click="!isEditing && startEdit()"
                class="relative overflow-hidden bg-[#151e29] border border-[#2b394e] hover:border-[#364761] rounded-lg px-3 py-2.5 flex justify-between items-center cursor-pointer transition-colors"
            >
                <span class="text-[#8a99ad]">{{ card.label }}:</span>
                <div
                    class="font-mono font-semibold flex items-center gap-1"
                    :class="card.textColor"
                >
                    <span>{{ card.actual }} /</span>
                    <input
                        v-if="isEditing"
                        type="number"
                        :step="card.step"
                        v-model.number="form[card.key]"
                        @click.stop
                        @keyup.enter="save"
                        :class="card.inputWidth"
                        class="h-6 px-1.5 rounded bg-[#1c2636] border border-[#10a37f] text-white text-right text-xs outline-none"
                    />
                    <span v-else>{{ card.target }}</span>
                    <span>{{ card.unit }}</span>
                </div>

                <!-- Прогресс-бар -->
                <div class="absolute bottom-0 left-0 right-0 h-1 bg-[#1c2636]">
                    <div
                        class="h-full transition-all duration-300"
                        :class="getProgressColor(card.actual, card.target, card.barColor)"
                        :style="{ width: getProgressWidth(card.actual, card.target) }"
                    ></div>
                </div>
            </div>
        </div>
    </div>
</template>
