<script setup>
defineProps({
    products: { type: Array, default: () => [] },
    date: { type: String, required: true },
    day: { type: Number, required: true },
    totalPeople: { type: Number, default: 0 }
})
</script>

<template>
    <div
        id="print-area"
        class="p-6"
    >
        <div class="mb-4 pb-3 border-b border-[#2b394e] print-header">
            <h2 class="text-base font-bold text-white print-title">
                Сводная продуктовая ведомость (Меню-требование) на {{ date }}
            </h2>
            <p class="text-xs text-[#8a99ad] print-text mt-1">
                Всего питающихся: {{ totalPeople }} чел. (День цикла №{{ day }})
            </p>
        </div>

        <table class="w-full border-collapse text-xs print-border">
            <thead>
                <tr class="bg-[#222e42] text-white print-th">
                    <th class="border border-[#2b394e] px-3 py-2 text-center w-12 print-border">№</th>
                    <th class="border border-[#2b394e] px-3 py-2 text-left print-border">Наименование продукта</th>
                    <th class="border border-[#2b394e] px-3 py-2 text-right w-32 print-border">Брутто, г</th>
                    <th class="border border-[#2b394e] px-3 py-2 text-right w-32 print-border">Брутто, кг</th>
                    <th class="border border-[#2b394e] px-3 py-2 text-right w-32 print-border">Нетто, г</th>
                    <th class="border border-[#2b394e] px-3 py-2 text-right w-32 print-border">Нетто, кг</th>
                </tr>
            </thead>
            <tbody>
                <tr
                    v-for="(prod, idx) in products"
                    :key="prod.name"
                    class="hover:bg-[#151e29]"
                >
                    <td class="border border-[#2b394e] px-3 py-2 text-center font-mono print-border">
                        {{ idx + 1 }}
                    </td>
                    <td class="border border-[#2b394e] px-3 py-2 font-medium print-border">
                        {{ prod.name }}
                    </td>
                    <td
                        class="border border-[#2b394e] px-3 py-2 text-right font-mono text-[#94a3b8] print-border print-text">
                        <span
                            v-if="prod.pieces_label"
                            class="text-[#fbbf24] font-semibold print-text"
                        >
                            {{ prod.pieces_label }}
                        </span>
                        <span v-else>{{ Math.round(prod.gross_grams) }}</span>
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
</template>
