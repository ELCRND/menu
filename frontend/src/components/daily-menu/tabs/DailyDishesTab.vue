<script setup>
defineProps({
    items: { type: Array, default: () => [] }
})

const emit = defineEmits(['update-alternative'])
</script>

<template>
    <div class="p-5 space-y-3 no-print">
        <div
            v-for="item in items"
            :key="item.id"
            class="p-3.5 rounded-xl bg-[#151e29] border border-[#2b394e] flex flex-wrap items-center justify-between gap-4"
        >
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-0.5 rounded bg-[#6366f1]/15 text-[#a5b4fc] text-[11px] font-medium">
                        {{ item.meal_name }}
                    </span>
                    <span class="px-2 py-0.5 rounded bg-[#10a37f]/15 text-[#13b890] font-mono text-[11px] font-bold">
                        {{ item.diet_code }}
                    </span>
                    <span class="font-mono text-xs text-[#8a99ad]">№{{ item.recipe_number }}</span>
                    <span class="text-xs font-semibold text-white">{{ item.recipe_title }}</span>
                </div>
                <div class="text-[11px] text-[#8a99ad] font-mono">
                    Колонка: {{ item.variant_category }} · Выход порции:
                    {{ Math.round(item.output_weight * item.portion_multiplier) }} г
                </div>
            </div>

            <!-- Селектор замены взаимозаменяемого продукта -->
            <div
                v-if="item.alternatives?.length"
                class="flex flex-wrap items-center gap-2"
            >
                <div
                    v-for="alt in item.alternatives"
                    :key="alt.groupId"
                    class="flex items-center gap-2"
                >
                    <span class="text-[11px] text-[#fbbf24]">Сырье на день:</span>
                    <select
                        :value="item.selected_alternatives[alt.groupId] || alt.options.id"
                        @change="emit('update-alternative', item, alt.groupId, Number($event.target.value))"
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
</template>
