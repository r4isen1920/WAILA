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
	Effect,
	Entity,
	EntityComponentTypes,
	EntityEquippableComponent,
	EntityHealthComponent,
	EntityItemComponent,
	EquipmentSlot,
	Player,
	TicksPerSecond,
} from "@minecraft/server";
import {
	LookAtEntityInterface,
	LookAtItemEntityInterface,
} from "../../types/LookAtObjectInterface";
import {
	EffectsRendererType,
	EntityRenderDataInterface,
} from "../../types/LookAtObjectMetadataInterface";
import { LookAtObjectTypeEnum } from "../../types/LookAtObjectTypeEnum";
import { EntityInteractionsEnum, TagRemarksEnum } from "../../types/TagsEnum";
import TagsInterface from "../../types/TagsInterface";

import armor from "../../data/armor.json";
import entityInteractionsData from "../../data/entityInteractions.json";
import ignoredEntityRender from "../../data/ignoredEntityRender.json";
import { RuleMatcher } from "../utils/RuleMatcher";
import { getMainHandContext } from "../utils/PlayerEquipment";
import { shouldDisplayFeature, WailaSettingsValues } from "./Settings";



//#region Globals
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



//#region EntityHandler
export class EntityHandler {
	static createLookupData(entity: Entity): LookAtEntityInterface {
		const health = entity.getComponent(
			EntityComponentTypes.Health,
		) as EntityHealthComponent | undefined;

		const base: LookAtEntityInterface = {
			type: LookAtObjectTypeEnum.ENTITY,
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
					duration: Math.floor(effect.duration / TicksPerSecond),
				}));
		} catch {
			base.effectsData = [];
		}

		if (entity.typeId === "minecraft:item") {
			const itemComponent = entity.getComponent(
				EntityComponentTypes.Item,
			) as EntityItemComponent | undefined;
			if (itemComponent?.itemStack) {
				(base as LookAtItemEntityInterface).itemStack = itemComponent.itemStack;
			}
		}

		return base;
	}

	static transformEntityId(entity: Entity): string {
		if (ignoredEntityRender.some((pattern) => entity.typeId.includes(pattern))) {
			return "0000000000000";
		}
		const rawId = entity.id ?? "0000000000000";
		const big = BigInt(rawId);
		const normalized = big < 0n ? -big : big;
		const padded = normalized.toString().padStart(12, "0");
		return `${big < 0n ? "-" : ""}${padded}`;
	}

	static createRenderData(
		entity: Entity,
		player: Player,
		isPlayer: boolean,
		settings: WailaSettingsValues,
	): EntityRenderDataInterface {
		const health = entity.getComponent(
			EntityComponentTypes.Health,
		) as EntityHealthComponent | undefined;
		const currentHp = Math.floor(health?.currentValue ?? 0);
		const maxHp = Math.floor(health?.effectiveMax ?? 0);

		const intHealthDisplay =
			entity.matches({ families: ["inanimate"] }) ||
			(maxHp > 40 && !entity.matches({ type: "minecraft:player" }));

		const healthRenderer = EntityHandler.buildHealthRenderer(
			currentHp,
			maxHp,
			isPlayer,
			intHealthDisplay,
		);

		return {
			entityId: EntityHandler.transformEntityId(entity),
			tagIcons: EntityHandler.buildInteractionIconString(entity, player),
			hp: currentHp,
			maxHp,
			intHealthDisplay,
			healthRenderer,
			armorRenderer: EntityHandler.buildArmorRenderer(entity),
			effectsRenderer: EntityHandler.buildEffectsRenderer(entity, player, settings),
		};
	}

	private static buildInteractionIconString(entity: Entity, player: Player): string {
		const interactionTags = EntityHandler.collectInteractionTags(entity);
		const componentTags = EntityHandler.collectComponentTags(entity);
		const finalNames = EntityHandler.selectTagNames(interactionTags, componentTags);
		const mainHand = getMainHandContext(player);

		const icons = finalNames.map((name) =>
			EntityHandler.resolveTagIcon(name, interactionTags.get(name), mainHand),
		);

		while (icons.length < 2) {
			icons.push({
				iconId: EntityInteractionsEnum.UNDEFINED,
				remark: TagRemarksEnum.UNDEFINED,
			});
		}

		const [first, second] = icons;
		return `:${first.iconId},${first.remark};${second.iconId},${second.remark}:`;
	}

	private static collectInteractionTags(entity: Entity): Map<string, TagsInterface> {
		const result = new Map<string, TagsInterface>();
		const typeId = entity.typeId;
		const namespaceLess = typeId.includes(":") ? typeId.split(":")[1] : typeId;

		for (const rawDef of entityInteractionsData as TagsInterface[]) {
			let matched = false;
			let blocked = false;

			for (const matcher of rawDef.target) {
				if (typeof matcher !== "string") continue;

				const rule = matcher;
				const hit = RuleMatcher.matches(typeId, rule) || RuleMatcher.matches(namespaceLess, rule);
				if (!hit) continue;

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

	private static collectComponentTags(entity: Entity): string[] {
		const candidateComponents = [
			EntityComponentTypes.CanFly,
			EntityComponentTypes.CanPowerJump,
			EntityComponentTypes.FireImmune,
			EntityComponentTypes.IsBaby,
			EntityComponentTypes.IsChested,
			EntityComponentTypes.IsDyeable,
			EntityComponentTypes.IsStunned,
			EntityComponentTypes.IsTamed,
			EntityComponentTypes.Projectile,
			EntityComponentTypes.WantsJockey,
		];

		const output: string[] = [];
		for (const component of candidateComponents) {
			try {
				if (entity.getComponent(component)) {
					output.push(component.replace("minecraft:", "").toUpperCase());
				}
			} catch {
				/** no-op */
			}
		}
		return output;
	}

	private static selectTagNames(
		interactionTags: Map<string, TagsInterface>,
		componentTags: string[],
	): string[] {
		const results: string[] = [];
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
			if (results.length >= 2) return results.slice(0, 2);
		}

		for (const name of componentTags) {
			if (!results.includes(name)) {
				results.push(name);
			}
			if (results.length >= 2) break;
		}

		return results.slice(0, 2);
	}

	private static resolveTagIcon(
		tagName: string,
		definition: TagsInterface | undefined,
		mainHand: ReturnType<typeof getMainHandContext>,
	) {
		const iconId =
			EntityInteractionsEnum[tagName as keyof typeof EntityInteractionsEnum] ??
			EntityInteractionsEnum.UNDEFINED;

		if (!definition?.remarks) {
			return { iconId, remark: TagRemarksEnum.UNDEFINED };
		}

		for (const key of Object.keys(definition.remarks)) {
			const enumKey = key.toUpperCase();
			if (!(enumKey in TagRemarksEnum)) continue;
			const remarkEnum = TagRemarksEnum[enumKey as keyof typeof TagRemarksEnum];
			const conditions = definition.remarks[key as keyof typeof definition.remarks]!;

			const matchesItemId = conditions.itemIds?.some((rule) =>
				RuleMatcher.matches(mainHand.itemTypeId, rule),
			);
			if (matchesItemId) {
				return { iconId, remark: remarkEnum };
			}

			const matchesTag = conditions.tags?.some((rule) =>
				mainHand.tags.some((tag) => RuleMatcher.matches(tag, rule)),
			);
			if (matchesTag) {
				return { iconId, remark: remarkEnum };
			}
		}

		return { iconId, remark: TagRemarksEnum.UNDEFINED };
	}

	private static buildHealthRenderer(
		currentHp: number,
		maxHp: number,
		isPlayer: boolean,
		intHealthDisplay: boolean,
	): string {
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

	private static buildArmorRenderer(entity: Player | Entity): string {
		const equippable = entity.getComponent(
			EntityComponentTypes.Equippable,
		) as EntityEquippableComponent | undefined;
		if (!equippable) return "dddddddddd";

		const armorValues: Record<string, number> = armor;
		const total = [
			EquipmentSlot.Head,
			EquipmentSlot.Chest,
			EquipmentSlot.Legs,
			EquipmentSlot.Feet,
		].reduce((sum, slot) => {
			const item = equippable.getEquipment(slot);
			return sum + (armorValues[item?.typeId ?? ""] ?? 0);
		}, 0);

		const icons = { empty: "d", half: "e", full: "f" };
		const full = Math.floor(total / 2);
		const half = total % 2;
		const empty = Math.max(0, Math.ceil(20 / 2) - full - half);

		let rendered = icons.full.repeat(full) + icons.half.repeat(half) + icons.empty.repeat(empty);
		if (rendered.length < 10) rendered += icons.empty.repeat(10 - rendered.length);
		return rendered.substring(0, 10) || "dddddddddd";
	}

	private static buildEffectsRenderer(entity: Entity, player: Player, settings: WailaSettingsValues): EffectsRendererType {
		let resolvedCount = 0;
		const resolvedIds: string[] = [];
		let effectString = "";

		const showEffects = shouldDisplayFeature(
			settings.entityEffectsVisibility,
			player.isSneaking,
		);

		for (const effectInfo of EFFECT_TABLE) {
			let effect: Effect | undefined;
			try {
				effect = showEffects ?
					entity.getEffect(effectInfo.name) :
					undefined; //? still iterate but do not resolve effects
			} catch {
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
			} else if (effectId) {
				amplifier = Math.min(amplifier + 1, 9);
			}

			if (effectId) {
				resolvedCount++;
				if (durationTicks > 0) resolvedIds.push(effectId);
			}

			const seconds = Math.floor(durationTicks / TicksPerSecond);
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
