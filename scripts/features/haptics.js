/** All mistake feedback reads the same persisted preference at the time of the error. */
function createHaptics({ getSettings, vibrate }) {
    return {
        error() {
            const settings = getSettings();
            if (settings.vibration === false) return false;
            const duration = [80, 200, 350].includes(settings.vibrationDuration)
                ? settings.vibrationDuration
                : 200;
            try {
                return Boolean(vibrate(duration));
            } catch {
                return false;
            }
        },
    };
}
