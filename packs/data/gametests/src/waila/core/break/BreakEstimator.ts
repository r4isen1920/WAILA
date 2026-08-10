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
	EntityComponentTypes,
	EntityEquippableComponent,
	EquipmentSlot,
	ItemComponentTypes,
	ItemStack,
	Player,
	type ItemEnchantableComponent,
} from "@minecraft/server";

import hardnessData from "../../datasets/blockHardness.json";
import toolData from "../../datasets/toolTiers.json";
import WailaLogger from "../../utils/Logger";
import { BreakLearningStore } from "./BreakLearningStore";



//#region Globals
const TICKS_PER_SECOND = 20;
const HARVESTABLE_DIVISOR = 30;
const UNHARVESTABLE_DIVISOR = 100;
const DEFAULT_TOOL_SPEED = 1;

const hardnessTable = hardnessData as HardnessDataset;
const toolTable = toolData as ToolDataset;
const unbreakableSet = new Set(hardnessTable.unbreakable);



//#region BreakEstimator
/**
 * Predicts how long a block takes to break for a given player, following the
 * vanilla breaking formula. Falls back to learned samples when the shipped
 * hardness data does not cover the block.
 */
export class BreakEstimator {
	private static readonly log = WailaLogger.get("BreakEstimator");

	static estimate(player: Player, block: Block, heldItem?: ItemStack): BreakEstimate {
		const blockTypeId = block.typeId;

		if (unbreakableSet.has(blockTypeId)) {
			return { seconds: 0, hardness: 0, source: "unbreakable", modifiers: undefined };
		}

		const resolved = this.resolveHardness(block);
		const modifiers = this.collectModifiers(player, block, heldItem);

		if (!resolved) {
			return { seconds: 0, hardness: 0, source: "unknown", modifiers };
		}

		return {
			seconds: this.secondsFor(resolved.hardness, modifiers),
			hardness: resolved.hardness,
			source: resolved.source,
			modifiers,
		};
	}

	/**
	 * Inverts the formula to recover the hardness implied by an observed break duration.
	 * Must use the exact modifier stack that produced the prediction.
	 */
	static impliedHardness(observedSeconds: number, modifiers: BreakModifiers): number | undefined {
		if (!Number.isFinite(observedSeconds) || observedSeconds <= 0) return undefined;

		const speed = this.speedMultiplier(modifiers);
		if (speed <= 0) return undefined;

		const ticks = Math.max(1, Math.round(observedSeconds * TICKS_PER_SECOND));
		const divisor = modifiers.canHarvest ? HARVESTABLE_DIVISOR : UNHARVESTABLE_DIVISOR;

		return (speed * ticks) / divisor;
	}

	static secondsFor(hardness: number, modifiers: BreakModifiers): number {
		if (hardness <= 0) return 0;

		const speed = this.speedMultiplier(modifiers);
		const divisor = modifiers.canHarvest ? HARVESTABLE_DIVISOR : UNHARVESTABLE_DIVISOR;
		const damage = speed / hardness / divisor;

		if (damage >= 1) return 0;
		return Math.ceil(1 / damage) / TICKS_PER_SECOND;
	}

	/** Whether the shipped hardness dataset already covers this block, ignoring tag fallbacks. */
	static hasShippedHardness(blockTypeId: string): boolean {
		if (hardnessTable.exact[blockTypeId] !== undefined) return true;
		return hardnessTable.patterns.some((pattern) => {
			if (pattern.not?.some((fragment) => blockTypeId.includes(fragment))) return false;
			return pattern.any.some((fragment) => blockTypeId.includes(fragment));
		});
	}

	private static speedMultiplier(modifiers: BreakModifiers): number {
		let speed = DEFAULT_TOOL_SPEED;

		if (modifiers.isBestTool) {
			speed = modifiers.toolSpeed;
			if (!modifiers.canHarvest) {
				speed = DEFAULT_TOOL_SPEED;
			} else if (modifiers.efficiencyLevel > 0) {
				speed += modifiers.efficiencyLevel * modifiers.efficiencyLevel + 1;
			}
		}

		if (modifiers.hasteLevel > 0) speed *= 1 + 0.2 * modifiers.hasteLevel;
		if (modifiers.miningFatigueLevel > 0) {
			speed *= Math.pow(0.3, Math.min(modifiers.miningFatigueLevel, 4));
		}
		if (modifiers.headInWater && !modifiers.aquaAffinity) speed /= 5;
		if (!modifiers.onGround) speed /= 5;

		return speed;
	}

	//#region Modifiers
	private static collectModifiers(
		player: Player,
		block: Block,
		heldItem?: ItemStack,
	): BreakModifiers {
		const toolClass = this.resolveToolClass(block, heldItem);
		const tier = this.resolveTier(heldItem);

		return {
			isBestTool: toolClass !== undefined,
			toolSpeed: this.resolveToolSpeed(block, toolClass, tier),
			canHarvest: this.canHarvest(block, tier),
			efficiencyLevel: this.enchantLevel(heldItem, "efficiency"),
			hasteLevel: this.effectLevel(player, "haste"),
			miningFatigueLevel: this.effectLevel(player, "mining_fatigue"),
			headInWater: this.isHeadInWater(player),
			aquaAffinity: this.hasAquaAffinity(player),
			onGround: player.isOnGround,
		};
	}

	private static resolveToolClass(block: Block, heldItem?: ItemStack): ToolClass | undefined {
		if (!heldItem) return undefined;

		const itemTags = this.safeGet(() => heldItem.getTags()) ?? [];
		const itemTypeId = heldItem.typeId;

		for (const toolClass of toolTable.classes) {
			const blockMatches = toolClass.blockTags.some((tag) => this.safeGet(() => block.hasTag(tag)) === true);
			if (!blockMatches) continue;

			const itemMatches =
				toolClass.itemTags.some((tag) => itemTags.includes(tag)) ||
				toolClass.idAny.some((fragment) => itemTypeId.includes(fragment));
			if (itemMatches) return toolClass;
		}

		return undefined;
	}

	private static resolveToolSpeed(
		block: Block,
		toolClass: ToolClass | undefined,
		tier: ToolTier | undefined,
	): number {
		if (!toolClass) return DEFAULT_TOOL_SPEED;

		const overrides = toolTable.overrides[toolClass.name];
		if (overrides) {
			for (const override of overrides) {
				if (!override.blockAny) return override.speed;
				if (override.blockAny.some((fragment) => block.typeId.includes(fragment))) {
					return override.speed;
				}
			}
		}

		return tier?.speed ?? DEFAULT_TOOL_SPEED;
	}

	private static resolveTier(heldItem?: ItemStack): ToolTier | undefined {
		if (!heldItem) return undefined;

		const itemTags = this.safeGet(() => heldItem.getTags()) ?? [];
		for (const tier of toolTable.tiers) {
			if (tier.tags.some((tag) => itemTags.includes(tag))) return tier;
		}
		for (const tier of toolTable.tiers) {
			if (tier.idAny.some((fragment) => heldItem.typeId.includes(fragment))) return tier;
		}

		return undefined;
	}

	private static canHarvest(block: Block, tier: ToolTier | undefined): boolean {
		let requiredRank = 0;
		for (const requirement of toolTable.harvestTiers) {
			const matches = requirement.blockTags.some(
				(tag) => this.safeGet(() => block.hasTag(tag)) === true,
			);
			if (matches) requiredRank = Math.max(requiredRank, requirement.rank);
		}

		if (requiredRank === 0) return true;
		return (tier?.harvestRank ?? 0) >= requiredRank;
	}

	private static enchantLevel(item: ItemStack | undefined, enchantment: string): number {
		if (!item) return 0;
		const enchantable = this.safeGet(
			() => item.getComponent(ItemComponentTypes.Enchantable) as ItemEnchantableComponent | undefined,
		);
		if (!enchantable) return 0;
		return this.safeGet(() => enchantable.getEnchantment(enchantment)?.level) ?? 0;
	}

	private static effectLevel(player: Player, effect: string): number {
		const active = this.safeGet(() => player.getEffect(effect));
		return active ? active.amplifier + 1 : 0;
	}

	private static hasAquaAffinity(player: Player): boolean {
		const equippable = this.safeGet(
			() => player.getComponent(EntityComponentTypes.Equippable) as EntityEquippableComponent | undefined,
		);
		const helmet = this.safeGet(() => equippable?.getEquipment(EquipmentSlot.Head));
		if (!helmet) return false;
		return this.enchantLevel(helmet, "aqua_affinity") > 0;
	}

	private static isHeadInWater(player: Player): boolean {
		const headBlock = this.safeGet(() =>
			player.dimension.getBlock(player.getHeadLocation()),
		);
		if (!headBlock) return false;
		return this.safeGet(() => headBlock.hasTag("water")) === true;
	}

	//#region Hardness
	private static resolveHardness(block: Block): ResolvedHardness | undefined {
		const blockTypeId = block.typeId;

		const learned = BreakLearningStore.lookup(blockTypeId);
		if (learned && learned.source !== "learning") {
			return { hardness: learned.hardness, source: learned.source };
		}

		const exact = hardnessTable.exact[blockTypeId];
		if (exact !== undefined) return { hardness: exact, source: "dataset" };

		for (const pattern of hardnessTable.patterns) {
			if (pattern.not?.some((fragment) => blockTypeId.includes(fragment))) continue;
			if (pattern.any.some((fragment) => blockTypeId.includes(fragment))) {
				return { hardness: pattern.h, source: "dataset" };
			}
		}

		for (const fallback of hardnessTable.tagDefaults) {
			if (this.safeGet(() => block.hasTag(fallback.tag)) === true) {
				return { hardness: fallback.h, source: "tag" };
			}
		}

		if (learned) return { hardness: learned.hardness, source: "learning" };
		return undefined;
	}

	private static safeGet<T>(getter: () => T): T | undefined {
		try {
			return getter();
		} catch (error) {
			this.log.debug(`Lookup failed: ${error}`);
			return undefined;
		}
	}
}



//#region Types
export interface BreakModifiers {
	isBestTool: boolean;
	toolSpeed: number;
	canHarvest: boolean;
	efficiencyLevel: number;
	hasteLevel: number;
	miningFatigueLevel: number;
	headInWater: boolean;
	aquaAffinity: boolean;
	onGround: boolean;
}

export type BreakEstimateSource =
	| "learned"
	| "seed"
	| "learning"
	| "dataset"
	| "tag"
	| "unknown"
	| "unbreakable";

export interface BreakEstimate {
	seconds: number;
	hardness: number;
	source: BreakEstimateSource;
	modifiers: BreakModifiers | undefined;
}

interface ResolvedHardness {
	hardness: number;
	source: BreakEstimateSource;
}

interface HardnessDataset {
	exact: Record<string, number>;
	patterns: { h: number; any: string[]; not?: string[] }[];
	tagDefaults: { tag: string; h: number }[];
	unbreakable: string[];
}

interface ToolClass {
	name: string;
	blockTags: string[];
	itemTags: string[];
	idAny: string[];
}

interface ToolTier {
	name: string;
	speed: number;
	harvestRank: number;
	tags: string[];
	idAny: string[];
}

interface ToolDataset {
	tiers: ToolTier[];
	classes: ToolClass[];
	harvestTiers: { blockTags: string[]; rank: number }[];
	overrides: Record<string, { speed: number; blockAny?: string[] }[]>;
}
