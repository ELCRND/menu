<script setup>
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'

const visible = defineModel('visible', { type: Boolean, default: false })

const props = defineProps({
    recipes: { type: Array, default: () => [] },
    defaultCategory: { type: String, default: null }
})

const emit = defineEmits(['confirm'])

const search = ref('')
const chosenRecipe = ref(null)
const chosenVariantId = ref(null)
const customOutputGrams = ref(0)

// Сброс формы при каждом открытии окна
watch(visible, (isOpen) => {
    if (isOpen) {
        search.value = ''
        chosenRecipe.value = null
        chosenVariantId.value = null
        customOutputGrams.value = 0
    }
})

const filteredRecipes = computed(() => {
    const q = search.value.toLowerCase().trim()
    if (!q) return props.recipes.slice(0, 30)
    return props.recipes.filter(
        r => r.title.toLowerCase().includes(q) || String(r.recipe_number) === q
    )
})

const selectedVariant = computed(() => {
    if (!chosenRecipe.value || !chosenVariantId.value) return null
    return chosenRecipe.value.variants.find(v => v.id === chosenVariantId.value) || null
})

watch(selectedVariant, (newVar) => {
    if (newVar?.output_weight) {
        customOutputGrams.value = newVar.output_weight
    }
})

const calculatedMultiplier = computed(() => {
    const base = selectedVariant.value?.output_weight
    if (!base || !customOutputGrams.value) return 1.0
    return customOutputGrams.value / base
})

function selectRecipe(recipe) {
    chosenRecipe.value = recipe
    const match = recipe.variants.find(v => v.category === props.defaultCategory) || recipe.variants[0]
    chosenVariantId.value = match ? match.id : null
}

function submit() {
    if (!chosenRecipe.value || !chosenVariantId.value) return
    emit('confirm', {
        recipe_id: chosenRecipe.value.id,
        variant_id: chosenVariantId.value,
        portion_multiplier: calculatedMultiplier.value
    })
    visible.value = false
}
</script>

<template>
    <Dialog
        v-model:visible="visible"
        modal
        header="Выбор блюда из картотеки ТТК"
        class="w-11/12 max-w-2xl xui-dialog"
        contentClass="!bg-[#1c2636] !text-[#e2e8f0]"
    >
        <div class="space-y-4 pt-2">
            <InputText
                v-model="search"
                placeholder="Введите номер рецепта или название блюда..."
                class="w-full xui-input"
            />

            <!-- Список найденных рецептов -->
            <div class="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                <div
                    v-for="rec in filteredRecipes"
                    :key="rec.id"
                    @click="selectRecipe(rec)"
                    class="p-2.5 rounded-lg border cursor-pointer flex items-center justify-between transition-colors"
                    :class="chosenRecipe?.id === rec.id
                        ? 'bg-[#10a37f]/15 border-[#10a37f] text-white'
                        : 'bg-[#151e29] border-[#2b394e] text-[#cbd5e1] hover:border-[#364761]'"
                >
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="font-mono text-xs text-[#13b890] font-semibold">№{{ rec.recipe_number }}</span>
                        <span class="text-xs truncate">{{ rec.title }}</span>
                    </div>
                    <span class="text-[11px] text-[#8a99ad] shrink-0">{{ rec.section }}</span>
                </div>
            </div>

            <!-- Параметры выбранного блюда -->
            <div
                v-if="chosenRecipe"
                class="p-3.5 rounded-xl bg-[#151e29] border border-[#2b394e] space-y-3"
            >
                <div class="text-xs font-semibold text-white">
                    Параметры закладки для: <span class="text-[#13b890]">{{ chosenRecipe.title }}</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[11px] text-[#8a99ad] mb-1">Колонка ТТК (выход):</label>
                        <Select
                            v-model="chosenVariantId"
                            :options="chosenRecipe.variants"
                            optionValue="id"
                            class="w-full xui-select"
                        >
                            <template #option="{ option }">
                                <span>{{ option.category }} колонка — {{ option.output_weight }} г</span>
                            </template>
                            <template #value>
                                <span v-if="selectedVariant">
                                    {{ selectedVariant.category }} колонка — {{ selectedVariant.output_weight }} г
                                </span>
                            </template>
                        </Select>
                    </div>

                    <div>
                        <label class="block text-[11px] text-[#8a99ad] mb-1">
                            Выход порции, г (база: {{ selectedVariant?.output_weight || 0 }} г):
                        </label>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            v-model.number="customOutputGrams"
                            @focus="$event.target.select()"
                            class="w-full h-8.5 px-3 rounded-lg bg-[#1c2636] border border-[#2b394e] text-white font-mono text-sm focus:border-[#10a37f] outline-none"
                        />
                    </div>
                </div>

                <div class="flex justify-end gap-2 pt-2">
                    <Button
                        label="Отмена"
                        class="xui-btn xui-btn-slate"
                        @click="visible = false"
                    />
                    <Button
                        label="Добавить в меню"
                        icon="pi pi-check"
                        class="xui-btn xui-btn-teal"
                        @click="submit"
                    />
                </div>
            </div>
        </div>
    </Dialog>
</template>
