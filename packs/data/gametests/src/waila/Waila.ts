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

import { LocationOutOfWorldBoundariesError, Player, RawMessage, TicksPerSecond, TitleDisplayOptions, system, world } from "@minecraft/server";
import { Logger, LogLevel } from "@bedrock-oss/bedrock-boost";

import nameAliases from "../data/nameAliases.json";
import namespaces from "../data/namespaces.json";

import { LookAtBlock, LookAtEntity, LookAtItemEntity, LookAtObject } from "../types/LookAtObjectInterface";
import { BlockRenderData, EntityRenderData, LookAtObjectMetadata } from "../types/LookAtObjectMetadataInterface";
import { LookAtObjectTypeEnum as LookAtObjectType } from "../types/LookAtObjectTypeEnum";
import { BlockHandler } from "./BlockHandler";
import { EntityHandler } from "./EntityHandler";
import Namespace from "../types/NamespaceInterface";

class WAILA {
   private static instance: WAILA;
   private readonly log = Logger.getLogger("Waila");
   private readonly MAX_DISTANCE = 8;
   private playerPreviousLookState: Map<string, boolean> = new Map();

   private constructor() {
      Logger.setLevel(LogLevel.Trace);
      system.runInterval(() => this.toAllPlayers());
      this.log.info("WAILA loaded and running.");
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
         const lookAtObject = this.fetchLookAt(player, this.MAX_DISTANCE);

         if (lookAtObject.hitIdentifier === undefined) {
            lookAtObject.hitIdentifier = "none";
            player.setDynamicProperty("r4isen1920_waila:old_log", undefined);
         }

         this.displayUI(player, lookAtObject);
      });
   }

   /**
    * Fetches what block or entity the specified player is looking at.
    */
   private fetchLookAt(player: Player, max_dist: number): LookAtObject {
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

      const hitNamespace = lookAtObject.hitIdentifier.includes(":")
         ? lookAtObject.hitIdentifier.substring(0, lookAtObject.hitIdentifier.indexOf(":") + 1)
         : "minecraft:";

      let resultDisplayName: string = lookAtObject.hitIdentifier;
      let nameTagContextTranslationKey_local: string | undefined = undefined;
      let itemContextIdentifier_local: string | undefined = undefined;
      let resolvedIcon: string | number = NaN;
      
      const nameAliasTypes: { [key: string]: string } = nameAliases;
      
      if (lookAtObject.type === LookAtObjectType.ENTITY) {
         const entity = (lookAtObject as LookAtEntity).entity;
         const entityNameTag = entity.nameTag;
         const entityTypeId = entity.typeId; // This is the lookAtObject.hitIdentifier for entities
         const cleanEntityTypeId = entityTypeId.replace(/minecraft:/gm, '');

         const entityRenderData = EntityHandler.createRenderData(
            entity, 
            entityTypeId === "minecraft:player"
         );

         const humanoidLikeEntities = [
            "minecraft:player"
         ];

         if (entityNameTag && entityNameTag.length > 0) {
            resultDisplayName = entityNameTag;
            nameTagContextTranslationKey_local = `entity.${cleanEntityTypeId}.name`;
         } else {
            if (humanoidLikeEntities.includes(entityTypeId)) {
               if (entityTypeId === "minecraft:player" && entity instanceof Player) {
                  resultDisplayName = `__r4ui:humanoid.${entity.name}`;
               } else {
                  // For non-player humanoids without a nameTag
                  resultDisplayName = "__r4ui:humanoid_translate_type";
               }
            } else if (entityTypeId === "minecraft:item") {
               resultDisplayName = "entity.item.name";
               const itemEntity = lookAtObject as LookAtItemEntity;
               const itemStack = itemEntity.itemStack;
               if (itemStack) {
                  itemContextIdentifier_local = itemStack.typeId;
                  resolvedIcon = BlockHandler.resolveIcon(itemStack.typeId);
               }
            } else if (entityTypeId === "minecraft:npc") {
               resultDisplayName = 'npcscreen.npc';
            } else if (hitNamespace === "minecraft:") {
               resultDisplayName = `entity.${cleanEntityTypeId}.name`;
            } else {
               resultDisplayName = lookAtObject.hitIdentifier; // Full ID for unknown custom entities
            }
         }

         return {
            type: lookAtObject.type,
            hitIdentifier: entityTypeId,
            namespace: hitNamespace,
            icon: resolvedIcon, // NaN for non-item entities, aux value for item entities
            displayName: resultDisplayName,
            renderData: entityRenderData,
            ...(nameTagContextTranslationKey_local && { nameTagContextTranslationKey: nameTagContextTranslationKey_local }),
            ...(itemContextIdentifier_local && { itemContextIdentifier: itemContextIdentifier_local })
         };
      }
      
      if (lookAtObject.type === LookAtObjectType.TILE) {
         const block = (lookAtObject as LookAtBlock).block;
         const blockId = lookAtObject.hitIdentifier;
         
         resolvedIcon = BlockHandler.resolveIcon(blockId);
         const blockRenderData = BlockHandler.createRenderData(block, blockId);
         
         if (hitNamespace === "minecraft:") {
            const nameAlias = nameAliasTypes[blockId.replace(hitNamespace, "")];
            resultDisplayName = `${nameAlias?.startsWith("item.") ? "" : "tile."}${
               !nameAlias ? blockId.replace(hitNamespace, "") : nameAlias
            }.name`;
         } else {
            resultDisplayName = `${lookAtObject.type}.${blockId}.name`;
         }
         
         return {
            type: lookAtObject.type,
            hitIdentifier: blockId,
            namespace: hitNamespace,
            icon: resolvedIcon,
            displayName: resultDisplayName,
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
         player.runCommand(`title @s reset`);
      } catch (e) {
         this.log.warn(`Failed to run title reset command for ${player.name}: ${e}`);
      }

      player.setDynamicProperty("r4isen1920_waila:old_log", undefined);
   }

   /**
    * Handles final string parse and sends a request to the UI.
    */
   private displayUI(player: Player, lookAtObject: LookAtObject): void {
      const hasTarget = lookAtObject.hitIdentifier !== "none";
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

      const metadata = this.fetchLookAtMetadata(lookAtObject);
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
            armor: EntityHandler.armorRenderer(entityData.entity),
            effects: entityData.effectsData?.map(e => `${e.id}:${e.amplifier}:${e.duration}`).join(",") || ""
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
      // Set up subtitle
      // Show entityId in subtitle only if it's not an item entity (item entities use main icon)
      // For blocks/item entities, subtitle can show texture path if icon is a string (custom), or empty if icon is number (handled by font)
      const parseStrSubtitle: RawMessage[] = 
         (metadata.type === LookAtObjectType.ENTITY && !metadata.itemContextIdentifier) ?
            [{ text: (metadata.renderData as EntityRenderData).entityId || "" }] :
            [{ text: typeof metadata.icon === "string" && metadata.icon.startsWith('textures/') ? metadata.icon : "" }];
         
      const iconTypes = this.getIconTypes();
      
      const isTileOrItemEntity = metadata.type === LookAtObjectType.TILE || 
         (metadata.type === LookAtObjectType.ENTITY && !!metadata.itemContextIdentifier);
      
      const prefixType = isTileOrItemEntity ? "A" : "B";
      
      let iconOrHealthArmor = "";
      let finalTagIcons = "";
      let effectsStr = "";
      
      if (isTileOrItemEntity) {
         // metadata.icon is already the resolved aux value for both blocks and items in itemEntities
         iconOrHealthArmor = typeof metadata.icon === 'number' ?
            `${metadata.icon >= 0 ? "" : "-"}${String(Math.abs(metadata.icon)).padStart(metadata.icon >= 0 ? 9 : 8, "0")}` :
            "000000000"; // Should not happen if logic is correct, but fallback

         if (metadata.type === LookAtObjectType.TILE) {
            const blockData = metadata.renderData as BlockRenderData;
            finalTagIcons = `:${iconTypes.tile[blockData.tool[0] || "undefined"] || "z"};${
               iconTypes.tile[blockData.tool[1] || "undefined"] || "z"
            }:`;
         } else { // Item Entity
            finalTagIcons = `:z;z:`; // Item entities don't have specific "tool" icons in this context
         }
      } else { // Non-item Entities
         const entityData = metadata.renderData as EntityRenderData;
         iconOrHealthArmor = `${entityData.healthRenderer}${entityData.armorRenderer}`;
         
         finalTagIcons = `:${iconTypes.entity[entityData.tags[0] || "undefined"] || "z"};${
            iconTypes.entity[entityData.tags[1] || "undefined"] || "z"
         }:`;
         
         effectsStr = `${entityData.effectsRenderer.effectString}e${
            entityData.effectsRenderer.effectsResolvedArray.length.toString().padStart(2, "0")
         }`;
      }
      
      const nameElements: RawMessage[] = [];
      if (metadata.nameTagContextTranslationKey) {
         // Entity with nameTag: {nameTag} (entity.type.name)
         nameElements.push({ text: `${metadata.displayName} §7(` }); // metadata.displayName is the nameTag
         nameElements.push({ translate: metadata.nameTagContextTranslationKey });
         nameElements.push({ text: ")§r" });
      } else if (metadata.displayName === "__r4ui:humanoid_translate_type") {
         // Non-player humanoid without nameTag: "__r4ui:humanoid." + translate<entity_type>
         nameElements.push({ text: "__r4ui:humanoid." });
         const cleanHitIdentifier = metadata.hitIdentifier.replace(/minecraft:/gm, '');
         nameElements.push({ translate: `entity.${cleanHitIdentifier}.name` });
      } else if (metadata.displayName.startsWith("__r4ui:humanoid.")) {
         // Player without nameTag: "__r4ui:humanoid.PlayerName"
         nameElements.push({ text: metadata.displayName });
      } else {
         nameElements.push({ translate: metadata.displayName }); // Standard translation key or 'entity.item.name'
      }
      nameElements.push({ text: "§r" });

      const blockStatesText = metadata.type === LookAtObjectType.TILE && player.isSneaking 
         ? (metadata.renderData as BlockRenderData).blockStates 
         : "";
         
      // Show item entity's specific item type ID (e.g., minecraft:diamond_sword)
      const itemEntityText = metadata.type === LookAtObjectType.ENTITY && metadata.itemContextIdentifier
         ? `\n§7${metadata.itemContextIdentifier}§r` 
         : "";
         
      // Format health text for entities
      let healthText = "";
      let paddingNewlines = "";
      
      if (metadata.type === LookAtObjectType.ENTITY) {
         const entityData = metadata.renderData as EntityRenderData;
         
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

      const namespacesType = namespaces as Record<string, Namespace>;
      const namespaceKey = Object.keys(namespacesType).find(ns => metadata.namespace.startsWith(ns));
      const namespaceText = 
         namespaceKey ? namespacesType[namespaceKey].display_name : 
         metadata.namespace.length > 3 ?
            metadata.namespace.replace(/_/g, " ").replace(":", "").toTitle().abrevCaps() :
            metadata.namespace.replace(":", "").toUpperCase();

      // Build the complete title
      const parseStr: RawMessage[] = [
         { text: `_r4ui:${prefixType}:` },
         { text: iconOrHealthArmor },
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
