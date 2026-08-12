# Notification sound assets

The notification engine loads these local files before using its Web Audio fallback:

- `soft-chime.wav`
- `clear-bell.wav`
- `digital-ping.wav`
- `double-tone.wav`
- `urgent-alert.wav`

To replace a preset, keep the same file name and use a short PCM WAV file. Keep the
peak level conservative because the user's saved volume is applied during playback.
Rebuild the frontend image after replacing a file.

Run `npm run sounds:generate` from `frontend` to restore the generated defaults.
