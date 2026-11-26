<script setup>
import Button from 'primevue/button'

defineProps({
    meal: { type: Object, required: true },
    items: { type: Array, default: () => [] }
})

const emit = defineEmits(['add', 'edit', 'remove', 'move'])

function calcWeight(item) {
    return Math.round((item.output_weight || 0) * (item.portion_multiplier || 1))
}

function calcCalories(item) {
    return Math.round((item.calories || 0) * (item.portion_multiplier || 1))
}
</script>

<template>
    <div
        class="bg-[#1c2636] border border-[#2b394e] rounded-xl overflow-hidden flex flex-col justify-between shadow-md">
        <div>
            <!-- Заголовок карточки -->
            <div class="px-4 py-3 bg-[#182130] border-b border-[#2b394e] flex items-center justify-between">
                <span class="font-semibold text-sm text-white">{{ meal.name }}</span>
                <Button
                    label="Добавить блюдо"
                    icon="pi pi-plus"
                    class="xui-btn xui-btn-teal !py-1 !px-2.5 !text-xs"
                    @click="emit('add')"
                />
            </div>

            <!-- Список блюд -->
            <div class="p-3 space-y-2">
                <div
                    v-if="!items.length"
                    class="text-center py-6 text-xs text-[#64748b] border border-dashed border-[#2b394e] rounded-lg"
                >
                    Блюда не назначены
                </div>

                <div
                    v-for="(item, idx) in items"
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
                            <span class="text-[#cbd5e1]">Выход: {{ calcWeight(item) }} г</span>
                            <span>·</span>
                            <span>{{ calcCalories(item) }} ккал</span>
                        </div>
                    </div>

                    <!-- Сортировка (Вверх / Вниз) -->
                    <div class="flex flex-col gap-0.5 shrink-0 mr-10">
                        <button
                            type="button"
                            :disabled="idx === 0"
                            @click="emit('move', idx, -1)"
                            title="Поднять выше"
                            class="w-5 h-5 rounded bg-[#1c2636] hover:bg-[#222e42] disabled:opacity-50 text-[#8a99ad] hover:text-white flex items-center justify-center cursor-pointer disabled:cursor-default"
                        >
                            <i class="pi pi-chevron-up text-[9px]"></i>
                        </button>
                        <button
                            type="button"
                            :disabled="idx === items.length - 1"
                            @click="emit('move', idx, 1)"
                            title="Опустить ниже"
                            class="w-5 h-5 rounded bg-[#1c2636] hover:bg-[#222e42] disabled:opacity-50 text-[#8a99ad] hover:text-white flex items-center justify-center cursor-pointer disabled:cursor-default"
                        >
                            <i class="pi pi-chevron-down text-[9px]"></i>
                        </button>
                    </div>

                    <!-- Редактирование и удаление -->
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            @click="emit('edit', item)"
                            title="Изменить колонку или граммовку"
                            class="w-7 h-7 rounded-lg bg-[#222e42] hover:bg-[#10a37f]/20 text-[#8a99ad] hover:text-[#13b890] border border-[#364761] flex items-center justify-center cursor-pointer transition-colors"
                        >
                            <i class="pi pi-pencil text-xs"></i>
                        </button>
                        <button
                            type="button"
                            @click="emit('remove', item.id)"
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
</template>
