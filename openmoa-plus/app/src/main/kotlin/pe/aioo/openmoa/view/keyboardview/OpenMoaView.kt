package pe.aioo.openmoa.view.keyboardview

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.AttributeSet
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.widget.TextView
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.content.ContextCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject
import pe.aioo.openmoa.OpenMoaIME
import com.onetouchmap.keyboard.R
import pe.aioo.openmoa.config.Config
import pe.aioo.openmoa.view.message.SpecialKey
import com.onetouchmap.keyboard.databinding.OpenMoaViewBinding
import pe.aioo.openmoa.view.keytouchlistener.CrossKeyTouchListener
import pe.aioo.openmoa.view.keytouchlistener.JaumKeyTouchListener
import pe.aioo.openmoa.view.keytouchlistener.RepeatKeyTouchListener
import pe.aioo.openmoa.view.keytouchlistener.SimpleKeyTouchListener
import pe.aioo.openmoa.view.message.SpecialKeyMessage
import pe.aioo.openmoa.view.message.StringKeyMessage
import kotlin.math.*

class OpenMoaView : ConstraintLayout, KoinComponent {

    private val config: Config by inject()

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

    private val broadcastManager = LocalBroadcastManager.getInstance(context)
    private lateinit var binding: OpenMoaViewBinding
    private var touchedMoeum: String? = null
    private val backgrounds = listOf(
        ContextCompat.getDrawable(context, R.drawable.key_background_pressed),
        ContextCompat.getDrawable(context, R.drawable.key_background),
    )

    // Vowel mode: consonant keys → vowel display
    private val consonantKeyMap: Map<String, TextView> by lazy {
        mapOf(
            "ㅃ" to binding.ssangbieupKey,
            "ㅉ" to binding.ssangjieutKey,
            "ㄸ" to binding.ssangdigeutKey,
            "ㄲ" to binding.ssanggiyeokKey,
            "ㅆ" to binding.ssangsiotKey,
            "ㅂ" to binding.bieupKey,
            "ㅈ" to binding.jieutKey,
            "ㄷ" to binding.digeutKey,
            "ㄱ" to binding.giyeokKey,
            "ㅅ" to binding.siotKey,
            "ㅁ" to binding.mieumKey,
            "ㄴ" to binding.nieunKey,
            "ㅇ" to binding.ieungKey,
            "ㄹ" to binding.rieulKey,
            "ㅎ" to binding.hieutKey,
            "ㅋ" to binding.kieukKey,
            "ㅌ" to binding.tieutKey,
            "ㅊ" to binding.chieutKey,
            "ㅍ" to binding.pieupKey,
        )
    }
    private val savedKeyTexts = mutableMapOf<TextView, CharSequence>()
    private var vowelModeActive = false

    private val vowelModeReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val type = intent.getStringExtra("type") ?: return
            when (type) {
                "start" -> {
                    val key = intent.getStringExtra("key") ?: return
                    enterVowelMode(key)
                }
                "move" -> {
                    val direction = intent.getStringExtra("direction")
                    highlightVowelDirection(direction)
                }
                "end" -> exitVowelMode()
            }
        }
    }

    private fun init() {
        inflate(context, R.layout.open_moa_view, this)
        binding = OpenMoaViewBinding.bind(this)
        setOnTouchListeners()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        broadcastManager.registerReceiver(
            vowelModeReceiver, IntentFilter(OpenMoaIME.GESTURE_ACTION)
        )
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        broadcastManager.unregisterReceiver(vowelModeReceiver)
    }

    // --- Vowel Mode ---

    private fun enterVowelMode(pressedKeyName: String) {
        val pressedView = consonantKeyMap[pressedKeyName] ?: return
        val pressedCx = pressedView.x + pressedView.width / 2f
        val pressedCy = pressedView.y + pressedView.height / 2f

        vowelModeActive = true

        for ((name, keyView) in consonantKeyMap) {
            savedKeyTexts[keyView] = keyView.text

            if (name == pressedKeyName) {
                // Highlight pressed key, keep its text
                keyView.background = backgrounds[0]
                continue
            }

            // Calculate direction from pressed key to this key
            val keyCx = keyView.x + keyView.width / 2f
            val keyCy = keyView.y + keyView.height / 2f
            val angle = Math.toDegrees(
                atan2((keyCy - pressedCy).toDouble(), (keyCx - pressedCx).toDouble())
            )

            val vowel = angleToVowel(angle)

            // Crossfade animation: fade out → change text → fade in
            keyView.animate().alpha(0f).setDuration(80).withEndAction {
                keyView.text = vowel
                keyView.animate().alpha(1f).setDuration(120).start()
            }.start()
        }
    }

    private fun angleToVowel(angle: Double): String {
        return when {
            abs(angle) <= 22.5 -> "ㅏ"            // → right
            angle in 22.5..67.5 -> "ㅡ"           // ↘ lower-right
            angle in 67.5..112.5 -> "ㅜ"          // ↓ down
            angle in 112.5..157.5 -> "ㅡ"         // ↙ lower-left
            abs(angle) >= 157.5 -> "ㅓ"           // ← left
            angle in -67.5..-22.5 -> "ㅣ"         // ↗ upper-right
            angle in -112.5..-67.5 -> "ㅗ"        // ↑ up
            angle in -157.5..-112.5 -> "ㅣ"       // ↖ upper-left
            else -> "ㅏ"
        }
    }

    private fun highlightVowelDirection(direction: String?) {
        if (!vowelModeActive) return

        val targetVowel = when (direction) {
            "ㅏ" -> "ㅏ"
            "ㅓ" -> "ㅓ"
            "ㅗ" -> "ㅗ"
            "ㅜ" -> "ㅜ"
            "ㅣR", "ㅣL" -> "ㅣ"
            "ㅡR", "ㅡL" -> "ㅡ"
            else -> null
        }

        for ((name, keyView) in consonantKeyMap) {
            // Skip the pressed key (it keeps its consonant text)
            if (keyView.text.toString() == name) continue

            if (targetVowel != null && keyView.text.toString() == targetVowel) {
                keyView.background = backgrounds[0]  // highlight matching vowels
            } else {
                keyView.background = backgrounds[1]  // reset others
            }
        }
    }

    private fun exitVowelMode() {
        if (!vowelModeActive) return
        vowelModeActive = false

        for ((keyView, originalText) in savedKeyTexts) {
            keyView.animate().alpha(0f).setDuration(80).withEndAction {
                keyView.text = originalText
                keyView.background = backgrounds[1]
                keyView.animate().alpha(1f).setDuration(120).start()
            }.start()
        }
        savedKeyTexts.clear()
    }

    // --- Touch Listeners ---

    @SuppressLint("ClickableViewAccessibility")
    private fun setOnTouchListeners() {
        binding.apply {
            tildeKey.setOnTouchListener(SimpleKeyTouchListener(context, StringKeyMessage("~")))
            ssangbieupKey.setOnTouchListener(JaumKeyTouchListener(context, "ㅃ"))
            ssangjieutKey.setOnTouchListener(JaumKeyTouchListener(context, "ㅉ"))
            ssangdigeutKey.setOnTouchListener(JaumKeyTouchListener(context, "ㄸ"))
            ssanggiyeokKey.setOnTouchListener(JaumKeyTouchListener(context, "ㄲ"))
            ssangsiotKey.setOnTouchListener(JaumKeyTouchListener(context, "ㅆ"))
            emojiKey.setOnTouchListener(
                SimpleKeyTouchListener(context, SpecialKeyMessage(SpecialKey.EMOJI))
            )
            caretKey.setOnTouchListener(SimpleKeyTouchListener(context, StringKeyMessage("^")))
            bieupKey.setOnTouchListener(JaumKeyTouchListener(context, "ㅂ"))
            jieutKey.setOnTouchListener(JaumKeyTouchListener(context, "ㅈ"))
            digeutKey.setOnTouchListener(JaumKeyTouchListener(context, "ㄷ"))
            giyeokKey.setOnTouchListener(JaumKeyTouchListener(context, "ㄱ"))
            siotKey.setOnTouchListener(JaumKeyTouchListener(context, "ㅅ"))
            backspaceKey.setOnTouchListener(
                RepeatKeyTouchListener(context, SpecialKeyMessage(SpecialKey.BACKSPACE))
            )
            semicolonKey.setOnTouchListener(
                SimpleKeyTouchListener(context, StringKeyMessage(";"))
            )
            mieumKey.setOnTouchListener(JaumKeyTouchListener(context, "ㅁ"))
            nieunKey.setOnTouchListener(JaumKeyTouchListener(context, "ㄴ"))
            ieungKey.setOnTouchListener(JaumKeyTouchListener(context, "ㅇ"))
            rieulKey.setOnTouchListener(JaumKeyTouchListener(context, "ㄹ"))
            hieutKey.setOnTouchListener(JaumKeyTouchListener(context, "ㅎ"))
            asteriskKey.setOnTouchListener(
                SimpleKeyTouchListener(context, StringKeyMessage("*"))
            )
            kieukKey.setOnTouchListener(JaumKeyTouchListener(context, "ㅋ"))
            tieutKey.setOnTouchListener(JaumKeyTouchListener(context, "ㅌ"))
            chieutKey.setOnTouchListener(JaumKeyTouchListener(context, "ㅊ"))
            pieupKey.setOnTouchListener(JaumKeyTouchListener(context, "ㅍ"))
            languageKey.setOnTouchListener(
                SimpleKeyTouchListener(context, SpecialKeyMessage(SpecialKey.LANGUAGE))
            )
            hanjaNumberPunctuationKey.setOnTouchListener(
                SimpleKeyTouchListener(
                    context, SpecialKeyMessage(SpecialKey.HANJA_NUMBER_PUNCTUATION)
                )
            )
            spaceKey.setOnTouchListener(SimpleKeyTouchListener(context, StringKeyMessage(" ")))
            commaQuestionDotExclamationKey.setOnTouchListener(
                CrossKeyTouchListener(
                    context,
                    listOf(
                        StringKeyMessage(","),
                        StringKeyMessage("!"),
                        StringKeyMessage("."),
                        StringKeyMessage("?"),
                    ),
                )
            )
            enterKey.setOnTouchListener(
                SimpleKeyTouchListener(context, SpecialKeyMessage(SpecialKey.ENTER))
            )
        }
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        touchedMoeum.let { moeum ->
            when (ev.action) {
                MotionEvent.ACTION_DOWN,
                MotionEvent.ACTION_MOVE -> {
                    if (ev.action == MotionEvent.ACTION_DOWN ||
                        (ev.action == MotionEvent.ACTION_MOVE && touchedMoeum != null)
                    ) {
                        binding.iKey.apply {
                            if (ev.x in x..x + width && ev.y in y..y + height) {
                                if (moeum != "ㅣ") {
                                    background = backgrounds[0]
                                    binding.euKey.background = backgrounds[1]
                                    binding.araeaKey.background = backgrounds[1]
                                    if (config.hapticFeedback) {
                                        performHapticFeedback(
                                            HapticFeedbackConstants.KEYBOARD_PRESS
                                        )
                                    }
                                    if (moeum != null) {
                                        sendKeyMessage(StringKeyMessage(moeum))
                                    }
                                }
                                touchedMoeum = "ㅣ"
                                return true
                            }
                        }
                        binding.euKey.apply {
                            if (ev.x in x..x + width && ev.y in y..y + height) {
                                if (moeum != "ㅡ") {
                                    background = backgrounds[0]
                                    binding.iKey.background = backgrounds[1]
                                    binding.araeaKey.background = backgrounds[1]
                                    if (config.hapticFeedback) {
                                        performHapticFeedback(
                                            HapticFeedbackConstants.KEYBOARD_PRESS
                                        )
                                    }
                                    if (moeum != null) {
                                        sendKeyMessage(StringKeyMessage(moeum))
                                    }
                                }
                                touchedMoeum = "ㅡ"
                                return true
                            }
                        }
                        binding.araeaKey.apply {
                            if (ev.x in x..x + width && ev.y in y..y + height) {
                                if (moeum != "ㆍ") {
                                    background = backgrounds[0]
                                    binding.iKey.background = backgrounds[1]
                                    binding.euKey.background = backgrounds[1]
                                    if (config.hapticFeedback) {
                                        performHapticFeedback(
                                            HapticFeedbackConstants.KEYBOARD_PRESS
                                        )
                                    }
                                    if (moeum != null) {
                                        sendKeyMessage(StringKeyMessage(moeum))
                                    }
                                }
                                touchedMoeum = "ㆍ"
                                return true
                            }
                        }
                    }
                    Unit
                }
                MotionEvent.ACTION_UP -> {
                    if (moeum != null) {
                        binding.iKey.background = backgrounds[1]
                        binding.euKey.background = backgrounds[1]
                        binding.araeaKey.background = backgrounds[1]
                        sendKeyMessage(StringKeyMessage(moeum))
                        touchedMoeum = null
                        return true
                    }
                    Unit
                }
                else -> Unit
            }
        }
        return super.dispatchTouchEvent(ev)
    }

    private fun sendKeyMessage(keyMessage: StringKeyMessage) {
        broadcastManager.sendBroadcast(
            Intent(OpenMoaIME.INTENT_ACTION).apply {
                putExtra(OpenMoaIME.EXTRA_NAME, keyMessage.key)
            }
        )
    }

}
