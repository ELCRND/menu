<script setup>
import Select from 'primevue/select'
import Button from 'primevue/button'

const templateId = defineModel('templateId')
const dietId = defineModel('dietId')
const day = defineModel('day')

defineProps({
    templates: { type: Array, default: () => [] },
    diets: { type: Array, default: () => [] },
    currentTemplate: { type: Object, default: null },
    currentDiet: { type: Object, default: null },
    hasItems: { type: Boolean, default: false }
})

const emit = defineEmits([
    'create-template',
    'rename-template',
    'delete-template',
    'copy-day',
    'clear-day',
    'manage-meal-times'
])
</script>

<template>
    <div class="flex flex-wrap items-center gap-4 mb-4 ">
        <div class="flex flex-wrap items-center gap-3">
            <!-- Управление шаблоном -->
            <div class="text-center h-14 py-2 px-2.5 border flex gap-2 items-center border-[#2b394e] rounded-lg">
                <Select
                    v-model="templateId"
                    :options="templates"
                    optionLabel="name"
                    optionValue="id"
                    placeholder="Выберите шаблон меню"
                    class="w-72 h-full mr-4 xui-select"
                />

                <Button
                    icon="pi pi-plus"
                    title="Создать новый шаблон меню (7 или 14 дней)"
                    class="xui-btn xui-btn-slate !px-3"
                    @click="emit('create-template')"
                />

                <Button
                    v-if="currentTemplate"
                    icon="pi pi-pencil"
                    title="Переименовать текущий шаблон"
                    class="xui-btn xui-btn-slate !px-2.5"
                    @click="emit('rename-template')"
                />

                <Button
                    v-if="currentTemplate"
                    icon="pi pi-trash"
                    title="Удалить текущий шаблон"
                    class="xui-btn xui-btn-danger !px-2.5"
                    @click="emit('delete-template')"
                />
            </div>

            <!-- Выбор диеты (стола) -->
            <Select
                v-model="dietId"
                :options="diets"
                optionValue="id"
                placeholder="Выберите стол"
                class="w-64 h-9 xui-select"
            >
                <template #value>
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

        <!-- Переключатель дней цикла и действия над днем -->
        <div class="min-w-full">
            <div
                class="w-fit text-center py-2 px-2.5 border flex flex-wrap gap-2 items-center border-[#2b394e] rounded-lg">
                <div
                    v-if="currentTemplate"
                    class="flex items-center gap-1.5 flex-wrap"
                >
                    <span class="text-xs text-[#8a99ad] mr-1">День цикла:</span>
                    <button
                        v-for="d in currentTemplate.days_count"
                        :key="d"
                        type="button"
                        @click="day = d"
                        class="w-8 h-8 rounded-lg font-mono text-xs font-semibold border transition-all cursor-pointer"
                        :class="day === d
                            ? 'bg-[#10a37f] border-[#13b890] text-white shadow-sm'
                            : 'bg-[#151e29] border-[#2b394e] text-[#94a3b8] hover:border-[#10a37f]'"
                    >
                        {{ d }}
                    </button>
                </div>

                <Button
                    v-if="hasItems"
                    label="Копировать день"
                    icon="pi pi-copy"
                    class="xui-btn xui-btn-slate !py-1.5 !px-3 !text-xs ml-2"
                    @click="emit('copy-day')"
                />

                <Button
                    v-if="hasItems"
                    label="Очистить день"
                    icon="pi pi-eraser"
                    class="xui-btn xui-btn-danger !py-1.5 !px-3 !text-xs"
                    @click="emit('clear-day')"
                />
            </div>
        </div>

        <Button
            label="Приемы пищи"
            icon="pi pi-sliders-h"
            class="xui-btn xui-btn-slate h-9 "
            @click="emit('manage-meal-times')"
        />
    </div>
</template>
