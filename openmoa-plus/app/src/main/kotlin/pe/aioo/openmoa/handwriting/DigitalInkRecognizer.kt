package pe.aioo.openmoa.handwriting

import android.content.Context
import android.util.Log
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.vision.digitalink.*

/**
 * Wraps ML Kit Digital Ink Recognition for English handwriting.
 * Downloads the model on first use, then recognizes strokes → text.
 */
class DigitalInkRecognizer(context: Context) {

    companion object {
        private const val TAG = "DigitalInkRecognizer"
        private const val LANG_TAG = "en-US"
    }

    private var recognizer: DigitalInkRecognizer? = null
    private var modelReady = false

    private val modelIdentifier = DigitalInkRecognitionModelIdentifier.fromLanguageTag(LANG_TAG)
        ?: throw IllegalStateException("No model for $LANG_TAG")

    private val model = DigitalInkRecognitionModel.builder(modelIdentifier).build()

    init {
        // Download model if needed
        val remoteModelManager = RemoteModelManager.getInstance()
        remoteModelManager.isModelDownloaded(model).addOnSuccessListener { downloaded ->
            if (downloaded) {
                initRecognizer()
            } else {
                remoteModelManager.download(model, DownloadConditions.Builder().build())
                    .addOnSuccessListener {
                        Log.d(TAG, "Model downloaded successfully")
                        initRecognizer()
                    }
                    .addOnFailureListener { e ->
                        Log.e(TAG, "Model download failed", e)
                    }
            }
        }
    }

    private fun initRecognizer() {
        recognizer = DigitalInkRecognition.getClient(
            DigitalInkRecognizerOptions.builder(model).build()
        )
        modelReady = true
        Log.d(TAG, "Recognizer ready")
    }

    fun isReady(): Boolean = modelReady

    /**
     * Recognize the given Ink and return candidates via callback.
     * @param ink The ML Kit Ink object built from user strokes
     * @param onResult Callback with list of candidate strings (best first)
     */
    fun recognize(ink: Ink, onResult: (List<String>) -> Unit) {
        val rec = recognizer
        if (rec == null || !modelReady) {
            onResult(emptyList())
            return
        }
        rec.recognize(ink)
            .addOnSuccessListener { result ->
                val candidates = result.candidates.map { it.text }
                onResult(candidates)
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Recognition failed", e)
                onResult(emptyList())
            }
    }
}
