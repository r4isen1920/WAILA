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
	EntityInventoryComponent,
	EnchantmentTypes,
	ItemComponentTypes,
	ItemLockMode,
	ItemStack,
	Player,
	type Enchantment,
	type ItemDurabilityComponent,
	type ItemEnchantableComponent,
	type Vector3,
} from "@minecraft/server";
import { Logger } from "@bedrock-oss/bedrock-boost";



//#region Globals
const PROPERTY_TRACKED_SLOTS = "r4isen1920_waila:inventory_item_holder_slots";
const PROPERTY_ITEM_BACKUPS = "r4isen1920_waila:inventory_item_backups";
const PROPERTY_ITEM_BACKUPS_CHUNK_SUFFIX = "_chunk_";
const DYNAMIC_PROPERTY_CHUNK_LIMIT = 32760;
const DYNAMIC_PROPERTY_MAX_CHUNKS = 16;
const INVENTORY_MIRROR_START_SLOT = 9;
const INVENTORY_MIRROR_END_SLOT = 26;



//#region InventoryMirror
/**
 * Manages the temporary inventory mirroring WAILA performs to show block/item icons in the UI.
 */
export class InventoryMirror {
	private static readonly log = Logger.getLogger("InventoryMirror");

	static apply(
		player: Player,
		requests: readonly IconSlotRequest[],
		mirrorAuxSlots = true,
	): void {
		if (requests.length === 0) return;

		const playerContainer = this.getPlayerContainer(player);
		if (!playerContainer) return;

		const trackedSlotsSet = new Set(this.getTrackedSlots(player));
		const backups = this.getBackupMap(player);
		const touchedSlots = new Set<number>();

		for (const request of requests) {
			const slotIndex = request.slot;
			if (slotIndex < 0 || slotIndex > playerContainer.size - 1) continue;

			const slotKey = String(slotIndex);
			if (!trackedSlotsSet.has(slotIndex)) {
				const original = playerContainer.getItem(slotIndex);
				backups[slotKey] = this.serializeItemStack(original);
				trackedSlotsSet.add(slotIndex);
			}

			this.applyRequestToSlot(playerContainer, slotIndex, request.item);
			touchedSlots.add(slotIndex);
		}

		if (mirrorAuxSlots) {
			for (let slotIndex = INVENTORY_MIRROR_START_SLOT; slotIndex <= INVENTORY_MIRROR_END_SLOT; slotIndex++) {
				if (slotIndex >= playerContainer.size) break;
				if (touchedSlots.has(slotIndex)) continue;

				const slotKey = String(slotIndex);
				if (!trackedSlotsSet.has(slotIndex)) {
					const original = playerContainer.getItem(slotIndex);
					backups[slotKey] = this.serializeItemStack(original);
					trackedSlotsSet.add(slotIndex);
				}

				this.applyRequestToSlot(playerContainer, slotIndex, undefined);
			}
		}

		if (!this.storeBackupMap(player, backups)) {
			this.revertSlotsFromBackup(playerContainer, trackedSlotsSet, backups);
			this.clearTrackedSlots(player);
			return;
		}
		this.setTrackedSlots(player, Array.from(trackedSlotsSet).sort((a, b) => a - b));
	}

	static restore(player: Player): void {
		const trackedSlots = this.getTrackedSlots(player);
		if (trackedSlots.length === 0) {
			this.clearTrackedSlots(player);
			return;
		}

		const playerContainer = this.getPlayerContainer(player);
		if (!playerContainer) {
			this.clearTrackedSlots(player);
			return;
		}

		const backups = this.getBackupMap(player);

		for (const slotIndex of trackedSlots) {
			const slotKey = String(slotIndex);
			const serialized = backups[slotKey];
			delete backups[slotKey];

			const restored = this.deserializeItemStack(serialized);
			try {
				playerContainer.setItem(slotIndex, restored ?? undefined);
			} catch (error) {
				this.log.warn(`Failed restoring slot ${slotIndex}: ${error}`);
			}
		}

		this.storeBackupMap(player, backups);
		this.clearTrackedSlots(player);
	}

	static createPrimaryIconRequest(source: Block | ItemStack): IconSlotRequest {
		const itemStack = source instanceof Block ? InventoryMirror.blockToItem(source) : source.clone();
		if (itemStack) {
			itemStack.amount = source instanceof Block ? 1 : itemStack.amount;
		}
		return { slot: 17, item: itemStack };
	}

	static createInventoryRequests(items: readonly { item: ItemStack; slot: number }[]): IconSlotRequest[] {
		return items.map(({ item, slot }) => ({ slot: Math.min(9 + slot, 35), item }));
	}

	private static blockToItem(block: Block): ItemStack | undefined {
		const SPECIAL_CASES: Record<string, string> = {
			"minecraft:bubble_column": "minecraft:water_bucket",
			"minecraft:flowing_lava": "minecraft:lava_bucket",
			"minecraft:flowing_water": "minecraft:water_bucket",
			"minecraft:water": "minecraft:water_bucket",
			"minecraft:lava": "minecraft:lava_bucket",
		};

		const mapped = SPECIAL_CASES[block.typeId];
		if (mapped) return new ItemStack(mapped);

		try {
			return block.getItemStack(1, true);
		} catch {
			try {
				return new ItemStack(block.typeId);
			} catch {
				return undefined;
			}
		}
	}

	private static getPlayerContainer(player: Player) {
		return player
			.getComponent(EntityComponentTypes.Inventory)
			?.container as EntityInventoryComponent["container"] | undefined;
	}

	private static getTrackedSlots(player: Player): number[] {
		const stored = player.getDynamicProperty(PROPERTY_TRACKED_SLOTS);
		if (typeof stored === "string" && stored.length > 0) {
			try {
				const parsed = JSON.parse(stored) as number[];
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return [];
			}
		}
		return [];
	}

	private static setTrackedSlots(player: Player, slots: readonly number[]): void {
		player.setDynamicProperty(
			PROPERTY_TRACKED_SLOTS,
			slots.length > 0 ? JSON.stringify(slots) : undefined,
		);
	}

	private static clearTrackedSlots(player: Player): void {
		player.setDynamicProperty(PROPERTY_TRACKED_SLOTS, undefined);
		this.clearBackupPayload(player);
	}

	private static applyRequestToSlot(
		container: EntityInventoryComponent["container"],
		slotIndex: number,
		item: ItemStack | undefined,
	): void {
		if (!item) {
			try {
				container.setItem(slotIndex, undefined);
			} catch (error) {
				this.log.warn(`Failed clearing slot ${slotIndex}: ${error}`);
			}
			return;
		}

		let cloned: ItemStack | undefined;
		try {
			cloned = item.clone();
		} catch (error) {
			this.log.warn(`Failed cloning request item for slot ${slotIndex}: ${error}`);
			try {
				container.setItem(slotIndex, undefined);
			} catch (setError) {
				this.log.warn(`Failed clearing slot ${slotIndex} after clone failure: ${setError}`);
			}
			return;
		}

		if (!cloned) {
			try {
				container.setItem(slotIndex, undefined);
			} catch (error) {
				this.log.warn(`Failed clearing slot ${slotIndex} after undefined clone: ${error}`);
			}
			return;
		}

		cloned.lockMode = ItemLockMode.slot;
		cloned.keepOnDeath = true;
		cloned.nameTag = "§7 §r";

		try {
			container.setItem(slotIndex, cloned);
		} catch (error) {
			this.log.warn(`Failed injecting item into slot ${slotIndex}: ${error}`);
		}
	}

	private static getBackupMap(player: Player): InventoryBackupPayload {
		const payload = this.readBackupPayload(player);
		if (!payload) return {};
		try {
			const parsed = JSON.parse(payload) as InventoryBackupPayload;
			return parsed && typeof parsed === "object" ? parsed : {};
		} catch (error) {
			this.log.warn(`Failed parsing inventory mirror payload: ${error}`);
			return {};
		}
	}

	private static storeBackupMap(player: Player, backups: InventoryBackupPayload): boolean {
		const entries = Object.entries(backups).filter(([, value]) => value !== undefined);
		if (entries.length === 0) {
			this.clearBackupPayload(player);
			return true;
		}

		const sanitized: InventoryBackupPayload = {};
		for (const [slot, value] of entries) {
			sanitized[slot] = value ?? null;
		}

		const payload = JSON.stringify(sanitized);
		const maxLength = DYNAMIC_PROPERTY_CHUNK_LIMIT * DYNAMIC_PROPERTY_MAX_CHUNKS;
		if (payload.length > maxLength) {
			this.log.warn(
				`Inventory mirror payload (${payload.length}) exceeds limit (${maxLength}). Original items may be lost.`,
			);
			return false;
		}

		return this.writeBackupPayload(player, payload);
	}

	private static serializeItemStack(item: ItemStack | undefined): SerializedItemStackData | null {
		if (!item) return null;
		let snapshot: ItemStack | undefined;
		try {
			snapshot = item.clone();
		} catch (error) {
			this.log.warn(`Failed cloning item stack for serialization: ${error}`);
			return null;
		}
		if (!snapshot) {
			this.log.warn(`Clone returned undefined during serialization for ${item.typeId}`);
			return null;
		}

		const serialized: SerializedItemStackData = {
			typeId: snapshot.typeId,
			amount: snapshot.amount,
		};

		if (snapshot.keepOnDeath) serialized.keepOnDeath = true;
		if (snapshot.lockMode && snapshot.lockMode !== ItemLockMode.none) serialized.lockMode = snapshot.lockMode;
		if (snapshot.nameTag) serialized.nameTag = snapshot.nameTag;

		const canDestroy = this.safeGet(() => snapshot.getCanDestroy());
		if (canDestroy && canDestroy.length > 0) serialized.canDestroy = canDestroy;

		const canPlaceOn = this.safeGet(() => snapshot.getCanPlaceOn());
		if (canPlaceOn && canPlaceOn.length > 0) serialized.canPlaceOn = canPlaceOn;

		const lore = this.safeGet(() => snapshot.getLore());
		if (lore && lore.length > 0) serialized.lore = lore;

		const durability = this.serializeDurability(snapshot);
		if (durability) serialized.durability = durability;

		const enchantments = this.serializeEnchantments(snapshot);
		if (enchantments && enchantments.length > 0) serialized.enchantments = enchantments;

		const dynamicProperties = this.serializeDynamicProperties(snapshot);
		if (dynamicProperties && dynamicProperties.length > 0)
			serialized.dynamicProperties = dynamicProperties;

		return serialized;
	}

	private static deserializeItemStack(data: SerializedItemStackData | null | undefined): ItemStack | undefined {
		if (!data) return undefined;
		try {
			const amount = Math.max(1, data.amount ?? 1);
			const item = new ItemStack(data.typeId, amount);
			item.amount = amount;

			if (data.keepOnDeath !== undefined) item.keepOnDeath = data.keepOnDeath;
			item.lockMode = data.lockMode ?? ItemLockMode.none;

			if (data.nameTag !== undefined) item.nameTag = data.nameTag;
			if (data.lore) {
				const lore = data.lore;
				this.trySet(() => item.setLore(lore));
			}
			if (data.canDestroy) {
				this.trySet(() => item.setCanDestroy(data.canDestroy));
			}
			if (data.canPlaceOn) {
				this.trySet(() => item.setCanPlaceOn(data.canPlaceOn));
			}

			if (data.dynamicProperties) {
				this.trySet(() => item.clearDynamicProperties());
				for (const prop of data.dynamicProperties) {
					this.trySet(() => {
						if (prop.type === "vector3") {
							item.setDynamicProperty(prop.id, prop.value as Vector3);
							return;
						}
						item.setDynamicProperty(
							prop.id,
							prop.value as boolean | number | string,
						);
					});
				}
			}

			if (data.enchantments) {
				const enchantable = this.safeGet(() =>
					item.getComponent(ItemComponentTypes.Enchantable) as ItemEnchantableComponent | undefined,
				);
				if (enchantable) {
					this.trySet(() => enchantable.removeAllEnchantments());
					const toApply: Enchantment[] = [];
					for (const enchant of data.enchantments) {
						const type = EnchantmentTypes.get(enchant.id);
						if (!type) continue;
						toApply.push({ type, level: enchant.level });
					}
					if (toApply.length > 0) {
						this.trySet(() => enchantable.addEnchantments(toApply));
					}
				}
			}

			if (data.durability) {
				const durabilityData = data.durability;
				const durability = this.safeGet(() =>
					item.getComponent(ItemComponentTypes.Durability) as ItemDurabilityComponent | undefined,
				);
				if (durability) {
					this.trySet(() => {
						durability.damage = durabilityData.damage ?? 0;
					});
				}
			}

			return item;
		} catch (error) {
			this.log.warn(`Failed to deserialize inventory mirror entry: ${error}`);
			return undefined;
		}
	}

	private static serializeDurability(item: ItemStack): SerializedDurability | undefined {
		try {
			const durability = item.getComponent(ItemComponentTypes.Durability) as ItemDurabilityComponent | undefined;
			if (!durability) return undefined;
			if (typeof durability.damage !== "number" || durability.damage <= 0) {
				return undefined;
			}
			return { damage: durability.damage };
		} catch (error) {
			this.log.debug?.(`Durability serialization failed: ${error}`);
			return undefined;
		}
	}

	private static serializeEnchantments(item: ItemStack): SerializedEnchantment[] | undefined {
		try {
			const enchantable = item.getComponent(ItemComponentTypes.Enchantable) as ItemEnchantableComponent | undefined;
			if (!enchantable) return undefined;
			const enchantments = enchantable.getEnchantments();
			if (!enchantments || enchantments.length === 0) return undefined;
			return enchantments.map((enchant) => ({
				id: enchant.type.id,
				level: enchant.level,
			}));
		} catch (error) {
			this.log.debug?.(`Enchantment serialization failed: ${error}`);
			return undefined;
		}
	}

	private static serializeDynamicProperties(item: ItemStack): SerializedDynamicProperty[] | undefined {
		try {
			const ids = item.getDynamicPropertyIds();
			if (!ids || ids.length === 0) return undefined;
			const out: SerializedDynamicProperty[] = [];
			for (const id of ids) {
				const value = item.getDynamicProperty(id);
				if (value === undefined || value === null) continue;
				switch (typeof value) {
					case "boolean":
						out.push({ id, type: "boolean", value });
						break;
					case "number":
						out.push({ id, type: "number", value });
						break;
					case "string":
						out.push({ id, type: "string", value });
						break;
					case "object": {
						if (
							typeof (value as Vector3).x === "number" &&
							typeof (value as Vector3).y === "number" &&
							typeof (value as Vector3).z === "number"
						) {
							const vec = value as Vector3;
							out.push({ id, type: "vector3", value: { x: vec.x, y: vec.y, z: vec.z } });
						}
						break;
					}
				}
			}
			return out.length ? out : undefined;
		} catch (error) {
			this.log.debug?.(`Dynamic property serialization failed: ${error}`);
			return undefined;
		}
	}

	private static writeBackupPayload(player: Player, payload: string): boolean {
		if (!payload) {
			this.clearBackupPayload(player);
			return true;
		}

		const chunks = this.chunkString(payload, DYNAMIC_PROPERTY_CHUNK_LIMIT);
		if (chunks.length > DYNAMIC_PROPERTY_MAX_CHUNKS) {
			this.log.warn(`Inventory mirror chunk count exceeded: ${chunks.length}`);
			return false;
		}

		this.clearBackupPayload(player);
		for (let index = 0; index < chunks.length; index++) {
			player.setDynamicProperty(this.getBackupChunkId(index), chunks[index]);
		}
		return true;
	}

	private static readBackupPayload(player: Player): string {
		const chunks: string[] = [];
		for (let index = 0; index < DYNAMIC_PROPERTY_MAX_CHUNKS; index++) {
			const value = player.getDynamicProperty(this.getBackupChunkId(index));
			if (typeof value !== "string") {
				if (index === 0) return "";
				break;
			}
			chunks.push(value);
		}
		return chunks.join("");
	}

	private static clearBackupPayload(player: Player): void {
		for (let index = 0; index < DYNAMIC_PROPERTY_MAX_CHUNKS; index++) {
			const propertyId = this.getBackupChunkId(index);
			if (player.getDynamicProperty(propertyId) === undefined) continue;
			player.setDynamicProperty(propertyId, undefined);
		}
	}

	private static getBackupChunkId(index: number): string {
		return index === 0
			? PROPERTY_ITEM_BACKUPS
			: `${PROPERTY_ITEM_BACKUPS}${PROPERTY_ITEM_BACKUPS_CHUNK_SUFFIX}${index}`;
	}

	private static chunkString(value: string, maxLength: number): string[] {
		const chunks: string[] = [];
		let cursor = 0;
		while (cursor < value.length) {
			chunks.push(value.slice(cursor, cursor + maxLength));
			cursor += maxLength;
		}
		return chunks.length ? chunks : [value];
	}

	private static safeGet<T>(fn: () => T): T | undefined {
		try {
			return fn();
		} catch (error) {
			// We intentionally swallow and log at debug level to avoid noisy warnings in normal gameplay.
			this.log.debug?.(`InventoryMirror safeGet failed: ${error}`);
			return undefined;
		}
	}

	private static trySet(fn: () => void): void {
		try {
			fn();
		} catch (error) {
			this.log.debug?.(`InventoryMirror trySet failed: ${error}`);
		}
	}

	private static revertSlotsFromBackup(
		container: EntityInventoryComponent["container"],
		slots: Set<number>,
		backups: InventoryBackupPayload,
	): void {
		for (const slotIndex of slots) {
			const original = this.deserializeItemStack(backups[String(slotIndex)]);
			try {
				container.setItem(slotIndex, original ?? undefined);
			} catch (error) {
				this.log.warn(`Failed reverting slot ${slotIndex} after backup overflow: ${error}`);
			}
		}
	}
}



//#region Types
type InventoryBackupPayload = Record<string, SerializedItemStackData | null | undefined>;

interface SerializedItemStackData {
	typeId: string;
	amount: number;
	keepOnDeath?: boolean;
	lockMode?: ItemLockMode;
	nameTag?: string;
	canDestroy?: string[];
	canPlaceOn?: string[];
	lore?: string[];
	enchantments?: SerializedEnchantment[];
	durability?: SerializedDurability;
	dynamicProperties?: SerializedDynamicProperty[];
}

interface SerializedEnchantment {
	id: string;
	level: number;
}

interface SerializedDurability {
	damage: number;
}

interface SerializedDynamicProperty {
	id: string;
	type: "boolean" | "number" | "string" | "vector3";
	value: boolean | number | string | { x: number; y: number; z: number };
}

export interface IconSlotRequest {
	slot: number;
	item: ItemStack | undefined;
}