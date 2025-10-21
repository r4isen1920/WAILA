"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("@minecraft/server");
const bedrock_boost_1 = require("@bedrock-oss/bedrock-boost");
const Init_1 = __importDefault(require("../Init"));
const Settings_1 = require("./Settings");
const PauseManager_1 = require("./core/PauseManager");
const SignatureStore_1 = require("./core/SignatureStore");
const LookPipeline_1 = require("./core/look/LookPipeline");
const LookScanner_1 = require("./core/look/LookScanner");
const UiController_1 = require("./core/ui/UiController");
class Waila {
    static instance;
    log = bedrock_boost_1.Logger.getLogger("WAILA");
    signatureStore = new SignatureStore_1.SignatureStore();
    lookScanner = new LookScanner_1.LookScanner();
    lookPipeline = new LookPipeline_1.LookPipeline();
    uiController = new UiController_1.UiController();
    playerHasTarget = new Map();
    pauseManager;
    constructor() {
        bedrock_boost_1.Logger.setLevel(bedrock_boost_1.LogLevel.Debug);
        this.pauseManager = new PauseManager_1.PauseManager((player) => this.handleExternalClear(player));
        this.pauseManager.initialize();
        (0, Init_1.default)(() => {
            server_1.world.gameRules.showTags = false;
            const pulse = new bedrock_boost_1.PlayerPulseScheduler((player) => {
                const isEnabled = Settings_1.WailaSettings.get(player, "isEnabled");
                if (isEnabled === undefined || isEnabled === true) {
                    this.processPlayer(player);
                }
            }, 3);
            pulse.start();
            this.log.info(`WAILA loaded and running.`);
        });
    }
    static getInstance() {
        if (!Waila.instance) {
            Waila.instance = new Waila();
        }
        return Waila.instance;
    }
    processPlayer(player) {
        if (this.pauseManager.isPaused(player))
            return;
        const settings = Settings_1.WailaSettings.getAllTyped(player);
        const lookAt = this.lookScanner.scan(player, settings.maxDisplayDistance);
        const assessment = this.lookPipeline.assess(player, lookAt, settings);
        this.updateTargetState(player, assessment);
        if (!assessment.hasTarget || !assessment.signature || !assessment.context) {
            this.signatureStore.clear(player);
            return;
        }
        if (this.signatureStore.isDuplicate(player, assessment.signature))
            return;
        const resolution = this.lookPipeline.finalize(assessment.context);
        this.uiController.present(player, resolution, settings);
    }
    updateTargetState(player, assessment) {
        const playerId = player.id;
        const hadTarget = this.playerHasTarget.get(playerId) ?? false;
        const hasTarget = assessment.hasTarget;
        if (!hasTarget && hadTarget) {
            this.handleExternalClear(player);
        }
        this.playerHasTarget.set(playerId, hasTarget);
    }
    handleExternalClear(player) {
        this.uiController.clear(player);
        this.signatureStore.clear(player);
        this.playerHasTarget.set(player.id, false);
    }
    clearUI(player) {
        this.handleExternalClear(player);
    }
    isPaused(player) {
        return this.pauseManager.isPaused(player);
    }
}
exports.default = Waila;
Waila.getInstance();
