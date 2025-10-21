"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityHandler = void 0;
const server_1 = require("@minecraft/server");
const LookAtObjectTypeEnum_1 = require("../types/LookAtObjectTypeEnum");
const TagsEnum_1 = require("../types/TagsEnum");
const armor_json_1 = __importDefault(require("../data/armor.json"));
const entityInteractions_json_1 = __importDefault(require("../data/entityInteractions.json"));
const ignoredEntityRender_json_1 = __importDefault(require("../data/ignoredEntityRender.json"));
const RuleMatcher_1 = require("./utils/RuleMatcher");
const PlayerEquipment_1 = require("./utils/PlayerEquipment");
const MAX_TRACKED_EFFECTS = 6;
const EFFECT_TABLE = [
    { name: "speed", id: 1 },
    { name: "slowness", id: 2 },
    { name: "haste", id: 3 },
    { name: "mining_fatigue", id: 4 },
    { name: "strength", id: 5 },
    { name: "instant_health", id: 6 },
    { name: "instant_damage", id: 7 },
    { name: "jump_boost", id: 8 },
    { name: "nausea", id: 9 },
    { name: "regeneration", id: 10 },
    { name: "resistance", id: 11 },
    { name: "fire_resistance", id: 12 },
    { name: "water_breathing", id: 13 },
    { name: "invisibility", id: 14 },
    { name: "blindness", id: 15 },
    { name: "night_vision", id: 16 },
    { name: "hunger", id: 17 },
    { name: "weakness", id: 18 },
    { name: "poison", id: 19 },
    { name: "wither", id: 20 },
    { name: "health_boost", id: 21 },
    { name: "absorption", id: 22 },
    { name: "saturation", id: 23 },
    { name: "levitation", id: 24 },
    { name: "fatal_poison", id: 25 },
    { name: "slow_falling", id: 26 },
    { name: "conduit_power", id: 27 },
    { name: "bad_omen", id: 28 },
    { name: "village_hero", id: 29 },
    { name: "darkness", id: 30 },
    { name: "wind_charged", id: 31 },
    { name: "weaving", id: 32 },
    { name: "oozing", id: 33 },
    { name: "infested", id: 34 },
];
class EntityHandler {
    static createLookupData(entity) {
        const health = entity.getComponent(server_1.EntityComponentTypes.Health);
        const base = {
            type: LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.ENTITY,
            hitIdentifier: entity.typeId,
            entity,
            hp: health?.currentValue ?? 0,
            maxHp: health?.effectiveMax ?? 0,
        };
        try {
            base.effectsData = entity
                .getEffects()
                .filter((effect) => effect.duration !== -1 && effect.amplifier !== -1)
                .map((effect) => ({
                id: effect.typeId,
                amplifier: effect.amplifier,
                duration: Math.floor(effect.duration / server_1.TicksPerSecond),
            }));
        }
        catch {
            base.effectsData = [];
        }
        if (entity.typeId === "minecraft:item") {
            const itemComponent = entity.getComponent(server_1.EntityComponentTypes.Item);
            if (itemComponent?.itemStack) {
                base.itemStack = itemComponent.itemStack;
            }
        }
        return base;
    }
    static transformEntityId(entity) {
        if (ignoredEntityRender_json_1.default.some((pattern) => entity.typeId.includes(pattern))) {
            return "0000000000000";
        }
        const rawId = entity.id ?? "0000000000000";
        const big = BigInt(rawId);
        const normalized = big < 0n ? -big : big;
        const padded = normalized.toString().padStart(12, "0");
        return `${big < 0n ? "-" : ""}${padded}`;
    }
    static createRenderData(entity, player, isPlayer) {
        const health = entity.getComponent(server_1.EntityComponentTypes.Health);
        const currentHp = Math.floor(health?.currentValue ?? 0);
        const maxHp = Math.floor(health?.effectiveMax ?? 0);
        const intHealthDisplay = entity.matches({ families: ["inanimate"] }) ||
            (maxHp > 40 && !entity.matches({ type: "minecraft:player" }));
        const healthRenderer = EntityHandler.buildHealthRenderer(currentHp, maxHp, isPlayer, intHealthDisplay);
        return {
            entityId: EntityHandler.transformEntityId(entity),
            tagIcons: EntityHandler.buildInteractionIconString(entity, player),
            hp: currentHp,
            maxHp,
            intHealthDisplay,
            healthRenderer,
            armorRenderer: EntityHandler.buildArmorRenderer(entity),
            effectsRenderer: EntityHandler.buildEffectsRenderer(entity),
        };
    }
    static buildInteractionIconString(entity, player) {
        const interactionTags = EntityHandler.collectInteractionTags(entity);
        const componentTags = EntityHandler.collectComponentTags(entity);
        const finalNames = EntityHandler.selectTagNames(interactionTags, componentTags);
        const mainHand = (0, PlayerEquipment_1.getMainHandContext)(player);
        const icons = finalNames.map((name) => EntityHandler.resolveTagIcon(name, interactionTags.get(name), mainHand));
        while (icons.length < 2) {
            icons.push({
                iconId: TagsEnum_1.EntityInteractionsEnum.UNDEFINED,
                remark: TagsEnum_1.TagRemarksEnum.UNDEFINED,
            });
        }
        const [first, second] = icons;
        return `:${first.iconId},${first.remark};${second.iconId},${second.remark}:`;
    }
    static collectInteractionTags(entity) {
        const result = new Map();
        const typeId = entity.typeId;
        const namespaceLess = typeId.includes(":") ? typeId.split(":")[1] : typeId;
        for (const rawDef of entityInteractions_json_1.default) {
            let matched = false;
            let blocked = false;
            for (const matcher of rawDef.target) {
                if (typeof matcher !== "string")
                    continue;
                const rule = matcher;
                const hit = RuleMatcher_1.RuleMatcher.matches(typeId, rule) || RuleMatcher_1.RuleMatcher.matches(namespaceLess, rule);
                if (!hit)
                    continue;
                if (rule.startsWith("!")) {
                    blocked = true;
                    break;
                }
                matched = true;
            }
            if (matched && !blocked) {
                result.set(rawDef.name.toUpperCase(), rawDef);
            }
        }
        return result;
    }
    static collectComponentTags(entity) {
        const candidateComponents = [
            server_1.EntityComponentTypes.CanFly,
            server_1.EntityComponentTypes.CanPowerJump,
            server_1.EntityComponentTypes.FireImmune,
            server_1.EntityComponentTypes.IsBaby,
            server_1.EntityComponentTypes.IsChested,
            server_1.EntityComponentTypes.IsDyeable,
            server_1.EntityComponentTypes.IsStunned,
            server_1.EntityComponentTypes.IsTamed,
            server_1.EntityComponentTypes.Projectile,
            server_1.EntityComponentTypes.WantsJockey,
        ];
        const output = [];
        for (const component of candidateComponents) {
            try {
                if (entity.getComponent(component)) {
                    output.push(component.replace("minecraft:", "").toUpperCase());
                }
            }
            catch {
            }
        }
        return output;
    }
    static selectTagNames(interactionTags, componentTags) {
        const results = [];
        const interactionKeys = Array.from(interactionTags.keys());
        if (interactionKeys.includes("IS_BABY")) {
            interactionTags.delete("IS_RIDEABLE");
        }
        if (interactionKeys.includes("IS_TAMED")) {
            interactionTags.delete("TAMEABLE");
        }
        for (const name of interactionKeys) {
            if (!results.includes(name)) {
                results.push(name);
            }
            if (results.length >= 2)
                return results.slice(0, 2);
        }
        for (const name of componentTags) {
            if (!results.includes(name)) {
                results.push(name);
            }
            if (results.length >= 2)
                break;
        }
        return results.slice(0, 2);
    }
    static resolveTagIcon(tagName, definition, mainHand) {
        const iconId = TagsEnum_1.EntityInteractionsEnum[tagName] ??
            TagsEnum_1.EntityInteractionsEnum.UNDEFINED;
        if (!definition?.remarks) {
            return { iconId, remark: TagsEnum_1.TagRemarksEnum.UNDEFINED };
        }
        for (const key of Object.keys(definition.remarks)) {
            const enumKey = key.toUpperCase();
            if (!(enumKey in TagsEnum_1.TagRemarksEnum))
                continue;
            const remarkEnum = TagsEnum_1.TagRemarksEnum[enumKey];
            const conditions = definition.remarks[key];
            const matchesItemId = conditions.itemIds?.some((rule) => RuleMatcher_1.RuleMatcher.matches(mainHand.itemTypeId, rule));
            if (matchesItemId) {
                return { iconId, remark: remarkEnum };
            }
            const matchesTag = conditions.tags?.some((rule) => mainHand.tags.some((tag) => RuleMatcher_1.RuleMatcher.matches(tag, rule)));
            if (matchesTag) {
                return { iconId, remark: remarkEnum };
            }
        }
        return { iconId, remark: TagsEnum_1.TagRemarksEnum.UNDEFINED };
    }
    static buildHealthRenderer(currentHp, maxHp, isPlayer, intHealthDisplay) {
        if (intHealthDisplay) {
            if (maxHp > 40 && !isPlayer) {
                return "xyyyyyyyyyyyyyyyyyyy";
            }
            return "yyyyyyyyyyyyyyyyyyyy";
        }
        let scaledCurrent = currentHp;
        let scaledMax = maxHp;
        const maxLength = isPlayer ? 20 : 40;
        if (scaledMax > maxLength) {
            scaledCurrent = Math.round((scaledCurrent / scaledMax) * maxLength);
            scaledMax = maxLength;
        }
        const icons = { empty: "a", half: "b", full: "c", padding: "y" };
        const heartSlots = Math.ceil(Math.max(scaledMax, 0) / 2);
        const clampedCurrent = Math.max(0, scaledCurrent);
        const full = Math.floor(clampedCurrent / 2);
        const half = clampedCurrent % 2;
        const empty = Math.max(0, heartSlots - full - half);
        let result = icons.full.repeat(full) + icons.half.repeat(half) + icons.empty.repeat(empty);
        if (result.length < 20) {
            result += icons.padding.repeat(20 - result.length);
        }
        return result.substring(0, 20) || "yyyyyyyyyyyyyyyyyyyy";
    }
    static buildArmorRenderer(entity) {
        const equippable = entity.getComponent(server_1.EntityComponentTypes.Equippable);
        if (!equippable)
            return "dddddddddd";
        const armorValues = armor_json_1.default;
        const total = [
            server_1.EquipmentSlot.Head,
            server_1.EquipmentSlot.Chest,
            server_1.EquipmentSlot.Legs,
            server_1.EquipmentSlot.Feet,
        ].reduce((sum, slot) => {
            const item = equippable.getEquipment(slot);
            return sum + (armorValues[item?.typeId ?? ""] ?? 0);
        }, 0);
        const icons = { empty: "d", half: "e", full: "f" };
        const full = Math.floor(total / 2);
        const half = total % 2;
        const empty = Math.max(0, Math.ceil(20 / 2) - full - half);
        let rendered = icons.full.repeat(full) + icons.half.repeat(half) + icons.empty.repeat(empty);
        if (rendered.length < 10)
            rendered += icons.empty.repeat(10 - rendered.length);
        return rendered.substring(0, 10) || "dddddddddd";
    }
    static buildEffectsRenderer(entity) {
        let resolvedCount = 0;
        const resolvedIds = [];
        let effectString = "";
        for (const effectInfo of EFFECT_TABLE) {
            let effect;
            try {
                effect = entity.getEffect(effectInfo.name);
            }
            catch {
                effect = undefined;
            }
            if (effect?.duration === -1 || effect?.amplifier === -1) {
                effect = undefined;
            }
            let durationTicks = effect?.duration ?? 0;
            let amplifier = effect?.amplifier ?? 0;
            const effectId = effect?.typeId;
            if (resolvedCount >= MAX_TRACKED_EFFECTS) {
                durationTicks = 0;
                amplifier = 0;
            }
            else if (effectId) {
                amplifier = Math.min(amplifier + 1, 9);
            }
            if (effectId) {
                resolvedCount++;
                if (durationTicks > 0)
                    resolvedIds.push(effectId);
            }
            const seconds = Math.floor(durationTicks / server_1.TicksPerSecond);
            const minutes = Math.min(99, Math.floor(seconds / 60));
            const remainingSeconds = Math.floor(seconds % 60);
            const durationStr = `${minutes.toString().padStart(2, "0")}:${remainingSeconds
                .toString()
                .padStart(2, "0")}`;
            effectString += `d${durationStr}p${Math.max(0, amplifier).toString().padStart(1, "0")}`;
        }
        return {
            effectString,
            effectsResolvedArray: resolvedIds,
        };
    }
}
exports.EntityHandler = EntityHandler;
