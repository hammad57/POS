# Keep WebView Javascript interfaces (none custom here, but safe default)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
