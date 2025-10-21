import { ItemStack, Player } from "@minecraft/server";
import { Logger } from "@bedrock-oss/bedrock-boost";

import frameBlockIds from "../../../data/frameBlockIds.json";
import nameAliases from "../../../data/nameAliases.json";
import { WailaSettingsValues, shouldRenderInventoryContents } from "../Settings";
import { InventoryMirror, IconSlotRequest } from "../InventoryMirror";
import {
	LookAtBlockInterface,
	LookAtEntityInterface,
	LookAtItemEntityInterface,
	LookAtObjectInterface,
} from "../../../types/LookAtObjectInterface";
import {
	BlockRenderDataInterface,
	EntityRenderDataInterface,
	LookAtObjectMetadata,
} from "../../../types/LookAtObjectMetadataInterface";
import { LookAtObjectTypeEnum as LookAtObjectType } from "../../../types/LookAtObjectTypeEnum";
import { BlockHandler } from "../BlockHandler";
import { EntityHandler } from "../EntityHandler";



//#region Pipeline
export class LookPipeline {
	private readonly log = Logger.getLogger("WAILA:LookPipeline");

	public assess(
		player: Player,
		lookAtObject: LookAtObjectInterface,
		settings: WailaSettingsValues,
	): LookAssessment {
		if (!lookAtObject.type || !lookAtObject.hitIdentifier || lookAtObject.hitIdentifier === "__r4ui:none") {
			return { hasTarget: false };
		}

		if (lookAtObject.type === LookAtObjectType.ENTITY) {
			const context = this.buildEntityContext(player, lookAtObject as LookAtEntityInterface);
			if (!context) return { hasTarget: false };

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

		if (lookAtObject.type === LookAtObjectType.TILE) {
			const context = this.buildBlockContext(player, lookAtObject as LookAtBlockInterface, settings);
			if (!context) return { hasTarget: false };

			const signaturePayload = {
				hit: lookAtObject.hitIdentifier,
				sneaking: player.isSneaking,
				name: context.displayName,
				toolIcons: context.renderData.toolIcons,
				blockStates: context.extendedInfoActive ? context.renderData.blockStates ?? "" : "",
				inventory: context.inventorySignature,
				overflow: context.renderData.inventoryOverflow ?? 0,
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

	public finalize(context: LookContext): LookResolution {
		if (context.type === LookAtObjectType.ENTITY) {
			return this.finalizeEntity(context as EntityLookContext);
		}
		return this.finalizeBlock(context as BlockLookContext);
	}

	private buildEntityContext(
		player: Player,
		lookAtObject: LookAtEntityInterface,
	): EntityLookContext | undefined {
		const { entity } = lookAtObject;
		if (!entity || !entity.isValid) return undefined;

		const renderData = EntityHandler.createRenderData(
			entity,
			player,
			entity.typeId === "minecraft:player",
		);

		let displayName = entity.localizationKey;
		let nameTagContextTranslationKey: string | undefined;
		let itemContextIdentifier: string | undefined;
		let itemStack: ItemStack | undefined;

		const entityNameTag = entity.nameTag;
		if (entityNameTag && entityNameTag.length > 0) {
			displayName = entityNameTag;
			nameTagContextTranslationKey = entity.localizationKey;
		} else if (entity.typeId === "minecraft:item") {
			const itemEntity = lookAtObject as LookAtItemEntityInterface;
			if (itemEntity.itemStack) {
				itemContextIdentifier = itemEntity.itemStack.typeId;
				itemStack = itemEntity.itemStack.clone();
			}
		}

		const hitNamespace = this.resolveNamespace(lookAtObject.hitIdentifier);

		return {
			type: LookAtObjectType.ENTITY,
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

	private buildBlockContext(
		player: Player,
		lookAtObject: LookAtBlockInterface,
		settings: WailaSettingsValues,
	): BlockLookContext | undefined {
		const block = lookAtObject.block;
		if (!block) return undefined;

		const includeInventory = shouldRenderInventoryContents(
			settings.showInventoryContents,
			player.isSneaking,
		);

		let renderData: BlockRenderDataInterface;
		try {
			renderData = BlockHandler.createRenderData(block, player, {
				includeInventory,
			});
		} catch (error) {
			this.log.warn(`Failed to build block render data for ${block.typeId}: ${error}`);
			return undefined;
		}

		const blockTypeId = block.typeId;
		const hitNamespace = this.resolveNamespace(lookAtObject.hitIdentifier);

		const aliasKey = (nameAliases as Record<string, string>)[blockTypeId.replace(/.*:/g, "")];
		const displayName = aliasKey ? `${aliasKey}.name` : block.localizationKey;

		const extendedInfoActive = Boolean(
			renderData.blockStates && settings.displayBlockStates && player.isSneaking,
		);

		const frameItemTranslationKey = this.resolveFrameItemKey(blockTypeId, lookAtObject.hitIdentifier);
		const inventorySignature = includeInventory ? this.encodeInventory(renderData.inventory) : "";

		return {
			type: LookAtObjectType.TILE,
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

	private finalizeEntity(context: EntityLookContext): LookResolution {
		const metadata: LookAtObjectMetadata = {
			type: LookAtObjectType.ENTITY,
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

		const iconRequests: IconSlotRequest[] = [];
		if (context.itemStack) {
			iconRequests.push(InventoryMirror.createPrimaryIconRequest(context.itemStack));
		}

		return {
			metadata,
			iconRequests,
			extendedInfoActive: false,
		};
	}

	private finalizeBlock(context: BlockLookContext): LookResolution {
		const metadata: LookAtObjectMetadata = {
			type: LookAtObjectType.TILE,
			hitIdentifier: context.blockTypeId,
			namespace: context.namespace,
			displayName: context.displayName,
			renderData: context.renderData,
			...(context.itemInsideFrameTranslationKey && {
				itemInsideFrameTranslationKey: context.itemInsideFrameTranslationKey,
			}),
		};

		const iconRequests: IconSlotRequest[] = [
			InventoryMirror.createPrimaryIconRequest(context.block),
		];

		if (context.renderData.inventory) {
			iconRequests.push(
				...InventoryMirror.createInventoryRequests(context.renderData.inventory),
			);
		}

		return {
			metadata,
			iconRequests,
			extendedInfoActive: context.extendedInfoActive,
		};
	}

	private resolveNamespace(hitIdentifier: string): string {
		return hitIdentifier.includes(":")
			? hitIdentifier.substring(0, hitIdentifier.indexOf(":") + 1)
			: "minecraft:";
	}

	private resolveFrameItemKey(blockTypeId: string, hitIdentifier: string): string | undefined {
		if (!frameBlockIds.includes(blockTypeId)) return undefined;
		if (frameBlockIds.includes(hitIdentifier)) return undefined;

		const namespaceLess = hitIdentifier.replace(/.*:/g, "");
		const mappedAlias = (nameAliases as Record<string, string>)[namespaceLess];
		if (mappedAlias) {
			return `${mappedAlias}.name`;
		}

		try {
			return new ItemStack(hitIdentifier).localizationKey;
		} catch {
			return undefined;
		}
	}

	private encodeInventory(inventory: BlockRenderDataInterface["inventory"]): string {
		if (!inventory || inventory.length === 0) return "";
		return inventory
			.map((entry) => {
				const typeId = entry.item?.typeId ?? "minecraft:air";
				const amount = entry.item?.amount ?? 0;
				return `${entry.slot}:${typeId}:${amount}`;
			})
			.join("|");
	}
}



//#region Types
interface BaseLookContext {
	type: LookAtObjectType;
	hitIdentifier: string;
	namespace: string;
	displayName: string;
}

interface BlockLookContext extends BaseLookContext {
	type: LookAtObjectType.TILE;
	block: LookAtBlockInterface["block"];
	blockTypeId: string;
	renderData: BlockRenderDataInterface;
	inventorySignature: string;
	extendedInfoActive: boolean;
	itemInsideFrameTranslationKey?: string;
}

interface EntityLookContext extends BaseLookContext {
	type: LookAtObjectType.ENTITY;
	entity: LookAtEntityInterface["entity"];
	renderData: EntityRenderDataInterface;
	nameTagContextTranslationKey?: string;
	itemContextIdentifier?: string;
	itemStack?: ItemStack;
	isPlayer: boolean;
}

type LookContext = BlockLookContext | EntityLookContext;

export interface LookAssessment {
	hasTarget: boolean;
	signature?: string;
	context?: LookContext;
}

export interface LookResolution {
	metadata: LookAtObjectMetadata;
	iconRequests: IconSlotRequest[];
	extendedInfoActive: boolean;
}
