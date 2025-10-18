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
	Player,
	EntityEquippableComponent,
	EquipmentSlot,
	ItemStack,
	world,
	ItemLockMode,
} from "@minecraft/server";
import { Logger } from "@bedrock-oss/bedrock-boost";

import { LookAtBlockInterface } from "../types/LookAtObjectInterface";
import { BlockRenderDataInterface } from "../types/LookAtObjectMetadataInterface";
import { LookAtObjectTypeEnum } from "../types/LookAtObjectTypeEnum";
import TagsInterface from "../types/TagsInterface";
import { BlockToolsEnum, TagRemarksEnum } from "../types/TagsEnum";

import blockTools from "../data/blockTools.json";

//#region Block
/**
 * Handles block-specific operations for WAILA
 */
export class BlockHandler {
	private static readonly logger = Logger.getLogger("BlockHandler");

	/**
	 * Helper function to check if a single value matches a condition rule.
	 * Mirrors the logic used for TagsInterface.target matching.
	 */
	private static checkRemarkConditionRule(
		value: string,
		rule: string,
	): boolean {
		const valueNamePart = value.includes(":") ? value.split(":")[1] : value;
		const isNegatedRule = rule.startsWith("!");
		const actualRule = isNegatedRule ? rule.substring(1) : rule;

		let positiveMatchFound = false;

		// Case 1: Rule is an exact match for the full value string (e.g., rule="minecraft:stone", value="minecraft:stone")
		if (actualRule === value) {
			positiveMatchFound = true;
		}
		// Case 2: Rule is namespace-less and is an exact match for the name part of the value (e.g., rule="stone", value="minecraft:stone")
		else if (!actualRule.includes(":") && actualRule === valueNamePart) {
			positiveMatchFound = true;
		}
		// Case 3: Rule is namespace-less and the full value string includes the rule (e.g., rule="pickaxe", value="minecraft:diamond_pickaxe")
		else if (!actualRule.includes(":") && value.includes(actualRule)) {
			positiveMatchFound = true;
		}
		// Case 4: Rule is namespace-less and the name part of the value includes the rule (e.g., rule="axe", value="minecraft:diamond_pickaxe" -> namePart "diamond_pickaxe")
		// This also covers cases where value itself is namespace-less and includes the rule.
		else if (!actualRule.includes(":") && valueNamePart.includes(actualRule)) {
			positiveMatchFound = true;
		}

		return isNegatedRule ? !positiveMatchFound : positiveMatchFound;
	}

	/**
	 * Creates lookup data for a block
	 */
	static createLookupData(block: Block): LookAtBlockInterface {
		let hitId: string;
		try {
			const itemStack = block.getItemStack(1, true);
			hitId = itemStack?.typeId ?? block.typeId;
		} catch {
			hitId = block.typeId;
		}

		return {
			type: LookAtObjectTypeEnum.TILE,
			hitIdentifier: hitId,
			block: block,
		};
	}

	/**
	 * Places the block into a hidden slot in the player's inventory to display it in the UI.
	 */
	static resolveIcon(player: Player, block: Block): void;
	/**
	 * Places the item stack into a hidden slot in the player's inventory to display it in the UI.
	 */
	static resolveIcon(player: Player, item: ItemStack): void;
	static resolveIcon(player: Player, blockOrItem: Block | ItemStack): void {
		const SLOT_INDEX = 17;

		const playerContainer = player.getComponent(
			EntityComponentTypes.Inventory,
		)?.container;
		if (!playerContainer) return;

		const ownedItemHolder = player.getDynamicProperty(
			"r4isen1920_waila:item_holder_id",
		);
		if (!ownedItemHolder) {
			const itemHolder = player.dimension.spawnEntity(
				"r4isen1920_waila:item_holder",
				player.location,
			);
			const itemHolderContainer = itemHolder.getComponent(
				EntityComponentTypes.Inventory,
			)?.container;
			if (itemHolderContainer) {
				playerContainer.moveItem(SLOT_INDEX, 0, itemHolderContainer);
				player.setDynamicProperty(
					"r4isen1920_waila:item_holder_id",
					itemHolder.id,
				);
			} else {
				itemHolder.triggerEvent("r4isen1920_waila:instant_despawn");
			}
		}

		const ITEM_MAPPING: { [key: string]: ItemStack } = {
			"minecraft:bubble_column": new ItemStack("minecraft:water_bucket"),
			"minecraft:flowing_lava": new ItemStack("minecraft:lava_bucket"),
			"minecraft:flowing_water": new ItemStack("minecraft:water_bucket"),
			"minecraft:water": new ItemStack("minecraft:water_bucket"),
			"minecraft:lava": new ItemStack("minecraft:lava_bucket"),
		};
		const item =
			blockOrItem instanceof Block
				? (ITEM_MAPPING[blockOrItem.typeId] ?? blockOrItem.getItemStack(1))
				: blockOrItem;
		if (item) {
			item.lockMode = ItemLockMode.slot;
			item.keepOnDeath = true;
			item.nameTag = "§7 §r";
		}
		playerContainer.setItem(SLOT_INDEX, item);
	}

	/**
	 * Resets the icon for the specified player. This clears whatever item we put in the hidden slot.
	 */
	static resetIcon(player: Player): void {
		const SLOT_INDEX = 17;

		const playerContainer = player.getComponent(
			EntityComponentTypes.Inventory,
		)?.container;
		if (!playerContainer) return;

		const ownedItemHolder = player.getDynamicProperty(
			"r4isen1920_waila:item_holder_id",
		);
		if (typeof ownedItemHolder === "string") {
			const itemHolder = world.getEntity(ownedItemHolder);
			if (itemHolder && itemHolder.isValid) {
				const itemHolderContainer = itemHolder.getComponent(
					EntityComponentTypes.Inventory,
				)?.container;
				itemHolderContainer?.moveItem(0, SLOT_INDEX, playerContainer);
				itemHolder.triggerEvent("r4isen1920_waila:instant_despawn");
			} else {
				this.logger.error(`Inventory lost for slot ${SLOT_INDEX}`);
				playerContainer.setItem(SLOT_INDEX, undefined);
			}
			player.setDynamicProperty("r4isen1920_waila:item_holder_id", undefined);
			return;
		}
	}

	/**
	 * Parses block tools data to determine which tools work with this block and returns a formatted icon string.
	 */
	static getBlockToolIcons(block: Block, player: Player): string {
		const blockId = block.typeId;
		const namespaceRemoved = blockId.replace(/:.*/, "");
		const blockTags = block.getTags();

		const matchedTagsData = blockTools.filter((tagRuleEntry) => {
			const typedTagRule = tagRuleEntry as TagsInterface;

			let hasApplicablePositiveRule = false;
			let hasBlockingNegativeRule = false;

			for (const targetMatcher of typedTagRule.target) {
				if (typeof targetMatcher === "string") {
					const isNegation = targetMatcher.startsWith("!");
					const ruleContent = isNegation
						? targetMatcher.substring(1)
						: targetMatcher;

					let currentRuleMatchesBlock = false;
					// Condition 1: Exact match on full ID. (e.g. ruleContent "minecraft:stone" matches blockId "minecraft:stone")
					if (ruleContent === blockId) {
						currentRuleMatchesBlock = true;
						// Condition 2: Rule is namespace-less.
					} else if (!ruleContent.includes(":")) {
						// Condition 2a: Exact match on name part. (e.g. ruleContent "stone" matches namespaceRemoved "stone")
						if (ruleContent === namespaceRemoved) {
							currentRuleMatchesBlock = true;
							// Condition 2b: blockId includes ruleContent. (e.g. ruleContent "log" in blockId "minecraft:oak_log")
						} else if (blockId.includes(ruleContent)) {
							currentRuleMatchesBlock = true;
						}
					}

					if (currentRuleMatchesBlock) {
						if (isNegation) {
							hasBlockingNegativeRule = true;
							break; // This tagRuleEntry is blocked by a negative string rule.
						} else {
							hasApplicablePositiveRule = true;
							// Continue checking other matchers for potential negations.
						}
					}
				} else if (typeof targetMatcher === "object" && targetMatcher.tag) {
					const requiredTagRule = targetMatcher.tag;
					const isNegation = requiredTagRule.startsWith("!");
					const actualTag = isNegation
						? requiredTagRule.substring(1)
						: requiredTagRule;

					if (blockTags.includes(actualTag)) {
						if (isNegation) {
							hasBlockingNegativeRule = true;
							break; // This tagRuleEntry is blocked by a negative tag rule.
						} else {
							hasApplicablePositiveRule = true;
							// Continue checking other matchers for potential negations.
						}
					}
				}
			}

			if (hasBlockingNegativeRule) {
				return false; // Blocked by a negative rule.
			}
			// To be included, a tag must have at least one positive rule that matched,
			// and no negative rules that matched.
			return hasApplicablePositiveRule;
		});

		let playerMainHandItemTags: string[] = [];
		let playerMainHandItemTypeId: string = "__r4ui:none";
		try {
			const equipComponent = player.getComponent(
				EntityComponentTypes.Equippable,
			) as EntityEquippableComponent | undefined;
			const mainHandItem = equipComponent?.getEquipment(EquipmentSlot.Mainhand);
			if (mainHandItem) {
				playerMainHandItemTags = mainHandItem.getTags();
				playerMainHandItemTypeId = mainHandItem.typeId || "__r4ui:none";
			}
		} catch {
			/** Empty */
		}

		const processedTags: { id: string; remark: string }[] = [];

		for (const tagData of matchedTagsData) {
			const typedTagData = tagData as TagsInterface;
			let remarkIcon = TagRemarksEnum.UNDEFINED;

			const tagNameUpper = typedTagData.name.toUpperCase();
			const iconId =
				BlockToolsEnum[tagNameUpper as keyof typeof BlockToolsEnum] ||
				BlockToolsEnum.UNDEFINED;

			if (typedTagData.remarks) {
				for (const jsonRemarkKey in typedTagData.remarks) {
					const enumKeyCandidate = jsonRemarkKey.toUpperCase();

					if (enumKeyCandidate in TagRemarksEnum) {
						const remarkEnumValue =
							TagRemarksEnum[enumKeyCandidate as keyof typeof TagRemarksEnum];
						const conditions =
							typedTagData.remarks[
								jsonRemarkKey as keyof typeof typedTagData.remarks
							]!;
						let conditionMet = false;

						// Check itemIds condition against the player's mainhand item typeId
						if (conditions.itemIds) {
							conditionMet = conditions.itemIds.some((idRule) =>
								BlockHandler.checkRemarkConditionRule(
									playerMainHandItemTypeId,
									idRule,
								),
							);
						}

						if (!conditionMet && conditions.tags) {
							conditionMet = conditions.tags.some((tagRule) =>
								playerMainHandItemTags.some((heldItemTag) =>
									BlockHandler.checkRemarkConditionRule(heldItemTag, tagRule),
								),
							);
						}

						if (conditionMet) {
							remarkIcon = remarkEnumValue;
							break;
						}
					}
				}
			}

			// If this tag's ID starts with the first letter of any previous processed tag, skip it
			const firstLetter = iconId.charAt(0);
			if (processedTags.some((tag) => tag.id.startsWith(firstLetter))) {
				continue;
			}

			processedTags.push({ id: iconId, remark: remarkIcon });
			if (processedTags.length >= 2) break; // Max 2 tags
		}

		const tag1 = processedTags[0] || {
			id: BlockToolsEnum.UNDEFINED,
			remark: TagRemarksEnum.UNDEFINED,
		};
		const tag2 = processedTags[1] || {
			id: BlockToolsEnum.UNDEFINED,
			remark: TagRemarksEnum.UNDEFINED,
		};

		return `${tag1.id},${tag1.remark};${tag2.id},${tag2.remark}:`;
	}

	/**
	 * Gets block states in a readable format
	 */
	static getBlockStates(block: Block): string | undefined {
		try {
			const permutation = block.permutation;
			const states = permutation.getAllStates();
			const blockStates = Object.keys(states).sort();
			if (blockStates.length === 0) {
				return;
			}

			return `\n${blockStates
				.map((state) => {
					const value = states[state];
					const valueColor =
						typeof value === "number"
							? "§3"
							: typeof value === "boolean"
								? value
									? "§a"
									: "§c"
								: "§e";

					return `§7"${state}" -> ${valueColor}${value}§r`;
				})
				.join("\n")}`;
		} catch {
			return;
		}
	}

	/**
	 * Gets block inventory contents
	 */
	static getBlockInventory(block: Block): string | string[] {
		try {
			const inventoryComponent = block.getComponent(
				EntityComponentTypes.Inventory,
			) as BlockInventoryComponent | undefined;
			const blockContainer = inventoryComponent?.container;
			if (!blockContainer) return "none";

			const items: string[] = [];
			for (let i = 0; i < blockContainer.size; i++) {
				const itemStack = blockContainer.getItem(i);
				if (itemStack) {
					items.push(itemStack.typeId);
				}
			}
			return items.length > 0 ? items : "empty";
		} catch (e) {
			if (e instanceof Error && e.message.includes("Component")) {
				return "none";
			}
			return "error";
		}
	}

	/**
	 * Creates block render data for UI display
	 */
	static createRenderData(
		block: Block,
		player: Player,
	): BlockRenderDataInterface {
		return {
			toolIcons: this.getBlockToolIcons(block, player),
			blockStates: this.getBlockStates(block),
			inventory: this.getBlockInventory(block),
		};
	}
}
