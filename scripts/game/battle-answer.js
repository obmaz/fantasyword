// One responsibility for wrong-answer protection, feedback and correct-answer settlement.
function createBattleAnswerHandler({
    getGame,
    db,
    ui,
    story,
    quests,
    equipment,
    battleRules,
    encounters,
    speech,
    clearInterval,
    getWeapons,
    vibrate,
    notify,
}) {
    return function handleAnswer(isCorrect, selectedIndex) {
        const game = getGame();
        if (!game.active || !game.currentQ || game.isProcessing) return;
        const timed = !game.currentQ.isBoss;
        if (timed) {
            game.timeLeft = game.remainingTime();
            // 늦게 도착한 클릭도 마감 후라면 시간 초과로 처리한다.
            if (game.deadline !== null && game.timeLeft <= 0) {
                isCorrect = false;
                selectedIndex = null;
            }
        }
        if (!isCorrect) {
            game.sessionMistakes++;
            vibrate?.();
        }
        if (!isCorrect && game.mode !== 'boss' && game.gear?.shield > 0) {
            game.hadRetry = true;
            game.gear.shield--;
            game.gear.combo = 0;
            game.recordWrong(game.currentQ);
            game.isProcessing = true;
            speech?.stop();
            game.listenRequest++;
            clearInterval(game.timer);
            game.timer = null;
            game.deadline = null;
            if (
                selectedIndex !== null &&
                selectedIndex !== undefined &&
                game.options[selectedIndex]
            )
                game.options[selectedIndex].disabled = true;
            game.spellingChosen = [];
            if (encounters?.usesSpelling(game.currentQ.questionKind))
                game.view.spellingProgress(game.spellingTiles, []);
            game.view.shieldBlock(selectedIndex);
            game.view.floatText('방패 방어! 다시 도전', 'gold');
            ui.updateSkills();
            const question = game.currentQ;
            const retryTime = Math.max(5, game.timeLeft);
            game.later(() => {
                if (game.currentQ !== question) return;
                game.isProcessing = false;
                game.rewardStartedAt = game.now();
                game.view.retry(game.options);
                if (timed) game.startTimer(retryTime);
                ui.updateSkills();
            }, 800);
            return;
        }
        if (game.gear) {
            const combo = equipment.combo(game.gear, isCorrect);
            game.gear.combo = combo.combo;
            game.currentQ.comboBonus = combo.bonus;
        }
        game.isProcessing = true;
        speech?.stop();
        game.listenRequest++;
        game.currentQ.wasCorrect = isCorrect;
        clearInterval(game.timer);
        game.timer = null;
        game.deadline = null;
        const questionType = timed ? 'objective' : 'subjective';
        if (game.currentQ.questionKind !== 'idiom') db.addStats(isCorrect, questionType);
        if (isCorrect && questionType === 'objective') game.sessionCorrectObjective++;
        if (isCorrect && questionType === 'subjective') game.subjectiveCorrect++;
        if (!isCorrect) game.recordWrong(game.currentQ);
        game.view.feedback(isCorrect, selectedIndex, !isCorrect && game.mode === 'boss');
        ui.updateSkills();
        if (isCorrect) {
            const weapon =
                getWeapons().find((w) => w.id === db.equippedWeapon) ||
                getWeapons().find((w) => w.id === 'basic');
            const secondary = getWeapons().find((w) => w.id === db.equipped['hand-2']);
            game.view.attack({
                weaponId: weapon.id,
                effect: weapon.effect || 'basic',
                secondaryEffect:
                    secondary && secondary.id !== 'shield_item' ? secondary.effect : null,
                combo: Boolean(game.currentQ.comboBonus),
            });
            const questReward =
                game.mode === 'revenge' ? quests?.prepareSuccess(game.currentQ) : null;
            const questBonus = questReward?.bonus || 0;
            const baseGain = battleRules.reward({
                mode: game.mode,
                subjective: !!game.currentQ.isBoss,
                timeLeft: game.timeLeft,
                maxTime: game.maxTime,
                elapsedSeconds: Math.max(0, (game.now() - game.rewardStartedAt) / 1000),
                multiplier: weapon.multiplier || 1,
                glove: db.equipped?.gloves === 'goldGlove' && db.durability.goldGlove > 0,
            });
            const routeBonus = equipment?.routeBonus(baseGain, game.gear?.route) || 0;
            const comboBonus = game.currentQ.comboBonus || 0;
            const elementalBonus = game.mode === 'idiom-test' ? 0 : game.gear?.fireBonus || 0;
            const gain =
                game.mode === 'idiom-test'
                    ? 0
                    : baseGain + routeBonus + comboBonus + elementalBonus + questBonus;
            if (weapon.multiplier > 1) game.view.goldAttack();
            const glove =
                game.mode !== 'idiom-test' &&
                db.equipped?.gloves === 'goldGlove' &&
                db.durability.goldGlove > 0;
            const paid =
                game.mode === 'idiom-test' ||
                db.grantGold(gain, questReward?.changes || {}, glove ? 'goldGlove' : null);
            if (paid) {
                game.stats.gain += gain;
                if (questReward) quests.refresh();
            } else
                notify(
                    '정답 보상을 저장하지 못했습니다. 골드와 아이템은 이전 상태입니다.',
                    'error'
                );
            const rewardDetails = [
                `정답 +${baseGain}`,
                ...(routeBonus ? [`보물 +${routeBonus}`] : []),
                ...(comboBonus ? [`연속 +${comboBonus}`] : []),
                ...(elementalBonus ? [`화염 +${elementalBonus}`] : []),
                ...(questBonus ? [`퀘스트 +${questBonus}`] : []),
            ];
            game.view.floatText(
                game.mode === 'idiom-test' ? '정답!' : paid ? `+${gain} G` : '정답 · 저장 실패',
                'gold',
                paid && (comboBonus || routeBonus || elementalBonus || questBonus)
                    ? rewardDetails.join(' · ')
                    : ''
            );
            game.later(() => {
                game.idx++;
                game.nextLevel();
            }, 800);
        } else {
            game.view.reveal(
                game.currentAns,
                questionType === 'subjective',
                game.options.findIndex((option) => option.correct)
            );
            game.view.hit();
            if (game.mode === 'boss') {
                game.view.floatText('GAME OVER', 'red');
                game.later(() => story.showEnding(false), 2500);
                return;
            }
            const penalty =
                game.mode === 'idiom-test' ? 0 : battleRules.penalty(db.gold, db.has('shield'));
            const previousGold = db.gold;
            db.subGold(penalty);
            const lost = previousGold - db.gold;
            game.stats.lost += lost;
            game.view.floatText(game.mode === 'idiom-test' ? '오답' : `-${lost} G`, 'red');
            game.later(() => {
                game.idx++;
                game.nextLevel();
            }, 2500);
        }
    };
}
