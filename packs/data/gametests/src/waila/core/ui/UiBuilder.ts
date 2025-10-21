import { Player, RawMessage } from "@minecraft/server";
import { Registry } from "@bedrock-oss/add-on-registry";

import inventoryTokens from "../../../data/blockInventoryTokens.json";
import {
	BlockRenderDataInterface,
	EntityRenderDataInterface,
	LookAtObjectMetadata,
} from "../../../types/LookAtObjectMetadataInterface";
import { LookAtObjectTypeEnum as LookAtObjectType } from "../../../types/LookAtObjectTypeEnum";
import { WailaSettingsValues } from "../Settings";



//#region UI Builder
export class UiBuilder {
	public static build(
		player: Player,
		metadata: LookAtObjectMetadata,
		settings: WailaSettingsValues,
		extendedInfoActive: boolean,
	): { title: RawMessage[]; subtitle: RawMessage[] } {
		const subtitleParts: RawMessage[] = [
			{ text: (metadata.renderData as EntityRenderDataInterface).entityId || "" },
		];

		const isTileOrItemEntity =
			metadata.type === LookAtObjectType.TILE ||
			(metadata.type === LookAtObjectType.ENTITY && !!metadata.itemContextIdentifier);

		const prefixType = isTileOrItemEntity ? "A" : "B";

		let healthOrArmor = "";
		let finalTagIcons = "";
		let effectsStr = "";
		let inventoryOverflow = 0;

		if (isTileOrItemEntity) {
			if (metadata.type === LookAtObjectType.TILE) {
				const blockData = metadata.renderData as BlockRenderDataInterface;
				finalTagIcons = blockData.toolIcons;
				inventoryOverflow = blockData.inventoryOverflow ?? 0;
			} else {
				finalTagIcons = "zz,f;zz,f:";
			}
		} else {
			const entityData = metadata.renderData as EntityRenderDataInterface;
			healthOrArmor = `${entityData.healthRenderer}${entityData.armorRenderer}`;
			finalTagIcons = entityData.tagIcons;
			effectsStr = `${entityData.effectsRenderer.effectString}e${entityData.effectsRenderer.effectsResolvedArray.length
				.toString()
				.padStart(2, "0")}`;
		}

		const nameElements: RawMessage[] = [];
		if (metadata.hitIdentifier === "minecraft:player") {
			nameElements.push({ text: "__r4ui:humanoid." });
		}
		if (metadata.nameTagContextTranslationKey && metadata.hitIdentifier !== "minecraft:player") {
			nameElements.push({ text: `${metadata.displayName} §7(` });
			nameElements.push({ translate: metadata.nameTagContextTranslationKey });
			nameElements.push({ text: ")§r" });
		} else {
			nameElements.push({ translate: metadata.displayName });
		}
		if (metadata.itemInsideFrameTranslationKey) {
			nameElements.push({ text: "\n§7[" });
			nameElements.push({ translate: metadata.itemInsideFrameTranslationKey });
			nameElements.push({ text: "]§r" });
		}
		nameElements.push({ text: "§r" });

		const blockStatesText =
			metadata.type === LookAtObjectType.TILE && extendedInfoActive
				? (metadata.renderData as BlockRenderDataInterface).blockStates ?? ""
				: "";

		const itemEntityText =
			metadata.type === LookAtObjectType.ENTITY && metadata.itemContextIdentifier
				? `\n§7${metadata.itemContextIdentifier}§r`
				: "";

		let healthText = "";
		let paddingNewlines = "";

		if (metadata.type === LookAtObjectType.ENTITY) {
			const entityData = metadata.renderData as EntityRenderDataInterface;

			if (entityData.maxHp > 0 && entityData.intHealthDisplay) {
				const percentage = Math.round((entityData.hp / entityData.maxHp) * 100);
				const hpDisplay =
					entityData.maxHp < 1000000
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
				healthText = `\n§7 ${
					entityData.maxHp < 1000000
						? `${entityData.hp}/${entityData.maxHp} (${Math.round((entityData.hp / entityData.maxHp) * 100)}%)`
						: "∞"
				}§r`;
			}

			const numEffects = entityData.effectsRenderer.effectsResolvedArray.length;
			if (numEffects > 0 && numEffects < 4) {
				paddingNewlines += "\n\n".repeat(numEffects);
			} else if (numEffects >= 4) {
				paddingNewlines +=
					!entityData.intHealthDisplay && entityData.maxHp > 40 ? "\n" : "\n\n";
			}

			if (entityData.armorRenderer !== "dddddddddd") {
				paddingNewlines += "\n";
			}
		}

		const namespaceText = UiBuilder.resolveNamespaceText(
			metadata.namespace,
			player,
			settings,
		);

		const titleParts: RawMessage[] = [
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

		if (metadata.type === LookAtObjectType.TILE && inventoryOverflow > 0) {
			const clampedOverflow = Math.min(99, Math.max(0, inventoryOverflow));
			titleParts.push({ text: `__r4ui:inv.size_${clampedOverflow}__` });
		}

		titleParts.push({ text: `__r4ui:anchor.${anchorSetting}__` });

		if (
			metadata.type === LookAtObjectType.TILE &&
			(metadata.renderData as BlockRenderDataInterface).inventory &&
			!player.isSneaking
		) {
			for (const token of UiBuilder.collectInventoryTokens(metadata.hitIdentifier)) {
				titleParts.push({ text: token });
			}
		}

		const filteredTitle = titleParts.filter(
			(part) => !(typeof part === "object" && "text" in part && part.text === ""),
		);

		return { title: filteredTitle, subtitle: subtitleParts };
	}

	private static collectInventoryTokens(blockId: string): string[] {
		const rules = inventoryTokens as InventoryTokenRule[];
		const matches: string[] = [];
		for (const rule of rules) {
			if (rule.match.some((candidate) => candidate === blockId)) {
				matches.push(rule.token);
			}
		}
		return matches;
	}

	private static resolveNamespaceText(
		namespace: string,
		player: Player,
		settings: WailaSettingsValues,
	): string {
		const value = Registry[namespace.replace(":", "")];
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



//#region Types
interface InventoryTokenRule {
	token: string;
	match: string[];
}