# Building the Family IPTV APK

## Prerequisites

1. **Android Studio** — Download from https://developer.android.com/studio
2. **Java 17+** — Usually bundled with Android Studio
3. **Node.js** — Already installed

## Steps to Build

### 1. Sync Web Content

Whenever you change files in `index.html`, `css/`, or `js/`, run:

```bash
cd app
npm run build:www
npx cap sync android
```

### 2. Open in Android Studio

```bash
npx cap open android
```

This opens the `android/` project in Android Studio.

### 3. Build the APK

In Android Studio:
- Wait for Gradle sync to finish
- Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**
- The debug APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

Or from terminal (if Android SDK is in your PATH):

```bash
cd android
./gradlew assembleDebug
```

### 4. Install on Google TV

Transfer `app-debug.apk` to your Google TV via:
- **USB**: `adb install app-debug.apk`
- **Network**: Enable developer mode on TV, then `adb connect <TV_IP>:5555 && adb install app-debug.apk`
- **File manager**: Copy APK to USB drive, plug into TV, install via file manager

## Testing in Browser First

To test the web app before building the APK:

```bash
cd app
npx serve www -l 3000
```

Then open http://localhost:3000 in your browser.

## Updating Channels

Channels are fetched live from iptv-org's GitHub Pages every time you open a profile.
No rebuild needed — the app always gets the latest channels automatically.
