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

    // All non-consonant keys that should hide during vowel mode
    private val functionalKeys: List<TextView> by lazy {
        listOf(
            binding.tildeKey, binding.emojiKey, binding.caretKey,
            binding.backspaceKey, binding.semicolonKey, binding.asteriskKey,
            binding.iKey, binding.euKey, binding.araeaKey,
            binding.languageKey, binding.hanjaNumberPunctuationKey,
            binding.spaceKey, binding.commaQuestionDotExclamationKey, binding.enterKey
        )
    }

    // Track which keys are showing vowels (keyView -> direction key like "ㅏ","ㅣR" etc.)
    private val vowelDisplayKeys = mutableMapOf<TextView, String>()
    private var pressedKeyView: TextView? = null
    private var pressedKeyName: String? = null

    // --- Vowel Mode ---

    private fun enterVowelMode(pressedKeyName: String) {
        val pressedView = consonantKeyMap[pressedKeyName] ?: return
        vowelModeActive = true
        pressedKeyView = pressedView
        this.pressedKeyName = pressedKeyName

        val pressedCx = pressedView.x + pressedView.width / 2f
        val pressedCy = pressedView.y + pressedView.height / 2f

        // Find closest key in each of 8 directions
        data class KeyCandidate(val view: TextView, val dist: Float, val direction: String)
        val bestPerDirection = mutableMapOf<String, KeyCandidate>()

        for ((name, keyView) in consonantKeyMap) {
            savedKeyTexts[keyView] = keyView.text
            if (name == pressedKeyName) continue

            val keyCx = keyView.x + keyView.width / 2f
            val keyCy = keyView.y + keyView.height / 2f
            val angle = Math.toDegrees(
                atan2((keyCy - pressedCy).toDouble(), (keyCx - pressedCx).toDouble())
            )
            val dist = sqrt((keyCx - pressedCx).pow(2) + (keyCy - pressedCy).pow(2))
            val direction = angleToDirection(angle)

            val current = bestPerDirection[direction]
            if (current == null || dist < current.dist) {
                bestPerDirection[direction] = KeyCandidate(keyView, dist, direction)
            }
        }

        vowelDisplayKeys.clear()
        val vowelKeyViews = bestPerDirection.values.map { it.view }.toSet()

        // Highlight pressed key
        pressedView.background = backgrounds[0]

        for ((name, keyView) in consonantKeyMap) {
            if (name == pressedKeyName) continue

            if (keyView in vowelKeyViews) {
                val candidate = bestPerDirection.values.first { it.view == keyView }
                val vowelLabel = directionToVowelLabel(candidate.direction)
                vowelDisplayKeys[keyView] = candidate.direction
                keyView.text = vowelLabel
                keyView.setTextColor(ContextCompat.getColor(context, R.color.vowel_highlight))
            } else {
                keyView.alpha = 0f
            }
        }

        for (funcKey in functionalKeys) {
            funcKey.alpha = 0f
        }
    }

    /** Map angle to one of 8 direction keys used by MoeumGestureProcessor */
    private fun angleToDirection(angle: Double): String {
        return when {
            abs(angle) <= 22.5 -> "ㅏ"
            angle in 22.5..67.5 -> "ㅡR"
            angle in 67.5..112.5 -> "ㅜ"
            angle in 112.5..157.5 -> "ㅡL"
            abs(angle) >= 157.5 -> "ㅓ"
            angle in -67.5..-22.5 -> "ㅣR"
            angle in -112.5..-67.5 -> "ㅗ"
            angle in -157.5..-112.5 -> "ㅣL"
            else -> "ㅏ"
        }
    }

    /** Convert direction key to display vowel label */
    private fun directionToVowelLabel(direction: String): String {
        return when (direction) {
            "ㅏ" -> "ㅏ"
            "ㅓ" -> "ㅓ"
            "ㅗ" -> "ㅗ"
            "ㅜ" -> "ㅜ"
            "ㅣR", "ㅣL" -> "ㅣ"
            "ㅡR", "ㅡL" -> "ㅡ"
            else -> "ㅏ"
        }
    }

    private fun highlightVowelDirection(direction: String?) {
        if (!vowelModeActive) return

        // Update pressed key to show composed syllable
        val pView = pressedKeyView
        val pName = pressedKeyName
        if (pView != null && pName != null) {
            if (direction != null) {
                val vowel = directionToVowelLabel(direction)
                val composed = composeHangul(pName, vowel)
                pView.text = composed ?: pName
            } else {
                pView.text = pName
            }
        }

        for ((keyView, dirKey) in vowelDisplayKeys) {
            val isMatch = when (direction) {
                "ㅏ" -> dirKey == "ㅏ"
                "ㅓ" -> dirKey == "ㅓ"
                "ㅗ" -> dirKey == "ㅗ"
                "ㅜ" -> dirKey == "ㅜ"
                "ㅣR", "ㅣL" -> dirKey == "ㅣR" || dirKey == "ㅣL"
                "ㅡR", "ㅡL" -> dirKey == "ㅡR" || dirKey == "ㅡL"
                else -> false
            }

            keyView.background = if (isMatch) backgrounds[0] else backgrounds[1]
        }
    }

    private fun composeHangul(consonant: String, vowel: String): String? {
        val chosung = listOf("ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ")
        val jungsung = listOf("ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ")
        val choIdx = chosung.indexOf(consonant)
        val jungIdx = jungsung.indexOf(vowel)
        if (choIdx < 0 || jungIdx < 0) return null
        val code = 0xAC00 + choIdx * 21 * 28 + jungIdx * 28
        return String(charArrayOf(code.toChar()))
    }

    private fun exitVowelMode() {
        if (!vowelModeActive) return
        vowelModeActive = false

        val pView = pressedKeyView
        if (pView != null) {
            pView.background = backgrounds[1]
            val originalText = savedKeyTexts[pView]
            if (originalText != null) pView.text = originalText
        }
        pressedKeyView = null
        pressedKeyName = null

        for ((keyView, _) in vowelDisplayKeys) {
            val originalText = savedKeyTexts[keyView]
            if (originalText != null) keyView.text = originalText
            keyView.setTextColor(ContextCompat.getColor(context, R.color.key_foreground))
            keyView.background = backgrounds[1]
        }

        for ((_, keyView) in consonantKeyMap) {
            keyView.alpha = 1f
            keyView.scaleX = 1f
            keyView.scaleY = 1f
        }

        for (funcKey in functionalKeys) {
            funcKey.alpha = 1f
        }

        vowelDisplayKeys.clear()
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
