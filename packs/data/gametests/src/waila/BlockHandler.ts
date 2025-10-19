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
import { BlockRenderDataInterface, ItemStackWithSlot } from "../types/LookAtObjectMetadataInterface";
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
	static resolveIcon(player: Player, block: Block, slot_index?: number): void;
	/**
	 * Places the item stack into a hidden slot in the player's inventory to display it in the UI.
	 */
	static resolveIcon(player: Player, item: ItemStack, slot_index?: number): void;
	static resolveIcon(player: Player, blockOrItem: Block | ItemStack, slot_index: number = 17): void {
		const playerContainer = player.getComponent(
			EntityComponentTypes.Inventory,
		)?.container; //? player container contains up to index 35 (9 hotbar + 27 main)
		if (!playerContainer) return;

		// Acquire or create an item holder entity that will safeguard player's original items
		let holderId = player.getDynamicProperty(
			"r4isen1920_waila:item_holder_id",
		) as string | undefined;
		let holderEntity = holderId ? world.getEntity(holderId) : undefined;
		let holderContainer = holderEntity?.getComponent(
			EntityComponentTypes.Inventory,
		)?.container;

		if (!holderContainer) {
			// Spawn a new holder if none exists or if the previous one became invalid
			const newHolder = player.dimension.spawnEntity(
				"r4isen1920_waila:item_holder",
				player.location,
			);
			const newHolderContainer = newHolder.getComponent(
				EntityComponentTypes.Inventory,
			)?.container; // ? entity container contains up to index 26
			if (!newHolderContainer) {
				newHolder.triggerEvent("r4isen1920_waila:instant_despawn");
				return;
			}
			holderEntity = newHolder;
			holderContainer = newHolderContainer;
			holderId = newHolder.id;
			player.setDynamicProperty("r4isen1920_waila:item_holder_id", holderId);
		}

		// Move current player's item in slot into holder (mirrored index: slot_index - 9)
		// Only applicable for indices >= 9, which is our reserved range for WAILA
		if (slot_index >= 9) {
			try {
				playerContainer.moveItem(slot_index, slot_index - 9, holderContainer);
			} catch (e) {
				this.logger.warn(`Failed moving player slot ${slot_index} to holder: ${e}`);
			}
		}

		// Remember which player slots we modified so they can be restored later
		try {
			const slotsProp = player.getDynamicProperty(
				"r4isen1920_waila:inventory_item_holder_slots",
			);
			const slots: number[] = Array.isArray(slotsProp)
				? // Defensive: though we always store as JSON string, keep support if ever stored raw
				  (slotsProp as unknown as number[])
				: typeof slotsProp === "string" && slotsProp.length > 0
				? JSON.parse(slotsProp)
				: [];
			if (!slots.includes(slot_index)) {
				slots.push(slot_index);
				player.setDynamicProperty(
					"r4isen1920_waila:inventory_item_holder_slots",
					JSON.stringify(slots),
				);
			}
		} catch (e) {
			this.logger.warn(`Failed tracking modified slot ${slot_index}: ${e}`);
		}

		// Determine the item to render in the UI slot
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
			item.amount = blockOrItem instanceof Block ? 1 : item.amount;
			item.lockMode = ItemLockMode.slot;
			item.keepOnDeath = true;
			item.nameTag = "§7 §r";
		}
		playerContainer.setItem(slot_index, item);
	}

	/**
	 * Resets the icon for the specified player. This clears whatever item we put in the hidden slot.
	 */
	static resetIcon(player: Player, slot_index: number = 17): void {
		const playerContainer = player.getComponent(
			EntityComponentTypes.Inventory,
		)?.container;
		if (!playerContainer) return;

		const holderId = player.getDynamicProperty(
			"r4isen1920_waila:item_holder_id",
		) as string | undefined;
		if (!holderId) {
			// Nothing to restore; avoid clearing player slot to prevent accidental item loss
			return;
		}

		const holder = world.getEntity(holderId);
		const holderContainer = holder
			?.getComponent(EntityComponentTypes.Inventory)
			?.container;
		if (holder && holder.isValid && holderContainer) {
			try {
				holderContainer.moveItem(slot_index - 9, slot_index, playerContainer);
			} catch (e) {
				this.logger.warn(`Failed restoring player slot ${slot_index} from holder: ${e}`);
			}
			// Update tracked slots: remove this slot
			try {
				const slotsProp = player.getDynamicProperty(
					"r4isen1920_waila:inventory_item_holder_slots",
				) as string | undefined;
				if (typeof slotsProp === "string" && slotsProp.length > 0) {
					const slots: number[] = JSON.parse(slotsProp);
					const idx = slots.indexOf(slot_index);
					if (idx >= 0) slots.splice(idx, 1);
					player.setDynamicProperty(
						"r4isen1920_waila:inventory_item_holder_slots",
						slots.length > 0 ? JSON.stringify(slots) : undefined,
					);
					if (slots.length === 0) {
						holder.triggerEvent("r4isen1920_waila:instant_despawn");
						player.setDynamicProperty(
							"r4isen1920_waila:item_holder_id",
							undefined,
						);
					}
				}
			} catch (e) {
				this.logger.warn(`Failed updating tracked slots after restore: ${e}`);
			}
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

			return `${blockStates
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

					return `§7${state.replace('minecraft:', '')}: ${valueColor}${value}§r`;
				})
				.join("\n")}`;
		} catch {
			return;
		}
	}

	/**
	 * Gets block inventory contents
	 */
	static getBlockInventory(block: Block): ItemStackWithSlot[] | undefined {
		try {
			const inventoryComponent = block.getComponent(
				EntityComponentTypes.Inventory,
			) as BlockInventoryComponent | undefined;
			const blockContainer = inventoryComponent?.container;
			if (!blockContainer) {
				return;
			}

			let emptySlots = 0;
			const items: ItemStackWithSlot[] = [];
			for (let i = 0; i < blockContainer.size; i++) {
				const itemStack = blockContainer.getItem(i);
				items.push({
					item: itemStack ?? new ItemStack("minecraft:air"),
					slot: i
				});
				if (!itemStack) {
					emptySlots++;
				}
			}
			return (items.length > 0 && emptySlots < blockContainer.size) ? items : undefined;
		} catch {
			return;
		}
	}

	/**
	 * Resolves icons for all items in the tile's inventory.
	 * This behavior is similar to {@link BlockHandler.resolveIcon `resolveIcon()`}, but for multiple items.
	 */
	static resolveInventoryIcons(inventory: ItemStackWithSlot[], player: Player) {
		for (const { item, slot } of inventory) {
			BlockHandler.resolveIcon(
				player,
				item,
				Math.min(9 + slot, 35) //? start at index 9; max 27 slots, excluding hotbar
			);
		}
	}

	/**
	 * Resets icons for all items in that were used to render the tile's inventory.
	 * This behavior is similar to {@link BlockHandler.resetIcon `resetIcon()`}, but for multiple items.
	 */
	static resetInventoryIcons(player: Player) {
		const modifiedSlotsProp = player.getDynamicProperty(
			"r4isen1920_waila:inventory_item_holder_slots",
		) as string | undefined;
		if (typeof modifiedSlotsProp !== "string" || modifiedSlotsProp.length === 0) {
			return;
		}

		let modifiedSlots: number[] = [];
		try {
			modifiedSlots = JSON.parse(modifiedSlotsProp) as number[];
		} catch {
			modifiedSlots = [];
		}
		if (modifiedSlots.length === 0) return;

		const playerContainer = player.getComponent(
			EntityComponentTypes.Inventory,
		)?.container;
		if (!playerContainer) return;

		const holderId = player.getDynamicProperty(
			"r4isen1920_waila:item_holder_id",
		) as string | undefined;
		const holder = holderId ? world.getEntity(holderId) : undefined;
		const holderContainer = holder
			?.getComponent(EntityComponentTypes.Inventory)
			?.container;

		if (holder && holder.isValid && holderContainer) {
			for (const slotIndex of modifiedSlots) {
				try {
					if (slotIndex >= 9) {
						holderContainer.moveItem(slotIndex - 9, slotIndex, playerContainer);
					}
				} catch (e) {
					this.logger.warn(`Failed restoring slot ${slotIndex}: ${e}`);
				}
			}
			try {
				holder.triggerEvent("r4isen1920_waila:instant_despawn");
			} catch (e) {
				this.logger.warn(`Failed to despawn item holder: ${e}`);
			}
		} else {
			// Holder missing; nothing we can safely restore. Avoid clearing player's items.
			this.logger.warn(
				"Item holder missing during inventory reset; skipped restoring items.",
			);
		}

		// Clear tracking properties regardless to avoid stale state
		player.setDynamicProperty(
			"r4isen1920_waila:inventory_item_holder_slots",
			undefined,
		);
		player.setDynamicProperty("r4isen1920_waila:item_holder_id", undefined);
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
