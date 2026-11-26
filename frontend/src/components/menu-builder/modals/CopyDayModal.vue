<script setup>
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Button from 'primevue/button'

const visible = defineModel('visible', { type: Boolean, default: false })

const props = defineProps({
    template: { type: Object, default: null },
    diets: { type: Array, default: () => [] },
    sourceDiet: { type: Object, default: null },
    sourceDay: { type: Number, required: true },
    itemsCount: { type: Number, default: 0 }
})

const emit = defineEmits(['confirm'])

const form = ref({
    target_diet_id: null,
    target_days: [],
    replace_existing: true
})

watch(visible, (isOpen) => {
    if (isOpen && props.sourceDiet) {
        form.value = {
            target_diet_id: props.sourceDiet.id,
            target_days: [],
            replace_existing: true
        }
    }
})

const selectedTargetDiet = computed(() =>
    props.diets.find(d => d.id === form.value.target_diet_id) || null
)

function isDisabledDay(day) {
    return day === props.sourceDay && form.value.target_diet_id === props.sourceDiet?.id
}

function toggleDay(day) {
    if (isDisabledDay(day)) return
    const idx = form.value.target_days.indexOf(day)
    if (idx === -1) form.value.target_days.push(day)
    else form.value.target_days.splice(idx, 1)
}

function submit() {
    if (!form.value.target_days.length) return
    emit('confirm', { ...form.value })
    visible.value = false
}
</script>

<template>
    <Dialog
        v-model:visible="visible"
        modal
        header="Копирование рациона дня"
        class="w-11/12 max-w-md xui-dialog"
        contentClass="!bg-[#1c2636] !text-[#e2e8f0]"
    >
        <div
            v-if="template && sourceDiet"
            class="space-y-4 pt-2 text-xs"
        >
            <div class="p-3 rounded-lg bg-[#151e29] border border-[#2b394e] text-[#cbd5e1]">
                Источник: <strong class="text-white">День {{ sourceDay }}</strong> · Стол
                <strong class="text-[#13b890]">{{ sourceDiet.code }}</strong>
                ({{ itemsCount }} блюд)
            </div>

            <div>
                <label class="block text-[11px] text-[#8a99ad] mb-1">На какой диетический стол копировать:</label>
                <Select
                    v-model="form.target_diet_id"
                    :options="diets"
                    optionValue="id"
                    @change="form.target_days = []"
                    class="w-full xui-select"
                >
                    <template #option="{ option }">
                        <span class="font-mono font-bold text-[#13b890]">{{ option.code }}</span>
                        <span class="ml-2 text-xs text-[#94a3b8]">{{ option.name }}</span>
                    </template>
                    <template #value>
                        <span v-if="selectedTargetDiet">
                            {{ selectedTargetDiet.code }} — {{ selectedTargetDiet.name }}
                        </span>
                    </template>
                </Select>
            </div>

            <div>
                <label class="block text-[11px] text-[#8a99ad] mb-1.5">Выберите целевые дни цикла:</label>
                <div class="flex flex-wrap gap-1.5">
                    <button
                        v-for="day in template.days_count"
                        :key="day"
                        type="button"
                        :disabled="isDisabledDay(day)"
                        @click="toggleDay(day)"
                        class="w-9 h-9 rounded-lg font-mono text-xs font-semibold border transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                        :class="form.target_days.includes(day)
                            ? 'bg-[#10a37f] border-[#13b890] text-white'
                            : 'bg-[#151e29] border-[#2b394e] text-[#94a3b8] hover:border-[#10a37f]'"
                    >
                        {{ day }}
                    </button>
                </div>
            </div>

            <label class="flex items-center gap-2 cursor-pointer text-[#cbd5e1] pt-1">
                <input
                    type="checkbox"
                    v-model="form.replace_existing"
                    class="accent-[#10a37f] w-4 h-4 rounded"
                />
                <span>Очистить существующие блюда в выбранных днях перед копированием</span>
            </label>

            <div class="flex justify-end gap-2 pt-2">
                <Button
                    label="Отмена"
                    class="xui-btn xui-btn-slate"
                    @click="visible = false"
                />
                <Button
                    label="Скопировать"
                    icon="pi pi-copy"
                    :disabled="!form.target_days.length"
                    class="xui-btn xui-btn-teal"
                    @click="submit"
                />
            </div>
        </div>
    </Dialog>
</template>
