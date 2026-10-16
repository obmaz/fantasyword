/** 보상·장착·승리·지도 진행의 표현만 소유한다. 저장 성공 후에만 호출한다. */
function createGamePresentation({
    document: doc,
    timers,
    sound,
    itemMarkup,
    config = PRESENTATION_CONFIG,
}) {
    const { setTimeout: schedule, clearTimeout: cancel } = timers;
    for (const [property, duration] of Object.entries({
        '--encounter-duration': config.encounterMs,
        '--enemy-attack-duration': config.monsterWindupMs + config.reactionMs,
        '--reaction-duration': config.reactionMs,
        '--reward-duration': config.rewardMs,
        '--equip-duration': config.equipMs,
    }))
        doc.documentElement.style.setProperty(property, `${duration}ms`);
    const pending = new Map();
    let reward = null;
    let progress = null;
    function pulse(node, className, duration) {
        if (!node) return;
        const old = pending.get(node);
        if (old) {
            cancel(old.timer);
            node.classList.remove(old.className);
        }
        void node.offsetWidth;
        node.classList.add(className);
        const timer = schedule(() => {
            node.classList.remove(className);
            pending.delete(node);
        }, duration);
        pending.set(node, { timer, className });
    }
    function clear() {
        for (const [node, effect] of pending) {
            cancel(effect.timer);
            node.classList.remove(effect.className);
        }
        pending.clear();
        reward?.remove();
        reward = null;
        sound.stop('reward');
    }
    function notify({ title, detail = '', item = null, cue = 'reward' }) {
        if (reward) {
            cancel(pending.get(reward)?.timer);
            pending.delete(reward);
            reward.remove();
        }
        const dialogs = [...doc.querySelectorAll('dialog[open]:not(.closing)')];
        const host = dialogs.at(-1) || doc.body;
        const node = doc.createElement('aside');
        node.className = 'game-acquisition';
        node.setAttribute('role', 'status');
        node.setAttribute('aria-live', 'polite');
        if (item) {
            const icon = doc.createElement('div');
            icon.className = 'acquisition-art';
            icon.innerHTML = itemMarkup(item);
            node.appendChild(icon);
        }
        const copy = doc.createElement('div');
        const name = doc.createElement('strong');
        name.textContent = title;
        const text = doc.createElement('span');
        text.textContent = detail;
        copy.append(name, text);
        node.appendChild(copy);
        host.appendChild(node);
        reward = node;
        pulse(node, 'is-acquiring', config.rewardMs);
        const effect = pending.get(node);
        cancel(effect.timer);
        effect.timer = schedule(() => {
            pending.delete(node);
            node.remove();
            if (reward === node) reward = null;
        }, config.rewardMs);
        sound.play(cue, {}, 'reward');
    }
    return {
        clear,
        notify,
        equip(item, avatar) {
            pulse(avatar, 'equipment-reveal', config.equipMs);
            notify({ title: '장비 장착', detail: item.name, item, cue: 'equip' });
        },
        highlight(node) {
            pulse(node, 'equipment-reveal', config.equipMs);
        },
        complete({ host, hero, won, gold = 0, mistakes = null }) {
            if (!host) return;
            host.querySelector('.result-celebration')?.remove();
            const scene = doc.createElement('div');
            scene.className = `result-celebration ${won ? 'is-victory' : 'is-defeat'}`;
            if (hero?.cloneNode) {
                const avatar = hero.cloneNode(true);
                for (const child of [avatar, ...avatar.querySelectorAll('[id]')])
                    child.removeAttribute('id');
                avatar.className = 'equipment-avatar celebration-avatar';
                avatar.removeAttribute('style');
                avatar.dataset.actorState = won ? 'victory' : 'defeat';
                scene.appendChild(avatar);
            }
            const caption = doc.createElement('strong');
            caption.textContent = won
                ? mistakes === null
                    ? '승리!'
                    : `${['금', '은', '동'][mistakes] || '도전'} 왕관`
                : '다시 도전해요';
            scene.appendChild(caption);
            for (let index = 0; won && index < config.particleCount; index++) {
                const spark = doc.createElement('i');
                spark.style.setProperty('--spark-index', index);
                scene.appendChild(spark);
            }
            host.prepend ? host.prepend(scene) : host.appendChild(scene);
            sound.play(won ? 'victory' : 'defeat', {}, 'reward');
            if (won && gold > 0) pulse(host, 'reward-settled', config.rewardMs);
        },
        rememberProgress(event) {
            progress = event;
        },
        takeProgress(book, stage) {
            const event = progress;
            progress = null;
            if (!event || event.book !== book || event.stage !== stage) return null;
            return event;
        },
    };
}
