// ===================================================
// ARTM_SkillOtherTargetMZ
// Copyright (c) 2021 Artemis
// This software is released under the MIT license.
// http://opensource.org/licenses/mit-license.php
// -------------
// [Version]
// 1.0.0 初版
// 1.1.0 MP不足でもスキルが使用できてしまう不具合を修正
//       リファクタリングを実施
// 1.1.1 アクター選択画面の更新漏れを修正
// ====================================================
/*:ja
 * @target MZ
 * @plugindesc スキル範囲を詠唱者以外に変更するMZ専用プラグイン
 * @author Artemis
 *
 * @help ARTM_SkillOtherTargetMZ
 * スキル範囲を詠唱者以外に変更するMZ専用プラグインです。
 *
 *-------------------------------------------------
 * メモ欄タグは以下の通りです。
 *-------------------------------------------------
 * ★スキルのメモ欄任意行に下記タグを記述して下さい。
 *   <SOT_STATE:VALID>
 *   上記記述があるスキルは、範囲が下記の通りに変更されます。
 *   ☆味方単体・・・詠唱者以外の味方を選択し対象とする（敵の場合は味方ランダム）
 *   ☆味方全体・・・詠唱者以外の味方全員を対象とする
 *   ☆敵味方全体・・詠唱者以外の敵味方全員を対象とする
 *
 * プラグインコマンドはありません。
 *
 */
 
(() => {

    const TAG_NAME = "SOT_STATE";
    const TAG_VALUE = "VALID";
    const STAGE = {"Non":0, "Fst": 1, "Snd":2, "Trd":3};
    STAGE["Exp"] = Object.keys(STAGE).length; 
    let GTmp;
    

    const _Game_Temp_initialize = Game_Temp.prototype.initialize;
    Game_Temp.prototype.initialize = function() {
        _Game_Temp_initialize.call(this);
        this._isExceptSOT = false;
        this._SOT = [false, false, false, false];
        this._listSOT = [];
        GTmp = this;
    };

    Game_Temp.prototype.getSOT = function(index) {
        return !!this._SOT[index];
    };

    Game_Temp.prototype.setSOT = function(indexList, stateList) {
        stateList.forEach((v, i) => this._SOT[indexList[i]] = v);
    };

    Game_Temp.prototype.listSOT = function() {
        return this._listSOT;
    };

    Game_Temp.prototype.doListExceptSOT = function(except) {
        this._listSOT = this._listSOT.filter(v => v !== except);
        if (this._listSOT.length === 0) {
            this.setSOT([STAGE.Fst], [false]);
        }
    };

    Game_Temp.prototype.findSOT = function(subject) {
        return this.listSOT().includes(subject);
    };
    
    Game_Action.prototype.isSOT = function() {
        return(
            DataManager.isSkill(this.item()) &&
            this.item().meta[TAG_NAME] === TAG_VALUE
        );
    };

    const _Game_Action_makeTargets = Game_Action.prototype.makeTargets;
    Game_Action.prototype.makeTargets = function() {
        const subject = this.subject();
        const isSOT = this.isSOT();
        let targets = this.makeTargetsSOT(subject, isSOT);
        if (!isSOT) {
            return targets
        } else if (!this.isForUser() && this.isForOne()) {
            targets = this.makeTargetsProcSOT(targets);
        } else if (this.isForAll()) {
            targets = targets.filter(t => {
                return t !== subject;
            }, this);
        } else {
            targets = [];
        }
        return targets
    };

    Game_Action.prototype.makeTargetsSOT = function(subject, isSOT) {
        let targets, members, index;
        if (!!isSOT && GTmp.getSOT(STAGE.Fst) && GTmp.findSOT(subject)) {
            const prvExp = GTmp.getSOT(STAGE.Exp)
            GTmp.setSOT([STAGE.Exp], [false]);
            index = $gameParty.members().indexOf(subject);
            GTmp.setSOT([STAGE.Exp], [true]);
            GTmp.doListExceptSOT(subject);
            if (index < this._targetIndex) {
                this._targetIndex--;
            }
            targets = _Game_Action_makeTargets.call(this);
            GTmp.setSOT([STAGE.Exp], [prvExp]);
        } else {
            targets = _Game_Action_makeTargets.call(this);
        }
        return targets;
   };

    Game_Action.prototype.makeTargetsProcSOT = function(targets) {
        if (this.friendsUnit()._actors) {
            return this.makeTargetsActorProcSOT() || targets;
        } else if (this.friendsUnit()._enemies) {
            return this.makeTargetsEnemyProcSOT();
        } else {
            return [];
        }
    }

    Game_Action.prototype.makeTargetsActorProcSOT = function() {
        return null;
    }

    Game_Action.prototype.makeTargetsEnemyProcSOT = function() {
        const unit = this.friendsUnit();
        const enemiesSave = [...unit._enemies];
        let targets;
        unit._enemies = enemiesSave.filter(a => {
            return a !== this.subject();
        });
        targets = [unit.randomTarget()]
        unit._enemies = enemiesSave
        return targets;
    }

    const _Game_Party_battleMembers = Game_Party.prototype.battleMembers;
    Game_Party.prototype.battleMembers = function() {
        const members = _Game_Party_battleMembers.call(this);
        if (GTmp.getSOT(STAGE.Exp)) {
            const subject =
                GTmp.getSOT(STAGE.Non) ?
                BattleManager._currentActor :
                BattleManager._subject;
            return(
                !subject ? members :
                members.filter(bm => bm !== subject)
            );
        }
        return members;
    };

    const _Game_Party_allMembers = Game_Party.prototype.allMembers;
    Game_Party.prototype.allMembers = function() {
        const members = _Game_Party_allMembers.call(this);
        if (GTmp.getSOT(STAGE.Snd)) {
            const scene = SceneManager._scene;
            const actor = scene._statusWindow._actor;
            return members.filter(t => t !== actor);
        }
        return members;
    };

    const _Spriteset_Battle_updateActors = Spriteset_Battle.prototype.updateActors;
    Spriteset_Battle.prototype.updateActors = function() {
        const prvExp = GTmp.getSOT(STAGE.Exp);
        GTmp.setSOT([STAGE.Exp], [false]);
        _Spriteset_Battle_updateActors.call(this);
        GTmp.setSOT([STAGE.Exp], [prvExp]);
    };

    const _Scene_ItemBase_showActorWindow = Scene_ItemBase.prototype.showActorWindow;
    Scene_ItemBase.prototype.showActorWindow = function() {
        const item = this.item();
        if (DataManager.isSkill(item) && item.meta[TAG_NAME]) {
            GTmp.setSOT([STAGE.Snd], [true]);
        }
        this._actorWindow.refresh();
        _Scene_ItemBase_showActorWindow.call(this);
    };

    const _Scene_ItemBase_hideActorWindow = Scene_ItemBase.prototype.hideActorWindow;
    Scene_ItemBase.prototype.hideActorWindow = function() {
        if (GTmp.getSOT(STAGE.Snd)) {
            GTmp.setSOT([STAGE.Snd], [false]);
        }
        _Scene_ItemBase_hideActorWindow.call(this);
    };

    const _Game_BattlerBase_meetsSkillConditions = Game_BattlerBase.prototype.meetsSkillConditions;
    Game_BattlerBase.prototype.meetsSkillConditions = function(skill) {
        const defRet = _Game_BattlerBase_meetsSkillConditions.call(this, skill);
        return(
            defRet && skill.meta[TAG_NAME] === TAG_VALUE ?
            this.meetsSkillConditionsSOT(skill) : defRet
        );
   };

    Game_BattlerBase.prototype.meetsSkillConditionsSOT = function(skill) {
        let length;
        if ($gameParty.inBattle()) {
            const prvInfo = [GTmp.getSOT(STAGE.Non), GTmp.getSOT(STAGE.Exp)];
            GTmp.setSOT([STAGE.Non, STAGE.Exp], [true, true]);
            length = $gameParty.battleMembers().length;
            GTmp.setSOT([STAGE.Non, STAGE.Exp], [prvInfo[0], prvInfo[1]]);
        } else {
            const prvState = GTmp.getSOT(STAGE.Snd);
            GTmp.setSOT([STAGE.Snd], [true]);
            length = $gameParty.allMembers().length;
            GTmp.setSOT([STAGE.Snd], [prvState]);
        }
        return length > 0;
    };

    const _Scene_Battle_onActorOk = Scene_Battle.prototype.onActorOk;
    Scene_Battle.prototype.onActorOk = function() {
        if (GTmp.getSOT(STAGE.Exp)) {
            GTmp.setSOT([STAGE.Exp], [false]);
            const members = $gameParty.battleMembers();
            const actor = BattleManager.actor();
            const index = members.indexOf(actor);
            GTmp.setSOT([STAGE.Fst], [true]);
            GTmp.listSOT().push(actor);
            if (!GTmp.getSOT(STAGE.Trd) &&
                index <= this._actorWindow.index()) {
                 this._actorWindow._index++;
            } else {
                GTmp.setSOT([STAGE.Trd], [false]);
            }
        }
        _Scene_Battle_onActorOk.call(this);
    };

    const _Scene_Battle_onActorCancel= Scene_Battle.prototype.onActorCancel;
    Scene_Battle.prototype.onActorCancel = function() {
        _Scene_Battle_onActorCancel.call(this);
        if (GTmp.getSOT(STAGE.Exp)) {
            GTmp.setSOT([STAGE.Exp], [false]);
        }
    };

    const _Scene_Battle_onSkillOk = Scene_Battle.prototype.onSkillOk;
    Scene_Battle.prototype.onSkillOk = function() {
        const skill = this._skillWindow.item();
        const action = BattleManager.inputtingAction();
        if (skill.meta[TAG_NAME] === TAG_VALUE) {
            action.setSkill(skill.id);
            if (action.needsSelection()) {
                GTmp.setSOT([STAGE.Exp], [true]);
                BattleManager.actor().setLastBattleSkill(skill);
                this.onSelectAction();
                return;
            }
        }
        _Scene_Battle_onSkillOk.call(this);
    };

    const _Window_BattleStatus_actor = Window_BattleStatus.prototype.actor;
    Window_BattleStatus.prototype.actor = function(index) {
        if (GTmp.getSOT(STAGE.Exp)) {
            GTmp.setSOT([STAGE.Non], [true]);
            const actor = _Window_BattleStatus_actor.call(this, index);
            GTmp.setSOT([STAGE.Non], [false]);
            return actor;
        }
        return _Window_BattleStatus_actor.call(this, index);
    };

    const _Window_BattleStatus_maxItems = Window_BattleStatus.prototype.maxItems;
    Window_BattleStatus.prototype.maxItems = function() {
        if (GTmp.getSOT(STAGE.Exp)) {
            GTmp.setSOT([STAGE.Non], [true]);
            const maxItems = _Window_BattleStatus_maxItems.call(this);
            GTmp.setSOT([STAGE.Non], [false]);
            return maxItems;
        }
        return _Window_BattleStatus_maxItems.call(this);
    };

    // overridable
    const _Window_BattleActor_processTouch = Window_BattleActor.prototype.processTouch;
    Window_BattleActor.prototype.processTouch = function() {
        if (!GTmp.getSOT(STAGE.Exp)) {
            _Window_BattleActor_processTouch.call(this);
            return;
        }
        Window_BattleStatus.prototype.processTouch.call(this);
        if (this.isOpenAndActive()) {
            const target = GTmp.touchTarget();
            if (target) {
                const _members = $gameParty.battleMembers();
                const index = _members.indexOf(target);
                const subject = BattleManager._currentActor;
                const members = _members.filter(bm => {
                    return bm !== subject;
                });
                if (members.includes(target)) {
                    this.select(members.indexOf(target));
                    if (GTmp.touchState() === "click") {
                        if (this._index < index) {
                            this._index++;
                            GTmp.setSOT([STAGE.Trd], [true]);
                        }
                        this.processOk();
                    }
                }
                GTmp.clearTouchState();
            }
        }
    };

})();