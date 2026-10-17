/** Storage-free story completion changes; persistence stays at the feature boundary. */
const storyProgressRules = Object.freeze({
    completion({ events, path, stage, index, rowCount, keys, rows, mistakes, regenerate }) {
        const eventKey = `${stage}:${index}`;
        const updatedEvents = {
            ...events,
            [eventKey]: {
                ...events[eventKey],
                cleared: true,
                ...(Number.isInteger(mistakes) && mistakes >= 0 ? { mistakes } : {}),
            },
        };
        const updatedPath = [...path];
        updatedPath[stage] = index;
        const nextStage = stage + 1;
        const changes =
            nextStage >= rowCount
                ? {
                      [keys.stage]: '0',
                      [keys.path]: '[]',
                      [keys.events]: '{}',
                      [keys.layout]: JSON.stringify(regenerate(rows)),
                  }
                : {
                      [keys.events]: JSON.stringify(updatedEvents),
                      [keys.path]: JSON.stringify(updatedPath),
                      [keys.stage]: String(nextStage),
                  };
        return { changes, nextStage };
    },
});
