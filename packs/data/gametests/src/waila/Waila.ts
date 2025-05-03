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

import { Block, Entity, ItemStack, LocationOutOfWorldBoundariesError, Player, RawMessage, TicksPerSecond, TitleDisplayOptions, system, world } from "@minecraft/server";
import { Logger, LogLevel } from "@bedrock-oss/bedrock-boost";

import nameAliases from "../data/nameAliases.json";

import { LookAtBlock, LookAtEntity, LookAtItemEntity, LookAtObject } from "../types/LookAtObjectInterface";
import { BlockRenderData, EntityRenderData, LookAtObjectMetadata } from "../types/LookAtObjectMetadataInterface";
import { LookAtObjectTypeEnum as LookAtObjectType } from "../types/LookAtObjectTypeEnum";
import { BlockHandler } from "./BlockHandler";
import { EntityHandler } from "./EntityHandler";

class WAILA {
   private static instance: WAILA;
   private readonly log = Logger.getLogger("Waila");
   private readonly MAX_DISTANCE = 8;

   private constructor() {
      Logger.setLevel(LogLevel.Trace);
      system.runInterval(() => this.toAllPlayers(), 3);
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
   private toAllPlayers(): void {
      world.getAllPlayers().forEach((player) => {
         let lookAtObject = this.fetchLookAt(player, this.MAX_DISTANCE);

         //* Reset UI when needed
         if (player.hasTag("r4ui_reset")) {
            if (lookAtObject) lookAtObject.hitIdentifier = "none";
            player.removeTag("r4ui_reset");
         }

         //* Inform UI that there is nothing on the screen the player is looking at
         if (!lookAtObject) return;
         if (lookAtObject.hitIdentifier === undefined) lookAtObject.hitIdentifier = "none";

         //* Render the UI in the screen
         this.displayUI(player, lookAtObject);
      });
   }

   /**
    * Fetches what block or entity the specified player is looking at.
    */
   private fetchLookAt(player: Player, max_dist: number): LookAtObject | null {
      try {
         // First check for entities in view direction (higher priority)
         const entityLookAt = player.getEntitiesFromViewDirection({
            maxDistance: max_dist,
         });
         
         if (entityLookAt.length > 0 && entityLookAt[0]?.entity) {
            const entity = entityLookAt[0].entity;
            const lookAtEntity = EntityHandler.createLookupData(entity);
            lookAtEntity.viewAdditionalProperties = player.isSneaking;
            return lookAtEntity;
         }

         // If no entity was found, check for blocks
         const blockLookAt = player.getBlockFromViewDirection({
            includeLiquidBlocks: !player.isInWater,
            includePassableBlocks: !player.isInWater,
            maxDistance: max_dist,
         });

         if (blockLookAt?.block) {
            const lookAtBlock = BlockHandler.createLookupData(blockLookAt.block);
            lookAtBlock.viewAdditionalProperties = player.isSneaking;
            return lookAtBlock;
         }
         
         // Nothing was found
         return {
            type: undefined,
            hitIdentifier: "none",
            viewAdditionalProperties: player.isSneaking
         };
      } catch (e) {
         if (!(e instanceof LocationOutOfWorldBoundariesError)) {
            this.log.error(`Error in fetchLookAt: ${e}`);
         }
         return {
            type: undefined,
            hitIdentifier: "none",
            viewAdditionalProperties: player.isSneaking
         };
      }
   }

   /**
    * Fetches metadata for the looked-at object.
    */
   private fetchLookAtMetadata(lookAtObject: LookAtObject): LookAtObjectMetadata | null {
      if (!lookAtObject.type || !lookAtObject.hitIdentifier || lookAtObject.hitIdentifier === "none") {
         return null;
      }

      // Extract namespace
      const hitNamespace = lookAtObject.hitIdentifier.includes(":")
         ? lookAtObject.hitIdentifier.substring(0, lookAtObject.hitIdentifier.indexOf(":") + 1)
         : "minecraft:";

      // Prepare display name based on type
      let displayName = lookAtObject.hitIdentifier;
      const nameAliasTypes: { [key: string]: string } = nameAliases;
      
      // Process entity
      if (lookAtObject.type === LookAtObjectType.ENTITY) {
         const entity = (lookAtObject as LookAtEntity).entity;
         
         // Get entity-specific render data
         const entityRenderData = EntityHandler.createRenderData(
            entity, 
            entity.typeId === "minecraft:player"
         );

         let itemEntity: LookAtItemEntity | undefined;
         
         // Handle special entity types
         if (entity.typeId === "minecraft:player" && entity instanceof Player) {
            displayName = `__r4ui:player.${entity.name}`;
         } else if (entity.typeId === "minecraft:item") {
            itemEntity = lookAtObject as LookAtItemEntity;
            const itemStack = itemEntity.itemStack;
            
            if (itemStack) {
               entityRenderData.hitItem = itemStack.typeId;
               displayName = "entity.minecraft:item.name";
            }
         } else if (hitNamespace === "minecraft:") {
            displayName = `entity.${lookAtObject.hitIdentifier}.name`;
         }
         
         return {
            type: lookAtObject.type,
            hit: displayName,
            namespace: hitNamespace,
            itemAux: itemEntity?.itemStack 
               ? BlockHandler.getItemAux(itemEntity.itemStack.typeId) 
               : NaN,
            displayName,
            renderData: entityRenderData
         };
      }
      
      // Process block
      if (lookAtObject.type === LookAtObjectType.TILE) {
         const block = (lookAtObject as LookAtBlock).block;
         const blockId = lookAtObject.hitIdentifier;
         
         // Get item auxiliary ID for texture lookup
         const itemAux = BlockHandler.getItemAux(blockId);
         
         // Get block-specific render data
         const blockRenderData = BlockHandler.createRenderData(block, blockId);
         
         // Format display name with proper namespace
         if (hitNamespace === "minecraft:") {
            const nameAlias = nameAliasTypes[blockId.replace(hitNamespace, "")];
            displayName = `${nameAlias?.startsWith("item.") ? "" : "tile."}${
               !nameAlias ? blockId.replace(hitNamespace, "") : nameAlias
            }.name`;
         } else {
            displayName = `${lookAtObject.type}.${blockId}.name`;
         }
         
         return {
            type: lookAtObject.type,
            hit: displayName,
            namespace: hitNamespace,
            itemAux,
            displayName,
            renderData: blockRenderData
         };
      }
      
      return null;
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
      player.onScreenDisplay.setTitle(" ", options);

      try {
         player.runCommandAsync(`title @s reset`);
      } catch (e) {
         this.log.warn(`Failed to run title reset command for ${player.name}: ${e}`);
      }
   }

   /**
    * Handles final string parse and sends a request to the UI.
    */
   private displayUI(player: Player, lookAtObject: LookAtObject): void {
      if (!lookAtObject.hitIdentifier || lookAtObject.hitIdentifier === "none") {
         this.clearUI(player);
         return;
      }

      // Create comparison data to see if UI needs updating
      const comparisonData = this.createComparisonData(lookAtObject);
      const oldLog = player.getDynamicProperty("r4isen1920_waila:old_log") as string | undefined;
      
      if (oldLog === comparisonData) return;
      player.setDynamicProperty("r4isen1920_waila:old_log", comparisonData);

      const metadata = this.fetchLookAtMetadata(lookAtObject);
      if (!metadata) {
         this.log.warn(`Failed to fetch metadata for ${lookAtObject.hitIdentifier}, clearing UI.`);
         this.clearUI(player);
         return;
      }

      // Generate UI components
      const { title, subtitle } = this.generateUIComponents(player, metadata);
      
      this.log.trace("Render:", JSON.stringify(metadata, null, 2));

      // Display the UI
      player.onScreenDisplay.setTitle(title, {
         subtitle: subtitle,
         fadeInDuration: 0,
         fadeOutDuration: 0,
         stayDuration: TicksPerSecond * 60,
      });
   }
   
   /**
    * Creates a comparison string to determine if UI needs updating
    */
   private createComparisonData(lookAtObject: LookAtObject): string {
      const baseData: any = {
         hit: lookAtObject.hitIdentifier,
         sneaking: lookAtObject.viewAdditionalProperties
      };
      
      if (lookAtObject.type === LookAtObjectType.ENTITY) {
         const entityData = lookAtObject as LookAtEntity;
         Object.assign(baseData, {
            hp: entityData.hp,
            maxHp: entityData.maxHp,
            effects: entityData.effectsData?.map(e => `${e.id}:${e.amplifier}`).join(",") || ""
         });
      } else if (lookAtObject.type === LookAtObjectType.TILE && (lookAtObject as LookAtBlock).block) {
         const blockData = lookAtObject as LookAtBlock;
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
      // Set up subtitle (entity ID or empty)
      const parseStrSubtitle: RawMessage[] = metadata.type === LookAtObjectType.ENTITY 
         ? [{ text: (metadata.renderData as EntityRenderData).entityId || "" }]
         : [{ text: "" }];
         
      // Create icon mappings
      const iconTypes = this.getIconTypes();
      
      // Determine if we're dealing with an item entity or a block/tile
      const isTileOrItemEntity = metadata.type === LookAtObjectType.TILE || 
         (metadata.type === LookAtObjectType.ENTITY && 'hitItem' in metadata.renderData);
      
      // Determine prefix type for UI format
      const prefixType = isTileOrItemEntity ? "A" : "B";
      
      // Get icons or health/armor display
      let iconOrHealthArmor = "";
      let finalTagIcons = "";
      let effectsStr = "";
      
      if (isTileOrItemEntity) {
         // For blocks or item entities, show item aux ID
         iconOrHealthArmor = `${metadata.itemAux >= 0 ? "" : "-"}${String(
            Math.abs(metadata.itemAux)
         ).padStart(metadata.itemAux >= 0 ? 9 : 8, "0")}`;
         
         // For blocks, show tool icons
         if (metadata.type === LookAtObjectType.TILE) {
            const blockData = metadata.renderData as BlockRenderData;
            finalTagIcons = `:${iconTypes.tile[blockData.tool[0] || "undefined"] || "z"};${
               iconTypes.tile[blockData.tool[1] || "undefined"] || "z"
            }:`;
         } else {
            // For item entities, use undefined tool icons
            finalTagIcons = `:z;z:`;
         }
      } else {
         // For entities (non-items), show health and armor
         const entityData = metadata.renderData as EntityRenderData;
         iconOrHealthArmor = `${entityData.healthRenderer}${entityData.armorRenderer}`;
         
         // Show entity tag icons
         finalTagIcons = `:${iconTypes.entity[entityData.tags[0] || "undefined"] || "z"};${
            iconTypes.entity[entityData.tags[1] || "undefined"] || "z"
         }:`;
         
         // For entities with effects, add effect string
         effectsStr = `${entityData.effectsRenderer.effectString}e${
            entityData.effectsRenderer.effectsResolvedArray.length.toString().padStart(2, "0")
         }`;
      }
      
      // Determine translated or text name
      const nameElement: RawMessage = 
         metadata.hit.startsWith("__r4ui:player.") 
            ? { text: metadata.hit.replace("__r4ui:player.", "") }
            : { translate: metadata.hit };
            
      // Determine block states text (only shown when sneaking)
      const blockStatesText = metadata.type === LookAtObjectType.TILE && player.isSneaking 
         ? (metadata.renderData as BlockRenderData).blockStates 
         : "";
         
      // Show item entity's item type
      const itemEntityText = metadata.type === LookAtObjectType.ENTITY && 
         'hitItem' in metadata.renderData && metadata.renderData.hitItem
         ? `\n§7${metadata.renderData.hitItem}§r` 
         : "";
         
      // Format health text for entities
      let healthText = "";
      let paddingNewlines = "";
      
      if (metadata.type === LookAtObjectType.ENTITY) {
         const entityData = metadata.renderData as EntityRenderData;
         
         // Handle integer health display
         if (entityData.maxHp > 0 && entityData.intHealthDisplay) {
            const percentage = Math.round((entityData.hp / entityData.maxHp) * 100);
            const hpDisplay = entityData.maxHp < 1000000
               ? `${entityData.hp}/${entityData.maxHp} (${percentage}%)`
               : "∞";
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
         } else if (entityData.maxHp > 20 && entityData.intHealthDisplay) {
            paddingNewlines += "\n";
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
      
      // Format namespace
      const formattedNamespace = metadata.namespace.length > 3
         ? metadata.namespace.replace(/_/g, " ").replace(":", "").toTitle().abrevCaps()
         : metadata.namespace.replace(":", "").toUpperCase();
      const namespaceText = `§9§o${formattedNamespace}§r`;
      
      // Build the complete title
      const parseStr: RawMessage[] = [
         { text: `_r4ui:${prefixType}:` },
         { text: iconOrHealthArmor },
         { text: finalTagIcons },
         { text: effectsStr },
         nameElement,
         { text: blockStatesText },
         { text: itemEntityText },
         { text: healthText },
         { text: paddingNewlines },
         { text: `\n${namespaceText}` },
      ];
      
      // Filter out empty text elements
      const filteredTitle = parseStr.filter(
         part => !(typeof part === "object" && "text" in part && part.text === "")
      );
      
      return { title: filteredTitle, subtitle: parseStrSubtitle };
   }
   
   /**
    * Gets icon mapping for UI display
    */
   private getIconTypes(): { tile: Record<string, string>, entity: Record<string, string> } {
      return {
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
         }
      };
   }
}

// Initialize the singleton instance to start the process
WAILA.getInstance();
