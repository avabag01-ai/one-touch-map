package pe.aioo.openmoa.hangul

class MoeumGestureProcessor {

    private val moeumList = arrayListOf<String>()

    fun appendMoeum(moeum: String) {
        moeumList.add(moeum)
    }

    fun clear() {
        moeumList.clear()
    }

    fun peekResolve(): String? {
        return resolveInternal(moeumList)
    }

    /**
     * Returns the full internal state (e.g. "ㅏ", "ㅡLㅓ", etc.) without reducing to final vowel.
     * Used for hierarchical hint computation.
     */
    fun peekFullState(): String? {
        return resolveFullState(moeumList)
    }

    /**
     * Simulates a transition from a given state with a new input direction.
     * Returns the new full state (not reduced to final vowel).
     * Used for computing "what would happen if user drags in direction X".
     */
    fun transitionFrom(state: String?, input: String): String? {
        return when (state) {
            null -> input
            "ㅏ" -> when (input) {
                "ㅓ", "ㅗ", "ㅜ", "ㅡL", "ㅣL" -> "ㅐ"
                else -> state
            }
            "ㅐ" -> when (input) {
                "ㅏ", "ㅡR", "ㅣR" -> "ㅑ"
                else -> state
            }
            "ㅑ" -> when (input) {
                "ㅓ", "ㅡL", "ㅣL" -> "ㅒ"
                else -> state
            }
            "ㅓ" -> when (input) {
                "ㅏ", "ㅗ", "ㅜ", "ㅡR", "ㅣR" -> "ㅔ"
                else -> state
            }
            "ㅔ" -> when (input) {
                "ㅓ", "ㅡL", "ㅣL" -> "ㅕ"
                else -> state
            }
            "ㅕ" -> when (input) {
                "ㅏ", "ㅡR", "ㅣR" -> "ㅖ"
                else -> state
            }
            "ㅗ" -> when (input) {
                "ㅏ" -> "ㅘ"
                "ㅜ", "ㅡL", "ㅡR" -> "ㅚ"
                else -> state
            }
            "ㅘ" -> when (input) {
                "ㅓ", "ㅜ", "ㅡL", "ㅡR" -> "ㅙ"
                "ㅗ" -> "ㅛ"
                else -> state
            }
            "ㅚ" -> when (input) {
                "ㅏ" -> "ㅘ"
                "ㅗ", "ㅣL", "ㅣR" -> "ㅛ"
                "ㅓ" -> "ㅕ"
                else -> state
            }
            "ㅜ" -> when (input) {
                "ㅓ" -> "ㅝ"
                "ㅗ", "ㅣL", "ㅣR" -> "ㅟ"
                else -> state
            }
            "ㅝ" -> when (input) {
                "ㅏ", "ㅗ", "ㅡR", "ㅣR" -> "ㅞ"
                "ㅜ" -> "ㅠ"
                else -> state
            }
            "ㅟ" -> when (input) {
                "ㅓ" -> "ㅝ"
                "ㅜ", "ㅡL", "ㅡR" -> "ㅠ"
                "ㅏ" -> "ㅑ"
                else -> state
            }
            "ㅡL" -> when (input) {
                "ㅏ", "ㅜ" -> "ㅡLㅜ"
                "ㅓ", "ㅗ" -> "ㅡLㅓ"
                "ㅣL", "ㅣR" -> "ㅢ"
                else -> state
            }
            "ㅡLㅓ" -> when (input) {
                "ㅓ", "ㅗ" -> "ㅓ"
                "ㅣL", "ㅣR" -> "ㅢ"
                else -> state
            }
            "ㅡLㅜ" -> when (input) {
                "ㅏ", "ㅜ" -> "ㅜ"
                "ㅣL", "ㅣR" -> "ㅢ"
                else -> state
            }
            "ㅡR" -> when (input) {
                "ㅏ", "ㅗ" -> "ㅡRㅏ"
                "ㅓ", "ㅜ" -> "ㅡRㅜ"
                "ㅣL", "ㅣR" -> "ㅢ"
                else -> state
            }
            "ㅡRㅏ" -> when (input) {
                "ㅏ", "ㅗ" -> "ㅏ"
                "ㅣL", "ㅣR" -> "ㅢ"
                else -> state
            }
            "ㅡRㅜ" -> when (input) {
                "ㅓ", "ㅜ" -> "ㅜ"
                "ㅣL", "ㅣR" -> "ㅢ"
                else -> state
            }
            "ㅣL" -> when (input) {
                "ㅏ", "ㅗ" -> "ㅣLㅗ"
                "ㅓ", "ㅜ" -> "ㅣLㅓ"
                else -> state
            }
            "ㅣLㅓ" -> when (input) {
                "ㅓ", "ㅜ" -> "ㅓ"
                else -> state
            }
            "ㅣLㅗ" -> when (input) {
                "ㅏ", "ㅗ" -> "ㅗ"
                else -> state
            }
            "ㅣR" -> when (input) {
                "ㅏ", "ㅜ" -> "ㅣRㅏ"
                "ㅓ", "ㅗ" -> "ㅣRㅗ"
                else -> state
            }
            "ㅣRㅏ" -> when (input) {
                "ㅏ", "ㅜ" -> "ㅏ"
                else -> state
            }
            "ㅣRㅗ" -> when (input) {
                "ㅓ", "ㅗ" -> "ㅗ"
                else -> state
            }
            else -> state
        }
    }

    fun resolveMoeumList(): String? {
        return resolveInternal(moeumList)
    }

    private fun resolveFullState(list: List<String>): String? {
        var moeum: String? = null
        for (nextMoeum in list) {
            moeum = transitionFrom(moeum, nextMoeum)
        }
        return moeum
    }

    /**
     * Converts a full state to the final vowel character.
     * Intermediate states like "ㅡLㅓ", "ㅣRㅏ" resolve to their first character.
     */
    companion object {
        fun resolveVowelFromState(state: String?): String? {
            return state?.substring(0, 1)
        }

        /** All 8 input directions */
        val ALL_DIRECTIONS = listOf("ㅏ", "ㅣR", "ㅗ", "ㅣL", "ㅓ", "ㅡL", "ㅜ", "ㅡR")
    }

    private fun resolveInternal(list: List<String>): String? {
        val fullState = resolveFullState(list)
        return resolveVowelFromState(fullState)
    }

}
