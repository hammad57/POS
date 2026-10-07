package com.hammad57.cryptopro

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        val ws: WebSettings = webView.settings
        // JavaScript is required: the whole app (Firebase Auth + Database) runs on it
        ws.javaScriptEnabled = true
        // Firebase Auth persistence + app state rely on DOM storage (localStorage)
        ws.domStorageEnabled = true
        ws.databaseEnabled = true
        // Allow the bundled file:///android_asset/farm.html to load properly
        ws.allowFileAccess = true
        ws.allowContentAccess = true
        // Media (chart sounds etc.) without extra taps
        ws.mediaPlaybackRequiresUserGesture = false
        ws.loadWithOverviewMode = true
        ws.useWideViewPort = true
        ws.cacheMode = WebSettings.LOAD_DEFAULT
        // Mixed content: all CDN scripts are https, but keep it permissive for safety
        ws.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

        // Back button goes back in WebView history instead of closing the app
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            // The full web app (farm.html) bundled in assets - Firebase works as-is
            webView.loadUrl("file:///android_asset/farm.html")
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
