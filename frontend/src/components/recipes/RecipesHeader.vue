<script setup>
import { computed } from 'vue'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'

const search = defineModel('search', { type: String, default: '' })
const section = defineModel('section', { default: null })
const onlyFavorites = defineModel('onlyFavorites', { type: Boolean, default: false })

const props = defineProps({
    totalCount: { type: Number, default: 0 },
    foundCount: { type: Number, default: 0 },
    sections: { type: Array, default: () => [] }
})

const emit = defineEmits(['reset'])

const hasActiveFilters = computed(() =>
    Boolean(search.value || section.value || onlyFavorites.value)
)
</script>

<template>
    <!-- Верхний статус-бар со статистикой -->
    <div
        class="bg-[#1c2636] border border-[#2b394e] rounded-xl px-5 py-4 mb-5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div class="flex items-center gap-3.5">
            <div
                class="w-10 h-10 rounded-lg bg-[#10a37f] text-white flex items-center justify-center shadow-md shadow-[#10a37f]/20">
                <i class="pi pi-book text-base"></i>
            </div>
            <div>
                <div class="flex items-center gap-2.5 flex-wrap">
                    <h1 class="text-base font-semibold text-white tracking-tight">
                        Сборник технологических карт
                    </h1>
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
                <p class="text-xs text-[#8a99ad] mt-0.5">
                    Управление рецептурами, закладкой сырья и КБЖУ
                </p>
            </div>
        </div>

        <!-- Плашки сводной статистики -->
        <div class="flex flex-wrap items-center gap-2.5 text-[16px]">
            <div class="flex items-center gap-2 bg-[#151e29] border border-[#2b394e] rounded-lg px-3 py-1.5">
                <span class="text-[#8a99ad]">Всего карт:</span>
                <span
                    class="px-2 py-0.5 rounded-full font-mono font-semibold bg-[#10a37f]/15 text-[#13b890] border border-[#10a37f]"
                >
                    {{ totalCount }}
                </span>
            </div>
            <div class="flex items-center gap-2 bg-[#151e29] border border-[#2b394e] rounded-lg px-3 py-1.5">
                <span class="text-[#8a99ad]">Найдено:</span>
                <span
                    class="px-2 py-0.5 rounded-full font-mono font-semibold bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]"
                >
                    {{ foundCount }}
                </span>
            </div>
            <div class="flex items-center gap-2 bg-[#151e29] border border-[#2b394e] rounded-lg px-3 py-1.5">
                <span class="text-[#8a99ad]">Разделов:</span>
                <span
                    class="px-2 py-0.5 rounded-full font-mono font-semibold bg-[#a855f7]/15 text-[#c084fc] border border-[#a855f7]"
                >
                    {{ sections.length }}
                </span>
            </div>
        </div>
    </div>

    <!-- Панель поиска и фильтров -->
    <div class="bg-[#1c2636] border border-[#2b394e] rounded-xl p-4 mb-6 shadow-md">
        <div class="h-10 flex flex-wrap items-center gap-3">
            <Button
                :label="onlyFavorites ? 'Избранное: Вкл' : 'Избранное: Выкл'"
                :icon="onlyFavorites ? 'pi pi-star-fill' : 'pi pi-star'"
                @click="onlyFavorites = !onlyFavorites"
                class="xui-btn h-full"
                :class="onlyFavorites ? 'xui-btn-teal' : 'xui-btn-slate'"
            />

            <Select
                v-model="section"
                :options="sections"
                placeholder="Все разделы"
                showClear
                class="w-full h-full sm:w-56 xui-select"
                labelClass="flex items-center"
            />

            <div class="relative flex-1 min-w-60 h-full">
                <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a99ad] text-xs z-10"></i>
                <InputText
                    v-model="search"
                    placeholder="Поиск по №, названию или сырью..."
                    class="w-full h-full !pl-9 xui-input"
                />
            </div>

            <Button
                v-if="hasActiveFilters"
                label="Сбросить"
                icon="pi pi-filter-slash"
                @click="emit('reset')"
                class="h-full xui-btn xui-btn-danger"
            />
        </div>
    </div>
</template>
