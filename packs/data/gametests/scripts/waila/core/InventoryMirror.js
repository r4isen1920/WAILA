"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryMirror = void 0;
const server_1 = require("@minecraft/server");
const bedrock_boost_1 = require("@bedrock-oss/bedrock-boost");
const HOLDER_ENTITY_ID = "r4isen1920_waila:item_holder";
const PROPERTY_ITEM_HOLDER_ID = "r4isen1920_waila:item_holder_id";
const PROPERTY_TRACKED_SLOTS = "r4isen1920_waila:inventory_item_holder_slots";
class InventoryMirror {
    static log = bedrock_boost_1.Logger.getLogger("InventoryMirror");
    static apply(player, requests) {
        if (requests.length === 0)
            return;
        const playerContainer = this.getPlayerContainer(player);
        if (!playerContainer)
            return;
        const { holder, container: holderContainer } = this.ensureHolder(player);
        if (!holder || !holderContainer)
            return;
        const trackedSlots = this.getTrackedSlots(player);
        for (const request of requests) {
            const slotIndex = request.slot;
            if (slotIndex < 0 || slotIndex > playerContainer.size - 1)
                continue;
            if (slotIndex >= 9) {
                try {
                    playerContainer.moveItem(slotIndex, slotIndex - 9, holderContainer);
                }
                catch (error) {
                    this.log.warn(`Failed moving slot ${slotIndex} into holder: ${error}`);
                    continue;
                }
                if (!trackedSlots.includes(slotIndex))
                    trackedSlots.push(slotIndex);
            }
            if (!request.item) {
                playerContainer.setItem(slotIndex, undefined);
                continue;
            }
            const cloned = request.item.clone();
            if (!cloned) {
                playerContainer.setItem(slotIndex, undefined);
                continue;
            }
            cloned.lockMode = server_1.ItemLockMode.slot;
            cloned.keepOnDeath = true;
            cloned.nameTag = "§7 §r";
            try {
                playerContainer.setItem(slotIndex, cloned);
            }
            catch (error) {
                this.log.warn(`Failed injecting item into slot ${slotIndex}: ${error}`);
            }
        }
        this.setTrackedSlots(player, trackedSlots);
    }
    static restore(player) {
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
        const holderData = this.getHolder(player);
        if (!holderData?.container || !holderData.holder?.isValid) {
            this.clearTrackedSlots(player);
            return;
        }
        for (const slotIndex of trackedSlots) {
            if (slotIndex < 9)
                continue;
            try {
                holderData.container.moveItem(slotIndex - 9, slotIndex, playerContainer);
            }
            catch (error) {
                this.log.warn(`Failed restoring slot ${slotIndex} from holder: ${error}`);
            }
        }
        this.despawnHolder(holderData.holder);
        this.clearTrackedSlots(player);
    }
    static createPrimaryIconRequest(source) {
        const itemStack = source instanceof server_1.Block ? InventoryMirror.blockToItem(source) : source.clone();
        if (itemStack) {
            itemStack.amount = source instanceof server_1.Block ? 1 : itemStack.amount;
        }
        return { slot: 17, item: itemStack };
    }
    static createInventoryRequests(items) {
        return items.map(({ item, slot }) => ({ slot: Math.min(9 + slot, 35), item }));
    }
    static blockToItem(block) {
        const SPECIAL_CASES = {
            "minecraft:bubble_column": "minecraft:water_bucket",
            "minecraft:flowing_lava": "minecraft:lava_bucket",
            "minecraft:flowing_water": "minecraft:water_bucket",
            "minecraft:water": "minecraft:water_bucket",
            "minecraft:lava": "minecraft:lava_bucket",
        };
        const mapped = SPECIAL_CASES[block.typeId];
        if (mapped)
            return new server_1.ItemStack(mapped);
        try {
            return block.getItemStack(1, true);
        }
        catch {
            try {
                return new server_1.ItemStack(block.typeId);
            }
            catch {
                return undefined;
            }
        }
    }
    static getPlayerContainer(player) {
        return player
            .getComponent(server_1.EntityComponentTypes.Inventory)
            ?.container;
    }
    static ensureHolder(player) {
        const existing = this.getHolder(player);
        if (existing?.holder && existing.holder.isValid && existing.container) {
            return existing;
        }
        const spawned = player.dimension.spawnEntity(HOLDER_ENTITY_ID, player.location);
        const container = spawned
            .getComponent(server_1.EntityComponentTypes.Inventory)
            ?.container;
        if (!container) {
            spawned.triggerEvent("r4isen1920_waila:instant_despawn");
            return { holder: undefined, container: undefined };
        }
        player.setDynamicProperty(PROPERTY_ITEM_HOLDER_ID, spawned.id);
        return { holder: spawned, container };
    }
    static getHolder(player) {
        const entityId = player.getDynamicProperty(PROPERTY_ITEM_HOLDER_ID);
        if (!entityId)
            return { holder: undefined, container: undefined };
        const holder = server_1.world.getEntity(entityId);
        const container = holder
            ?.getComponent(server_1.EntityComponentTypes.Inventory)
            ?.container;
        return { holder, container };
    }
    static despawnHolder(holder) {
        if (!holder || !holder.isValid)
            return;
        try {
            holder.triggerEvent("r4isen1920_waila:instant_despawn");
        }
        catch (error) {
            this.log.warn(`Failed to despawn holder entity: ${error}`);
        }
    }
    static getTrackedSlots(player) {
        const stored = player.getDynamicProperty(PROPERTY_TRACKED_SLOTS);
        if (typeof stored === "string" && stored.length > 0) {
            try {
                const parsed = JSON.parse(stored);
                return Array.isArray(parsed) ? parsed : [];
            }
            catch {
                return [];
            }
        }
        return [];
    }
    static setTrackedSlots(player, slots) {
        player.setDynamicProperty(PROPERTY_TRACKED_SLOTS, slots.length > 0 ? JSON.stringify(slots) : undefined);
    }
    static clearTrackedSlots(player) {
        player.setDynamicProperty(PROPERTY_TRACKED_SLOTS, undefined);
        player.setDynamicProperty(PROPERTY_ITEM_HOLDER_ID, undefined);
    }
}
exports.InventoryMirror = InventoryMirror;
