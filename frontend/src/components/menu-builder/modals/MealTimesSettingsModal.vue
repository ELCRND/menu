<script setup>
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

const visible = defineModel('visible', { type: Boolean, default: false })

const props = defineProps({
    mealTimes: { type: Array, default: () => [] }
})

const emit = defineEmits(['add', 'rename', 'move', 'remove'])

const newName = ref('')
const errorMsg = ref('')

watch(visible, (isOpen) => {
    if (isOpen) {
        newName.value = ''
        errorMsg.value = ''
    }
})

// Обертка для отображения серверных ошибок внутри модалки
async function runSafe(action) {
    errorMsg.value = ''
    try {
        await action()
    } catch (err) {
        errorMsg.value = err.message || 'Произошла ошибка'
    }
}

function handleAdd() {
    const trimmed = newName.value.trim()
    if (!trimmed) return
    runSafe(async () => {
        await emit('add', trimmed)
        newName.value = ''
    })
}

function handleRename(meal, value) {
    const trimmed = value.trim()
    if (!trimmed || trimmed === meal.name) return
    runSafe(() => emit('rename', meal, trimmed))
}

function handleRemove(mealId) {
    runSafe(() => emit('remove', mealId))
}
</script>

<template>
    <Dialog
        v-model:visible="visible"
        modal
        header="Настройка приемов пищи"
        class="w-11/12 max-w-lg xui-dialog"
        contentClass="!bg-[#1c2636] !text-[#e2e8f0]"
    >
        <div class="space-y-4 pt-2 text-xs">
            <div
                v-if="errorMsg"
                class="p-2.5 rounded-lg bg-[#ef4444]/15 border border-[#ef4444]/40 text-[#fca5a5]"
            >
                {{ errorMsg }}
            </div>

            <!-- Добавление нового приема пищи -->
            <div class="flex items-center gap-2">
                <InputText
                    v-model="newName"
                    placeholder="Например: Паужин или Сонник..."
                    @keyup.enter="handleAdd"
                    class="flex-1 xui-input"
                />
                <Button
                    label="Добавить"
                    icon="pi pi-plus"
                    :disabled="!newName.trim()"
                    class="xui-btn xui-btn-teal"
                    @click="handleAdd"
                />
            </div>

            <!-- Список существующих приемов пищи -->
            <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
                <div
                    v-for="(meal, idx) in mealTimes"
                    :key="meal.id"
                    class="p-2 rounded-lg bg-[#151e29] border border-[#2b394e] flex items-center gap-2"
                >
                    <!-- Стрелки сортировки -->
                    <div class="flex flex-col gap-0.5 shrink-0">
                        <button
                            type="button"
                            :disabled="idx === 0"
                            @click="emit('move', idx, -1)"
                            class="w-5 h-4 rounded bg-[#1c2636] hover:bg-[#222e42] disabled:opacity-25 text-[#8a99ad] hover:text-white flex items-center justify-center cursor-pointer disabled:cursor-default"
                        >
                            <i class="pi pi-chevron-up text-[9px]"></i>
                        </button>
                        <button
                            type="button"
                            :disabled="idx === mealTimes.length - 1"
                            @click="emit('move', idx, 1)"
                            class="w-5 h-4 rounded bg-[#1c2636] hover:bg-[#222e42] disabled:opacity-25 text-[#8a99ad] hover:text-white flex items-center justify-center cursor-pointer disabled:cursor-default"
                        >
                            <i class="pi pi-chevron-down text-[9px]"></i>
                        </button>
                    </div>

                    <!-- Поле редактирования названия -->
                    <input
                        type="text"
                        :value="meal.name"
                        @blur="handleRename(meal, $event.target.value)"
                        @keyup.enter="$event.target.blur()"
                        class="flex-1 h-8 px-2.5 rounded bg-[#1c2636] border border-[#2b394e] focus:border-[#10a37f] text-white text-xs outline-none"
                    />

                    <!-- Удаление -->
                    <button
                        type="button"
                        @click="handleRemove(meal.id)"
                        title="Удалить прием пищи"
                        class="w-8 h-8 rounded-lg bg-[#222e42] hover:bg-[#ef4444]/20 text-[#8a99ad] hover:text-[#f87171] border border-[#364761] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                    >
                        <i class="pi pi-trash text-xs"></i>
                    </button>
                </div>
            </div>

            <div class="flex justify-end pt-2 border-t border-[#2b394e]">
                <Button
                    label="Готово"
                    class="xui-btn xui-btn-slate"
                    @click="visible = false"
                />
            </div>
        </div>
    </Dialog>
</template>
