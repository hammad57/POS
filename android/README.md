# Crypto Pro - Android App

Ye `farm.html` web app ka Android mobile app version hai. App ke andar wahi web app
WebView me chalti hai, is liye **Firebase Authentication, Realtime Database aur
saari functionality bilkul waisi hi kaam karti hai jaisi website par** - koi tabdeeli nahi.

## App kaise banayein (APK)

1. **Android Studio** kholein (https://developer.android.com/studio se free download).
2. **Open** par click karke ye `CryptoProApp` folder select karein.
3. Android Studio khud zaroori files download kar lega (pehli baar 5-10 minute lag sakte hain).
4. Upar **Run** (hara play button) dabayein - app emulator ya apne mobile par chal jayegi.
5. APK file banane ke liye: menu me **Build > Build App Bundle(s) / APK(s) > Build APK(s)**.
   APK is jagah milegi: `app/build/outputs/apk/debug/app-debug.apk`
6. Is APK ko apne mobile par copy karke install kar lein.

## Zaroori baatein

- App ko **internet** chahiye (Firebase aur CDN scripts ke liye).
- `farm.html` file `app/src/main/assets/` me hai. Website update karni ho to bas ye file
  badal dein aur dobara build kar lein - app ka code chherne ki zaroorat nahi.
- Package name: `com.hammad57.cryptopro`
- Min Android version: 7.0 (API 24)

## Files

- `app/src/main/java/.../MainActivity.kt` - WebView wali main screen
- `app/src/main/assets/farm.html` - poori web app (Firebase linked)
- `app/src/main/AndroidManifest.xml` - permissions (Internet)
