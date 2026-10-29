package ar.edu.fcyt.fieldkit.network

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.io.File
import java.util.concurrent.Executors

/** Visor local: no depende de Google Drive, un navegador ni Internet en el emulador. */
class PdfPreviewActivity : Activity() {
  private val worker = Executors.newSingleThreadExecutor()
  private var renderer: PdfRenderer? = null
  private var bitmap: Bitmap? = null
  @Volatile private var destroyed = false
  private var pageIndex = 0
  private lateinit var titleLabel: TextView
  private lateinit var image: ImageView
  private lateinit var previous: Button
  private lateinit var next: Button
  private lateinit var scroll: ScrollView

  override fun onCreate(state: Bundle?) {
    super.onCreate(state)
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.rgb(244, 246, 243))
      fitsSystemWindows = true
      setPadding(16, 20, 16, 16)
    }
    root.addView(Button(this).apply { text = "Volver a Fieldkit"; setOnClickListener { finish() } })
    titleLabel = TextView(this).apply { text = "Abriendo reporte…"; textSize = 18f; setTypeface(null, Typeface.BOLD); setPadding(8, 12, 8, 12) }
    root.addView(titleLabel)
    image = ImageView(this).apply { adjustViewBounds = true; scaleType = ImageView.ScaleType.FIT_CENTER; contentDescription = "Página del reporte PDF" }
    scroll = ScrollView(this).apply { addView(image, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)) }
    root.addView(scroll, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
    val navigation = LinearLayout(this)
    previous = Button(this).apply { text = "Anterior"; isEnabled = false; setOnClickListener { showPage(pageIndex - 1) } }
    next = Button(this).apply { text = "Siguiente"; isEnabled = false; setOnClickListener { showPage(pageIndex + 1) } }
    navigation.addView(previous, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    navigation.addView(next, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    root.addView(navigation)
    setContentView(root)
    worker.execute {
      try {
        val uri = Uri.parse(intent.getStringExtra("uri") ?: throw IllegalArgumentException("Falta el archivo PDF"))
        require(uri.scheme == "file") { "Solo se admiten reportes locales de la app" }
        val file = File(uri.path ?: "").canonicalFile
        require(listOf(filesDir, cacheDir).any { file.path.startsWith(it.canonicalPath + File.separator) }) { "Archivo fuera del almacenamiento privado" }
        renderer = PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY))
        require((renderer?.pageCount ?: 0) > 0) { "PDF sin páginas" }
        runOnUiThread { if (!destroyed) showPage(0) }
      } catch (error: Exception) { showError(error) }
    }
  }

  private fun showPage(index: Int) {
    previous.isEnabled = false
    next.isEnabled = false
    titleLabel.text = "Cargando página…"
    worker.execute {
      try {
        val document = renderer ?: return@execute
        val width = resources.displayMetrics.widthPixels.coerceIn(720, 1500)
        val rendered = document.openPage(index).use { page ->
          Bitmap.createBitmap(width, (width.toDouble() * page.height / page.width).toInt(), Bitmap.Config.ARGB_8888).also {
            it.eraseColor(Color.WHITE)
            page.render(it, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
          }
        }
        runOnUiThread {
          if (destroyed) rendered.recycle()
          else {
            val old = bitmap
            bitmap = rendered
            image.setImageBitmap(rendered)
            old?.recycle()
            pageIndex = index
            titleLabel.text = "Reporte · ${index + 1} / ${document.pageCount}"
            previous.isEnabled = index > 0
            next.isEnabled = index + 1 < document.pageCount
            scroll.scrollTo(0, 0)
          }
        }
      } catch (error: Exception) { showError(error) }
    }
  }
  private fun showError(error: Exception) = runOnUiThread { if (!destroyed) titleLabel.text = "No se pudo abrir el PDF: ${error.message}" }
  override fun onDestroy() {
    destroyed = true
    image.setImageDrawable(null)
    bitmap?.recycle()
    worker.execute { renderer?.close(); renderer = null }
    worker.shutdown()
    super.onDestroy()
  }
}
