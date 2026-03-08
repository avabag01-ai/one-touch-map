package pe.aioo.openmoa.view.keytouchlistener

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.view.MotionEvent
import android.view.View
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import pe.aioo.openmoa.OpenMoaIME
import pe.aioo.openmoa.config.Config
import pe.aioo.openmoa.hangul.MoeumGestureProcessor
import pe.aioo.openmoa.view.message.SpecialKey
import pe.aioo.openmoa.view.message.SpecialKeyMessage
import pe.aioo.openmoa.view.message.StringKeyMessage
import kotlin.math.*

class JaumKeyTouchListener(
    context: Context,
    private val key: String,
) : BaseKeyTouchListener(context) {

    // Read sensitivity from SharedPreferences directly (avoids Koin context issues)
    private val gestureThresholdFromPrefs: Float = context
        .getSharedPreferences(Config.PREFS_NAME, Context.MODE_PRIVATE)
        .getFloat(Config.KEY_SENSITIVITY, Config.SENSITIVITY_MEDIUM)

    // Original touch point - never reset during a gesture
    private var originX: Float = 0f
    private var originY: Float = 0f
    // Tracking point for direction calculation
    private var startX: Float = 0f
    private var startY: Float = 0f
    private val moeumGestureProcessor = MoeumGestureProcessor()
    private val broadcastManager = LocalBroadcastManager.getInstance(context)

    private var currentDirection: String? = null
    private var touchCenterX: Float = 0f
    private var touchCenterY: Float = 0f
    private var gestureActivated: Boolean = false

    companion object {
        private var lastTapTime: Long = 0L
        private var lastTapKey: String? = null
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouch(view: View, motionEvent: MotionEvent): Boolean {
        when (motionEvent.action) {
            MotionEvent.ACTION_DOWN -> {
                val now = System.currentTimeMillis()
                if (lastTapKey == key && (now - lastTapTime) < config.doubleTapDeleteTime) {
                    // Double-tap detected: send backspace instead
                    lastTapKey = null
                    lastTapTime = 0L
                    sendKeyMessage(SpecialKeyMessage(SpecialKey.BACKSPACE))
                    return super.onTouch(view, motionEvent)
                }
                lastTapKey = key
                lastTapTime = now

                originX = motionEvent.x
                originY = motionEvent.y
                startX = motionEvent.x
                startY = motionEvent.y
                touchCenterX = motionEvent.rawX
                touchCenterY = motionEvent.rawY
                currentDirection = null
                gestureActivated = false
                moeumGestureProcessor.clear()

                // Broadcast gesture start for overlay
                broadcastManager.sendBroadcast(
                    Intent(OpenMoaIME.GESTURE_ACTION).apply {
                        putExtra("type", "start")
                        putExtra("key", key)
                        putExtra("centerX", touchCenterX)
                        putExtra("centerY", touchCenterY)
                    }
                )
            }
            MotionEvent.ACTION_MOVE -> {
                val currentX = motionEvent.x
                val currentY = motionEvent.y

                // Check distance from ORIGINAL touch point (not last sample)
                val distFromOrigin = sqrt(
                    (currentX - originX).pow(2) + (currentY - originY).pow(2)
                )

                // Only activate gesture recognition once total distance exceeds threshold
                if (distFromOrigin > gestureThresholdFromPrefs) {
                    // For direction calculation, use distance from last tracking point
                    val distFromLast = sqrt(
                        (currentX - startX).pow(2) + (currentY - startY).pow(2)
                    )
                    // Use a smaller threshold for subsequent direction changes
                    val segmentThreshold = if (gestureActivated) 30f else gestureThresholdFromPrefs
                    if (distFromLast > segmentThreshold) {
                        val degree = (atan2(currentY - startY, currentX - startX) * 180f) / PI
                        startX = currentX
                        startY = currentY
                        gestureActivated = true
                        val direction: String? = when {
                            0.001f <= abs(degree) && abs(degree) < 22.5f -> "ㅏ"
                            abs(degree) < 67.5f -> if (degree > 0) "ㅡR" else "ㅣR"
                            abs(degree) < 112.5f -> if (degree > 0) "ㅜ" else "ㅗ"
                            abs(degree) < 157.5f -> if (degree > 0) "ㅡL" else "ㅣL"
                            abs(degree) <= 179.999f -> "ㅓ"
                            else -> null
                        }
                        if (direction != null) {
                            moeumGestureProcessor.appendMoeum(direction)
                            currentDirection = direction

                            // Broadcast current preview for real-time composing
                            val previewMoeum = moeumGestureProcessor.peekResolve()
                            val fullState = moeumGestureProcessor.peekFullState()
                            broadcastManager.sendBroadcast(
                                Intent(OpenMoaIME.GESTURE_ACTION).apply {
                                    putExtra("type", "move")
                                    putExtra("key", key)
                                    putExtra("direction", direction)
                                    putExtra("previewMoeum", previewMoeum ?: "")
                                    putExtra("fullState", fullState ?: "")
                                }
                            )
                        }
                    }
                }
            }
            MotionEvent.ACTION_UP -> {
                // Broadcast gesture end
                broadcastManager.sendBroadcast(
                    Intent(OpenMoaIME.GESTURE_ACTION).apply {
                        putExtra("type", "end")
                    }
                )

                sendKeyMessage(StringKeyMessage(key))
                // Only send vowel if gesture was actually activated (sufficient distance)
                if (gestureActivated) {
                    moeumGestureProcessor.resolveMoeumList()?.let {
                        sendKeyMessage(StringKeyMessage(it))
                    }
                }
            }
        }
        return super.onTouch(view, motionEvent)
    }

}
