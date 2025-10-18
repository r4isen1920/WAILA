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

import { EntityComponentTypes, EquipmentSlot, ItemStack, LocationOutOfWorldBoundariesError, Player, RawMessage, TicksPerSecond, TitleDisplayOptions, system, world } from "@minecraft/server";
import { Logger, LogLevel, PlayerPulseScheduler } from "@bedrock-oss/bedrock-boost";
import { Registry } from "@bedrock-oss/add-on-registry";

import { LookAtBlockInterface, LookAtEntityInterface, LookAtItemEntityInterface, LookAtObjectInterface } from "../types/LookAtObjectInterface";
import { BlockRenderDataInterface, EntityRenderDataInterface, LookAtObjectMetadata } from "../types/LookAtObjectMetadataInterface";
import { LookAtObjectTypeEnum as LookAtObjectType } from "../types/LookAtObjectTypeEnum";
import { BlockHandler } from "./BlockHandler";
import { EntityHandler } from "./EntityHandler";
import nameAliases from "../data/nameAliases.json";
import AfterWorldLoad from "../Init";
import { WailaSettings } from "./Settings";

import ignoredBlockRender from "../data/ignoredBlockRender.json";



//#region WAILA
class Waila {
	private static instance: Waila;
	private readonly log = Logger.getLogger("WAILA");
	private playerPreviousLookState: Map<string, boolean> = new Map();

	private constructor() {
		Logger.setLevel(LogLevel.Debug);

		AfterWorldLoad(() => {
			world.gameRules.showTags = false;

			const pulse = new PlayerPulseScheduler((player) => {
				const isEnabled = WailaSettings.get(player, 'isEnabled');
				if (isEnabled === undefined || isEnabled === true) {
					this.toPlayer(player);
				} else {
					this.clearUI(player);
				}
			}, 3);
			pulse.start();

			this.log.info(`WAILA loaded and running.`);
		});
	}

	public static getInstance(): Waila {
		if (!Waila.instance) {
			Waila.instance = new Waila();
		}
		return Waila.instance;
	}

	/**
	 * Requests the process for a player in the world.
	 */
	private toPlayer(player: Player): void {
		const lookAtObject = this.fetchLookAt(player, WailaSettings.get(player, 'maxDisplayDistance'));
		lookAtObject.viewAdditionalProperties = WailaSettings.get(player, 'displayExtendedInfo') === true && player.isSneaking;

		if (lookAtObject.hitIdentifier === undefined) {
			lookAtObject.hitIdentifier = "__r4ui:none";
			player.setDynamicProperty("r4isen1920_waila:old_log", undefined);
		}

		this.displayUI(player, lookAtObject);
	}

	//#region Fetch
	/**
	 * Fetches what block or entity the specified player is looking at.
	 */
	private fetchLookAt(player: Player, max_dist: number): LookAtObjectInterface {
		try {
			// First check for entities in view direction (higher priority)
			const entityLookAt = player.getEntitiesFromViewDirection({
				maxDistance: max_dist,
			});

			// Check for the item held by the player
			const playerEquippedItem = player.getComponent(EntityComponentTypes.Equippable)
				?.getEquipment(EquipmentSlot.Mainhand)?.typeId || "__r4ui:none";

			if (entityLookAt.length > 0 && entityLookAt[0]?.entity) {
				const entity = entityLookAt[0].entity;
				const lookAtEntity = EntityHandler.createLookupData(entity);
				lookAtEntity.itemHeld = playerEquippedItem;
				return lookAtEntity;
			}

			// If no entity was found, check for blocks
			const blockLookAt = player.getBlockFromViewDirection({
				includeLiquidBlocks: !player.isInWater,
				includePassableBlocks: !player.isInWater,
				maxDistance: max_dist,
			});

			if (blockLookAt?.block && !ignoredBlockRender.some(b => b.includes(blockLookAt.block.typeId))) {
				const lookAtBlock = BlockHandler.createLookupData(blockLookAt.block);
				lookAtBlock.itemHeld = playerEquippedItem;
				return lookAtBlock;
			}

			// Nothing was found
			return {
				type: undefined,
				hitIdentifier: "__r4ui:none",
				itemHeld: playerEquippedItem
			};
		} catch (e) {
			if (!(e instanceof LocationOutOfWorldBoundariesError)) {
				this.log.error(`Error in fetchLookAt: ${e}`);
			}
			return {
				type: undefined,
				hitIdentifier: "__r4ui:none",
				itemHeld: "__r4ui:none"
			};
		}
	}

	/**
	 * Fetches metadata for the looked-at object.
	 */
	private fetchLookAtMetadata(player: Player, lookAtObject: LookAtObjectInterface): LookAtObjectMetadata | null {
		if (!lookAtObject.type || !lookAtObject.hitIdentifier || lookAtObject.hitIdentifier === "__r4ui:none") {
			return null;
		}

		const hitNamespace = lookAtObject.hitIdentifier.includes(":")
			? lookAtObject.hitIdentifier.substring(0, lookAtObject.hitIdentifier.indexOf(":") + 1)
			: "minecraft:";

		let resultDisplayName: string = lookAtObject.hitIdentifier;
		let nameTagContextTranslationKey_local: string | undefined = undefined;
		let itemContextIdentifier_local: string | undefined = undefined;

		if (lookAtObject.type === LookAtObjectType.ENTITY) {
			const entity = (lookAtObject as LookAtEntityInterface).entity;
			const entityNameTag = entity.nameTag;
			const entityTypeId = entity.typeId;

			const entityRenderData = EntityHandler.createRenderData(
				entity,
				player,
				entityTypeId === "minecraft:player"
			);

			if (entityNameTag && entityNameTag.length > 0) {
				resultDisplayName = entityNameTag;
				nameTagContextTranslationKey_local = entity.localizationKey;
			} else {
				if (entityTypeId === "minecraft:item") {
					const itemEntity = lookAtObject as LookAtItemEntityInterface;
					const itemStack = itemEntity.itemStack;
					if (itemStack) {
						itemContextIdentifier_local = itemStack.typeId;
						BlockHandler.resolveIcon(player, itemStack);
					}
				}
				resultDisplayName = entity.localizationKey;
			}

			return {
				type: lookAtObject.type,
				hitIdentifier: entityTypeId,
				namespace: hitNamespace,
				displayName: resultDisplayName,
				renderData: entityRenderData,
				...(nameTagContextTranslationKey_local && { nameTagContextTranslationKey: nameTagContextTranslationKey_local }),
				...(itemContextIdentifier_local && { itemContextIdentifier: itemContextIdentifier_local })
			};
		}

		if (lookAtObject.type === LookAtObjectType.TILE) {
			const block = (lookAtObject as LookAtBlockInterface).block;
			const blockId = block.typeId;

			BlockHandler.resolveIcon(player, block);
			const blockRenderData = BlockHandler.createRenderData(block, player);

			const nameAlias = (nameAliases as { [key: string]: string })[blockId.replace(/.*:/g, '')];
			if (nameAlias) {
				resultDisplayName = `${nameAlias}.name`;
			} else {
				resultDisplayName = block.localizationKey;
			}

			let itemInsideFrameTranslationKey_local: string | undefined = undefined;
			const itemFrameIds = ['minecraft:frame', 'minecraft:glow_frame'];
			const hitIdentifier = lookAtObject.hitIdentifier; // the hitIdentifier and the actual block typeId may be different
			// if hitIdentifier is also an item frame, that means the item frame is empty--don't bother checking
			if (itemFrameIds.includes(blockId) && !itemFrameIds.includes(hitIdentifier)) {
				const nA = (nameAliases as { [key: string]: string })[hitIdentifier.replace(/.*:/g, '')];
				if (nA) {
					itemInsideFrameTranslationKey_local = `${nA}.name`;
				} else {
					itemInsideFrameTranslationKey_local = (() => {
						let tryCreateItem: ItemStack | undefined = undefined;
						try {
							tryCreateItem = new ItemStack(hitIdentifier);
						} catch { /** empty */ }
						return tryCreateItem?.localizationKey;
					})();
				}
			}

			return {
				type: lookAtObject.type,
				hitIdentifier: blockId,
				namespace: hitNamespace,
				displayName: resultDisplayName,
				renderData: blockRenderData,
				...(itemInsideFrameTranslationKey_local && { itemInsideFrameTranslationKey: itemInsideFrameTranslationKey_local })
			};
		}

		return null;
	}

	//#region Render
	/**
	 * Clears the UI for the specified player.
	 */
	private clearUI(player: Player): void {
		const options: TitleDisplayOptions = {
			fadeInDuration: 0,
			fadeOutDuration: 0,
			stayDuration: 0,
		};
		player.onScreenDisplay.setTitle(" ", options);

		try {
			player.runCommand(`title @s reset`);
		} catch (e) {
			this.log.warn(`Failed to run title reset command for ${player.name}: ${e}`);
		}

		player.setDynamicProperty("r4isen1920_waila:old_log", undefined);

		BlockHandler.resetIcon(player);
	}

	/**
	 * Handles final string parse and sends a request to the UI.
	 */
	private displayUI(player: Player, lookAtObject: LookAtObjectInterface): void {
		const hasTarget = lookAtObject.hitIdentifier !== "__r4ui:none";
		const playerId = player.id;
		const hadPreviousTarget = this.playerPreviousLookState.get(playerId) ?? false;

		// Update the player's look state for the next tick
		this.playerPreviousLookState.set(playerId, hasTarget);

		if (!hasTarget) {
			// Only clear UI when transitioning from having a target to no target
			if (hadPreviousTarget) {
				this.clearUI(player);
			}
			return;
		}

		// Create comparison data to see if UI needs updating
		const comparisonData = this.createComparisonData(lookAtObject);
		const oldLog = player.getDynamicProperty("r4isen1920_waila:old_log") as string | undefined;

		if (oldLog === comparisonData) return;
		player.setDynamicProperty("r4isen1920_waila:old_log", comparisonData);

		const metadata = this.fetchLookAtMetadata(player, lookAtObject);
		if (!metadata) {
			this.log.warn(`Failed to fetch metadata for ${lookAtObject.hitIdentifier}, clearing UI.`);
			this.clearUI(player);
			return;
		}

		// Generate UI components
		const { title, subtitle } = this.generateUIComponents(player, metadata);

		// Display the UI
		player.onScreenDisplay.setTitle(title, {
			subtitle: subtitle,
			fadeInDuration: 0,
			fadeOutDuration: 0,
			stayDuration: TicksPerSecond * 60,
		});
		system.runTimeout(() => BlockHandler.resetIcon(player), 2);
	}

	/**
	 * Creates a comparison string to determine if UI needs updating
	 */
	private createComparisonData(lookAtObject: LookAtObjectInterface): string {
		const baseData: any = {
			hit: lookAtObject.hitIdentifier,
			sneaking: lookAtObject.viewAdditionalProperties,
			itemHeld: lookAtObject.itemHeld
		};

		if (lookAtObject.type === LookAtObjectType.ENTITY) {
			const entityData = lookAtObject as LookAtEntityInterface;
			Object.assign(baseData, {
				hp: entityData.hp,
				maxHp: entityData.maxHp,
				armor: EntityHandler.armorRenderer(entityData.entity),
				effects: entityData.effectsData?.map(e => `${e.id}:${e.amplifier}:${e.duration}`).join(",") || ""
			});
		} else if (lookAtObject.type === LookAtObjectType.TILE && (lookAtObject as LookAtBlockInterface).block) {
			const blockData = lookAtObject as LookAtBlockInterface;
			Object.assign(baseData, {
				states: BlockHandler.getBlockStates(blockData.block)
			});
		}

		return JSON.stringify(baseData);
	}

	/**
	 * Generates UI components for the title display
	 */
	private generateUIComponents(player: Player, metadata: LookAtObjectMetadata): { title: RawMessage[], subtitle: RawMessage[] } {
		const parseStrSubtitle: RawMessage[] = [{ text: (metadata.renderData as EntityRenderDataInterface).entityId || "" }];
		const isTileOrItemEntity = metadata.type === LookAtObjectType.TILE ||
			(metadata.type === LookAtObjectType.ENTITY && !!metadata.itemContextIdentifier);

		const prefixType = isTileOrItemEntity ? "A" : "B";

		let healthOrArmor = "";
		let finalTagIcons = "";
		let effectsStr = "";

		if (isTileOrItemEntity) {
			if (metadata.type === LookAtObjectType.TILE) {
				const blockData = metadata.renderData as BlockRenderDataInterface;
				finalTagIcons = blockData.toolIcons;
			} else { // Item Entity
				finalTagIcons = `zz,f;zz,f:`; // Item entities don't have specific "tool" icons in this context
			}
		} else { // Non-item Entities
			const entityData = metadata.renderData as EntityRenderDataInterface;
			healthOrArmor = `${entityData.healthRenderer}${entityData.armorRenderer}`;
			finalTagIcons = entityData.tagIcons;

			effectsStr = `${entityData.effectsRenderer.effectString}e${entityData.effectsRenderer.effectsResolvedArray.length.toString().padStart(2, "0")}`;
		}

		const nameElements: RawMessage[] = [];
		if (metadata.hitIdentifier === "minecraft:player") {
			nameElements.push({ text: '__r4ui:humanoid.' });
		}
		if (metadata.nameTagContextTranslationKey && metadata.hitIdentifier !== "minecraft:player") {
			nameElements.push({ text: `${metadata.displayName} §7(` }); // metadata.displayName is the nameTag
			nameElements.push({ translate: metadata.nameTagContextTranslationKey });
			nameElements.push({ text: ")§r" });
		} else {
			nameElements.push({ translate: metadata.displayName }); // Standard translation key or 'entity.item.name'
		}
		if (metadata.itemInsideFrameTranslationKey) {
			nameElements.push({ text: `\n§7[` });
			nameElements.push({ translate: metadata.itemInsideFrameTranslationKey });
			nameElements.push({ text: "]§r" });
		}
		nameElements.push({ text: "§r" });

		const blockStatesText = metadata.type === LookAtObjectType.TILE && player.isSneaking && WailaSettings.get(player, 'displayExtendedInfo')
			? (metadata.renderData as BlockRenderDataInterface).blockStates
			: "";

		// Show item entity's specific item type ID (e.g., minecraft:diamond_sword)
		const itemEntityText = metadata.type === LookAtObjectType.ENTITY && metadata.itemContextIdentifier
			? `\n§7${metadata.itemContextIdentifier}§r`
			: "";

		// Format health text for entities
		let healthText = "";
		let paddingNewlines = "";

		if (metadata.type === LookAtObjectType.ENTITY) {
			const entityData = metadata.renderData as EntityRenderDataInterface;

			// Handle integer health display
			if (entityData.maxHp > 0 && entityData.intHealthDisplay) {
				const percentage = Math.round((entityData.hp / entityData.maxHp) * 100);
				const hpDisplay = entityData.maxHp < 1000000 ?
					// "" corresponds to health icon in the UI
					` ${entityData.hp}/${entityData.maxHp} (${percentage}%)` :
					" ∞";
				healthText = `\n§7 ${hpDisplay}§r`;
			}

			// Add padding based on HP and display type
			if (entityData.maxHp > 0 && entityData.maxHp <= 40 && !entityData.intHealthDisplay) {
				paddingNewlines += "\n";
			}
			if (entityData.maxHp > 20 && entityData.maxHp <= 40 && !entityData.intHealthDisplay) {
				paddingNewlines += "\n";
			}
			if (entityData.maxHp > 40 && !entityData.intHealthDisplay) {
				// High HP bar shown
				healthText = `\n§7 ${entityData.maxHp < 1000000
					? `${entityData.hp}/${entityData.maxHp} (${Math.round((entityData.hp / entityData.maxHp) * 100)}%)`
					: "∞"
					}§r`;
			}

			// Effects padding
			const numEffects = entityData.effectsRenderer.effectsResolvedArray.length;
			if (numEffects > 0 && numEffects < 4) {
				paddingNewlines += "\n\n".repeat(numEffects);
			} else if (numEffects >= 4) {
				paddingNewlines += !entityData.intHealthDisplay && entityData.maxHp > 40 ? "\n" : "\n\n";
			}

			// Armor padding
			if (entityData.armorRenderer !== "dddddddddd") {
				paddingNewlines += "\n";
			}
		}

		const namespaceText = ((): string => {
			const value = Registry[metadata.namespace.replace(":", "")];
			if (value) {
				return (!player.isSneaking || !WailaSettings.get(player, 'displayExtendedInfo'))
					? value.name
					: `${value.name}\nby ${value.creator}`;
			}
			return metadata.namespace.length > 3
				? metadata.namespace.replace(/_/g, " ").replace(":", "").toTitle().abrevCaps()
				: metadata.namespace.replace(":", "").toUpperCase();
		})();

		// Build the complete title
		const parseStr: RawMessage[] = [
			{ text: `_r4ui:${prefixType}:` },
			{ text: healthOrArmor },
			{ text: finalTagIcons },
			{ text: effectsStr },
			...nameElements,
			{ text: blockStatesText },
			{ text: itemEntityText },
			{ text: healthText },
			{ text: paddingNewlines },
			{ text: '\n§9§o' },
			{ translate: namespaceText },
			{ text: '§r' },
		];

		// Add some setting flags
		parseStr.push({ text: `__r4ui:anchor.${WailaSettings.get(player, 'displayPosition')}__` });

		const filteredTitle = parseStr.filter(
			part => !(typeof part === "object" && "text" in part && part.text === "")
		);

		DEBUG: {
			player.sendMessage(filteredTitle);
			player.sendMessage(parseStrSubtitle);
		}

		this.log.debug(filteredTitle, parseStrSubtitle);

		return { title: filteredTitle, subtitle: parseStrSubtitle };
	}
}

Waila.getInstance();
