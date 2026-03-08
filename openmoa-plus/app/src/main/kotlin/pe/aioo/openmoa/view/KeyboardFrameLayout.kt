package pe.aioo.openmoa.view

import android.content.Context
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.onetouchmap.keyboard.R
import com.onetouchmap.keyboard.databinding.KeyboardFrameLayoutBinding
import pe.aioo.openmoa.handwriting.HandwritingCanvasView

class KeyboardFrameLayout : FrameLayout {

    constructor(context: Context) : super(context) {
        init()
    }
    constructor(context: Context, attrs: AttributeSet) : super(context, attrs) {
        init()
    }
    constructor(context: Context, attrs: AttributeSet, defStyle: Int) : super(
        context,
        attrs,
        defStyle
    ) {
        init()
    }

    private lateinit var binding: KeyboardFrameLayoutBinding

    val radialOverlay: RadialVowelOverlay
        get() = binding.radialVowelOverlay

    val handwritingCanvas: HandwritingCanvasView
        get() = binding.handwritingCanvas

    var isHandwritingActive: Boolean = false
        private set

    private fun init() {
        inflate(context, R.layout.keyboard_frame_layout, this)
        binding = KeyboardFrameLayoutBinding.bind(this)
    }

    fun setKeyboardView(view: View) {
        view.parent?.let {
            if (it is ViewGroup) {
                it.removeView(view)
            }
        }
        binding.keyboardLayout.removeAllViews()
        binding.keyboardLayout.addView(view)
    }

    fun showHandwriting() {
        isHandwritingActive = true
        binding.handwritingCanvas.show()
    }

    fun hideHandwriting() {
        isHandwritingActive = false
        binding.handwritingCanvas.hide()
    }

    /**
     * Intercept two-finger touch to activate handwriting mode.
     */
    override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
        if (!isHandwritingActive && ev.pointerCount >= 2) {
            showHandwriting()
            return true
        }
        return super.onInterceptTouchEvent(ev)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (isHandwritingActive) {
            // Forward to handwriting canvas
            return binding.handwritingCanvas.dispatchTouchEvent(event)
        }
        return super.onTouchEvent(event)
    }

}
