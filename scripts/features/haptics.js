/** All mistake feedback reads the same persisted preference at the time of the error. */
function createHaptics({ getSettings, vibrate }) {
    return {
        error() {
            const settings = getSettings();
            if (settings.vibration === false) return false;
            const duration = HAPTICS_CONFIG.durations.includes(settings.vibrationDuration)
                ? settings.vibrationDuration
                : HAPTICS_CONFIG.defaultDuration;
            try {
                return Boolean(vibrate(duration));
            } catch {
                return false;
            }
        },
    };
}
