<script setup>
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

const recipe = defineModel('recipe', { default: null })

// Сбор строк таблицы закладки сырья без альтернатив и подытогов
const rows = computed(() => {
    if (!recipe.value?.variants?.length) return []
    const variants = recipe.value.variants

    const allRows = []
    const seen = new Set()

    for (const v of variants) {
        for (const ing of (v.ingredients || [])) {
            if (!seen.has(ing.name)) {
                seen.add(ing.name)
                allRows.push({
                    name: ing.name,
                    order: ing.order ?? 999
                })
            }
        }
    }

    allRows.sort((a, b) => a.order - b.order)

    const mapped = allRows.map(row => ({
        name: row.name,
        cells: variants.map(v => {
            const item = (v.ingredients || []).find(ing => ing.name === row.name)
            return {
                gross: item?.gross_weight ?? '—',
                net: item?.net_weight ?? '—'
            }
        })
    }))

    // Помечаем строки-альтернативы (если совпадает вес нетто во всех колонках, как у сыров 25/20/15)
    return mapped.map((row, idx) => {
        if (idx === 0) return { ...row, isAlternative: false }
        const prev = mapped[idx - 1]
        const sameNet = row.cells.every((cell, cIdx) =>
            cell.net !== '—' && cell.net === prev.cells[cIdx]?.net
        )
        return {
            ...row,
            isAlternative: sameNet
        }
    })
})


// Расчет КБЖУ для каждой колонки (I, II, III) на основе базового КБЖУ
const nutritionRows = computed(() => {
    const baseNut = recipe.value?.nutrition?.[0]
    const variants = recipe.value?.variants || []
    if (!baseNut || !variants.length) return []

    const baseWeight = Number(baseNut.output_weight) || 100

    return variants.map(v => {
        const targetWeight = Number(v.output_weight) || baseWeight
        const ratio = targetWeight / baseWeight
        const isExactMatch = Math.abs(targetWeight - baseWeight) < 0.01

        const calc = (val, decimals = 2) => {
            if (val === null || val === undefined) return '—'
            return Number((Number(val) * ratio).toFixed(decimals))
        }

        return {
            id: v.id,
            category: v.category,
            output_weight: targetWeight,
            proteins_total: calc(baseNut.proteins_total, 2),
            fats_total: calc(baseNut.fats_total, 2),
            carbs_total: calc(baseNut.carbs_total, 2),
            calories: calc(baseNut.calories, 0),
            isCalculated: !isExactMatch
        }
    })
})

function close() {
    recipe.value = null
}

function printCard() {
    window.print()
}
</script>

<template>
    <Dialog
        v-if="recipe"
        :visible="!!recipe"
        @update:visible="close"
        modal
        :showHeader="false"
        class="w-11/12 max-w-4xl xui-dialog"
        contentClass="!p-0 !bg-[#1c2636] !border !border-[#2b394e] !rounded-xl overflow-hidden shadow-2xl"
    >
        <div
            id="print-area"
            class="bg-[#1c2636] text-[#e2e8f0]"
        >
            <!-- Шапка модального окна -->
            <div
                class="flex flex-wrap items-start justify-between gap-4 border-b border-[#2b394e] px-6 py-4 bg-[#182130] print-header">
                <div>
                    <div class="flex flex-wrap items-center gap-2 mb-1.5">
                        <span
                            class="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#10a37f]/15 text-[#13b890] border border-[#10a37f]/35 print-tag"
                        >
                            ТТК № {{ recipe.ttk_code }}
                        </span>
                        <span
                            v-if="recipe.section"
                            class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#6366f1]/15 text-[#a5b4fc] border border-[#6366f1]/35 print-tag"
                        >
                            {{ recipe.section }}
                        </span>
                        <span
                            class="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#222e42] text-[#94a3b8] border border-[#364761] no-print"
                        >
                            Колонок: {{ recipe.variants?.length || 0 }}
                        </span>
                    </div>
                    <h2 class="text-base sm:text-lg font-semibold text-white print-title">
                        {{ recipe.title }}
                    </h2>
                </div>

                <div class="h-10 flex items-center gap-4 no-print shrink-0">
                    <Button
                        label="Печать ТТК"
                        icon="pi pi-print"
                        class="h-full xui-btn xui-btn-teal"
                        @click="printCard"
                    />
                    <button
                        type="button"
                        @click="close"
                        class="px-3 h-full rounded-lg bg-[#222e42] hover:bg-[#ef4444]/20 border border-[#364761] hover:border-[#ef4444]/50 text-[#cbd5e1] hover:text-[#f87171] text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                        <i class="pi pi-times text-xs"></i>
                        <span>Закрыть</span>
                    </button>
                </div>
            </div>

            <div class="p-6">
                <!-- Таблица закладки сырья -->
                <div class="overflow-x-auto mb-6 rounded-xl border border-[#2b394e] bg-[#151e29] print-border">
                    <table class="w-full border-collapse text-xs">
                        <thead>
                            <tr class="bg-[#222e42] text-white print-th">
                                <th
                                    rowspan="2"
                                    class="border border-[#2b394e] px-3.5 py-2.5 text-left font-semibold print-border"
                                >
                                    Наименование сырья и продуктов
                                </th>
                                <th
                                    v-for="v in recipe.variants"
                                    :key="v.id"
                                    colspan="2"
                                    class="border border-[#2b394e] px-2 py-2 text-center font-semibold print-border print-text"
                                >
                                    <span
                                        class="px-2.5 py-0.5 rounded-full bg-[#10a37f]/15 text-[#13b890] border border-[#10a37f]/35 print-tag"
                                    >
                                        {{ v.category }} колонка
                                    </span>
                                </th>
                            </tr>
                            <tr class="bg-[#1c2636] text-[#8a99ad] print-th">
                                <template
                                    v-for="v in recipe.variants"
                                    :key="'sub-' + v.id"
                                >
                                    <th
                                        class="border border-[#2b394e] px-2 py-1.5 text-center w-20 font-medium print-border">
                                        Брутто, г
                                    </th>
                                    <th
                                        class="border border-[#2b394e] px-2 py-1.5 text-center w-20 font-medium print-border">
                                        Нетто, г
                                    </th>
                                </template>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="(row, rIdx) in rows"
                                :key="rIdx"
                                class="hover:bg-[#1c2636] transition-colors"
                            >
                                <td class="border border-[#2b394e] px-3.5 py-2 print-border">
                                    <div class="flex items-center gap-2">
                                        <span
                                            v-if="row.isAlternative"
                                            class="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-[#f59e0b]/15 text-[#fbbf24] border border-[#f59e0b]/35 shrink-0 print-tag"
                                        >
                                            или
                                        </span>
                                        <span :class="row.isAlternative ? 'text-[#cbd5e1]' : 'text-white'">
                                            {{ row.name }}
                                        </span>
                                    </div>
                                </td>
                                <template
                                    v-for="(cell, cIdx) in row.cells"
                                    :key="cIdx"
                                >
                                    <td
                                        class="border border-[#2b394e] px-2 py-2 text-center font-mono text-[#94a3b8] print-border print-text">
                                        {{ cell.gross }}
                                    </td>
                                    <td
                                        class="border border-[#2b394e] px-2 py-2 text-center font-mono text-white print-border print-text">
                                        <span
                                            class="px-2 py-0.5 rounded bg-[#222e42] border border-[#364761]/60 print-tag"
                                        >
                                            {{ cell.net }}
                                        </span>
                                    </td>
                                </template>
                            </tr>

                            <tr class="bg-[#182130] font-semibold print-th print-text">
                                <td class="border border-[#2b394e] px-3.5 py-2.5 text-white print-border print-text">
                                    Выход
                                </td>
                                <template
                                    v-for="v in recipe.variants"
                                    :key="'out-' + v.id"
                                >
                                    <td
                                        class="border border-[#2b394e] px-2 py-2.5 text-center font-mono text-[#64748b] print-border">
                                        —
                                    </td>
                                    <td
                                        class="border border-[#2b394e] px-2 py-2.5 text-center font-mono print-border align-middle">
                                        <span
                                            class="inline-block max-w-[220px] whitespace-normal px-2.5 py-1 rounded-lg bg-[#10a37f]/20 text-[#13b890] border border-[#10a37f]/40 text-xs leading-snug print-tag"
                                        >
                                            {{ v.output_weight }}
                                        </span>
                                    </td>
                                </template>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Примечания / сноски -->
                <div
                    v-if="recipe.footnotes"
                    class="mb-6 px-4 py-2.5 rounded-lg bg-[#182130] border border-[#2b394e] text-xs text-[#94a3b8] italic print-text"
                >
                    {{ recipe.footnotes }}
                </div>

                <!-- Текстовые блоки ТТК -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-xs leading-relaxed">
                    <div class="p-4 rounded-xl bg-[#151e29] border border-[#2b394e] print-box">
                        <div class="mb-2">
                            <span
                                class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#10a37f]/15 text-[#13b890] border border-[#10a37f]/35 print-tag"
                            >
                                Технология приготовления
                            </span>
                        </div>
                        <div class="whitespace-pre-line text-[#cbd5e1] print-text">
                            {{ recipe.technology || '—' }}
                        </div>
                    </div>

                    <div class="p-4 rounded-xl bg-[#151e29] border border-[#2b394e] print-box">
                        <div class="mb-2">
                            <span
                                class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#6366f1]/15 text-[#a5b4fc] border border-[#6366f1]/35 print-tag"
                            >
                                Требования к качеству
                            </span>
                        </div>
                        <div class="whitespace-pre-line text-[#cbd5e1] print-text">
                            {{ recipe.quality_requirements || '—' }}
                        </div>
                    </div>
                </div>

                <!-- Таблица КБЖУ (рассчитанная для каждой колонки) -->
                <div v-if="nutritionRows.length">
                    <div class="flex items-center justify-between gap-2 mb-2.5">
                        <span
                            class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#222e42] text-[#e2e8f0] border border-[#364761] print-tag"
                        >
                            Пищевая и энергетическая ценность (на выход блюда)
                        </span>
                    </div>
                    <div class="overflow-x-auto rounded-xl border border-[#2b394e] bg-[#151e29] print-border">
                        <table class="w-full border-collapse text-xs">
                            <thead>
                                <tr class="bg-[#222e42] text-[#cbd5e1] print-th">
                                    <th class="border border-[#2b394e] px-3.5 py-2 text-left font-medium print-border">
                                        Колонка
                                    </th>
                                    <th
                                        class="border border-[#2b394e] px-2 py-2 text-center w-24 font-medium print-border">
                                        Выход, г
                                    </th>
                                    <th
                                        class="border border-[#2b394e] px-2 py-2 text-center w-24 font-medium print-border">
                                        Белки, г
                                    </th>
                                    <th
                                        class="border border-[#2b394e] px-2 py-2 text-center w-24 font-medium print-border">
                                        Жиры, г
                                    </th>
                                    <th
                                        class="border border-[#2b394e] px-2 py-2 text-center w-28 font-medium print-border">
                                        Углеводы, г
                                    </th>
                                    <th
                                        class="border border-[#2b394e] px-2 py-2 text-center w-24 font-medium text-[#13b890] print-border print-text">
                                        Ккал
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="n in nutritionRows"
                                    :key="n.id"
                                    class="hover:bg-[#1c2636] transition-colors"
                                >
                                    <td class="border border-[#2b394e] px-3.5 py-2 print-border">
                                        <span
                                            class="px-2 py-0.5 rounded-full bg-[#222e42] text-[#94a3b8] border border-[#364761] font-mono print-tag"
                                        >
                                            {{ n.category }} колонка
                                        </span>
                                    </td>
                                    <td class="border border-[#2b394e] px-2 py-2 text-center font-mono print-border">
                                        {{ n.output_weight }}
                                    </td>
                                    <td
                                        class="border border-[#2b394e] px-2 py-2 text-center font-mono text-[#60a5fa] print-border print-text">
                                        {{ n.proteins_total }}
                                    </td>
                                    <td
                                        class="border border-[#2b394e] px-2 py-2 text-center font-mono text-[#fbbf24] print-border print-text">
                                        {{ n.fats_total }}
                                    </td>
                                    <td
                                        class="border border-[#2b394e] px-2 py-2 text-center font-mono text-[#c084fc] print-border print-text">
                                        {{ n.carbs_total }}
                                    </td>
                                    <td
                                        class="border border-[#2b394e] px-2 py-2 text-center font-mono font-semibold print-border">
                                        <span
                                            class="px-2.5 py-0.5 rounded-full bg-[#10a37f]/20 text-[#13b890] border border-[#10a37f]/40 print-tag"
                                        >
                                            {{ n.calories }}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </Dialog>
</template>
