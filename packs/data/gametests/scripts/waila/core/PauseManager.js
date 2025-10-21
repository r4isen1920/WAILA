"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PauseManager = void 0;
const server_1 = require("@minecraft/server");
const bedrock_boost_1 = require("@bedrock-oss/bedrock-boost");
const guiPauseBlocks_json_1 = __importDefault(require("../../data/guiPauseBlocks.json"));
const PROPERTY_PAUSED = "r4isen1920_waila:paused";
class PauseManager {
    clearUi;
    log = bedrock_boost_1.Logger.getLogger("WAILA:PauseManager");
    resumeWatchers = new Map();
    constructor(clearUi) {
        this.clearUi = clearUi;
    }
    initialize() {
        server_1.world.afterEvents.playerInteractWithBlock.subscribe(({ player, block }) => {
            if (!block)
                return;
            if (guiPauseBlocks_json_1.default.includes(block.typeId)) {
                this.pause(player);
            }
        });
        server_1.world.beforeEvents.playerLeave.subscribe(({ player }) => {
            this.clearUi(player);
            player.setDynamicProperty(PROPERTY_PAUSED, undefined);
            this.stopResumeWatcher(player.id);
        });
    }
    isPaused(player) {
        return Boolean(player.getDynamicProperty(PROPERTY_PAUSED));
    }
    pause(player) {
        if (this.isPaused(player))
            return;
        player.setDynamicProperty(PROPERTY_PAUSED, true);
        this.clearUi(player);
        this.log.info(`Player ${player.name} opened a UI, pausing updates.`);
        const initialPosition = bedrock_boost_1.Vec3.from(player.location);
        const initialRotation = bedrock_boost_1.Vec2.from(player.getRotation());
        const interval = server_1.system.runInterval(() => {
            if (!player.isValid) {
                this.stopResumeWatcher(player.id);
                return;
            }
            const currentPos = bedrock_boost_1.Vec3.from(player.location);
            const currentRot = bedrock_boost_1.Vec2.from(player.getRotation());
            const movedFar = initialPosition.distance(currentPos) > 2;
            const rotatedEnough = currentRot.distance(initialRotation) > 10;
            if (!movedFar && !rotatedEnough)
                return;
            this.log.info(`Player ${player.name} moved, resuming WAILA UI.`);
            this.stopResumeWatcher(player.id);
            player.setDynamicProperty(PROPERTY_PAUSED, undefined);
            this.clearUi(player);
        }, 5);
        this.resumeWatchers.set(player.id, interval);
    }
    stopResumeWatcher(playerId) {
        const handle = this.resumeWatchers.get(playerId);
        if (handle === undefined)
            return;
        try {
            server_1.system.clearRun(handle);
        }
        catch (error) {
            this.log.warn(`Failed to clear resume watcher for player ${playerId}: ${error}`);
        }
        this.resumeWatchers.delete(playerId);
    }
}
exports.PauseManager = PauseManager;
