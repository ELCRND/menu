<script setup>
import Select from 'primevue/select'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'

const date = defineModel('date', { type: String, required: true })
const templateId = defineModel('templateId')
const day = defineModel('day', { type: Number, default: 1 })

defineProps({
    templates: { type: Array, default: () => [] },
    currentTemplate: { type: Object, default: null },
    headcountForm: { type: Array, default: () => [] },
    totalPeople: { type: Number, default: 0 },
    hasDailyData: { type: Boolean, default: false }
})

const emit = defineEmits(['copy-yesterday', 'save-headcount', 'generate'])

const numberInputPt = {
    root: { class: 'h-8' },
    pcInputText: {
        root: {
            class: '!w-full !h-8 !px-2 !rounded !bg-[#1c2636] !border-[#2b394e] !text-white !font-mono !text-[16px] focus:!border-[#10a37f] !shadow-none'
        }
    },
    incrementButton: { class: '!bg-[#2b394e] !border-[#2b394e] !text-white !w-6 !p-0 hover:!bg-[#364761]' },
    decrementButton: { class: '!bg-[#2b394e] !border-[#2b394e] !text-white !w-6 !p-0 hover:!bg-[#364761]' }
}
</script>

<template>
    <div class="bg-[#1c2636] border border-[#2b394e] rounded-xl p-5 mb-6 shadow-lg no-print">
        <div class="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-[#2b394e]">
            <div class="flex flex-wrap items-center gap-3">
                <div>
                    <label class="block text-[11px] text-[#8a99ad] mb-1">Дата меню-раскладки:</label>
                    <input
                        type="date"
                        v-model="date"
                        class="h-10 px-3 rounded-lg bg-[#151e29] border border-[#2b394e] text-sm text-white focus:border-[#10a37f] outline-none"
                    />
                </div>

                <div>
                    <label class="block text-[11px] text-[#8a99ad] mb-1">Типовой шаблон:</label>
                    <Select
                        v-model="templateId"
                        :options="templates"
                        optionLabel="name"
                        optionValue="id"
                        class="w-64 h-10 xui-select"
                    />
                </div>

                <div v-if="currentTemplate">
                    <label class="block text-[11px] text-[#8a99ad] mb-1">День цикла:</label>
                    <Select
                        v-model="day"
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
                    @click="emit('copy-yesterday')"
                />

                <Button
                    v-if="hasDailyData"
                    label="Обновить"
                    icon="pi pi-users"
                    class="h-10 xui-btn xui-btn-teal"
                    @click="emit('save-headcount')"
                />

                <Button
                    :label="hasDailyData ? 'Пересчитать меню' : 'Сформировать меню'"
                    icon="pi pi-bolt"
                    :disabled="totalPeople === 0"
                    class="h-10 xui-btn xui-btn-teal"
                    @click="emit('generate')"
                />
            </div>
        </div>

        <div
            v-if="totalPeople === 0"
            class="my-3 text-[#fbbf24] flex items-center gap-1.5 text-xs"
        >
            <i class="pi pi-info-circle"></i>
            <span>Укажите количество питающихся хотя бы по одному столу, чтобы сформировать меню.</span>
        </div>

        <!-- Сетка ввода количества человек по столам -->
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
                        <label class="block text-[#8a99ad] mb-1">Общий:</label>
                        <InputNumber
                            v-model="row.regular"
                            :min="0"
                            showButtons
                            buttonLayout="stacked"
                            fluid
                            :pt="numberInputPt"
                        />
                    </div>

                    <div>
                        <label class="block text-[#8a99ad] mb-1">Протертый:</label>
                        <InputNumber
                            v-model="row.pureed"
                            :min="0"
                            showButtons
                            buttonLayout="stacked"
                            fluid
                            :pt="numberInputPt"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
