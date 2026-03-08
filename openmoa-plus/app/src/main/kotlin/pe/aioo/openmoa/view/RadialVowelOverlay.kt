package pe.aioo.openmoa.view

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import androidx.core.content.ContextCompat
import com.onetouchmap.keyboard.R

/**
 * 3×3 grid-based radial hint overlay displayed to the LEFT of the touched key.
 * Each cell position spatially matches the finger swipe direction:
 *
 *   ㅣ(↖)  ㅗ(↑)  ㅣ(↗)
 *   ㅓ(←)  [key]  ㅏ(→)
 *   ㅡ(↙)  ㅜ(↓)  ㅡ(↘)
 *
 * Active direction is highlighted. Hints update hierarchically after each stroke.
 */
class RadialVowelOverlay @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var anchorX: Float = 0f
    private var anchorY: Float = 0f
    private var activeDirection: String? = null
    private var currentKey: String? = null
    private var isShowing: Boolean = false

    // Hierarchical hints: direction -> resulting vowel/syllable text
    private var hintTexts: Map<String, String> = emptyMap()

    // Grid cell definition
    data class GridCell(
        val vowelLabel: String,
        val directionKey: String,
        val row: Int,
        val col: Int
    )

    // 8 direction cells in a 3×3 grid (center is the key label)
    private val gridCells = listOf(
        GridCell("ㅣ", "ㅣL", 0, 0),   // ↖ upper-left
        GridCell("ㅗ", "ㅗ", 0, 1),    // ↑ up
        GridCell("ㅣ", "ㅣR", 0, 2),   // ↗ upper-right
        GridCell("ㅓ", "ㅓ", 1, 0),    // ← left
        // (1,1) = center: current key
        GridCell("ㅏ", "ㅏ", 1, 2),    // → right
        GridCell("ㅡ", "ㅡL", 2, 0),   // ↙ lower-left
        GridCell("ㅜ", "ㅜ", 2, 1),    // ↓ down
        GridCell("ㅡ", "ㅡR", 2, 2),   // ↘ lower-right
    )

    // Panel dimensions
    private val cellSize = 64f
    private val panelPadding = 6f
    private val panelWidth = 3 * cellSize + 2 * panelPadding
    private val panelHeight = 3 * cellSize + 2 * panelPadding
    private val cornerRadius = 12f
    private val panelGap = 16f  // gap between panel right edge and key center

    // Paints
    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = ContextCompat.getColor(context, R.color.keyboard_background)
        alpha = 235
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
        alpha = 55
    }

    private val vowelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        textSize = 22f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        alpha = 140
    }

    private val activeVowelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        textSize = 24f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        typeface = Typeface.DEFAULT_BOLD
    }

    private val hintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        textSize = 20f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        alpha = 100
    }

    private val activeHintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        textSize = 22f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        typeface = Typeface.DEFAULT_BOLD
    }

    private val keyLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        textSize = 30f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        typeface = Typeface.DEFAULT_BOLD
    }

    private val dimHintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        textSize = 18f
        color = ContextCompat.getColor(context, R.color.key_foreground)
        alpha = 50
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

        // Panel position: to the LEFT of the key center
        var panelLeft = anchorX - panelWidth - panelGap
        var panelTop = anchorY - panelHeight / 2f

        // Clamp to screen bounds
        if (panelLeft < 4f) panelLeft = 4f
        if (panelTop < 4f) panelTop = 4f
        if (panelLeft + panelWidth > width - 4f) panelLeft = width - 4f - panelWidth
        if (panelTop + panelHeight > height - 4f) panelTop = height - 4f - panelHeight

        // Draw panel background
        val panelRect = RectF(panelLeft, panelTop, panelLeft + panelWidth, panelTop + panelHeight)
        canvas.drawRoundRect(panelRect, cornerRadius, cornerRadius, bgPaint)
        canvas.drawRoundRect(panelRect, cornerRadius, cornerRadius, borderPaint)

        val gridLeft = panelLeft + panelPadding
        val gridTop = panelTop + panelPadding

        // Draw direction cells
        for (cell in gridCells) {
            val cellLeft = gridLeft + cell.col * cellSize
            val cellTop = gridTop + cell.row * cellSize
            val isActive = cell.directionKey == activeDirection

            // Highlight active cell
            if (isActive) {
                val activeRect = RectF(
                    cellLeft + 2f, cellTop + 2f,
                    cellLeft + cellSize - 2f, cellTop + cellSize - 2f
                )
                canvas.drawRoundRect(activeRect, 8f, 8f, activeBgPaint)
            }

            val centerX = cellLeft + cellSize / 2f

            // Draw base vowel label (upper part of cell)
            val vowelY = cellTop + cellSize * 0.42f
            canvas.drawText(
                cell.vowelLabel, centerX, vowelY,
                if (isActive) activeVowelPaint else vowelPaint
            )

            // Draw hint text (lower part of cell)
            val hintText = hintTexts[cell.directionKey]
            if (hintText != null) {
                val hintY = cellTop + cellSize * 0.78f
                canvas.drawText(
                    hintText, centerX, hintY,
                    if (isActive) activeHintPaint else hintPaint
                )
            } else {
                // Show dimmed dash if no transition available
                val hintY = cellTop + cellSize * 0.78f
                canvas.drawText("—", centerX, hintY, dimHintPaint)
            }
        }

        // Draw center cell: current key label
        val centerCellLeft = gridLeft + 1 * cellSize
        val centerCellTop = gridTop + 1 * cellSize
        val centerCellBg = RectF(
            centerCellLeft + 2f, centerCellTop + 2f,
            centerCellLeft + cellSize - 2f, centerCellTop + cellSize - 2f
        )
        // Subtle border around center cell
        canvas.drawRoundRect(centerCellBg, 8f, 8f, borderPaint)
        canvas.drawText(
            currentKey ?: "",
            centerCellLeft + cellSize / 2f,
            centerCellTop + cellSize * 0.6f,
            keyLabelPaint
        )
    }
}
