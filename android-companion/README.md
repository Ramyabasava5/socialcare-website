# SocialCare Android Device Tracker

This companion runs independently of the React dashboard. After the student starts the foreground service and grants **Usage Access**, it tracks screen-ON time across the whole phone. Leaving the web dashboard does not stop tracking.

## Setup
1. Open this folder in Android Studio.
2. Allow Gradle to sync.
3. Install the app on an Android device.
4. Tap **Grant Usage Access** and enable SocialCare Tracker.
5. Tap **Start Background Tracking**.
6. The service sends total screen-on minutes to `POST /api/mobile/device` every minute.

### API address
- Android Emulator: `http://10.0.2.2:5000/api/mobile/device`
- Physical phone: replace `10.0.2.2` in `UsageTrackingService.kt` with the computer's LAN IP, e.g. `http://192.168.1.10:5000/api/mobile/device`, and make sure the phone and computer are on the same Wi-Fi.

The app uses a foreground service so tracking continues when the React page is closed. The student can stop tracking by stopping the service from Android settings/notification controls.
