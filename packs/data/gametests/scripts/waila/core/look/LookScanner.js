"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LookScanner = void 0;
const server_1 = require("@minecraft/server");
const bedrock_boost_1 = require("@bedrock-oss/bedrock-boost");
const ignoredBlockRender_json_1 = __importDefault(require("../../../data/ignoredBlockRender.json"));
const BlockHandler_1 = require("../../BlockHandler");
const EntityHandler_1 = require("../../EntityHandler");
class LookScanner {
    log = bedrock_boost_1.Logger.getLogger("WAILA:LookScanner");
    scan(player, maxDistance) {
        try {
            const entityLookAt = player.getEntitiesFromViewDirection({ maxDistance });
            if (entityLookAt.length > 0 && entityLookAt[0]?.entity) {
                return EntityHandler_1.EntityHandler.createLookupData(entityLookAt[0].entity);
            }
            const blockLookAt = player.getBlockFromViewDirection({
                includeLiquidBlocks: !player.isInWater,
                includePassableBlocks: !player.isInWater,
                maxDistance,
            });
            if (blockLookAt?.block &&
                !ignoredBlockRender_json_1.default.some((entry) => entry.includes(blockLookAt.block.typeId))) {
                return BlockHandler_1.BlockHandler.createLookupData(blockLookAt.block);
            }
            return {
                type: undefined,
                hitIdentifier: "__r4ui:none",
            };
        }
        catch (error) {
            if (!(error instanceof server_1.LocationOutOfWorldBoundariesError)) {
                this.log.error(`Error while scanning look target: ${error}`);
            }
            return {
                type: undefined,
                hitIdentifier: "__r4ui:none",
            };
        }
    }
}
exports.LookScanner = LookScanner;
