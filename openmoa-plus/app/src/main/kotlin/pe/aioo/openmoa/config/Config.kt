package pe.aioo.openmoa.config

import android.content.Context

data class Config(
    val longPressRepeatTime: Long = 50L,
    val longPressThresholdTime: Long = 500L,
    val gestureThreshold: Float = 80f,
    val hapticFeedback: Boolean = true,
    val maxSuggestionCount: Int = 10,
    val showRadialOverlay: Boolean = true,
    val showHint: Boolean = true,
    val showTopPreview: Boolean = true,
    val realtimeComposing: Boolean = true,
    val doubleTapDeleteTime: Long = 300L,
) {
    companion object {
        const val PREFS_NAME = "openmoa_settings"
        const val KEY_SENSITIVITY = "gesture_sensitivity"

        const val SENSITIVITY_SHORT = 40f
        const val SENSITIVITY_MEDIUM = 80f
        const val SENSITIVITY_LONG = 120f

        fun saveSensitivity(context: Context, value: Float) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putFloat(KEY_SENSITIVITY, value)
                .apply()
        }
    }
}
