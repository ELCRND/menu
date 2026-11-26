<script setup>
const props = defineProps({
    rows: { type: Array, default: () => [] },
    date: { type: String, required: true },
    totalPeople: { type: Number, default: 0 }
})

function getMealRowspan(index) {
    const currentMeal = props.rows[index]?.meal_name
    if (index > 0 && props.rows[index - 1]?.meal_name === currentMeal) {
        return 0
    }

    let count = 1
    for (let i = index + 1; i < props.rows.length; i++) {
        if (props.rows[i]?.meal_name === currentMeal) count++
        else break
    }
    return count
}
</script>

<template>
    <div
        id="print-area"
        class="p-6"
    >
        <div class="mb-4 pb-3 border-b border-[#2b394e] print-header">
            <h2 class="text-base font-bold text-white print-title">
                Раздаточная ведомость на пищеблок на {{ date }}
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
                    <th class="border border-[#2b394e] px-3 py-2 text-center w-28 print-border">Протертых, шт</th>
                    <th class="border border-[#2b394e] px-3 py-2 text-center w-24 print-border">Итого, шт</th>
                </tr>
            </thead>
            <tbody class="border border-[#2b394e] border-collapse">
                <tr
                    v-for="(row, idx) in rows"
                    :key="idx"
                    class="hover:bg-[#151e29]"
                >
                    <td
                        v-if="getMealRowspan(idx) > 0"
                        :rowspan="getMealRowspan(idx)"
                        class="border border-[#2b394e] px-3 py-2 align-top font-semibold print-border"
                    >
                        {{ row.meal_name }}
                    </td>
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
</template>
