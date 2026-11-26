<script setup>
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import { useDailyMenu } from '@/composables/useDailyMenu'

import HeadcountPanel from './HeadcountPanel.vue'
import DailyDishesTab from './tabs/DailyDishesTab.vue'
import ProductsReportTab from './tabs/ProductsReportTab.vue'
import DistributionTab from './tabs/DistributionTab.vue'

const {
    templates,
    selectedDate,
    selectedTemplateId,
    selectedDay,
    headcountForm,
    dailyData,
    productsSummary,
    distributionList,
    totalPeople,
    currentTemplate,
    init,
    generateMenu,
    saveOnlyHeadcount,
    updateAlternative,
    copyHeadcountFromYesterday
} = useDailyMenu()

const activeReportTab = ref('dishes') // 'dishes' | 'products' | 'distribution'

onMounted(init)

async function handleCopyYesterday() {
    const result = await copyHeadcountFromYesterday()
    if (!result.ok) {
        alert(`За вчера (${result.date}) данных о питающихся не найдено.`)
    }
}

function printReport() {
    window.print()
}
</script>

<template>
    <div class="max-w-7xl mx-auto p-4 sm:p-6">
        <!-- Верхняя панель параметров и ввода контингента -->
        <HeadcountPanel
            v-model:date="selectedDate"
            v-model:templateId="selectedTemplateId"
            v-model:day="selectedDay"
            :templates="templates"
            :currentTemplate="currentTemplate"
            :headcountForm="headcountForm"
            :totalPeople="totalPeople"
            :hasDailyData="Boolean(dailyData)"
            @copy-yesterday="handleCopyYesterday"
            @save-headcount="saveOnlyHeadcount"
            @generate="generateMenu"
        />

        <!-- Сформированное меню и печатные ведомости -->
        <div
            v-if="dailyData"
            class="bg-[#1c2636] border border-[#2b394e] rounded-xl overflow-hidden shadow-lg"
        >
            <!-- Панель переключения вкладок -->
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

            <!-- Содержимое активной вкладки -->
            <DailyDishesTab
                v-if="activeReportTab === 'dishes'"
                :items="dailyData.items"
                @update-alternative="updateAlternative"
            />

            <ProductsReportTab
                v-else-if="activeReportTab === 'products'"
                :products="productsSummary"
                :date="selectedDate"
                :day="selectedDay"
                :totalPeople="totalPeople"
            />

            <DistributionTab
                v-else-if="activeReportTab === 'distribution'"
                :rows="distributionList"
                :date="selectedDate"
                :totalPeople="totalPeople"
            />
        </div>
    </div>
</template>
