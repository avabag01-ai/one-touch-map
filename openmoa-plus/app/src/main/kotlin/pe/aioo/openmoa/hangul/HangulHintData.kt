package pe.aioo.openmoa.hangul

object HangulHintData {

    private val directionToVowel = mapOf(
        "ㅏ" to "ㅏ",
        "ㅓ" to "ㅓ",
        "ㅗ" to "ㅗ",
        "ㅜ" to "ㅜ",
        "ㅣR" to "ㅏ",
        "ㅣL" to "ㅓ",
        "ㅡR" to "ㅜ",
        "ㅡL" to "ㅜ",
    )

    private val choseongMap = mapOf(
        "ㄱ" to 0, "ㄲ" to 1, "ㄴ" to 2, "ㄷ" to 3, "ㄸ" to 4,
        "ㄹ" to 5, "ㅁ" to 6, "ㅂ" to 7, "ㅃ" to 8, "ㅅ" to 9,
        "ㅆ" to 10, "ㅇ" to 11, "ㅈ" to 12, "ㅉ" to 13, "ㅊ" to 14,
        "ㅋ" to 15, "ㅌ" to 16, "ㅍ" to 17, "ㅎ" to 18
    )

    private val jungseongMap = mapOf(
        "ㅏ" to 0, "ㅐ" to 1, "ㅑ" to 2, "ㅒ" to 3, "ㅓ" to 4,
        "ㅔ" to 5, "ㅕ" to 6, "ㅖ" to 7, "ㅗ" to 8, "ㅘ" to 9,
        "ㅙ" to 10, "ㅚ" to 11, "ㅛ" to 12, "ㅜ" to 13, "ㅝ" to 14,
        "ㅞ" to 15, "ㅟ" to 16, "ㅠ" to 17, "ㅡ" to 18, "ㅢ" to 19,
        "ㅣ" to 20
    )

    fun composeSyllablePublic(choseong: String, jungseong: String): String {
        val cho = choseongMap[choseong] ?: return "$choseong$jungseong"
        val jung = jungseongMap[jungseong] ?: return "$choseong$jungseong"
        val code = (cho * 21 + jung) * 28 + 0xAC00
        return String(charArrayOf(code.toChar()))
    }

    fun getHintsForKey(consonant: String): Map<String, String> {
        val hints = mutableMapOf<String, String>()
        for ((direction, vowel) in directionToVowel) {
            hints[direction] = composeSyllablePublic(consonant, vowel)
        }
        return hints
    }
}
