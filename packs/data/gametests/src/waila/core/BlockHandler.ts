/**
 *
 * @author
 * r4isen1920
 * https://mcpedl.com/user/r4isen1920
 *
 * @license
 * MIT License
 *
 */

import {
	Block,
	BlockInventoryComponent,
	EntityComponentTypes,
	ItemStack,
	Player,
} from "@minecraft/server";
import { Logger } from "@bedrock-oss/bedrock-boost";

import { LookAtBlockInterface } from "../../types/LookAtObjectInterface";
import {
	BlockRenderDataInterface,
	ItemStackWithSlot,
} from "../../types/LookAtObjectMetadataInterface";
import { LookAtObjectTypeEnum } from "../../types/LookAtObjectTypeEnum";
import TagsInterface from "../../types/TagsInterface";
import { BlockToolsEnum, TagRemarksEnum } from "../../types/TagsEnum";

import blockTools from "../../data/blockTools.json";
import { RuleMatcher } from "../utils/RuleMatcher";
import { MainHandContext, getMainHandContext } from "../utils/PlayerEquipment";



//#region Globals
const INVENTORY_SECOND_ROW_LIMIT = 18;




//#region BlockHandler
export class BlockHandler {
	private static readonly log = Logger.getLogger("BlockHandler");

	static createLookupData(block: Block): LookAtBlockInterface {
		return {
			type: LookAtObjectTypeEnum.TILE,
			hitIdentifier: BlockHandler.resolveHitIdentifier(block),
			block,
		};
	}

	static createRenderData(block: Block, player: Player): BlockRenderDataInterface {
		const extracted = BlockHandler.extractInventory(block);
		return {
			toolIcons: BlockHandler.buildToolIconString(block, player),
			blockStates: BlockHandler.describeStates(block),
			inventory: extracted.slots,
			...(extracted.overflow > 0 ? { inventoryOverflow: extracted.overflow } : {}),
		};
	}

	private static resolveHitIdentifier(block: Block): string {
		try {
			const stack = block.getItemStack(1, true);
			if (stack?.typeId) return stack.typeId;
		} catch {
			/** intentionally empty */
		}
		return block.typeId;
	}

	private static buildToolIconString(block: Block, player: Player): string {
		const matches = BlockHandler.collectMatchingTags(block);
		if (matches.length === 0) {
			return `${BlockToolsEnum.UNDEFINED},${TagRemarksEnum.UNDEFINED};${BlockToolsEnum.UNDEFINED},${TagRemarksEnum.UNDEFINED}:`;
		}

		const mainHand = getMainHandContext(player);
		const processed: TagEvaluationResult[] = [];

		for (const tagDef of matches) {
			const iconId = BlockHandler.resolveToolIconId(tagDef.name);
			const remark = BlockHandler.resolveRemarkIcon(tagDef, mainHand);

			if (processed.some((entry) => entry.iconId.charAt(0) === iconId.charAt(0))) {
				continue;
			}

			processed.push({ iconId, remark });
			if (processed.length >= 2) break;
		}

		const [primary, secondary] = BlockHandler.padToolEntries(processed);
		return `${primary.iconId},${primary.remark};${secondary.iconId},${secondary.remark}:`;
	}

	private static collectMatchingTags(block: Block): TagsInterface[] {
		const blockId = block.typeId;
		const namespaceLess = blockId.includes(":") ? blockId.split(":")[1] : blockId;
		const blockTags = block.getTags();

		return (blockTools as TagsInterface[]).filter((tagDef) => {
			let hasPositiveMatch = false;

			for (const matcher of tagDef.target) {
				if (typeof matcher === "string") {
					const isNegated = matcher.startsWith("!");
					const rule = isNegated ? matcher.substring(1) : matcher;
					if (!rule) continue;

					const matches = BlockHandler.matchesBlockRule(rule, blockId, namespaceLess);
					if (matches) {
						if (isNegated) return false;
						hasPositiveMatch = true;
					}
					continue;
				}

				const tagRule = matcher.tag;
				if (!tagRule) continue;
				const isNegated = tagRule.startsWith("!");
				const actualRule = isNegated ? tagRule.substring(1) : tagRule;
				const matches = BlockHandler.matchesTagRule(actualRule, blockTags);

				if (matches) {
					if (isNegated) return false;
					hasPositiveMatch = true;
				} else if (!isNegated) {
					// positive tag that doesn't match does not immediately disqualify the entry,
					// but it also doesn't contribute to the positive match tally
				}
			}

			return hasPositiveMatch;
		});
	}

	private static matchesBlockRule(
		rule: string,
		blockId: string,
		namespaceLess: string,
	): boolean {
		return (
			RuleMatcher.matches(blockId, rule) ||
			RuleMatcher.matches(namespaceLess, rule)
		);
	}

	private static matchesTagRule(
		rule: string,
		blockTags: readonly string[],
	): boolean {
		return blockTags.some((tag) => RuleMatcher.matches(tag, rule));
	}

	private static matchesTagCondition(
		rule: string,
		tags: readonly string[],
	): boolean {
		if (!rule) return false;
		const isNegated = rule.startsWith("!");
		const actualRule = isNegated ? rule.substring(1) : rule;
		const positiveMatch = tags.some((tag) => RuleMatcher.matches(tag, actualRule));
		return isNegated ? !positiveMatch : positiveMatch;
	}

	private static matchesItemRule(rule: string, itemTypeId: string): boolean {
		if (!rule) return false;
		const isNegated = rule.startsWith("!");
		const actualRule = isNegated ? rule.substring(1) : rule;
		const value = itemTypeId;
		const namespaceLess = BlockHandler.getNamespaceLessIdentifier(value);
		const tokens = namespaceLess.split("_").filter(Boolean);

		let matched = false;

		if (actualRule.includes(":")) {
			matched = value === actualRule;
		} else {
			matched =
				namespaceLess === actualRule ||
				tokens.includes(actualRule);
		}

		return isNegated ? !matched : matched;
	}

	private static getNamespaceLessIdentifier(value: string): string {
		return value.includes(":") ? value.split(":")[1] : value;
	}

	private static resolveToolIconId(tagName: string): string {
		const key = tagName.toUpperCase();
		return (
			BlockToolsEnum[key as keyof typeof BlockToolsEnum] ??
			BlockToolsEnum.UNDEFINED
		);
	}

	private static resolveRemarkIcon(tagDef: TagsInterface, context: MainHandContext): TagRemarksEnum {
		if (!tagDef.remarks) return TagRemarksEnum.UNDEFINED;

		for (const remarkKey of Object.keys(tagDef.remarks)) {
			const enumKey = remarkKey.toUpperCase();
			if (!(enumKey in TagRemarksEnum)) continue;

			const remarkEnum = TagRemarksEnum[enumKey as keyof typeof TagRemarksEnum];
			const conditions = tagDef.remarks[remarkKey as keyof typeof tagDef.remarks]!;

			const matchesByTag = conditions.tags
				?.some((rule) => BlockHandler.matchesTagCondition(rule, context.tags)) ?? false;
			const matchesByItem = conditions.itemIds
				?.some((rule) => BlockHandler.matchesItemRule(rule, context.itemTypeId)) ?? false;

			if (matchesByTag || matchesByItem) {
				return remarkEnum;
			}
		}

		return TagRemarksEnum.UNDEFINED;
	}

	private static padToolEntries(entries: TagEvaluationResult[]): [TagEvaluationResult, TagEvaluationResult] {
		const defaultEntry: TagEvaluationResult = {
			iconId: BlockToolsEnum.UNDEFINED,
			remark: TagRemarksEnum.UNDEFINED,
		};
		return [entries[0] ?? defaultEntry, entries[1] ?? defaultEntry];
	}

	private static describeStates(block: Block): string | undefined {
		try {
			const states = block.permutation.getAllStates();
			const keys = Object.keys(states).sort();
			if (keys.length === 0) return undefined;

			return keys
				.map((key) => {
					const value = states[key as keyof typeof states];
					const formattedKey = key.replace("minecraft:", "");
					const prefix = BlockHandler.colorForStateValue(value);
					return `§7${formattedKey}: ${prefix}${value}§r`;
				})
				.join("\n");
		} catch {
			return undefined;
		}
	}

	private static colorForStateValue(value: unknown): string {
		if (typeof value === "number") return "§3";
		if (typeof value === "boolean") return value ? "§a" : "§c";
		return "§e";
	}

	private static extractInventory(block: Block): ExtractedInventoryResult {
		const container = BlockHandler.getBlockContainer(block);
		if (!container) return { slots: undefined, overflow: 0 };

		const allNonEmpty = BlockHandler.collectNonEmptyStacks(container);

		if (container.size > INVENTORY_SECOND_ROW_LIMIT) {
			if (allNonEmpty.length === 0) return { slots: undefined, overflow: 0 };
			const packed = BlockHandler.packIntoTwoRows(allNonEmpty);
			const slots = packed.slots;
			const overflow = Math.max(0, packed.aggregatedSize - slots.length);
			return {
				slots: slots.length > 0 ? slots : undefined,
				overflow,
			};
		}

		const mirrored = BlockHandler.mirrorContainer(container);
		if (!mirrored) return { slots: undefined, overflow: 0 };
		const overflow = Math.max(0, allNonEmpty.length - mirrored.mirroredNonEmpty);
		return {
			slots: mirrored.slots,
			overflow,
		};
	}

	private static getBlockContainer(block: Block): BlockContainer | undefined {
		const component = block.getComponent(
			EntityComponentTypes.Inventory,
		) as BlockInventoryComponent | undefined;
		return component?.container ?? undefined;
	}

	private static collectNonEmptyStacks(container: BlockContainer): ItemStack[] {
		const result: ItemStack[] = [];
		for (let i = 0; i < container.size; i++) {
			const stack = container.getItem(i);
			if (stack && stack.typeId !== "minecraft:air" && stack.amount > 0) {
				result.push(stack);
			}
		}
		return result;
	}

	private static packIntoTwoRows(items: ItemStack[]): { slots: ItemStackWithSlot[]; aggregatedSize: number } {
		const aggregated = BlockHandler.aggregateStackableItems(items);
		const allowedSlots: number[] = [];
		for (let index = 0; index < INVENTORY_SECOND_ROW_LIMIT; index++) {
			if (index === 8) continue;
			allowedSlots.push(index);
		}

		const slots: ItemStackWithSlot[] = [];
		for (let i = 0; i < allowedSlots.length; i++) {
			const item = aggregated[i];
			if (!item) break;
			slots.push({ item, slot: allowedSlots[i] });
		}
		return { slots, aggregatedSize: aggregated.length };
	}

	private static mirrorContainer(container: BlockContainer): MirroredInventoryResult | undefined {
		const rendered: ItemStackWithSlot[] = [];
		let mirroredNonEmpty = 0;
		for (let slot = 0; slot < container.size; slot++) {
			const mapped = slot < 8 ? slot : slot + 1;
			if (mapped >= INVENTORY_SECOND_ROW_LIMIT) break;
			const stack = container.getItem(slot);
			if (stack && stack.typeId !== "minecraft:air" && stack.amount > 0) {
				mirroredNonEmpty++;
			}
			rendered.push({ item: stack ?? new ItemStack("minecraft:air"), slot: mapped });
		}
		return mirroredNonEmpty > 0 ? { slots: rendered, mirroredNonEmpty } : undefined;
	}

	private static aggregateStackableItems(items: ItemStack[]): ItemStack[] {
		if (items.length === 0) return items;

		const order: AggregationOrderEntry[] = [];
		const buckets = new Map<string, StackAggregationBucket>();

		for (const item of items) {
			if (!item) continue;
			if (!BlockHandler.isStackableCandidate(item)) {
				order.push({ kind: "single", stack: item });
				continue;
			}

			const key = item.typeId;
			let bucket = buckets.get(key);
			if (!bucket) {
				bucket = {
					template: item,
					maxAmount: BlockHandler.resolveMaxStackSize(item),
					total: 0,
				};
				buckets.set(key, bucket);
				order.push({ kind: "bucket", key });
			}
			bucket.total += Math.max(0, item.amount);
		}

		const aggregated: ItemStack[] = [];
		for (const entry of order) {
			if (entry.kind === "single") {
				aggregated.push(entry.stack);
				continue;
			}

			const bucket = buckets.get(entry.key);
			if (!bucket) continue;

			let remaining = bucket.total;
			const maxStack = Math.max(1, bucket.maxAmount);
			while (remaining > 0) {
				const portion = Math.min(maxStack, remaining);
				const clone = BlockHandler.cloneItemForAggregation(bucket.template, portion);
				if (clone) {
					aggregated.push(clone);
				}
				remaining -= portion;
			}
			buckets.delete(entry.key);
		}

		return aggregated;
	}

	private static isStackableCandidate(item: ItemStack): boolean {
		if (!item || item.amount <= 0) return false;
		if (item.isStackable !== true) return false;
		const maxAmount = typeof item.maxAmount === "number" ? item.maxAmount : 0;
		return maxAmount > 1;
	}

	private static resolveMaxStackSize(item: ItemStack): number {
		const maxAmount = typeof item.maxAmount === "number" ? item.maxAmount : 0;
		return maxAmount > 0 ? maxAmount : 64;
	}

	private static cloneItemForAggregation(source: ItemStack, amount: number): ItemStack | undefined {
		try {
			const clone = source.clone();
			clone.amount = amount;
			return clone;
		} catch (error) {
			BlockHandler.log.debug?.(`Failed to clone stack for aggregation: ${error}`);
			try {
				const fallback = new ItemStack(source.typeId, amount);
				fallback.amount = amount;
				return fallback;
			} catch (creationError) {
				BlockHandler.log.warn(`Failed to create fallback stack for ${source.typeId}: ${creationError}`);
				return undefined;
			}
		}
	}
}



//#region Types
type BlockContainer = NonNullable<BlockInventoryComponent["container"]>;

interface ExtractedInventoryResult {
	slots?: ItemStackWithSlot[];
	overflow: number;
}

interface MirroredInventoryResult {
	slots: ItemStackWithSlot[];
	mirroredNonEmpty: number;
}

interface TagEvaluationResult {
	iconId: string;
	remark: TagRemarksEnum;
}

interface StackAggregationBucket {
	template: ItemStack;
	maxAmount: number;
	total: number;
}

type AggregationOrderEntry =
	| { kind: "single"; stack: ItemStack }
	| { kind: "bucket"; key: string };