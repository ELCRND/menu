<script setup>
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Button from 'primevue/button'

const visible = defineModel('visible', { type: Boolean, default: false })

const props = defineProps({
    item: { type: Object, default: null },
    recipes: { type: Array, default: () => [] }
})

const emit = defineEmits(['confirm'])

const variantId = ref(null)
const outputGrams = ref(0)

const recipeObj = computed(() => {
    if (!props.item) return null
    return props.recipes.find(r => r.id === props.item.recipe_id) || null
})

const variantObj = computed(() => {
    if (!recipeObj.value || !variantId.value) return null
    return recipeObj.value.variants.find(v => v.id === variantId.value) || null
})

// Инициализируем поля при открытии
watch(visible, (isOpen) => {
    if (isOpen && props.item) {
        variantId.value = props.item.variant_id
        outputGrams.value = Math.round((props.item.output_weight || 0) * (props.item.portion_multiplier || 1))
    }
})

// При смене колонки вручную подставляем её стандартный выход
watch(variantId, (newId, oldId) => {
    if (!visible.value || !oldId || !variantObj.value) return
    outputGrams.value = variantObj.value.output_weight
})

function submit() {
    if (!props.item || !variantObj.value) return
    const baseWeight = variantObj.value.output_weight || 1
    emit('confirm', {
        variant_id: variantId.value,
        portion_multiplier: outputGrams.value / baseWeight
    })
    visible.value = false
}
</script>

<template>
    <Dialog
        v-model:visible="visible"
        modal
        header="Редактирование порции блюда"
        class="w-11/12 max-w-md xui-dialog"
        contentClass="!bg-[#1c2636] !text-[#e2e8f0]"
    >
        <div
            v-if="recipeObj"
            class="space-y-4 pt-2"
        >
            <div class="text-xs font-semibold text-white">
                №{{ recipeObj.recipe_number }} {{ recipeObj.title }}
            </div>

            <div>
                <label class="block text-[11px] text-[#8a99ad] mb-1">Колонка ТТК:</label>
                <Select
                    v-model="variantId"
                    :options="recipeObj.variants"
                    optionValue="id"
                    class="w-full xui-select"
                >
                    <template #option="{ option }">
                        <span>{{ option.category }} колонка — {{ option.output_weight }} г</span>
                    </template>
                    <template #value>
                        <span v-if="variantObj">
                            {{ variantObj.category }} колонка — {{ variantObj.output_weight }} г
                        </span>
                    </template>
                </Select>
            </div>

            <div>
                <label class="block text-[11px] text-[#8a99ad] mb-1">
                    Выход порции, г (база: {{ variantObj?.output_weight || 0 }} г):
                </label>
                <input
                    type="number"
                    min="1"
                    v-model.number="outputGrams"
                    @focus="$event.target.select()"
                    @keyup.enter="submit"
                    class="w-full h-10 px-3 rounded-lg bg-[#151e29] border border-[#2b394e] text-white font-mono text-sm focus:border-[#10a37f] outline-none"
                />
            </div>

            <div class="flex justify-end gap-2 pt-2">
                <Button
                    label="Отмена"
                    class="xui-btn xui-btn-slate"
                    @click="visible = false"
                />
                <Button
                    label="Сохранить"
                    icon="pi pi-check"
                    class="xui-btn xui-btn-teal"
                    @click="submit"
                />
            </div>
        </div>
    </Dialog>
</template>
