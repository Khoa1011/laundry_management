# Notification Sound

## Catalog

The frontend includes six allowlisted keys:

- `NONE`
- `SOFT_CHIME`
- `CLEAR_BELL`
- `DIGITAL_PING`
- `DOUBLE_TONE`
- `URGENT_ALERT`

The backend stores only the key and volume from 0 to 100. It never stores a file path or device ID.

## User-imported sound

The notification settings screen lets each user choose an MP3, WAV, OGG, M4A,
or AAC file up to 5 MB. The file is stored in IndexedDB under the current user
ID and remains on that browser/device; it is never uploaded to the backend.

Selecting **Save** activates the imported sound for both previews and realtime
SSE notifications. The previously selected built-in key remains the fallback
when the custom file is missing, unreadable, or unavailable on another device.
Replacing or removing the file clears the engine cache immediately.

## Engine

`NotificationSoundEngine` first tries the active user-imported sound, then plays a bundled PCM WAV asset from
`frontend/public/sounds/notifications`. It caches and reuses one
`HTMLAudioElement` per preset. If an asset is unavailable, the engine falls back to
one reused Web Audio `AudioContext` and clean multi-harmonic sine tones with
controlled gain envelopes. No external or copyrighted audio asset is downloaded.
Preview occurs only after a user action.

The bundled file names are:

- `soft-chime.wav`
- `clear-bell.wav`
- `digital-ping.wav`
- `double-tone.wav`
- `urgent-alert.wav`

A preset can be replaced by putting a short PCM WAV file at the matching path and
rebuilding the frontend. Keep the same file name so the backend allowlisted sound
key and existing user preferences remain unchanged. Run `npm run sounds:generate`
from `frontend` to restore the generated defaults.

Normal notifications use the user's selected sound. Severity does not silently replace it with a harsher preset. A global four-second cooldown prevents repeated sound while visual state continues to update.

## Browser autoplay

Browsers may keep the audio context suspended before interaction. A blocked play does not affect notification delivery. The app shows a one-time “Bật âm thanh” action; selecting it unlocks the context and plays a short preview without changing the stored preset.

Reduced-motion preference affects visual motion only. Sound remains controlled by the user's notification preference.

## Multiple tabs

Only a visible focused tab attempts audio. It claims the event ID in localStorage with an eight-second TTL and confirms ownership before playing. BroadcastChannel shares effect IDs between tabs. Every tab still updates its list and unread badge.

## Preferences

`GET` returns defaults when no row exists:

```json
{
  "soundEnabled": true,
  "soundKey": "SOFT_CHIME",
  "soundVolume": 65,
  "toastEnabled": true,
  "bellAnimationEnabled": true
}
```

`PUT` validates the allowlisted key and volume, operates only on the current principal, and uses `notification.preferences.manage-own`.
