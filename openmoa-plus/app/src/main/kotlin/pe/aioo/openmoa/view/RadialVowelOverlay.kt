package pe.aioo.openmoa.view

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import androidx.core.content.ContextCompat
import com.onetouchmap.keyboard.R

/**
 * Hierarchical hint overlay displayed to the LEFT of the touched key.
 * Shows 6 direction groups (→ㅏ, ←ㅓ, ↑ㅗ, ↓ㅜ, ↗↖ㅣ, ↙↘ㅡ) and
 * the resulting vowel for each direction based on current gesture state.
 * Active direction is highlighted. Hints update hierarchically after each stroke.
 */
class RadialVowelOverlay @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var anchorX: Float = 0f  // Key center X (screen coords mapped to view)
    private var anchorY: Float = 0f  // Key center Y
    private var activeDirection: String? = null
    private var currentKey: String? = null
    private var isShowing: Boolean = false

    // Hierarchical hints: direction -> resulting vowel/syllable text
    private var hintTexts: Map<String, String> = emptyMap()

    // Panel dimensions
    private val panelWidth = 180f
    private val panelHeight = 280f
    private val rowHeight = 42f
    private val cornerRadius = 12f
    private val panelOffsetX = -200f  // Offset to the LEFT of key center
    private val panelOffsetY = -140f  // Center vertically around key

    // 8 directions grouped into display rows
    // Each row: label, list of direction keys that map to this row
    data class HintRow(
        val label: String,
        val arrow: String,
        val directionKeys: List<String>
    )

    private val hintRows = listOf(
        HintRow("→", "ㅏ", listOf("ㅏ")),
        HintRow("←", "ㅓ", listOf("ㅓ")),
        HintRow("↑", "ㅗ", listOf("ㅗ")),
        HintRow("↓", "ㅜ", listOf("ㅜ")),
        HintRow("↗↖", "ㅣ", listOf("ㅣR", "ㅣL")),
        HintRow("↙↘", "ㅡ", listOf("ㅡL", "ㅡR")),
    )

    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = ContextCompat.getColor(context, R.color.keyboard_background)
        alpha = 230
    }

    private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1.5f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        alpha = 60
    }

    private val activeBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = ContextCompat.getColor(context, R.color.key_foreground)
        alpha = 50
    }

    private val arrowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        textSize = 24f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        alpha = 160
    }

    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.LEFT
        textSize = 28f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        typeface = Typeface.DEFAULT_BOLD
    }

    private val hintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.RIGHT
        textSize = 28f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        typeface = Typeface.DEFAULT_BOLD
    }

    private val activeHintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.RIGHT
        textSize = 30f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        typeface = Typeface.DEFAULT_BOLD
    }

    private val dimPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.RIGHT
        textSize = 28f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        alpha = 80
    }

    private val currentVowelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        textSize = 32f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        typeface = Typeface.DEFAULT_BOLD
    }

    fun show(cx: Float, cy: Float, key: String, hints: Map<String, String> = emptyMap()) {
        anchorX = cx
        anchorY = cy
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

    fun updateHints(hints: Map<String, String>) {
        hintTexts = hints
        invalidate()
    }

    fun setShowHints(show: Boolean) {
        // Always show hints in hierarchical mode
    }

    fun hide() {
        isShowing = false
        visibility = GONE
    }

    override fun onDraw(canvas: Canvas) {
        if (!isShowing) return
        super.onDraw(canvas)

        // Calculate panel position (to the LEFT of the key)
        var panelLeft = anchorX + panelOffsetX
        var panelTop = anchorY + panelOffsetY

        // Clamp to screen bounds
        if (panelLeft < 4f) panelLeft = 4f
        if (panelTop < 4f) panelTop = 4f
        if (panelLeft + panelWidth > width - 4f) panelLeft = width - 4f - panelWidth
        if (panelTop + panelHeight > height - 4f) panelTop = height - 4f - panelHeight

        // Draw panel background
        val panelRect = RectF(panelLeft, panelTop, panelLeft + panelWidth, panelTop + panelHeight)
        canvas.drawRoundRect(panelRect, cornerRadius, cornerRadius, bgPaint)
        canvas.drawRoundRect(panelRect, cornerRadius, cornerRadius, borderPaint)

        // Draw current key + current vowel at top
        val headerY = panelTop + 30f
        val currentLabel = currentKey ?: ""
        canvas.drawText(currentLabel, panelLeft + panelWidth / 2f, headerY, currentVowelPaint)

        // Draw separator line
        val sepY = panelTop + 44f
        canvas.drawLine(panelLeft + 12f, sepY, panelLeft + panelWidth - 12f, sepY, borderPaint)

        // Draw hint rows
        val startY = panelTop + 52f
        for ((i, row) in hintRows.withIndex()) {
            val rowTop = startY + i * rowHeight
            val rowBottom = rowTop + rowHeight
            val isActive = row.directionKeys.contains(activeDirection)

            // Highlight active row
            if (isActive) {
                val activeRect = RectF(panelLeft + 4f, rowTop, panelLeft + panelWidth - 4f, rowBottom)
                canvas.drawRoundRect(activeRect, 6f, 6f, activeBgPaint)
            }

            val textY = rowTop + rowHeight / 2f + 10f

            // Draw arrow label
            canvas.drawText(row.arrow, panelLeft + 28f, textY, arrowPaint)

            // Draw base vowel label
            canvas.drawText(row.label, panelLeft + 52f, textY, labelPaint)

            // Draw hint text (resulting vowel/syllable) - pick first available hint
            val hintText = row.directionKeys.firstNotNullOfOrNull { hintTexts[it] }
            if (hintText != null) {
                val paint = if (isActive) activeHintPaint else hintPaint
                canvas.drawText(hintText, panelLeft + panelWidth - 16f, textY, paint)
            } else {
                // Show dimmed "—" if no transition available
                canvas.drawText("—", panelLeft + panelWidth - 16f, textY, dimPaint)
            }
        }
    }
}
