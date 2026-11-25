<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'

// Справочники
const templates = ref([])
const diets = ref([])
const mealTimes = ref([])

// Параметры генерации
const selectedDate = ref(new Date().toISOString().slice(0, 10))
const selectedTemplateId = ref(null)
const selectedDay = ref(1)
const headcountForm = ref([]) // [{ diet_id, code, name, regular: 0, pureed: 0 }]

// Загруженные данные сформированного меню на дату
const dailyData = ref(null)
const productsSummary = ref([])
const distributionList = ref([])
const activeReportTab = ref('dishes') // 'dishes' | 'products' | 'distribution'
const isLoading = ref(false)

onMounted(async () => {
    const res = await fetch('/api/menu/dictionaries')
    const dict = await res.json()
    templates.value = dict.templates
    diets.value = dict.diets
    mealTimes.value = dict.mealTimes

    if (templates.value.length) selectedTemplateId.value = templates.value[0].id
    resetHeadcountForm()
    await loadDailyMenu()
})

function resetHeadcountForm() {
    headcountForm.value = diets.value.map(d => ({
        diet_id: d.id,
        code: d.code,
        name: d.name,
        regular: 0,
        pureed: 0
    }))
}

// Загружаем меню при смене даты
watch(selectedDate, loadDailyMenu)

async function loadDailyMenu() {
    isLoading.value = true
    try {
        const res = await fetch(`/api/daily-menus/${selectedDate.value}`)
        const data = await res.json()
        dailyData.value = data

        if (data) {
            if (data.menu.template_id) selectedTemplateId.value = data.menu.template_id
            if (data.menu.day_number) selectedDay.value = data.menu.day_number

            // Заполняем форму количества людей из сохраненных данных
            headcountForm.value = diets.value.map(d => {
                const reg = data.headcounts.find(h => h.diet_id === d.id && h.is_pureed === 0)
                const pur = data.headcounts.find(h => h.diet_id === d.id && h.is_pureed === 1)
                return {
                    diet_id: d.id,
                    code: d.code,
                    name: d.name,
                    regular: reg ? reg.people_count : 0,
                    pureed: pur ? pur.people_count : 0
                }
            })

            await loadReports()
        } else {
            resetHeadcountForm()
            productsSummary.value = []
            distributionList.value = []
        }
    } finally {
        isLoading.value = false
    }
}

async function loadReports() {
    const [prodRes, distRes] = await Promise.all([
        fetch(`/api/daily-menus/${selectedDate.value}/products-summary`),
        fetch(`/api/daily-menus/${selectedDate.value}/distribution`)
    ])
    productsSummary.value = await prodRes.json()
    distributionList.value = await distRes.json()
}

const totalPeople = computed(() =>
    headcountForm.value.reduce((sum, row) => sum + (row.regular || 0) + (row.pureed || 0), 0)
)

const currentTemplate = computed(() =>
    templates.value.find(t => t.id === selectedTemplateId.value)
)

// Сформировать (или пересчитать) меню на выбранную дату
async function generateMenu() {
    if (!selectedTemplateId.value || totalPeople.value === 0) return

    const headcounts = []
    for (const row of headcountForm.value) {
        if (row.regular > 0) {
            headcounts.push({ diet_id: row.diet_id, people_count: row.regular, is_pureed: 0 })
        }
        if (row.pureed > 0) {
            headcounts.push({ diet_id: row.diet_id, people_count: row.pureed, is_pureed: 1 })
        }
    }

    await fetch('/api/daily-menus/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            menu_date: selectedDate.value,
            template_id: selectedTemplateId.value,
            day_number: selectedDay.value,
            headcounts
        })
    })

    await loadDailyMenu()
}

// Замена взаимозаменяемого продукта в блюде на текущий день
async function updateAlternative(item, groupId, ingredientId) {
    const updatedAlts = { ...item.selected_alternatives, [groupId]: ingredientId }
    item.selected_alternatives = updatedAlts

    await fetch(`/api/daily-menus/items/${item.id}/alternatives`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_alternatives: updatedAlts })
    })

    // Пересчитываем сводную ведомость продуктов
    await loadReports()
}

// Подтянуть количество питающихся со вчерашнего дня
async function copyHeadcountFromYesterday() {
    const current = new Date(selectedDate.value)
    current.setDate(current.getDate() - 1)
    const yesterdayStr = current.toISOString().slice(0, 10)

    const res = await fetch(`/api/daily-menus/${yesterdayStr}`)
    const yesterdayData = await res.json()

    if (!yesterdayData || !yesterdayData.headcounts?.length) {
        alert(`За вчера (${yesterdayStr}) данных о питающихся не найдено.`)
        return
    }

    headcountForm.value = diets.value.map(d => {
        const reg = yesterdayData.headcounts.find(h => h.diet_id === d.id && h.is_pureed === 0)
        const pur = yesterdayData.headcounts.find(h => h.diet_id === d.id && h.is_pureed === 1)
        return {
            diet_id: d.id,
            code: d.code,
            name: d.name,
            regular: reg ? reg.people_count : 0,
            pureed: pur ? pur.people_count : 0
        }
    })
}

// Сохранить только измененное количество людей (не трогая блюда и замены)
async function saveOnlyHeadcount() {
    const headcounts = []
    for (const row of headcountForm.value) {
        if (row.regular > 0) headcounts.push({ diet_id: row.diet_id, people_count: row.regular, is_pureed: 0 })
        if (row.pureed > 0) headcounts.push({ diet_id: row.diet_id, people_count: row.pureed, is_pureed: 1 })
    }

    await fetch(`/api/daily-menus/${selectedDate.value}/headcount`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headcounts })
    })

    await loadReports() // Мгновенно пересчитываем продукты и порционник
}

function printReport() {
    window.print()
}

</script>

<template>
    <div class="max-w-7xl mx-auto p-4 sm:p-6">
        <!-- Блок 1: Выбор даты и контингента (скрывается при печати) -->
        <div class="bg-[#1c2636] border border-[#2b394e] rounded-xl p-5 mb-6 shadow-lg no-print">

            <div class="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-[#2b394e]">
                <div class="flex flex-wrap items-center gap-3">
                    <div>
                        <label class="block text-[11px] text-[#8a99ad] mb-1">Дата меню-раскладки:</label>
                        <input
                            type="date"
                            v-model="selectedDate"
                            class="h-10 px-3 rounded-lg bg-[#151e29] border border-[#2b394e] text-sm text-white focus:border-[#10a37f] outline-none"
                        />
                    </div>

                    <div>
                        <label class="block text-[11px] text-[#8a99ad] mb-1">Типовой шаблон:</label>
                        <Select
                            v-model="selectedTemplateId"
                            :options="templates"
                            optionLabel="name"
                            optionValue="id"
                            class="w-64 h-10 xui-select"
                        />
                    </div>

                    <div v-if="currentTemplate">
                        <label class="block text-[11px] text-[#8a99ad] mb-1">День цикла:</label>
                        <Select
                            v-model="selectedDay"
                            :options="Array.from({ length: currentTemplate.days_count }, (_, i) => i + 1)"
                            class="w-28 h-10 xui-select"
                        >
                            <template #option="{ option }">День {{ option }}</template>
                            <template #value="{ value }">День {{ value }}</template>
                        </Select>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <div class="px-3.5 py-2 rounded-lg bg-[#151e29] border border-[#2b394e] text-xs">
                        <span class="text-[#8a99ad]">Всего питающихся: </span>
                        <span class="font-mono font-bold text-sm text-[#13b890]">{{ totalPeople }} чел.</span>
                    </div>

                    <Button
                        label="Как вчера"
                        icon="pi pi-history"
                        class="h-10 xui-btn xui-btn-slate"
                        @click="copyHeadcountFromYesterday"
                    />

                    <Button
                        v-if="dailyData"
                        label="Обновить"
                        icon="pi pi-users"
                        class="h-10 xui-btn xui-btn-teal"
                        @click="saveOnlyHeadcount"
                    />

                    <Button
                        :label="dailyData ? 'Пересчитать меню' : 'Сформировать меню'"
                        icon="pi pi-bolt"
                        :disabled="totalPeople === 0"
                        class="h-10 xui-btn xui-btn-teal"
                        @click="generateMenu"
                    />

                </div>
            </div>

            <div
                v-if="totalPeople === 0"
                class="my-3  text-[#fbbf24] flex items-center gap-1.5"
            >
                <i class="pi pi-info-circle"></i>
                <span>Укажите количество питающихся хотя бы по одному столу, чтобы сформировать меню.</span>
            </div>

            <!-- Сетка ввода количества человек по столам ДИПИ -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div
                    v-for="row in headcountForm"
                    :key="row.diet_id"
                    class="p-3 rounded-xl bg-[#151e29] border border-[#2b394e]"
                >
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-mono font-bold text-xs text-[#13b890]">{{ row.code }}</span>
                        <span
                            class="text-[11px] text-[#8a99ad] truncate ml-2"
                            :title="row.name"
                        >{{ row.name }}</span>
                    </div>

                    <div class="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                            <label
                                for="regular-input"
                                class="block text-[#8a99ad] mb-1"
                            >Общий:</label>
                            <InputNumber
                                id="regular-input"
                                v-model="row.regular"
                                :min="0"
                                showButtons
                                buttonLayout="stacked"
                                fluid
                                :pt="{
                                    root: { class: 'h-8' },
                                    pcInputText: {
                                        root: {
                                            class: '!w-full !h-8 !px-2 !rounded !bg-[#1c2636] !border-[#2b394e] !text-white !font-mono !text-[16px] focus:!border-[#10a37f] !shadow-none'
                                        }
                                    },
                                    incrementButton: { class: '!bg-[#2b394e] !border-[#2b394e] !text-white !w-6 !p-0 hover:!bg-[#364761]' },
                                    decrementButton: { class: '!bg-[#2b394e] !border-[#2b394e] !text-white !w-6 !p-0 hover:!bg-[#364761]' }
                                }"
                            />
                        </div>

                        <div>
                            <label
                                for="pureed-input"
                                class="block text-[#8a99ad] mb-1"
                            >Протертый:</label>
                            <InputNumber
                                id="pureed-input"
                                v-model="row.pureed"
                                :min="0"
                                showButtons
                                buttonLayout="stacked"
                                fluid
                                :pt="{
                                    root: { class: 'h-8' },
                                    pcInputText: {
                                        root: {
                                            class: '!w-full !h-8 !px-2 !rounded !bg-[#1c2636] !border-[#2b394e] !text-white !font-mono !text-[16px] focus:!border-[#10a37f] !shadow-none'
                                        }
                                    },
                                    incrementButton: { class: '!bg-[#2b394e] !border-[#2b394e] !text-white !w-6 !p-0 hover:!bg-[#364761]' },
                                    decrementButton: { class: '!bg-[#2b394e] !border-[#2b394e] !text-white !w-6 !p-0 hover:!bg-[#364761]' }
                                }"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>



        <!-- Блок 2: Сформированное меню и печатные ведомости -->
        <div
            v-if="dailyData"
            class="bg-[#1c2636] border border-[#2b394e] rounded-xl overflow-hidden shadow-lg"
        >
            <!-- Панель переключения отчетов -->
            <div
                class="px-5 py-3.5 bg-[#182130] border-b border-[#2b394e] flex flex-wrap items-center justify-between gap-3 no-print">
                <div class="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        @click="activeReportTab = 'dishes'"
                        class="px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors"
                        :class="activeReportTab === 'dishes'
                            ? 'bg-[#10a37f] border-[#13b890] text-white'
                            : 'bg-[#222e42] border-[#364761] text-[#cbd5e1]'"
                    >
                        1. Блюда и замены сырья ({{ dailyData.items.length }})
                    </button>

                    <button
                        type="button"
                        @click="activeReportTab = 'products'"
                        class="px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors"
                        :class="activeReportTab === 'products'
                            ? 'bg-[#10a37f] border-[#13b890] text-white'
                            : 'bg-[#222e42] border-[#364761] text-[#cbd5e1]'"
                    >
                        2. Меню-требование (Продукты)
                    </button>

                    <button
                        type="button"
                        @click="activeReportTab = 'distribution'"
                        class="px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors"
                        :class="activeReportTab === 'distribution'
                            ? 'bg-[#10a37f] border-[#13b890] text-white'
                            : 'bg-[#222e42] border-[#364761] text-[#cbd5e1]'"
                    >
                        3. Раздаточная ведомость (Порции)
                    </button>
                </div>

                <Button
                    v-if="activeReportTab !== 'dishes'"
                    label="Печать ведомости"
                    icon="pi pi-print"
                    class="xui-btn xui-btn-teal !py-1.5 !text-xs"
                    @click="printReport"
                />
            </div>

            <!-- Вкладка 1: Список блюд на день и выбор взаимозаменяемого сырья -->
            <div
                v-if="activeReportTab === 'dishes'"
                class="p-5 space-y-3 no-print"
            >
                <div
                    v-for="item in dailyData.items"
                    :key="item.id"
                    class="p-3.5 rounded-xl bg-[#151e29] border border-[#2b394e] flex flex-wrap items-center justify-between gap-4"
                >
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="px-2 py-0.5 rounded bg-[#6366f1]/15 text-[#a5b4fc] text-[11px] font-medium">
                                {{ item.meal_name }}
                            </span>
                            <span
                                class="px-2 py-0.5 rounded bg-[#10a37f]/15 text-[#13b890] font-mono text-[11px] font-bold"
                            >
                                {{ item.diet_code }}
                            </span>
                            <span class="font-mono text-xs text-[#8a99ad]">№{{ item.recipe_number }}</span>
                            <span class="text-xs font-semibold text-white">{{ item.recipe_title }}</span>
                        </div>
                        <div class="text-[11px] text-[#8a99ad] font-mono">
                            Колонка: {{ item.variant_category }} · Выход порции: {{ Math.round(item.output_weight *
                                item.portion_multiplier) }} г
                        </div>
                    </div>

                    <!-- Селектор выбора конкретного продукта, если в ТТК есть альтернативы -->
                    <div
                        v-if="item.alternatives.length"
                        class="flex flex-wrap items-center gap-2"
                    >
                        <div
                            v-for="alt in item.alternatives"
                            :key="alt.groupId"
                            class="flex items-center gap-2"
                        >
                            <span class="text-[11px] text-[#fbbf24]">Сырье на день:</span>
                            <select
                                :value="item.selected_alternatives[alt.groupId] || alt.options[0].id"
                                @change="updateAlternative(item, alt.groupId, Number($event.target.value))"
                                class="h-8 px-2.5 rounded-lg bg-[#1c2636] border border-[#364761] text-xs text-white focus:border-[#10a37f] outline-none"
                            >
                                <option
                                    v-for="opt in alt.options"
                                    :key="opt.id"
                                    :value="opt.id"
                                >
                                    {{ opt.name.replace(/^>\s*/, '') }}
                                </option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Вкладка 2: Меню-требование (Сводная продуктовая ведомость) -->
            <div
                v-if="activeReportTab === 'products'"
                id="print-area"
                class="p-6"
            >
                <div class="mb-4 pb-3 border-b border-[#2b394e] print-header">
                    <h2 class="text-base font-bold text-white print-title">
                        Сводная продуктовая ведомость (Меню-требование) на {{ selectedDate }}
                    </h2>
                    <p class="text-xs text-[#8a99ad] print-text mt-1">
                        Всего питающихся: {{ totalPeople }} чел. (День цикла №{{ selectedDay }})
                    </p>
                </div>

                <table class="w-full border-collapse text-xs print-border">
                    <thead>
                        <tr class="bg-[#222e42] text-white print-th">
                            <th class="border border-[#2b394e] px-3 py-2 text-center w-12 print-border">№</th>
                            <th class="border border-[#2b394e] px-3 py-2 text-left print-border">Наименование продукта
                            </th>
                            <th class="border border-[#2b394e] px-3 py-2 text-right w-32 print-border">Брутто, г</th>
                            <th class="border border-[#2b394e] px-3 py-2 text-right w-32 print-border">Брутто, кг</th>
                            <th class="border border-[#2b394e] px-3 py-2 text-right w-32 print-border">Нетто, г</th>
                            <th class="border border-[#2b394e] px-3 py-2 text-right w-32 print-border">Нетто, кг</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="(prod, idx) in productsSummary"
                            :key="prod.name"
                            class="hover:bg-[#151e29]"
                        >
                            <td class="border border-[#2b394e] px-3 py-2 text-center font-mono print-border">{{ idx + 1
                            }}</td>
                            <td class="border border-[#2b394e] px-3 py-2 font-medium print-border">{{ prod.name }}</td>
                            <td
                                class="border border-[#2b394e] px-3 py-2 text-right font-mono text-[#94a3b8] print-border print-text">
                                <span
                                    v-if="prod.pieces_label"
                                    class="text-[#fbbf24] font-semibold print-text"
                                >
                                    {{ prod.pieces_label }}
                                </span>
                                <span v-else>
                                    {{ Math.round(prod.gross_grams) }}
                                </span>
                            </td>
                            <td
                                class="border border-[#2b394e] px-3 py-2 text-right font-mono font-bold text-[#13b890] print-border print-text">
                                {{ prod.gross_kg.toFixed(3) }}
                            </td>
                            <td
                                class="border border-[#2b394e] px-3 py-2 text-right font-mono text-[#94a3b8] print-border print-text">
                                {{ Math.round(prod.net_grams) }}
                            </td>
                            <td
                                class="border border-[#2b394e] px-3 py-2 text-right font-mono font-semibold print-border print-text">
                                {{ prod.net_kg.toFixed(3) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Вкладка 3: Раздаточная ведомость (Порционник для пищеблока) -->
            <div
                v-if="activeReportTab === 'distribution'"
                id="print-area"
                class="p-6"
            >
                <div class="mb-4 pb-3 border-b border-[#2b394e] print-header">
                    <h2 class="text-base font-bold text-white print-title">
                        Раздаточная ведомость на пищеблок на {{ selectedDate }}
                    </h2>
                    <p class="text-xs text-[#8a99ad] print-text mt-1">
                        Всего питающихся: {{ totalPeople }} чел.
                    </p>
                </div>

                <table class="w-full border-collapse text-xs print-border">
                    <thead>
                        <tr class="bg-[#222e42] text-white print-th">
                            <th class="border border-[#2b394e] px-3 py-2 text-left print-border">Прием пищи</th>
                            <th class="border border-[#2b394e] px-3 py-2 text-left print-border">Блюдо (№ ТТК)</th>
                            <th class="border border-[#2b394e] px-3 py-2 text-center w-24 print-border">Стол</th>
                            <th class="border border-[#2b394e] px-3 py-2 text-center w-24 print-border">Выход, г</th>
                            <th class="border border-[#2b394e] px-3 py-2 text-center w-28 print-border">Обычных, шт</th>
                            <th class="border border-[#2b394e] px-3 py-2 text-center w-28 print-border">Протертых, шт
                            </th>
                            <th class="border border-[#2b394e] px-3 py-2 text-center w-24 print-border">Итого, шт</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="(row, idx) in distributionList"
                            :key="idx"
                            class="hover:bg-[#151e29]"
                        >
                            <td class="border border-[#2b394e] px-3 py-2 print-border">{{ row.meal_name }}</td>
                            <td class="border border-[#2b394e] px-3 py-2 font-medium print-border">
                                №{{ row.recipe_number }} {{ row.recipe_title }}
                            </td>
                            <td
                                class="border border-[#2b394e] px-3 py-2 text-center font-mono font-bold text-[#13b890] print-border print-text">
                                {{ row.diet_code }}
                            </td>
                            <td class="border border-[#2b394e] px-3 py-2 text-center font-mono print-border">
                                {{ Math.round(row.output_weight * row.portion_multiplier) }}
                            </td>
                            <td class="border border-[#2b394e] px-3 py-2 text-center font-mono print-border">
                                {{ row.regular_count || '—' }}
                            </td>
                            <td
                                class="border border-[#2b394e] px-3 py-2 text-center font-mono text-[#fbbf24] print-border print-text">
                                {{ row.pureed_count || '—' }}
                            </td>
                            <td class="border border-[#2b394e] px-3 py-2 text-center font-mono font-bold print-border">
                                {{ (row.regular_count || 0) + (row.pureed_count || 0) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
