package pe.aioo.openmoa.config

data class Config (
    val longPressRepeatTime: Long = 50L,
    val longPressThresholdTime: Long = 500L,
    val gestureThreshold: Float = 50f,
    val hapticFeedback: Boolean = true,
    val maxSuggestionCount: Int = 10,
    val showRadialOverlay: Boolean = true,
    val showHint: Boolean = true,
    val showTopPreview: Boolean = true,
    val realtimeComposing: Boolean = true,
    val doubleTapDeleteTime: Long = 300L,
)
