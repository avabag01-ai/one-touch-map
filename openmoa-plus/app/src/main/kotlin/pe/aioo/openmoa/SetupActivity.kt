package pe.aioo.openmoa

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.RadioGroup
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import pe.aioo.openmoa.config.Config

class SetupActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        findViewById<Button>(R.id.btnEnableKeyboard).setOnClickListener {
            startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
        }

        findViewById<Button>(R.id.btnSelectKeyboard).setOnClickListener {
            val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showInputMethodPicker()
        }

        // Sensitivity settings
        val radioGroup = findViewById<RadioGroup>(R.id.sensitivityGroup)
        val prefs = getSharedPreferences(Config.PREFS_NAME, MODE_PRIVATE)
        val currentSensitivity = prefs.getFloat(Config.KEY_SENSITIVITY, Config.SENSITIVITY_MEDIUM)

        when (currentSensitivity) {
            Config.SENSITIVITY_SHORT -> radioGroup.check(R.id.radioShort)
            Config.SENSITIVITY_LONG -> radioGroup.check(R.id.radioLong)
            else -> radioGroup.check(R.id.radioMedium)
        }

        radioGroup.setOnCheckedChangeListener { _, checkedId ->
            val value = when (checkedId) {
                R.id.radioShort -> Config.SENSITIVITY_SHORT
                R.id.radioLong -> Config.SENSITIVITY_LONG
                else -> Config.SENSITIVITY_MEDIUM
            }
            Config.saveSensitivity(this, value)
            findViewById<TextView>(R.id.tvSensitivityNote).text =
                getString(R.string.sensitivity_restart_note)
        }
    }

    override fun onResume() {
        super.onResume()
        updateStatus()
    }

    private fun updateStatus() {
        val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        val enabled = imm.enabledInputMethodList.any {
            it.packageName == packageName
        }
        val statusText = findViewById<TextView>(R.id.tvStatus)
        val btnSelect = findViewById<Button>(R.id.btnSelectKeyboard)

        if (enabled) {
            statusText.text = getString(R.string.setup_status_enabled)
            btnSelect.isEnabled = true
        } else {
            statusText.text = getString(R.string.setup_status_disabled)
            btnSelect.isEnabled = false
        }
    }
}
