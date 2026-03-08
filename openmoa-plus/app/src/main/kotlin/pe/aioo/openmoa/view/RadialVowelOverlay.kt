package pe.aioo.openmoa.view

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import androidx.core.content.ContextCompat
import com.onetouchmap.keyboard.R

class RadialVowelOverlay @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var centerX: Float = 0f
    private var centerY: Float = 0f
    private var activeDirection: String? = null
    private var currentKey: String? = null
    private var isShowing: Boolean = false
    private var showHints: Boolean = true

    private val outerRadius = 140f
    private val innerRadius = 30f

    // 8 directions: ㅏ(→), ㅣR(↗), ㅗ(↑), ㅣL(↖), ㅓ(←), ㅡL(↙), ㅜ(↓), ㅡR(↘)
    private val directions = listOf("ㅏ", "ㅣR", "ㅗ", "ㅣL", "ㅓ", "ㅡL", "ㅜ", "ㅡR")
    private val directionLabels = listOf("ㅏ", "↗", "ㅗ", "↖", "ㅓ", "↙", "ㅜ", "↘")

    private val sectorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    private val activePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = ContextCompat.getColor(context, R.color.key_foreground)
        alpha = 60
    }

    private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1.5f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        alpha = 80
    }

    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        textSize = 32f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        typeface = Typeface.DEFAULT_BOLD
    }

    private val activeTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        textSize = 36f
        color = ContextCompat.getColor(context, R.color.keyboard_background)
        typeface = Typeface.DEFAULT_BOLD
    }

    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = ContextCompat.getColor(context, R.color.keyboard_background)
        alpha = 200
    }

    private val hintTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        textSize = 22f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        alpha = 150
    }

    private var hintTexts: Map<String, String> = emptyMap()

    fun show(cx: Float, cy: Float, key: String, hints: Map<String, String> = emptyMap()) {
        centerX = cx
        centerY = cy
        currentKey = key
        activeDirection = null
        hintTexts = hints
        isShowing = true
        visibility = VISIBLE
        invalidate()
    }

    fun updateDirection(direction: String?) {
        if (activeDirection != direction) {
            activeDirection = direction
            invalidate()
        }
    }

    fun setShowHints(show: Boolean) {
        showHints = show
    }

    fun hide() {
        isShowing = false
        visibility = GONE
    }

    override fun onDraw(canvas: Canvas) {
        if (!isShowing) return
        super.onDraw(canvas)

        val rect = RectF(
            centerX - outerRadius,
            centerY - outerRadius,
            centerX + outerRadius,
            centerY + outerRadius
        )

        // Draw background circle
        canvas.drawCircle(centerX, centerY, outerRadius, bgPaint)

        // Draw 8 sectors
        for (i in directions.indices) {
            val startAngle = -22.5f + (i * 45f)
            val isActive = directions[i] == activeDirection

            if (isActive) {
                canvas.drawArc(rect, startAngle, 45f, true, activePaint)
            }

            // Draw sector border
            canvas.drawArc(rect, startAngle, 45f, true, borderPaint)

            // Draw label at sector center
            val labelAngle = Math.toRadians((startAngle + 22.5f).toDouble())
            val labelRadius = (outerRadius + innerRadius) / 2f + 15f
            val lx = centerX + (labelRadius * Math.cos(labelAngle)).toFloat()
            val ly = centerY + (labelRadius * Math.sin(labelAngle)).toFloat()

            val paint = if (isActive) activeTextPaint else textPaint
            canvas.drawText(directionLabels[i], lx, ly + paint.textSize / 3f, paint)

            // Draw hint text (predicted character) below direction label
            if (showHints) {
                val hintText = hintTexts[directions[i]]
                if (hintText != null) {
                    val hintRadius = labelRadius + 28f
                    val hx = centerX + (hintRadius * Math.cos(labelAngle)).toFloat()
                    val hy = centerY + (hintRadius * Math.sin(labelAngle)).toFloat()
                    canvas.drawText(hintText, hx, hy + hintTextPaint.textSize / 3f, hintTextPaint)
                }
            }
        }

        // Draw center circle with current key
        canvas.drawCircle(centerX, centerY, innerRadius, bgPaint)
        canvas.drawCircle(centerX, centerY, innerRadius, borderPaint)
        currentKey?.let {
            canvas.drawText(it, centerX, centerY + textPaint.textSize / 3f, textPaint)
        }
    }
}
