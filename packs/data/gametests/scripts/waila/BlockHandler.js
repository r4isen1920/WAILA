"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockHandler = void 0;
const server_1 = require("@minecraft/server");
const bedrock_boost_1 = require("@bedrock-oss/bedrock-boost");
const LookAtObjectTypeEnum_1 = require("../types/LookAtObjectTypeEnum");
const TagsEnum_1 = require("../types/TagsEnum");
const blockTools_json_1 = __importDefault(require("../data/blockTools.json"));
const RuleMatcher_1 = require("./utils/RuleMatcher");
const PlayerEquipment_1 = require("./utils/PlayerEquipment");
const INVENTORY_SECOND_ROW_LIMIT = 18;
class BlockHandler {
    static log = bedrock_boost_1.Logger.getLogger("BlockHandler");
    static createLookupData(block) {
        return {
            type: LookAtObjectTypeEnum_1.LookAtObjectTypeEnum.TILE,
            hitIdentifier: BlockHandler.resolveHitIdentifier(block),
            block,
        };
    }
    static createRenderData(block, player) {
        return {
            toolIcons: BlockHandler.buildToolIconString(block, player),
            blockStates: BlockHandler.describeStates(block),
            inventory: BlockHandler.extractInventory(block),
        };
    }
    static resolveHitIdentifier(block) {
        try {
            const stack = block.getItemStack(1, true);
            if (stack?.typeId)
                return stack.typeId;
        }
        catch {
        }
        return block.typeId;
    }
    static buildToolIconString(block, player) {
        const matches = BlockHandler.collectMatchingTags(block);
        if (matches.length === 0) {
            return `${TagsEnum_1.BlockToolsEnum.UNDEFINED},${TagsEnum_1.TagRemarksEnum.UNDEFINED};${TagsEnum_1.BlockToolsEnum.UNDEFINED},${TagsEnum_1.TagRemarksEnum.UNDEFINED}:`;
        }
        const mainHand = (0, PlayerEquipment_1.getMainHandContext)(player);
        const processed = [];
        for (const tagDef of matches) {
            const iconId = BlockHandler.resolveToolIconId(tagDef.name);
            const remark = BlockHandler.resolveRemarkIcon(tagDef, mainHand);
            if (processed.some((entry) => entry.iconId.charAt(0) === iconId.charAt(0))) {
                continue;
            }
            processed.push({ iconId, remark });
            if (processed.length >= 2)
                break;
        }
        const [primary, secondary] = BlockHandler.padToolEntries(processed);
        return `${primary.iconId},${primary.remark};${secondary.iconId},${secondary.remark}:`;
    }
    static collectMatchingTags(block) {
        const blockId = block.typeId;
        const namespaceLess = blockId.includes(":") ? blockId.split(":")[1] : blockId;
        const blockTags = block.getTags();
        return blockTools_json_1.default.filter((tagDef) => {
            let hasPositiveMatch = false;
            for (const matcher of tagDef.target) {
                if (typeof matcher === "string") {
                    const isNegated = matcher.startsWith("!");
                    const rule = isNegated ? matcher.substring(1) : matcher;
                    if (!rule)
                        continue;
                    const matches = BlockHandler.matchesBlockRule(rule, blockId, namespaceLess);
                    if (matches) {
                        if (isNegated)
                            return false;
                        hasPositiveMatch = true;
                    }
                    continue;
                }
                const tagRule = matcher.tag;
                if (!tagRule)
                    continue;
                const isNegated = tagRule.startsWith("!");
                const actualRule = isNegated ? tagRule.substring(1) : tagRule;
                const matches = BlockHandler.matchesTagRule(actualRule, blockTags);
                if (matches) {
                    if (isNegated)
                        return false;
                    hasPositiveMatch = true;
                }
                else if (!isNegated) {
                }
            }
            return hasPositiveMatch;
        });
    }
    static matchesBlockRule(rule, blockId, namespaceLess) {
        return (RuleMatcher_1.RuleMatcher.matches(blockId, rule) ||
            RuleMatcher_1.RuleMatcher.matches(namespaceLess, rule));
    }
    static matchesTagRule(rule, blockTags) {
        return blockTags.some((tag) => RuleMatcher_1.RuleMatcher.matches(tag, rule));
    }
    static matchesTagCondition(rule, tags) {
        if (!rule)
            return false;
        const isNegated = rule.startsWith("!");
        const actualRule = isNegated ? rule.substring(1) : rule;
        const positiveMatch = tags.some((tag) => RuleMatcher_1.RuleMatcher.matches(tag, actualRule));
        return isNegated ? !positiveMatch : positiveMatch;
    }
    static matchesItemRule(rule, itemTypeId) {
        if (!rule)
            return false;
        const isNegated = rule.startsWith("!");
        const actualRule = isNegated ? rule.substring(1) : rule;
        const value = itemTypeId;
        const namespaceLess = BlockHandler.getNamespaceLessIdentifier(value);
        const tokens = namespaceLess.split("_").filter(Boolean);
        let matched = false;
        if (actualRule.includes(":")) {
            matched = value === actualRule;
        }
        else {
            matched =
                namespaceLess === actualRule ||
                    tokens.includes(actualRule);
        }
        return isNegated ? !matched : matched;
    }
    static getNamespaceLessIdentifier(value) {
        return value.includes(":") ? value.split(":")[1] : value;
    }
    static resolveToolIconId(tagName) {
        const key = tagName.toUpperCase();
        return (TagsEnum_1.BlockToolsEnum[key] ??
            TagsEnum_1.BlockToolsEnum.UNDEFINED);
    }
    static resolveRemarkIcon(tagDef, context) {
        if (!tagDef.remarks)
            return TagsEnum_1.TagRemarksEnum.UNDEFINED;
        for (const remarkKey of Object.keys(tagDef.remarks)) {
            const enumKey = remarkKey.toUpperCase();
            if (!(enumKey in TagsEnum_1.TagRemarksEnum))
                continue;
            const remarkEnum = TagsEnum_1.TagRemarksEnum[enumKey];
            const conditions = tagDef.remarks[remarkKey];
            const matchesByTag = conditions.tags
                ?.some((rule) => BlockHandler.matchesTagCondition(rule, context.tags)) ?? false;
            const matchesByItem = conditions.itemIds
                ?.some((rule) => BlockHandler.matchesItemRule(rule, context.itemTypeId)) ?? false;
            if (matchesByTag || matchesByItem) {
                return remarkEnum;
            }
        }
        return TagsEnum_1.TagRemarksEnum.UNDEFINED;
    }
    static padToolEntries(entries) {
        const defaultEntry = {
            iconId: TagsEnum_1.BlockToolsEnum.UNDEFINED,
            remark: TagsEnum_1.TagRemarksEnum.UNDEFINED,
        };
        return [entries[0] ?? defaultEntry, entries[1] ?? defaultEntry];
    }
    static describeStates(block) {
        try {
            const states = block.permutation.getAllStates();
            const keys = Object.keys(states).sort();
            if (keys.length === 0)
                return undefined;
            return keys
                .map((key) => {
                const value = states[key];
                const formattedKey = key.replace("minecraft:", "");
                const prefix = BlockHandler.colorForStateValue(value);
                return `§7${formattedKey}: ${prefix}${value}§r`;
            })
                .join("\n");
        }
        catch {
            return undefined;
        }
    }
    static colorForStateValue(value) {
        if (typeof value === "number")
            return "§3";
        if (typeof value === "boolean")
            return value ? "§a" : "§c";
        return "§e";
    }
    static extractInventory(block) {
        const container = BlockHandler.getBlockContainer(block);
        if (!container)
            return undefined;
        if (container.size > INVENTORY_SECOND_ROW_LIMIT) {
            const packed = BlockHandler.collectNonEmptyStacks(container);
            if (packed.length === 0)
                return undefined;
            return BlockHandler.packIntoTwoRows(packed);
        }
        return BlockHandler.mirrorContainer(container);
    }
    static getBlockContainer(block) {
        const component = block.getComponent(server_1.EntityComponentTypes.Inventory);
        return component?.container ?? undefined;
    }
    static collectNonEmptyStacks(container) {
        const result = [];
        for (let i = 0; i < container.size; i++) {
            const stack = container.getItem(i);
            if (stack && stack.typeId !== "minecraft:air" && stack.amount > 0) {
                result.push(stack);
            }
        }
        return result;
    }
    static packIntoTwoRows(items) {
        const allowedSlots = [];
        for (let index = 0; index < INVENTORY_SECOND_ROW_LIMIT; index++) {
            if (index === 8)
                continue;
            allowedSlots.push(index);
        }
        const slots = [];
        for (let i = 0; i < allowedSlots.length; i++) {
            const item = items[i];
            if (!item)
                break;
            slots.push({ item, slot: allowedSlots[i] });
        }
        return slots;
    }
    static mirrorContainer(container) {
        const rendered = [];
        let nonEmpty = 0;
        for (let slot = 0; slot < container.size; slot++) {
            const mapped = slot < 8 ? slot : slot + 1;
            if (mapped >= INVENTORY_SECOND_ROW_LIMIT)
                break;
            const stack = container.getItem(slot);
            if (stack)
                nonEmpty++;
            rendered.push({ item: stack ?? new server_1.ItemStack("minecraft:air"), slot: mapped });
        }
        return nonEmpty > 0 ? rendered : undefined;
    }
}
exports.BlockHandler = BlockHandler;
