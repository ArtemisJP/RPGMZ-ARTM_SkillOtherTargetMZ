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
// 1.1.2 リファクタリングを実施
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
    const gST = {"N":0, "F": 1, "S":2, "T":3, "E":4};
    let gTmp;
    
    //-----------------------------------------------------------------------------
    // Game_Temp
    //
    const _Game_Temp_initialize = Game_Temp.prototype.initialize;
    Game_Temp.prototype.initialize = function() {
        _Game_Temp_initialize.call(this);
        this._SOT = [false, false, false, false];
        this._listSOT = [];
        gTmp = this;
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
            this.setSOT([gST.F], [false]);
        }
    };

    //-----------------------------------------------------------------------------
    // Game_Action
    //
    Game_Action.prototype.isSOT = function() {
        return(
            DataManager.isSkill(this.item()) &&
            this.item().meta[TAG_NAME] === TAG_VALUE
        );
    };

    const _Game_Action_makeTargets = Game_Action.prototype.makeTargets;
    Game_Action.prototype.makeTargets = function() {
        const subject = this.subject();
        const targets = this.makeTargetsSOT(subject, this.isSOT());
        if (this.isSOT()) {
            if (!this.isForUser() && this.isForOne()) {
                return this.makeTargetsProcSOT(targets);
            } else if (this.isForAll()) {
                return targets.filter(t => t !== subject);
            }
        }
        return targets;
    };

    Game_Action.prototype.makeTargetsSOT = function(subject, isSOT) {
        const inListSOT = gTmp.listSOT().includes(subject);
        let index, targets;
        if (isSOT && gTmp.getSOT(gST.F) && inListSOT) {
            const prvExp = gTmp.getSOT(gST.E)
            gTmp.setSOT([gST.E], [false]);
            index = $gameParty.members().indexOf(subject);
            gTmp.setSOT([gST.E], [true]);
            gTmp.doListExceptSOT(subject);
            if (index < this._targetIndex) {
                this._targetIndex--;
            }
            targets = _Game_Action_makeTargets.call(this);
            gTmp.setSOT([gST.E], [prvExp]);
            return targets;
        }
        return _Game_Action_makeTargets.call(this);
   };

    Game_Action.prototype.makeTargetsProcSOT = function(targets) {
        if (this.friendsUnit()._enemies) {
            const unit = this.friendsUnit();
            const enemiesSave = [...unit._enemies];
            unit._enemies = enemiesSave.filter(a => {
                return a !== this.subject();
            });
            targets = [unit.randomTarget()]
            unit._enemies = enemiesSave
        }
        return targets;
    }

    //-----------------------------------------------------------------------------
    // Game_Party
    //
    const _Game_Party_battleMembers = Game_Party.prototype.battleMembers;
    Game_Party.prototype.battleMembers = function() {
        const members = _Game_Party_battleMembers.call(this);
        if (gTmp.getSOT(gST.E)) {
            const subject =
                gTmp.getSOT(gST.N) ?
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
        if (gTmp.getSOT(gST.S)) {
            const scene = SceneManager._scene;
            const actor = scene._statusWindow._actor;
            return members.filter(t => t !== actor);
        }
        return members;
    };

    //-----------------------------------------------------------------------------
    // Spriteset_Battle
    //
    const _Spriteset_Battle_updateActors = Spriteset_Battle.prototype.updateActors;
    Spriteset_Battle.prototype.updateActors = function() {
        const prvExp = gTmp.getSOT(gST.E);
        gTmp.setSOT([gST.E], [false]);
        _Spriteset_Battle_updateActors.call(this);
        gTmp.setSOT([gST.E], [prvExp]);
    };

    //-----------------------------------------------------------------------------
    // Scene_ItemBase
    //
    const _Scene_ItemBase_showActorWindow = Scene_ItemBase.prototype.showActorWindow;
    Scene_ItemBase.prototype.showActorWindow = function() {
        const item = this.item();
        if (DataManager.isSkill(item) && item.meta[TAG_NAME]) {
            gTmp.setSOT([gST.S], [true]);
        }
        this._actorWindow.refresh();
        _Scene_ItemBase_showActorWindow.call(this);
    };

    const _Scene_ItemBase_hideActorWindow = Scene_ItemBase.prototype.hideActorWindow;
    Scene_ItemBase.prototype.hideActorWindow = function() {
        if (gTmp.getSOT(gST.S)) {
            gTmp.setSOT([gST.S], [false]);
        }
        _Scene_ItemBase_hideActorWindow.call(this);
    };

    //-----------------------------------------------------------------------------
    // Game_BattlerBase
    //
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
            const prvInfo = [gTmp.getSOT(gST.N), gTmp.getSOT(gST.E)];
            gTmp.setSOT([gST.N, gST.E], [true, true]);
            length = $gameParty.battleMembers().length;
            gTmp.setSOT([gST.N, gST.E], [prvInfo[0], prvInfo[1]]);
        } else {
            const prvState = gTmp.getSOT(gST.S);
            gTmp.setSOT([gST.S], [true]);
            length = $gameParty.allMembers().length;
            gTmp.setSOT([gST.S], [prvState]);
        }
        return length > 0;
    };

    //-----------------------------------------------------------------------------
    // Scene_Battle
    //
    const _Scene_Battle_onActorOk = Scene_Battle.prototype.onActorOk;
    Scene_Battle.prototype.onActorOk = function() {
        if (gTmp.getSOT(gST.E)) {
            gTmp.setSOT([gST.E], [false]);
            const members = $gameParty.battleMembers();
            const actor = BattleManager.actor();
            const index = members.indexOf(actor);
            gTmp.setSOT([gST.F], [true]);
            gTmp.listSOT().push(actor);
            if (!gTmp.getSOT(gST.T) &&
                index <= this._actorWindow.index()) {
                 this._actorWindow._index++;
            } else {
                gTmp.setSOT([gST.T], [false]);
            }
        }
        _Scene_Battle_onActorOk.call(this);
    };

    const _Scene_Battle_onActorCancel= Scene_Battle.prototype.onActorCancel;
    Scene_Battle.prototype.onActorCancel = function() {
        _Scene_Battle_onActorCancel.call(this);
        if (gTmp.getSOT(gST.E)) {
            gTmp.setSOT([gST.E], [false]);
        }
    };

    const _Scene_Battle_onSkillOk = Scene_Battle.prototype.onSkillOk;
    Scene_Battle.prototype.onSkillOk = function() {
        const skill = this._skillWindow.item();
        const action = BattleManager.inputtingAction();
        if (skill.meta[TAG_NAME] === TAG_VALUE) {
            action.setSkill(skill.id);
            if (action.needsSelection()) {
                gTmp.setSOT([gST.E], [true]);
                BattleManager.actor().setLastBattleSkill(skill);
                this.onSelectAction();
                return;
            }
        }
        _Scene_Battle_onSkillOk.call(this);
    };

    //-----------------------------------------------------------------------------
    // Window_BattleStatus
    //
    const _Window_BattleStatus_actor = Window_BattleStatus.prototype.actor;
    Window_BattleStatus.prototype.actor = function(index) {
        if (gTmp.getSOT(gST.E)) {
            gTmp.setSOT([gST.N], [true]);
            const actor = _Window_BattleStatus_actor.call(this, index);
            gTmp.setSOT([gST.N], [false]);
            return actor;
        }
        return _Window_BattleStatus_actor.call(this, index);
    };

    const _Window_BattleStatus_maxItems = Window_BattleStatus.prototype.maxItems;
    Window_BattleStatus.prototype.maxItems = function() {
        if (gTmp.getSOT(gST.E)) {
            gTmp.setSOT([gST.N], [true]);
            const maxItems = _Window_BattleStatus_maxItems.call(this);
            gTmp.setSOT([gST.N], [false]);
            return maxItems;
        }
        return _Window_BattleStatus_maxItems.call(this);
    };

    //-----------------------------------------------------------------------------
    // Window_BattleActor
    //
    const _Window_BattleActor_processTouch = Window_BattleActor.prototype.processTouch;
    Window_BattleActor.prototype.processTouch = function() {
        if (!gTmp.getSOT(gST.E)) {
            _Window_BattleActor_processTouch.call(this);
            return;
        }
        Window_BattleStatus.prototype.processTouch.call(this);
        const target = gTmp.touchTarget()
        if (this.isOpenAndActive()) {
            this.processTouchSOT(target);
        }
    };
    
    Window_BattleActor.prototype.processTouchSOT = function(target) {
        let members = $gameParty.battleMembers();
        members = members.filter(bm => {
            return bm !== BattleManager._currentActor;
        });
        if (members.includes(target)) {
            this.select(members.indexOf(target));
            if (gTmp.touchState() === "click") {
                if (this._index < members.indexOf(target)) {
                    this._index++;
                    gTmp.setSOT([gST.T], [true]);
                }
                this.processOk();
            }
        }
        gTmp.clearTouchState();
    };

})();