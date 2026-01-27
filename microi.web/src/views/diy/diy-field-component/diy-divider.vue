<template>
    <div class="tech-divider" :class="'tech-divider--' + tagType" :data-position="contentPosition">
        <!-- 主内容区域 -->
        <div class="tech-divider__container">
            <!-- 如果有 tag 样式 -->
            <div v-if="hasTag" class="tech-divider__tag">
                <fa-icon v-if="hasIcon" :icon="field.Config.Divider.Icon" class="tech-divider__icon" />
                <span class="tech-divider__text" v-html="field.Label"></span>
            </div>
            <!-- 普通文字 -->
            <div v-else class="tech-divider__label">
                <fa-icon v-if="hasIcon" :icon="field.Config.Divider.Icon" class="tech-divider__icon" />
                <span class="tech-divider__text" v-html="field.Label"></span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, getCurrentInstance } from 'vue';

// Props定义
const props = defineProps({
    field: {
        type: Object,
        required: true
    }
});

// 获取全局属性
const instance = getCurrentInstance();
const DiyCommon = instance.appContext.config.globalProperties.DiyCommon;

// 计算属性
const contentPosition = computed(() => {
    return DiyCommon.IsNull(props.field.Config.DividerPosition) ? 'left' : props.field.Config.DividerPosition;
});

const hasTag = computed(() => {
    return props.field.Config.Divider && props.field.Config.Divider.Tag;
});

const hasIcon = computed(() => {
    return props.field.Config.Divider && props.field.Config.Divider.Icon;
});

const tagType = computed(() => {
    if (!hasTag.value) return 'default';
    return props.field.Config.Divider.Tag || 'primary';
});
</script>

<style lang="scss" scoped>
$primary-color: #1890ff;
$success-color: #52c41a;
$info-color: #722ed1;
$warning-color: #faad14;
$danger-color: #ff4d4f;

.tech-divider {
    position: relative;
    margin: 0;
    padding: 0;
    width: 100%;
    display: flex;
    align-items: center;
    
    // 性能优化：提示浏览器这些属性会变化
    will-change: transform;
    
    // 主容器
    &__container {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: var(--content-position, flex-start);
    }
    
    // 标签样式（有背景色）
    &__tag {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 12px;
        padding: 1px 32px;
        background: var(--tag-bg, linear-gradient(135deg, #{$primary-color} 0%, #40a9ff 100%));
        border-radius: 30px;
        color: #fff;
        font-weight: 700;
        font-size: 18px;
        overflow: hidden;
        box-shadow: 0 6px 24px var(--tag-shadow, rgba(24, 144, 255, 0.5)),
                    0 0 40px var(--tag-glow, rgba(24, 144, 255, 0.3)),
                    inset 0 2px 0 rgba(255, 255, 255, 0.3),
                    inset 0 -2px 0 rgba(0, 0, 0, 0.1);
        transform-style: preserve-3d;
        
        // 性能优化：只对transform和opacity做动画
        will-change: transform;
        
        // 顶部高光
        &::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 50%;
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 100%);
            border-radius: 30px 30px 0 0;
            pointer-events: none;
        }
        
        // 扫光效果 - 性能优化：使用transform而不是left
        &::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 30%;
            height: 100%;
            background: linear-gradient(90deg, 
                transparent 0%, 
                rgba(255, 255, 255, 0.5) 50%, 
                transparent 100%
            );
            transform: translateX(-100%);
            will-change: transform;
            animation: tag-shine 4s ease-in-out infinite;
        }
    }
    
    // 普通标签（无背景，边框样式）
    &__label {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 12px;
        padding: 12px 28px;
        background: linear-gradient(135deg, 
            rgba(0, 0, 0, 0.02) 0%, 
            rgba(0, 0, 0, 0.01) 100%
        );
        border: 3px solid var(--divider-color, #{$primary-color});
        border-radius: 25px;
        font-weight: 700;
        font-size: 17px;
        color: var(--divider-color, #{$primary-color});
        box-shadow: 0 0 30px var(--divider-shadow, rgba(24, 144, 255, 0.4)),
                    0 4px 16px rgba(0, 0, 0, 0.08),
                    inset 0 0 30px var(--divider-shadow, rgba(24, 144, 255, 0.15));
        backdrop-filter: blur(10px);
        will-change: transform;
        
        // 内发光
        &::before {
            content: '';
            position: absolute;
            inset: -3px;
            border-radius: 25px;
            padding: 3px;
            background: linear-gradient(135deg, 
                var(--divider-color, #{$primary-color}), 
                transparent 50%,
                var(--divider-color, #{$primary-color})
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask-composite: exclude;
            opacity: 0.6;
            will-change: transform;
            animation: border-glow 3s ease-in-out infinite;
        }
    }
    
    // 图标 - 简化动画
    &__icon {
        font-size: 20px;
        filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
        will-change: transform;
        animation: icon-float 3s ease-in-out infinite;
    }
    
    // 文字
    &__text {
        position: relative;
        z-index: 2;
        white-space: nowrap;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    
    // 位置调整
    &[data-position="left"] {
        .tech-divider__container {
            justify-content: flex-start;
        }
    }
    
    &[data-position="center"] {
        .tech-divider__container {
            justify-content: center;
        }
    }
    
    &[data-position="right"] {
        .tech-divider__container {
            justify-content: flex-end;
        }
    }
    
    // 颜色主题
    &--primary {
        --divider-color: #{$primary-color};
        --divider-shadow: rgba(24, 144, 255, 0.4);
        --tag-bg: linear-gradient(135deg, #{$primary-color} 0%, #40a9ff 100%);
        --tag-shadow: rgba(24, 144, 255, 0.5);
        --tag-glow: rgba(24, 144, 255, 0.3);
    }
    
    &--success {
        --divider-color: #{$success-color};
        --divider-shadow: rgba(82, 196, 26, 0.4);
        --tag-bg: linear-gradient(135deg, #{$success-color} 0%, #73d13d 100%);
        --tag-shadow: rgba(82, 196, 26, 0.5);
        --tag-glow: rgba(82, 196, 26, 0.3);
    }
    
    &--info {
        --divider-color: #{$info-color};
        --divider-shadow: rgba(114, 46, 209, 0.4);
        --tag-bg: linear-gradient(135deg, #{$info-color} 0%, #9254de 100%);
        --tag-shadow: rgba(114, 46, 209, 0.5);
        --tag-glow: rgba(114, 46, 209, 0.3);
    }
    
    &--warning {
        --divider-color: #{$warning-color};
        --divider-shadow: rgba(250, 173, 20, 0.4);
        --tag-bg: linear-gradient(135deg, #{$warning-color} 0%, #ffc53d 100%);
        --tag-shadow: rgba(250, 173, 20, 0.5);
        --tag-glow: rgba(250, 173, 20, 0.3);
    }
    
    &--danger {
        --divider-color: #{$danger-color};
        --divider-shadow: rgba(255, 77, 79, 0.4);
        --tag-bg: linear-gradient(135deg, #{$danger-color} 0%, #ff7875 100%);
        --tag-shadow: rgba(255, 77, 79, 0.5);
        --tag-glow: rgba(255, 77, 79, 0.3);
    }
    
    &--default {
        --divider-color: #{$primary-color};
        --divider-shadow: rgba(24, 144, 255, 0.4);
    }
}

// 动画 - 性能优化：只使用transform和opacity
@keyframes tag-shine {
    0% {
        transform: translateX(-100%);
    }
    50%, 100% {
        transform: translateX(400%);
    }
}

@keyframes border-glow {
    0%, 100% {
        opacity: 0.4;
    }
    50% {
        opacity: 0.8;
    }
}

@keyframes icon-float {
    0%, 100% {
        transform: translateY(0) scale(1);
    }
    50% {
        transform: translateY(-3px) scale(1.05);
    }
}
</style>
