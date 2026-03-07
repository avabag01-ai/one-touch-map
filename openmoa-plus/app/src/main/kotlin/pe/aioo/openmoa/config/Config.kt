package pe.aioo.openmoa.config

import android.content.Context
import android.content.SharedPreferences

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

        // Sensitivity levels: minimum distance (px) from original touch point
        const val SENSITIVITY_SHORT = 40f
        const val SENSITIVITY_MEDIUM = 80f
        const val SENSITIVITY_LONG = 120f

        fun fromPreferences(context: Context): Config {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val sensitivity = prefs.getFloat(KEY_SENSITIVITY, SENSITIVITY_MEDIUM)
            return Config(gestureThreshold = sensitivity)
        }

        fun saveSensitivity(context: Context, value: Float) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putFloat(KEY_SENSITIVITY, value)
                .apply()
        }
    }
}
