<script setup>
defineProps({
    recipe: { type: Object, required: true }
})

const emit = defineEmits(['select', 'toggle-favorite'])
</script>

<template>
    <div
        @click="emit('select')"
        class="group cursor-pointer flex flex-col justify-between rounded-xl border border-[#2b394e] bg-[#1c2636] overflow-hidden hover:border-[#10a37f] hover:shadow-lg hover:shadow-[#10a37f]/10 transition-all duration-200"
    >
        <div>
            <!-- Верхний блок с изображением -->
            <div class="relative h-32 bg-[#151e29] border-b border-[#2b394e] overflow-hidden">
                <img
                    :src="recipe.image_url || 'placeholder-600x400.webp'"
                    :alt="recipe.title"
                    class="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-[#1c2636] via-[#1c2636]/20 to-transparent"></div>

                <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span
                        class="px-2.5 py-0.5 rounded-full bg-[#151e29]/90 backdrop-blur-sm border border-[#13b890]/45 text-[#13b890] font-mono text-[14px] font-semibold"
                    >
                        № {{ recipe.recipe_number }}
                    </span>
                </div>

                <button
                    type="button"
                    @click.stop="emit('toggle-favorite')"
                    aria-label="Добавить в избранное"
                    class="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg border flex items-center justify-center transition-all shadow-sm cursor-pointer"
                    :class="recipe.is_favorite
                        ? 'bg-[#f59e0b]/40 border-[#f59e0b]/50 text-[#fbbf24]'
                        : 'bg-[#222e42]/90 border-[#364761] text-[#8a99ad] hover:text-white hover:border-[#10a37f]'"
                >
                    <i
                        :class="recipe.is_favorite ? 'pi pi-star-fill' : 'pi pi-star'"
                        class="text-xs"
                    ></i>
                </button>
            </div>

            <!-- Контент и теги карточки -->
            <div class="p-4">
                <div class="flex flex-wrap items-center gap-1.5 mb-2.5">
                    <span
                        v-if="recipe.section"
                        class="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#10a37f]/15 text-[#13b890] border border-[#10a37f]/35 truncate max-w-full"
                    >
                        {{ recipe.section }}
                    </span>
                    <span
                        v-if="recipe.variants?.[0]?.output_weight"
                        class="px-2 py-0.5 rounded-full text-[11px] font-mono bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/40"
                    >
                        Выход: {{ recipe.variants[0].output_weight }} г
                    </span>
                </div>

                <h3
                    class="text-sm font-semibold text-white leading-snug mb-2 group-hover:text-[#13b890] transition-colors">
                    {{ recipe.title }}
                </h3>

                <p class="text-xs text-[#8a99ad] line-clamp-3 leading-relaxed">
                    {{ recipe.technology || 'Описание технологии не указано.' }}
                </p>
            </div>
        </div>

        <!-- Нижний футер карточки -->
        <div class="px-4 py-2.5 bg-[#182130] border-t border-[#2b394e] flex justify-between items-center">
            <span
                class="px-2.5 py-1 rounded-md bg-[#222e42] group-hover:bg-[#10a37f] text-[#cbd5e1] group-hover:text-white border border-[#364761] group-hover:border-[#10a37f] text-[11px] font-medium transition-colors flex items-center gap-1.5"
            >
                <i class="pi pi-table text-[10px]"></i>
                Открыть ТТК
            </span>
            <span
                class="px-2 py-0.5 rounded-full bg-[#151e29] border border-[#2b394e] text-[11px] font-mono text-[#64748b] group-hover:text-[#13b890] group-hover:border-[#10a37f]/40 transition-colors"
            >
                ID:{{ recipe.id }}
            </span>
        </div>
    </div>
</template>
