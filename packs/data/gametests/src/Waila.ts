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
   Entity,
   Block,
   Effect,
   BlockStates,
   EntityComponentTypes,
   EquipmentSlot,
   LocationOutOfWorldBoundariesError,
   system,
   TicksPerSecond,
   ItemTypes,
   world,
   Player,
   ItemStack,
   Container,
   RawMessage,
   EntityEquippableComponent,
   EntityHealthComponent,
   EntityInventoryComponent,
   BlockInventoryComponent,
   BlockPermutation,
   EntityItemComponent,
   TitleDisplayOptions,
} from "@minecraft/server";

import armor from "./data/armor.json";
import blockIds from "./data/blockIds.json";
import blockTools from "./data/blockTools.json";
import entityInteractions from "./data/entityInteractions.json";
import nameAliases from "./data/nameAliases.json";

import { Logger, LogLevel } from "@bedrock-oss/bedrock-boost";


/**
 * Represents the object a player is currently looking at in the game.
 */
interface LookAtObject {
   type: "entity" | "tile" | undefined;
   rawHit: Entity | Block | undefined;
   hit: string | undefined;
   hp?: number | string; // Can be string '0' initially
   maxHp?: number | string; // Can be string '0' initially
   effects?:
   | { id: string; amplifier: number; effectDuration?: number }[]
   | Effect[];
   isPlayerSneaking: boolean;
}

/**
 * Contains metadata about the object a player is looking at, used for UI display.
 */
interface LookAtObjectMetadata {
   type: "entity" | "tile" | undefined;
   hit: string;
   hitItem?: string;
   itemAux: number;
   intHealthDisplay: boolean;
   healthRenderer: string;
   armorRenderer: string;
   effectsRenderer: { effectString: string; effectsResolvedArray: string[] };
   hp: number;
   maxHp: number;
   entityId?: string;
   tool: string[];
   tags: string[];
   blockStates: string; // Changed from BlockStates to string representation
   inventory: string | string[];
}

class WAILA {
   private static instance: WAILA;
   private readonly log = Logger.getLogger("Waila");
   private readonly MAX_DISTANCE = 8;

   private constructor() {
      Logger.setLevel(LogLevel.Trace);
      system.runInterval(() => this.iterAllPlayers(), 3);
      this.log.info("WAILA Manager Initialized.");
   }

   public static getInstance(): WAILA {
      if (!WAILA.instance) {
         WAILA.instance = new WAILA();
      }
      return WAILA.instance;
   }

   /**
    * Requests the process for each player in the world.
    */
   private iterAllPlayers(): void {
      world.getAllPlayers().forEach((player) => {
         let lookAtObject = this.fetchLookAt(player, this.MAX_DISTANCE);

         //* Reset UI when needed
         if (player.hasTag("r4ui_reset")) {
            lookAtObject.hit = "none";
            player.removeTag("r4ui_reset");
         }

         //* Inform UI that there is nothing on the screen the player is looking at
         if (!lookAtObject) return;
         if (lookAtObject.hit === undefined) lookAtObject.hit = "none";

         //* Render the UI in the screen
         this.displayUI(player, lookAtObject);
      });
   }

   /**
    * Parses the item AUX value of the block or item.
    */
   private getItemAux(type: ItemStack | Block | string | undefined): number {
      if (!type) return NaN;
      const typeId = typeof type === "string" ? type : type.typeId;
      const blockIdsType: { [key: string]: string | number } = blockIds;
      const auxValue = blockIdsType[typeId];
      if (auxValue === undefined) return NaN;
      return Number(auxValue) * 65536;
   }

   /**
    * Transforms the entity ID into a displayable format.
    */
   private transformEntityId(entity: Entity): string {
      const IGNORE_IDS = [
         "area_effect_cloud",
         "fireball",
         "minecart",
         "potion",
         "minecraft:arrow",
         "minecraft:boat",
         "minecraft:egg",
         "minecraft:eye_of_ender_signal",
         "minecraft:item",
         "minecraft:snowball",
         "minecraft:tnt",
      ];

      const entityId = entity.id ?? "0000000000000";
      if (IGNORE_IDS.some((id) => entity.typeId.includes(id)))
         return "0000000000000";

      // Ensure entityId is treated as a number for comparison
      const numericId = BigInt(entityId);
      return `${numericId < 0n ? "-" : ""}${String(
         numericId < 0n ? -numericId : numericId
      ).padStart(12, "0")}`;
   }

   /**
    * Parses the blockTools variable and returns applicable tool types.
    */
   private parseBlockTools(blockId: string): string[] {
      const namespaceRemoved = blockId.replace(/(?<=:).+/g, "");
      const matches = blockTools.filter(
         (tools) =>
            (tools.value.some((block) => namespaceRemoved.includes(block)) ||
               tools.value.some((block) => blockId.includes(block))) &&
            !tools.value.some(
               (block) =>
                  block.startsWith("!") &&
                  (namespaceRemoved.includes(block.substring(1)) ||
                     blockId.includes(block.substring(1)))
            )
      );

      if (matches.length > 0) {
         return matches.slice(0, 2).map((match) => match.type);
      } else {
         return ["undefined", "undefined"];
      }
   }

   /**
    * Fetches appropriate tags for the entity based on components and interactions.
    */
   private getEntityTags(entityType: Entity): string[] {
      let entityTags: string[] = [];
      const typeId = entityType.typeId;
      const namespaceRemoved = typeId.replace(/(?<=:).+/g, "");

      const interactionMatches = entityInteractions
         .filter(
            (items) =>
               (items.value.some((item) => namespaceRemoved.includes(item)) ||
                  items.value.some((item) => typeId.includes(item))) &&
               !items.value.some(
                  (item) =>
                     item.startsWith("!") &&
                     (namespaceRemoved.includes(item.substring(1)) ||
                        typeId.includes(item.substring(1)))
               )
         )
         .map((item) => item.type);
      entityTags.push(...interactionMatches);

      const getComponentValue = <T>(
         entity: Entity,
         componentName: string
      ): T | undefined => {
         try {
            return entity.getComponent(componentName) as T | undefined;
         } catch {
            return undefined; // Component might not exist
         }
      };

      const componentList: string[] = [
         // Use string identifiers
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

      componentList.forEach((componentId) => {
         if (getComponentValue(entityType, componentId)) {
            const tagName = componentId.replace("minecraft:", "");
            if (componentId === EntityComponentTypes.IsBaby) {
               entityTags = entityTags.filter((tag) => tag !== "is_rideable");
            }
            if (componentId === EntityComponentTypes.IsTamed) {
               entityTags = entityTags.filter((tag) => tag !== "tameable");
            }
            entityTags.push(tagName);
         }
      });

      if (entityTags.length > 0) {
         return [...new Set(entityTags)].slice(0, 2);
      } else {
         return ["undefined", "undefined"];
      }
   }

   /**
    * Draws the current health of the entity in useable text.
    */
   private healthRenderer(
      currentHealth: number,
      maxHealth: number,
      MAX_LENGTH: number = 40
   ): string {
      let displayCurrent = currentHealth;
      let displayMax = maxHealth;

      //* Normalize value to the specified max length if it exceeds the value
      if (displayMax > MAX_LENGTH) {
         displayCurrent = Math.round((displayCurrent / displayMax) * MAX_LENGTH);
         displayMax = MAX_LENGTH;
      }

      const healthIcons = { empty: "a", half: "b", full: "c", padding: "y" };
      const MAX_HEARTS_DISPLAY = Math.ceil(displayMax / 2);

      // Ensure non-negative values
      displayCurrent = Math.max(0, displayCurrent);

      let fullHearts = Math.floor(displayCurrent / 2);
      let halfHearts = displayCurrent % 2;
      let emptyHearts = Math.max(0, MAX_HEARTS_DISPLAY - fullHearts - halfHearts); // Ensure non-negative

      let healthString =
         healthIcons.full.repeat(fullHearts) +
         healthIcons.half.repeat(halfHearts) +
         healthIcons.empty.repeat(emptyHearts);

      // Ensure the string length is exactly 20 by padding
      const paddingNeeded = 20 - healthString.length;
      if (paddingNeeded > 0) {
         healthString += healthIcons.padding.repeat(paddingNeeded);
      } else if (paddingNeeded < 0) {
         healthString = healthString.substring(0, 20); // Truncate if too long (shouldn't happen with MAX_LENGTH=40)
      }

      return healthString || "yyyyyyyyyyyyyyyyyyyy"; // Fallback
   }

   /**
    * Renders the armor of the player in useable text.
    */
   private armorRenderer(player: Player | Entity): string {
      const playerEquipment = player.getComponent(
         EntityComponentTypes.Equippable
      ) as EntityEquippableComponent | undefined;
      if (!playerEquipment) return "dddddddddd"; // Default empty armor bar

      const armorTypes: { [key: string]: number } = armor;
      const currentArmor = [
         EquipmentSlot.Head,
         EquipmentSlot.Chest,
         EquipmentSlot.Legs,
         EquipmentSlot.Feet,
      ].reduce((total, slot) => {
         const item = playerEquipment.getEquipment(slot);
         return total + (armorTypes[item?.typeId ?? ""] || 0);
      }, 0);

      const maxArmor = 20;
      const armorIcons = { empty: "d", half: "e", full: "f" };

      const MAX_ARMOR_DISPLAY = Math.ceil(maxArmor / 2); // Should be 10
      let fullArmor = Math.floor(currentArmor / 2);
      let halfArmor = currentArmor % 2;
      let emptyArmor = Math.max(0, MAX_ARMOR_DISPLAY - fullArmor - halfArmor); // Ensure non-negative

      let armorString =
         armorIcons.full.repeat(fullArmor) +
         armorIcons.half.repeat(halfArmor) +
         armorIcons.empty.repeat(emptyArmor);

      // Ensure the string length is exactly 10
      const paddingNeeded = 10 - armorString.length;
      if (paddingNeeded > 0) {
         // This case implies currentArmor > maxArmor, pad with full? Or empty? Let's stick to empty.
         armorString += armorIcons.empty.repeat(paddingNeeded);
      } else if (paddingNeeded < 0) {
         armorString = armorString.substring(0, 10); // Truncate if somehow too long
      }

      return armorString || "dddddddddd"; // Fallback
   }

   /**
    * Renders the effects of the entity in useable text.
    */
   private effectsRenderer(entity: Entity): {
      effectString: string;
      effectsResolvedArray: string[];
   } {
      const MAX_EFFECTS_TO_RESOLVE = 6;
      const effectList = [
         { name: "speed", id: 1, is_negative: false },
         { name: "slowness", id: 2, is_negative: true },
         { name: "haste", id: 3, is_negative: false },
         { name: "mining_fatigue", id: 4, is_negative: true },
         { name: "strength", id: 5, is_negative: false },
         { name: "instant_health", id: 6, is_negative: false },
         { name: "instant_damage", id: 7, is_negative: true },
         { name: "jump_boost", id: 8, is_negative: false },
         { name: "nausea", id: 9, is_negative: true },
         { name: "regeneration", id: 10, is_negative: false },
         { name: "resistance", id: 11, is_negative: false },
         { name: "fire_resistance", id: 12, is_negative: false },
         { name: "water_breathing", id: 13, is_negative: false },
         { name: "invisibility", id: 14, is_negative: false },
         { name: "blindness", id: 15, is_negative: true },
         { name: "night_vision", id: 16, is_negative: false },
         { name: "hunger", id: 17, is_negative: true },
         { name: "weakness", id: 18, is_negative: true },
         { name: "poison", id: 19, is_negative: true },
         { name: "wither", id: 20, is_negative: true },
         { name: "health_boost", id: 21, is_negative: false },
         { name: "absorption", id: 22, is_negative: false },
         { name: "saturation", id: 23, is_negative: false },
         { name: "levitation", id: 24, is_negative: true },
         { name: "fatal_poison", id: 25, is_negative: true },
         { name: "slow_falling", id: 26, is_negative: false },
         { name: "conduit_power", id: 27, is_negative: false },
         { name: "bad_omen", id: 28, is_negative: true },
         { name: "village_hero", id: 29, is_negative: false },
         { name: "darkness", id: 30, is_negative: true },
         { name: "wind_charged", id: 31, is_negative: true },
         { name: "weaving", id: 32, is_negative: true },
         { name: "oozing", id: 33, is_negative: true },
         { name: "infested", id: 34, is_negative: true },
      ];

      let effectString = "";
      let effectsResolved = 0;
      let effectsResolvedArray: string[] = [];

      for (const effectInfo of effectList) {
         let effectData: Effect | undefined;
         try {
            effectData = entity.getEffect(effectInfo.name);
         } catch {
            effectData = undefined; // Effect might not exist or entity is invalid
         }

         let effectDuration = effectData?.duration ?? 0;
         let effectAmplifier = effectData?.amplifier ?? 0;
         const effectTypeId = effectData?.typeId;

         if (effectsResolved >= MAX_EFFECTS_TO_RESOLVE) {
            effectDuration = 0;
            effectAmplifier = 0;
         } else {
            effectAmplifier = effectTypeId ? Math.min(effectAmplifier + 1, 9) : 0;
         }

         if (effectTypeId) {
            effectsResolved++;
            if (effectDuration > 0) {
               effectsResolvedArray.push(effectTypeId);
            }
         }

         effectDuration /= TicksPerSecond;
         const effectDurationMinutes = Math.min(
            99,
            Math.floor(effectDuration / 60)
         );
         const effectDurationSeconds = Math.floor(effectDuration % 60);

         effectString +=
            `d${effectDurationMinutes
               .toString()
               .padStart(2, "0")}:${effectDurationSeconds
                  .toString()
                  .padStart(2, "0")}` +
            `p${effectAmplifier.toString().padStart(1, "0")}`;
      }

      return { effectString, effectsResolvedArray };
   }

   /**
    * Fetches and parses the states of the block in a readable format.
    */
   private getBlockStates(block: Block): string {
      try {
         const permutation = block.permutation;
         const states = permutation.getAllStates();
         const blockStates = Object.keys(states).sort();
         if (blockStates.length === 0) return "";
         return `\n${blockStates
            .map((state) => `§7${state.replace(/.+:/g, "")}: ${states[state]}§r`)
            .join("\n")}`;
      } catch (e) {
         this.log.warn(`Error getting block states for ${block.typeId}: ${e}`);
         return "";
      }
   }

   /**
    * Fetches the inventory of the block.
    */
   private getBlockInventory(block: Block): string | string[] {
      try {
         const inventoryComponent = block.getComponent(
            EntityComponentTypes.Inventory
         ) as BlockInventoryComponent | undefined;
         const blockContainer = inventoryComponent?.container;
         if (!blockContainer) return "none";

         let items: string[] = [];
         for (let i = 0; i < blockContainer.size; i++) {
            const itemStack = blockContainer.getItem(i);
            if (itemStack) {
               items.push(itemStack.typeId);
            }
         }
         return items.length > 0 ? items : "empty"; // Distinguish between no inventory and empty inventory
      } catch (e) {
         // This can happen if the block doesn't have an inventory component (e.g., trying on 'air')
         if (e instanceof Error && e.message.includes("Component")) {
            return "none";
         }
         this.log.warn(`Error getting block inventory for ${block.typeId}: ${e}`);
         return "error";
      }
   }

   /**
    * Fetches what block or entity the specified player is looking at.
    */
   private fetchLookAt(player: Player, max_dist: number): LookAtObject {
      let lookAt: LookAtObject = {
         type: undefined,
         rawHit: undefined,
         hit: undefined,
         isPlayerSneaking: player.isSneaking,
      };

      try {
         //* Fetch entity the player is looking at
         const entityLookAt = player.getEntitiesFromViewDirection({
            maxDistance: max_dist,
         });
         if (entityLookAt.length > 0 && entityLookAt[0]?.entity) {
            const entity = entityLookAt[0].entity;
            lookAt.type = "entity";
            lookAt.rawHit = entity;
            lookAt.hit = entity.typeId;
            const healthComponent = entity.getComponent(
               EntityComponentTypes.Health
            ) as EntityHealthComponent | undefined;
            lookAt.hp = healthComponent?.currentValue ?? 0;
            lookAt.maxHp = healthComponent?.effectiveMax ?? 0;
            try {
               lookAt.effects = entity.getEffects().map((effect) => ({
                  // Simplify effect structure slightly
                  id: effect.typeId,
                  amplifier: effect.amplifier,
                  effectDuration: Math.floor(effect.duration / TicksPerSecond),
               }));
            } catch {
               lookAt.effects = []; // Handle cases where getEffects might fail
            }

            return lookAt; // Return early if entity found
         }

         //* Fetch block the player is looking at
         const blockLookAt = player.getBlockFromViewDirection({
            includeLiquidBlocks: !player.isInWater,
            includePassableBlocks: !player.isInWater,
            maxDistance: max_dist,
         });

         if (blockLookAt?.block) {
            const block = blockLookAt.block;
            lookAt.type = "tile"; // Use 'tile' to match original logic
            lookAt.rawHit = block;
            try {
               const itemStack = block.getItemStack(1, true);
               lookAt.hit = itemStack?.typeId ?? block.typeId;
            } catch (e) {
               // block.getItemStack can fail on some blocks (e.g., custom ones?)
               this.log.warn(
                  `Could not get ItemStack for block ${block.typeId}, using typeId. Error: ${e}`
               );
               lookAt.hit = block.typeId;
            }
         } else {
            lookAt.hit = "none"; // Explicitly set to none if nothing is hit
         }
      } catch (e) {
         if (!(e instanceof LocationOutOfWorldBoundariesError)) {
            this.log.error(`Error in fetchLookAt: ${e}`);
         }
         lookAt.hit = "none"; // Ensure hit is 'none' on error
      }

      return lookAt;
   }

   /**
    * Fetches metadata for the looked-at object.
    */
   private fetchLookAtMetadata(
      lookAtObject: LookAtObject,
      hitNamespace: string
   ): LookAtObjectMetadata | null {
      if (
         !lookAtObject.type ||
         !lookAtObject.hit ||
         lookAtObject.hit === "none" ||
         !lookAtObject.rawHit
      ) {
         return null; // Not enough data to generate metadata
      }

      let metadata: Partial<LookAtObjectMetadata> = {
         type: lookAtObject.type,
         hit: lookAtObject.hit,
      };

      if (
         lookAtObject.type === "entity" &&
         lookAtObject.rawHit instanceof Entity
      ) {
         const entity = lookAtObject.rawHit;
         const entityHp = entity.getComponent(EntityComponentTypes.Health) as
            | EntityHealthComponent
            | undefined;
         const currentHp = Math.floor(entityHp?.currentValue ?? 0);
         const maxHp = Math.floor(entityHp?.effectiveMax ?? 0);

         metadata.hp = currentHp;
         metadata.maxHp = maxHp;

         switch (lookAtObject.hit) {
            case "minecraft:player":
               // Ensure rawHit is Player for name and armorRenderer
               if (entity instanceof Player) {
                  metadata.hit = `__r4ui:player.${entity.name}`;
                  metadata.armorRenderer = this.armorRenderer(entity);
               } else {
                  // Fallback if typeId is player but object isn't Player instance (shouldn't happen)
                  metadata.hit = `entity.minecraft:player.name`;
                  metadata.armorRenderer = "dddddddddd";
               }

               break;
            case "minecraft:item":
               const itemComponent = entity.getComponent(
                  EntityComponentTypes.Item
               ) as EntityItemComponent | undefined;
               const itemStackEntity = itemComponent?.itemStack;
               if (itemStackEntity) {
                  metadata.hitItem = itemStackEntity.typeId;
                  metadata.itemAux = this.getItemAux(itemStackEntity);
                  // Keep original hit for translation lookup if needed?
                  // metadata.hit = `item.${itemStackEntity.typeId}.name`; // Or keep entity.minecraft:item.name?
                  metadata.hit = `entity.minecraft:item.name`; // Keep consistent for now
               } else {
                  metadata.hit = `entity.minecraft:item.name`; // Fallback
                  metadata.itemAux = NaN;
               }

               break;
            default:
               if (hitNamespace === "minecraft:") {
                  metadata.hit = `entity.${lookAtObject.hit}.name`;
               } // Keep original non-minecraft ID otherwise
         }

         metadata.intHealthDisplay =
            entity.matches({ families: ["inanimate"] }) ||
            (maxHp > 40 && !entity.matches({ type: "minecraft:player" }));

         if (!metadata.intHealthDisplay) {
            metadata.healthRenderer = this.healthRenderer(
               currentHp,
               maxHp,
               entity.matches({ type: "minecraft:player" }) ? 20 : 40
            );
         } else if (maxHp > 40 && !entity.matches({ type: "minecraft:player" })) {
            metadata.healthRenderer = "xyyyyyyyyyyyyyyyyyyy"; // Special case for high HP non-players
         } else {
            metadata.healthRenderer = "yyyyyyyyyyyyyyyyyyyy"; // Default padding
         }

         metadata.entityId = this.transformEntityId(entity);
         metadata.tags = this.getEntityTags(entity);
         metadata.effectsRenderer = this.effectsRenderer(entity);
         metadata.tool = ["undefined", "undefined"]; // Entities don't have tools
         metadata.blockStates = ""; // Entities don't have block states
         metadata.inventory = "none"; // Entities don't have block inventory
      } else if (
         lookAtObject.type === "tile" &&
         lookAtObject.rawHit instanceof Block
      ) {
         const block = lookAtObject.rawHit;
         let itemStackForAux: ItemStack | Block | undefined;
         try {
            itemStackForAux = block.getItemStack(1, true) ?? block;
         } catch {
            itemStackForAux = block; // Fallback to block if getItemStack fails
         }

         metadata.tool = this.parseBlockTools(lookAtObject.hit); // Use the potentially item-derived hit ID
         metadata.itemAux = this.getItemAux(itemStackForAux);
         metadata.blockStates = this.getBlockStates(block);
         metadata.inventory = this.getBlockInventory(block);
         metadata.healthRenderer = "yyyyyyyyyyyyyyyyyyyy"; // Placeholder
         metadata.effectsRenderer = {
            effectString: "none",
            effectsResolvedArray: [],
         }; // Placeholder
         metadata.hp = 0; // Blocks don't have HP in this context
         metadata.maxHp = 0;
         metadata.tags = ["undefined", "undefined"]; // Blocks don't have entity tags
      } else {
         return null; // Invalid state
      }

      //* Set armorRenderer placeholder value if not set (e.g., for non-players)
      if (!metadata.armorRenderer) metadata.armorRenderer = "dddddddddd";
      // Ensure itemAux is a number
      metadata.itemAux = metadata.itemAux ?? NaN;

      // Type assertion after filling mandatory fields
      return metadata as LookAtObjectMetadata;
   }

   /**
    * Clears the UI for the specified player.
    */
   private clearUI(player: Player): void {
      const options: TitleDisplayOptions = {
         fadeInDuration: 0,
         fadeOutDuration: 0,
         stayDuration: 0,
      };
      player.onScreenDisplay.setTitle(" ", options); // Clear with space

      // Reset title properties using native API if possible, fallback to command
      // Note: There isn't a direct equivalent to `title @s reset` in the native API
      // for clearing timings/subtitles specifically. Setting a blank title is the closest.
      // Keep the command for now to ensure full reset behavior.
      try {
         player.runCommandAsync(`title @s reset`);
      } catch (e) {
         this.log.warn(
            `Failed to run title reset command for ${player.name}: ${e}`
         );
      }
   }

   /**
    * Handles final string parse and sends a request to the UI.
    */
   private displayUI(player: Player, lookAtObject: LookAtObject): void {
      const hit = lookAtObject.hit;
      if (!hit) {
         // This case should ideally be handled before calling displayUI
         this.log.warn(
            `displayUI called with undefined hit for player ${player.name}`
         );
         this.clearUI(player);
         return;
      }

      //* Fetch the namespace of the provided hit typeId
      const hitNamespace = hit.includes(":")
         ? hit.substring(0, hit.indexOf(":") + 1)
         : "minecraft:"; // Default to minecraft if no namespace

      //* Only send a UI update if the value has changed
      // Use more specific properties for comparison to avoid stringify overhead on complex objects
      const currentBlockStates =
         lookAtObject.type === "tile" && lookAtObject.rawHit instanceof Block
            ? this.getBlockStates(lookAtObject.rawHit)
            : "";
      const currentComparisonData = JSON.stringify({
         hit: lookAtObject.hit,
         sneaking: lookAtObject.isPlayerSneaking,
         // Include relevant entity data if type is entity
         ...(lookAtObject.type === "entity" && {
            hp: lookAtObject.hp,
            maxHp: lookAtObject.maxHp,
            effects:
               lookAtObject.effects
                  ?.map(
                     (e) => `${e instanceof Effect ? e.typeId : e.id}:${e.amplifier}`
                  )
                  .join(",") ?? "", // Simplified effects check
         }),
         // Include block states if type is tile
         ...(lookAtObject.type === "tile" && { states: currentBlockStates }),
      });

      const oldLog = player.getDynamicProperty("r4isen1920_waila:old_log") as
         | string
         | undefined;
      if (oldLog === currentComparisonData) return;
      player.setDynamicProperty(
         "r4isen1920_waila:old_log",
         currentComparisonData
      );

      //* Remove information that was once displayed on screen
      if (hit === "none") {
         this.clearUI(player);
         return;
      }

      //* Transform lookAtObject to a parsed object value with metadata included
      const object = this.fetchLookAtMetadata(lookAtObject, hitNamespace);
      if (!object) {
         this.log.warn(`Failed to fetch metadata for ${hit}, clearing UI.`);
         this.clearUI(player);
         return;
      }

      let parseStr: RawMessage[] = [];
      let parseStrSubtitle: RawMessage[] = [{ text: object.entityId ?? "" }]; // Subtitle is entity ID or empty

      const nameAliasTypes: { [key: string]: string } = nameAliases;
      const nameAlias = nameAliasTypes[object.hit.replace(hitNamespace, "")];

      const iconTypes: { [key: string]: { [key: string]: string } } = {
         tile: {
            sword: "a",
            axe: "b",
            pickaxe: "c",
            shovel: "d",
            hoe: "e",
            armor: "f",
            crops: "g",
            shears: "h",
            bucket: "i",
            brush: "j",
            commands: "k",
            undefined: "z",
         },
         entity: {
            can_climb: "a",
            can_fly: "b",
            can_power_jump: "c",
            fire_immune: "d",
            is_baby: "e",
            is_chested: "f",
            is_dyeable: "g",
            is_stunned: "h",
            is_rideable: "i",
            is_tradeable: "j",
            projectile: "k",
            wants_jockey: "l",
            tameable: "m",
            wheat: "n",
            potato: "o",
            hay_bale: "p",
            seeds: "q",
            golden_apple: "r",
            fish: "s",
            flowers: "t",
            fungi: "u",
            slimeball: "v",
            cactus: "w",
            torchflower: "x",
            spider_eye: "y",
            undefined: "z",
         },
      };

      const isTileOrItemEntity = object.type === "tile" || !!object.hitItem;
      const prefixType = isTileOrItemEntity ? "A" : "B";
      const iconOrHealthArmor = isTileOrItemEntity
         ? `${object.itemAux >= 0 ? "" : "-"}${String(
            Math.abs(object.itemAux)
         ).padStart(object.itemAux >= 0 ? 9 : 8, "0")}`
         : `${object.healthRenderer}${object.armorRenderer}`;
      const tagIcons = `:${iconTypes[object.type ?? "tile"][object.tool[0] ?? "undefined"] ?? "z"
         };${iconTypes[object.type ?? "tile"][object.tool[1] ?? "undefined"] ?? "z"
         }:`; // Use tool for tile, tags for entity (corrected logic needed here)
      const entityTagIcons = `:${iconTypes.entity[object.tags[0] ?? "undefined"] ?? "z"
         };${iconTypes.entity[object.tags[1] ?? "undefined"] ?? "z"}:`;
      const finalTagIcons = object.type === "tile" ? tagIcons : entityTagIcons;

      const effectsStr =
         object.type === "entity" && !object.hitItem
            ? `${object.effectsRenderer.effectString
            }e${object.effectsRenderer.effectsResolvedArray.length
               .toString()
               .padStart(2, "0")}`
            : "";

      let translateKey = "";
      let nameText = ""; // Use text for non-translatable names

      if (hitNamespace === "minecraft:") {
         if (object.hit.startsWith("__r4ui:player.")) {
            // Player names are not translated
            nameText = object.hit.replace("__r4ui:player.", "");
         } else if (object.type === "tile") {
            translateKey = `${nameAlias?.startsWith("item.") ? "" : "tile."}${!nameAlias ? object.hit.replace(hitNamespace, "") : nameAlias
               }.name`;
         } else {
            // Entity
            translateKey = object.hit; // Already formatted like entity.namespace:id.name
         }
      } else {
         // Non-vanilla: Assume translation key format type.namespace:id.name
         translateKey = `${object.type}.${object.hit}.name`;
      }

      const blockStatesText =
         object.type === "tile" && player.isSneaking ? object.blockStates : "";
      const itemEntityText =
         object.hitItem !== undefined ? `\n§7${object.hitItem}§r` : ""; // Display raw item ID for item entities

      // Integer health display logic
      let healthText = "";
      if (object.maxHp > 0 && object.intHealthDisplay) {
         // Only show if intHealthDisplay is true
         const percentage =
            object.maxHp > 0 ? Math.round((object.hp / object.maxHp) * 100) : 0;
         const hpDisplay =
            object.maxHp < 1000000
               ? `${object.hp}/${object.maxHp} (${percentage}%)`
               : "∞";
         healthText = `\n§7 ${hpDisplay}§r`; // Add newline before
      }

      // Padding logic needs careful review based on UI layout
      let paddingNewlines = "";

      if (object.maxHp > 0 && object.maxHp <= 40 && !object.intHealthDisplay) {
         paddingNewlines += "\n";
      }
      if (object.maxHp > 20 && object.maxHp <= 40 && !object.intHealthDisplay) {
         paddingNewlines += "\n";
      }
      if (object.maxHp > 40 && !object.intHealthDisplay) {
         // High HP bar shown, add health text padding
         healthText = `\n§7 ${object.maxHp < 1000000
               ? `${object.hp}/${object.maxHp} (${Math.round(
                  (object.hp / object.maxHp) * 100
               )}%)`
               : "∞"
            }§r`;
         // No extra newline needed here as healthText provides one? Check original logic.
      } else if (object.maxHp > 20 && object.intHealthDisplay) {
         // Integer health shown for >20 HP, add newline?
         paddingNewlines += "\n"; // Seems redundant if healthText adds \n
      }

      // Effects padding
      const numEffects = object.effectsRenderer.effectsResolvedArray.length;
      if (numEffects > 0 && numEffects < 4) {
         paddingNewlines += "\n\n".repeat(numEffects); // Add 2 newlines per effect? Seems excessive. Maybe 1?
      } else if (numEffects >= 4) {
         // Complex condition based on health display type
         paddingNewlines +=
            !object.intHealthDisplay && object.maxHp > 40 ? "\n" : "\n\n";
      }

      // Armor padding
      if (object.armorRenderer !== "dddddddddd") {
         paddingNewlines += "\n";
      }

      // Namespace formatting
      const formattedNamespace =
         hitNamespace.length > 3
            ? hitNamespace.replace(/_/g, " ").replace(":", "").toTitle().abrevCaps() // Requires String.prototype extensions
            : hitNamespace.replace(":", "").toUpperCase();
      const namespaceText = `§9§o${formattedNamespace}§r`;

      // Construct the final RawMessage
      parseStr = [
         { text: `_r4ui:${prefixType}:` },
         { text: iconOrHealthArmor },
         { text: finalTagIcons },
         { text: effectsStr },
         // Use text or translate based on what was determined earlier
         nameText ? { text: nameText } : { translate: translateKey },
         { text: blockStatesText },
         { text: itemEntityText },
         { text: healthText }, // Integer health text (includes preceding \n)
         { text: paddingNewlines }, // Apply calculated padding (commented out, needs review)
         // Append namespace at the end
         { text: `\n${namespaceText}` }, // Add newline before namespace
      ];

      // Filter out empty text elements which can cause issues
      parseStr = parseStr.filter(
         (part) =>
            !(typeof part === "object" && "text" in part && part.text === "")
      );

      this.log.trace("Render:", JSON.stringify(object, null, 2));
      // player.sendMessage(JSON.stringify(parseStr)); // Debugging

      //* Pass the information to the JSON UI
      player.onScreenDisplay.setTitle(parseStr, {
         subtitle: parseStrSubtitle,
         fadeInDuration: 0,
         fadeOutDuration: 0,
         stayDuration: TicksPerSecond * 60, // Keep it displayed longer
      });

      // Resetting title timings immediately after setting might prevent it from showing.
      // The original code did this, maybe it relies on UI behavior?
      // Consider removing the immediate reset or delaying it slightly if the title doesn't appear.
      // player.runCommandAsync(`title @s reset`); // Keep for now to match original
   }
}

// Initialize the singleton instance to start the process
WAILA.getInstance();
