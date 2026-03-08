package pe.aioo.openmoa.handwriting

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.*
import android.os.Handler
import android.os.Looper
import android.util.AttributeSet
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.digitalink.Ink
import com.onetouchmap.keyboard.R

/**
 * Full-overlay handwriting canvas. Captures finger strokes,
 * renders them, and triggers recognition after a pause.
 *
 * Shows candidate bar at top; tap a candidate to commit it.
 */
class HandwritingCanvasView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    interface Listener {
        fun onTextCommitted(text: String)
        fun onDismiss()
    }

    var listener: Listener? = null

    private val recognizer = DigitalInkRecognizer(context)
    private val handler = Handler(Looper.getMainLooper())
    private val recognizeDelay = 800L  // ms after last stroke to trigger recognition

    // Drawing state
    private val strokes = mutableListOf<List<PointF>>()
    private var currentStroke = mutableListOf<PointF>()
    private val inkBuilder = Ink.builder()
    private var strokeBuilder: Ink.Stroke.Builder? = null
    private var strokeStartTime = 0L

    // Drawing canvas
    private val canvasView = DrawingCanvas(context)

    // Candidate bar
    private val candidateBar = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        setBackgroundColor(ContextCompat.getColor(context, R.color.keyboard_background))
        setPadding(8, 4, 8, 4)
    }

    // Label showing "영어 필기" mode indicator
    private val modeLabel = TextView(context).apply {
        text = "영어 필기"
        setTextColor(ContextCompat.getColor(context, R.color.key_foreground))
        alpha = 0.5f
        textSize = 14f
        setPadding(12, 4, 12, 4)
    }

    // Clear button
    private val clearBtn = TextView(context).apply {
        text = "지우기"
        setTextColor(ContextCompat.getColor(context, R.color.key_foreground))
        textSize = 14f
        setPadding(12, 4, 12, 4)
        setOnClickListener { clearCanvas() }
    }

    init {
        // Background
        setBackgroundColor(ContextCompat.getColor(context, R.color.keyboard_background))

        // Candidate bar at top
        val barParams = LayoutParams(LayoutParams.MATCH_PARENT, dp(36))
        barParams.gravity = Gravity.TOP
        candidateBar.addView(modeLabel)
        candidateBar.addView(
            View(context).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) }
        )
        candidateBar.addView(clearBtn)
        addView(candidateBar, barParams)

        // Drawing area below candidate bar
        val canvasParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        canvasParams.topMargin = dp(36)
        addView(canvasView, canvasParams)
    }

    fun show() {
        clearCanvas()
        visibility = VISIBLE
    }

    fun hide() {
        visibility = GONE
        handler.removeCallbacksAndMessages(null)
    }

    private fun clearCanvas() {
        strokes.clear()
        currentStroke.clear()
        inkBuilder.let { /* Ink.Builder is immutable once built; we need a new one */ }
        canvasView.clearStrokes()
        updateCandidateBar(emptyList())
        // Reset ink builder by creating new instance via reflection workaround:
        // Actually Ink.builder() returns a new builder each time, so we just
        // rebuild from scratch each time we recognize.
    }

    // Track all strokes separately for rebuilding Ink
    private val allStrokeData = mutableListOf<List<StrokePoint>>()
    private var currentStrokeData = mutableListOf<StrokePoint>()

    data class StrokePoint(val x: Float, val y: Float, val t: Long)

    @SuppressLint("ClickableViewAccessibility")
    private inner class DrawingCanvas(context: Context) : View(context) {

        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = ContextCompat.getColor(context, R.color.key_foreground)
            style = Paint.Style.STROKE
            strokeWidth = 5f
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }

        private val paths = mutableListOf<Path>()
        private var currentPath = Path()

        fun clearStrokes() {
            paths.clear()
            currentPath.reset()
            allStrokeData.clear()
            currentStrokeData.clear()
            invalidate()
        }

        override fun onTouchEvent(event: MotionEvent): Boolean {
            val x = event.x
            val y = event.y
            val t = System.currentTimeMillis()

            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    currentPath = Path()
                    currentPath.moveTo(x, y)
                    currentStrokeData = mutableListOf(StrokePoint(x, y, t))
                    strokeStartTime = t
                    handler.removeCallbacksAndMessages(null)
                }
                MotionEvent.ACTION_MOVE -> {
                    currentPath.lineTo(x, y)
                    currentStrokeData.add(StrokePoint(x, y, t))
                    invalidate()
                }
                MotionEvent.ACTION_UP -> {
                    currentPath.lineTo(x, y)
                    currentStrokeData.add(StrokePoint(x, y, t))
                    paths.add(currentPath)
                    allStrokeData.add(currentStrokeData.toList())
                    currentPath = Path()
                    currentStrokeData = mutableListOf()
                    invalidate()

                    // Schedule recognition after delay
                    handler.removeCallbacksAndMessages(null)
                    handler.postDelayed({ triggerRecognition() }, recognizeDelay)
                }
            }
            return true
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            for (path in paths) {
                canvas.drawPath(path, paint)
            }
            canvas.drawPath(currentPath, paint)
        }
    }

    private fun triggerRecognition() {
        if (allStrokeData.isEmpty()) return
        if (!recognizer.isReady()) return

        // Build Ink from stroke data
        val builder = Ink.builder()
        for (strokeData in allStrokeData) {
            val sb = Ink.Stroke.builder()
            for (pt in strokeData) {
                sb.addPoint(Ink.Point.create(pt.x, pt.y, pt.t))
            }
            builder.addStroke(sb.build())
        }
        val ink = builder.build()

        recognizer.recognize(ink) { candidates ->
            handler.post {
                updateCandidateBar(candidates.take(5))
            }
        }
    }

    private fun updateCandidateBar(candidates: List<String>) {
        // Remove old candidate views (keep modeLabel and spacer and clearBtn)
        while (candidateBar.childCount > 3) {
            candidateBar.removeViewAt(1)  // remove after modeLabel
        }

        if (candidates.isEmpty()) return

        // Insert candidate buttons between modeLabel and spacer
        for ((i, text) in candidates.withIndex()) {
            val tv = TextView(context).apply {
                this.text = text
                setTextColor(ContextCompat.getColor(context, R.color.key_foreground))
                textSize = 16f
                setPadding(dp(12), dp(2), dp(12), dp(2))
                if (i == 0) {
                    setTypeface(null, Typeface.BOLD)
                    alpha = 1.0f
                } else {
                    alpha = 0.6f
                }
                setOnClickListener {
                    listener?.onTextCommitted(text)
                    clearCanvas()
                }
                setBackgroundResource(android.R.drawable.list_selector_background)
            }
            candidateBar.addView(tv, i + 1)  // after modeLabel
        }
    }

    private fun dp(value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()
}
