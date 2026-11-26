<script setup>
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'

const visible = defineModel('visible', { type: Boolean, default: false })

const props = defineProps({
    mode: { type: String, default: 'create' }, // 'create' | 'rename'
    templates: { type: Array, default: () => [] },
    currentTemplate: { type: Object, default: null }
})

const emit = defineEmits(['create', 'rename'])

const form = ref({
    name: '',
    days_count: 14,
    copy_from_id: null
})

watch(visible, (isOpen) => {
    if (!isOpen) return
    if (props.mode === 'rename' && props.currentTemplate) {
        form.value.name = props.currentTemplate.name
    } else {
        form.value = { name: '', days_count: 14, copy_from_id: null }
    }
})

function submit() {
    const trimmedName = form.value.name.trim()
    if (!trimmedName) return

    if (props.mode === 'create') {
        emit('create', { ...form.value, name: trimmedName })
    } else {
        emit('rename', trimmedName)
    }
    visible.value = false
}
</script>

<template>
    <Dialog
        v-model:visible="visible"
        modal
        :header="mode === 'create' ? 'Новый шаблон типового меню' : 'Переименовать шаблон меню'"
        class="w-11/12 max-w-md xui-dialog"
        contentClass="!bg-[#1c2636] !text-[#e2e8f0]"
    >
        <div class="space-y-4 pt-2">
            <div>
                <label class="block text-[11px] text-[#8a99ad] mb-1">
                    {{ mode === 'create' ? 'Название меню:' : 'Новое название:' }}
                </label>
                <InputText
                    v-model="form.name"
                    :placeholder="mode === 'create' ? 'Например: 14-дневное весенне-летнее меню' : ''"
                    @keyup.enter="submit"
                    class="w-full xui-input"
                />
            </div>

            <template v-if="mode === 'create'">
                <div>
                    <label class="block text-[11px] text-[#8a99ad] mb-1">Цикличность (количество дней):</label>
                    <Select
                        v-model="form.days_count"
                        :options="[
                            { label: '7 дней (недельное)', value: 7 },
                            { label: '10 дней (декадное)', value: 10 },
                            { label: '14 дней (двухнедельное)', value: 14 }
                        ]"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full xui-select"
                    />
                </div>

                <div>
                    <label class="block text-[11px] text-[#8a99ad] mb-1">Взять за основу (необязательно):</label>
                    <Select
                        v-model="form.copy_from_id"
                        :options="templates"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Пустое меню"
                        showClear
                        class="w-full xui-select"
                    />
                </div>
            </template>

            <div class="flex justify-end gap-2 pt-2">
                <Button
                    label="Отмена"
                    class="xui-btn xui-btn-slate"
                    @click="visible = false"
                />
                <Button
                    :label="mode === 'create' ? 'Создать шаблон' : 'Сохранить'"
                    icon="pi pi-check"
                    :disabled="!form.name.trim()"
                    class="xui-btn xui-btn-teal"
                    @click="submit"
                />
            </div>
        </div>
    </Dialog>
</template>
