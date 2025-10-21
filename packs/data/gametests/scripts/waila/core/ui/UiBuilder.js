"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UiBuilder = void 0;
const add_on_registry_1 = require("@bedrock-oss/add-on-registry");
const blockInventoryTokens_json_1 = __importDefault(require("../../../data/blockInventoryTokens.json"));
const LookAtObjectTypeEnum_1 = require("../../../types/LookAtObjectTypeEnum");
class UiBuilder {
    static build(player, metadata, settings, extendedInfoActive) {
        const subtitleParts = [
            { text: metadata.renderData.entityId || "" },
        ];
        const isTileOrItemEntity = metadata.type === LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.TILE ||
            (metadata.type === LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.ENTITY && !!metadata.itemContextIdentifier);
        const prefixType = isTileOrItemEntity ? "A" : "B";
        let healthOrArmor = "";
        let finalTagIcons = "";
        let effectsStr = "";
        if (isTileOrItemEntity) {
            if (metadata.type === LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.TILE) {
                const blockData = metadata.renderData;
                finalTagIcons = blockData.toolIcons;
            }
            else {
                finalTagIcons = "zz,f;zz,f:";
            }
        }
        else {
            const entityData = metadata.renderData;
            healthOrArmor = `${entityData.healthRenderer}${entityData.armorRenderer}`;
            finalTagIcons = entityData.tagIcons;
            effectsStr = `${entityData.effectsRenderer.effectString}e${entityData.effectsRenderer.effectsResolvedArray.length
                .toString()
                .padStart(2, "0")}`;
        }
        const nameElements = [];
        if (metadata.hitIdentifier === "minecraft:player") {
            nameElements.push({ text: "__r4ui:humanoid." });
        }
        if (metadata.nameTagContextTranslationKey && metadata.hitIdentifier !== "minecraft:player") {
            nameElements.push({ text: `${metadata.displayName} §7(` });
            nameElements.push({ translate: metadata.nameTagContextTranslationKey });
            nameElements.push({ text: ")§r" });
        }
        else {
            nameElements.push({ translate: metadata.displayName });
        }
        if (metadata.itemInsideFrameTranslationKey) {
            nameElements.push({ text: "\n§7[" });
            nameElements.push({ translate: metadata.itemInsideFrameTranslationKey });
            nameElements.push({ text: "]§r" });
        }
        nameElements.push({ text: "§r" });
        const blockStatesText = metadata.type === LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.TILE && extendedInfoActive
            ? metadata.renderData.blockStates ?? ""
            : "";
        const itemEntityText = metadata.type === LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.ENTITY && metadata.itemContextIdentifier
            ? `\n§7${metadata.itemContextIdentifier}§r`
            : "";
        let healthText = "";
        let paddingNewlines = "";
        if (metadata.type === LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.ENTITY) {
            const entityData = metadata.renderData;
            if (entityData.maxHp > 0 && entityData.intHealthDisplay) {
                const percentage = Math.round((entityData.hp / entityData.maxHp) * 100);
                const hpDisplay = entityData.maxHp < 1000000
                    ? ` ${entityData.hp}/${entityData.maxHp} (${percentage}%)`
                    : " ∞";
                healthText = `\n§7 ${hpDisplay}§r`;
            }
            if (entityData.maxHp > 0 && entityData.maxHp <= 40 && !entityData.intHealthDisplay) {
                paddingNewlines += "\n";
            }
            if (entityData.maxHp > 20 && entityData.maxHp <= 40 && !entityData.intHealthDisplay) {
                paddingNewlines += "\n";
            }
            if (entityData.maxHp > 40 && !entityData.intHealthDisplay) {
                healthText = `\n§7 ${entityData.maxHp < 1000000
                    ? `${entityData.hp}/${entityData.maxHp} (${Math.round((entityData.hp / entityData.maxHp) * 100)}%)`
                    : "∞"}§r`;
            }
            const numEffects = entityData.effectsRenderer.effectsResolvedArray.length;
            if (numEffects > 0 && numEffects < 4) {
                paddingNewlines += "\n\n".repeat(numEffects);
            }
            else if (numEffects >= 4) {
                paddingNewlines +=
                    !entityData.intHealthDisplay && entityData.maxHp > 40 ? "\n" : "\n\n";
            }
            if (entityData.armorRenderer !== "dddddddddd") {
                paddingNewlines += "\n";
            }
        }
        const namespaceText = UiBuilder.resolveNamespaceText(metadata.namespace, player, settings);
        const titleParts = [
            { text: `_r4ui:${prefixType}:` },
            { text: healthOrArmor },
            { text: finalTagIcons },
            { text: effectsStr },
            ...nameElements,
            { text: itemEntityText },
            { text: healthText },
            { text: paddingNewlines },
            { text: "\n§9§o" },
            { translate: namespaceText },
            { text: "§r" },
        ];
        let anchorSetting = settings.displayPosition;
        if (extendedInfoActive && blockStatesText.length > 0) {
            const override = settings.extendedDisplayPosition;
            anchorSetting = override === "unchanged" ? anchorSetting : override;
            subtitleParts.push({ text: "__r4ui:block_states__" });
            subtitleParts.push({ text: blockStatesText });
        }
        titleParts.push({ text: `__r4ui:anchor.${anchorSetting}__` });
        if (metadata.type === LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.TILE &&
            metadata.renderData.inventory &&
            !player.isSneaking) {
            for (const token of UiBuilder.collectInventoryTokens(metadata.hitIdentifier)) {
                titleParts.push({ text: token });
            }
        }
        const filteredTitle = titleParts.filter((part) => !(typeof part === "object" && "text" in part && part.text === ""));
        return { title: filteredTitle, subtitle: subtitleParts };
    }
    static collectInventoryTokens(blockId) {
        const rules = blockInventoryTokens_json_1.default;
        const matches = [];
        for (const rule of rules) {
            if (rule.match.some((candidate) => candidate === blockId)) {
                matches.push(rule.token);
            }
        }
        return matches;
    }
    static resolveNamespaceText(namespace, player, settings) {
        const value = add_on_registry_1.Registry[namespace.replace(":", "")];
        if (value) {
            return !player.isSneaking || !settings.displayExtendedInfo
                ? value.name
                : `${value.name}\nby ${value.creator}`;
        }
        if (namespace.length > 3) {
            return namespace
                .replace(/_/g, " ")
                .replace(":", "")
                .toTitle()
                .abrevCaps();
        }
        return namespace.replace(":", "").toUpperCase();
    }
}
exports.UiBuilder = UiBuilder;
