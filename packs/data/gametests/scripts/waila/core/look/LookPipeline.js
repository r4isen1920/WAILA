"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LookPipeline = void 0;
const server_1 = require("@minecraft/server");
const bedrock_boost_1 = require("@bedrock-oss/bedrock-boost");
const frameBlockIds_json_1 = __importDefault(require("../../../data/frameBlockIds.json"));
const nameAliases_json_1 = __importDefault(require("../../../data/nameAliases.json"));
const InventoryMirror_1 = require("../InventoryMirror");
const LookAtObjectTypeEnum_1 = require("../../../types/LookAtObjectTypeEnum");
const BlockHandler_1 = require("../../BlockHandler");
const EntityHandler_1 = require("../../EntityHandler");
class LookPipeline {
    log = bedrock_boost_1.Logger.getLogger("WAILA:LookPipeline");
    assess(player, lookAtObject, settings) {
        if (!lookAtObject.type || !lookAtObject.hitIdentifier || lookAtObject.hitIdentifier === "__r4ui:none") {
            return { hasTarget: false };
        }
        if (lookAtObject.type === LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.ENTITY) {
            const context = this.buildEntityContext(player, lookAtObject);
            if (!context)
                return { hasTarget: false };
            const signaturePayload = {
                hit: context.hitIdentifier,
                sneaking: player.isSneaking,
                name: context.displayName,
                tagIcons: context.renderData.tagIcons,
                healthRenderer: context.renderData.healthRenderer,
                armorRenderer: context.renderData.armorRenderer,
                health: `${context.renderData.hp}/${context.renderData.maxHp}`,
                effects: context.renderData.effectsRenderer.effectString,
                itemContext: context.itemContextIdentifier ?? "",
            };
            return {
                hasTarget: true,
                signature: JSON.stringify(signaturePayload),
                context,
            };
        }
        if (lookAtObject.type === LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.TILE) {
            const context = this.buildBlockContext(player, lookAtObject, settings);
            if (!context)
                return { hasTarget: false };
            const signaturePayload = {
                hit: lookAtObject.hitIdentifier,
                sneaking: player.isSneaking,
                name: context.displayName,
                toolIcons: context.renderData.toolIcons,
                blockStates: context.extendedInfoActive ? context.renderData.blockStates ?? "" : "",
                inventory: context.inventorySignature,
                frameItem: context.itemInsideFrameTranslationKey ?? "",
            };
            return {
                hasTarget: true,
                signature: JSON.stringify(signaturePayload),
                context,
            };
        }
        return { hasTarget: false };
    }
    finalize(context) {
        if (context.type === LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.ENTITY) {
            return this.finalizeEntity(context);
        }
        return this.finalizeBlock(context);
    }
    buildEntityContext(player, lookAtObject) {
        const { entity } = lookAtObject;
        if (!entity || !entity.isValid)
            return undefined;
        const renderData = EntityHandler_1.EntityHandler.createRenderData(entity, player, entity.typeId === "minecraft:player");
        let displayName = entity.localizationKey;
        let nameTagContextTranslationKey;
        let itemContextIdentifier;
        let itemStack;
        const entityNameTag = entity.nameTag;
        if (entityNameTag && entityNameTag.length > 0) {
            displayName = entityNameTag;
            nameTagContextTranslationKey = entity.localizationKey;
        }
        else if (entity.typeId === "minecraft:item") {
            const itemEntity = lookAtObject;
            if (itemEntity.itemStack) {
                itemContextIdentifier = itemEntity.itemStack.typeId;
                itemStack = itemEntity.itemStack.clone();
            }
        }
        const hitNamespace = this.resolveNamespace(lookAtObject.hitIdentifier);
        return {
            type: LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.ENTITY,
            hitIdentifier: entity.typeId,
            namespace: hitNamespace,
            displayName,
            entity,
            renderData,
            nameTagContextTranslationKey,
            itemContextIdentifier,
            itemStack,
            isPlayer: entity.typeId === "minecraft:player",
        };
    }
    buildBlockContext(player, lookAtObject, settings) {
        const block = lookAtObject.block;
        if (!block)
            return undefined;
        let renderData;
        try {
            renderData = BlockHandler_1.BlockHandler.createRenderData(block, player);
        }
        catch (error) {
            this.log.warn(`Failed to build block render data for ${block.typeId}: ${error}`);
            return undefined;
        }
        const blockTypeId = block.typeId;
        const hitNamespace = this.resolveNamespace(lookAtObject.hitIdentifier);
        const aliasKey = nameAliases_json_1.default[blockTypeId.replace(/.*:/g, "")];
        const displayName = aliasKey ? `${aliasKey}.name` : block.localizationKey;
        const extendedInfoActive = Boolean(renderData.blockStates && settings.displayExtendedInfo && player.isSneaking);
        const frameItemTranslationKey = this.resolveFrameItemKey(blockTypeId, lookAtObject.hitIdentifier);
        const inventorySignature = this.encodeInventory(renderData.inventory);
        return {
            type: LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.TILE,
            hitIdentifier: lookAtObject.hitIdentifier,
            namespace: hitNamespace,
            displayName,
            block,
            blockTypeId,
            renderData,
            inventorySignature,
            extendedInfoActive,
            itemInsideFrameTranslationKey: frameItemTranslationKey,
        };
    }
    finalizeEntity(context) {
        const metadata = {
            type: LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.ENTITY,
            hitIdentifier: context.entity.typeId,
            namespace: context.namespace,
            displayName: context.displayName,
            renderData: context.renderData,
            ...(context.nameTagContextTranslationKey && {
                nameTagContextTranslationKey: context.nameTagContextTranslationKey,
            }),
            ...(context.itemContextIdentifier && {
                itemContextIdentifier: context.itemContextIdentifier,
            }),
        };
        const iconRequests = [];
        if (context.itemStack) {
            iconRequests.push(InventoryMirror_1.InventoryMirror.createPrimaryIconRequest(context.itemStack));
        }
        return {
            metadata,
            iconRequests,
            extendedInfoActive: false,
        };
    }
    finalizeBlock(context) {
        const metadata = {
            type: LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.TILE,
            hitIdentifier: context.blockTypeId,
            namespace: context.namespace,
            displayName: context.displayName,
            renderData: context.renderData,
            ...(context.itemInsideFrameTranslationKey && {
                itemInsideFrameTranslationKey: context.itemInsideFrameTranslationKey,
            }),
        };
        const iconRequests = [
            InventoryMirror_1.InventoryMirror.createPrimaryIconRequest(context.block),
        ];
        if (context.renderData.inventory) {
            iconRequests.push(...InventoryMirror_1.InventoryMirror.createInventoryRequests(context.renderData.inventory));
        }
        return {
            metadata,
            iconRequests,
            extendedInfoActive: context.extendedInfoActive,
        };
    }
    resolveNamespace(hitIdentifier) {
        return hitIdentifier.includes(":")
            ? hitIdentifier.substring(0, hitIdentifier.indexOf(":") + 1)
            : "minecraft:";
    }
    resolveFrameItemKey(blockTypeId, hitIdentifier) {
        if (!frameBlockIds_json_1.default.includes(blockTypeId))
            return undefined;
        if (frameBlockIds_json_1.default.includes(hitIdentifier))
            return undefined;
        const namespaceLess = hitIdentifier.replace(/.*:/g, "");
        const mappedAlias = nameAliases_json_1.default[namespaceLess];
        if (mappedAlias) {
            return `${mappedAlias}.name`;
        }
        try {
            return new server_1.ItemStack(hitIdentifier).localizationKey;
        }
        catch {
            return undefined;
        }
    }
    encodeInventory(inventory) {
        if (!inventory || inventory.length === 0)
            return "";
        return inventory
            .map((entry) => {
            const typeId = entry.item?.typeId ?? "minecraft:air";
            const amount = entry.item?.amount ?? 0;
            return `${entry.slot}:${typeId}:${amount}`;
        })
            .join("|");
    }
}
exports.LookPipeline = LookPipeline;
