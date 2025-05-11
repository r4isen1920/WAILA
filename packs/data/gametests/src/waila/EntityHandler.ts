import { Effect, Entity, EntityComponentTypes, EntityEquippableComponent, EntityHealthComponent, EntityItemComponent, EquipmentSlot, Player, TicksPerSecond } from "@minecraft/server";
import { LookAtEntityInterface, LookAtItemEntityInterface } from "../types/LookAtObjectInterface";
import { EffectsRendererType, EntityRenderDataInterface } from "../types/LookAtObjectMetadataInterface";
import { LookAtObjectTypeEnum } from "../types/LookAtObjectTypeEnum";
import { EntityInteractionsEnum, TagRemarksEnum } from "../types/TagsEnum";
import TagsInterface from "../types/TagsInterface";

import armor from "../data/armor.json";
import entityInteractionsData from "../data/entityInteractions.json";
import ignoredEntityRender from "../data/ignoredEntityRender.json";

//#region Entity
/**
 * Handles entity-specific operations for WAILA
 */
export class EntityHandler {
   /**
    * Helper function to check if a single value matches a condition rule.
    * Mirrors the logic used for TagsInterface.target matching.
    */
   private static checkRemarkConditionRule(value: string | undefined, rule: string): boolean {
      if (value === undefined) return false;

      const valueNamePart = value.includes(':') ? value.split(':')[1] : value;
      const isNegatedRule = rule.startsWith("!");
      const actualRule = isNegatedRule ? rule.substring(1) : rule;

      let positiveMatchFound = false;

      // Case 1: Rule is an exact match for the full value string (e.g., rule="minecraft:stone", value="minecraft:stone")
      if (actualRule === value) {
         positiveMatchFound = true;
      }
      // Case 2: Rule is namespace-less and is an exact match for the name part of the value (e.g., rule="stone", value="minecraft:stone")
      else if (!actualRule.includes(':') && actualRule === valueNamePart) {
         positiveMatchFound = true;
      }
      // Case 3: Rule is namespace-less and the full value string includes the rule (e.g., rule="pickaxe", value="minecraft:diamond_pickaxe")
      else if (!actualRule.includes(':') && value.includes(actualRule)) {
         positiveMatchFound = true;
      }
      // Case 4: Rule is namespace-less and the name part of the value includes the rule (e.g., rule="axe", value="minecraft:diamond_pickaxe" -> namePart "diamond_pickaxe")
      // This also covers cases where value itself is namespace-less and includes the rule.
      else if (!actualRule.includes(':') && valueNamePart.includes(actualRule)) {
         positiveMatchFound = true;
      }

      return isNegatedRule ? !positiveMatchFound : positiveMatchFound;
   }

   /**
    * Creates lookup data for an entity
    */
   static createLookupData(entity: Entity): LookAtEntityInterface {
      const healthComponent = entity.getComponent(EntityComponentTypes.Health) as EntityHealthComponent | undefined;

      const lookupData: LookAtEntityInterface = {
         type: LookAtObjectTypeEnum.ENTITY,
         hitIdentifier: entity.typeId,
         entity: entity,
         viewAdditionalProperties: false,
         hp: healthComponent?.currentValue ?? 0,
         maxHp: healthComponent?.effectiveMax ?? 0,
      };

      try {
         lookupData.effectsData = entity.getEffects()
            .filter(effect => effect.duration !== -1 && effect.amplifier !== -1)
            .map(effect => ({
               id: effect.typeId,
               amplifier: effect.amplifier,
               duration: Math.floor(effect.duration / TicksPerSecond),
            }));
      } catch {
         lookupData.effectsData = [];
      }

      // Handle item entities
      if (entity.typeId === "minecraft:item") {
         const itemComponent = entity.getComponent(EntityComponentTypes.Item) as EntityItemComponent | undefined;
         const itemData = lookupData as LookAtItemEntityInterface;

         if (itemComponent?.itemStack) {
            itemData.itemStack = itemComponent.itemStack;
         }
      }

      return lookupData;
   }

   /**
    * Transforms entity ID into a displayable format
    */
   static transformEntityId(entity: Entity): string {
      const entityId = entity.id ?? "0000000000000";
      if (ignoredEntityRender.some((id) => entity.typeId.includes(id))) {
         return "0000000000000";
      }

      const numericId = BigInt(entityId);
      return `${numericId < 0n ? "-" : ""}${String(numericId < 0n ? -numericId : numericId).padStart(12, "0")}`;
   }

   /**
    * Fetches entity tags based on components and interactions and returns a formatted icon string.
    */
   static getEntityTagIcons(entity: Entity, player: Player): string {
      const typeId = entity.typeId;
      const namespaceRemoved = typeId.replace(/:.*/, "");

      const interactionTagDefinitions: Map<string, TagsInterface> = new Map();
      entityInteractionsData.filter(tagDef => {
         const typedTag = tagDef as TagsInterface;
         const positiveMatch =
            typedTag.target.some(item => item === typeId || item === namespaceRemoved) ||
            typedTag.target.some(item => !item.startsWith("!") && typeId.includes(item)) ||
            typedTag.target.some(item => !item.startsWith("!") && namespaceRemoved.includes(item));
         if (!positiveMatch) return false;

         const negativeMatch = typedTag.target.some(
            item => item.startsWith("!") &&
            (item.substring(1) === typeId ||
             item.substring(1) === namespaceRemoved ||
             typeId.includes(item.substring(1)) ||
             namespaceRemoved.includes(item.substring(1)))
         );
         return !negativeMatch;
      }).forEach(tagDef => {
         const typedTag = tagDef as TagsInterface;
         interactionTagDefinitions.set(typedTag.name.toUpperCase(), typedTag);
      });

      const componentDerivedTagNames: string[] = [];
      const getComponentValue = <T>(ent: Entity, componentName: string): T | undefined => {
         try {
            return ent.getComponent(componentName) as T | undefined;
         } catch {
            return undefined;
         }
      };

      const componentList = [
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
         if (getComponentValue(entity, componentId)) {
            const tagName = componentId.replace("minecraft:", "").toUpperCase();
            componentDerivedTagNames.push(tagName);
         }
      });

      const allPotentialTagNames = new Set([...interactionTagDefinitions.keys(), ...componentDerivedTagNames]);

      if (allPotentialTagNames.has("IS_BABY")) {
         allPotentialTagNames.delete("IS_RIDEABLE");
      }
      if (allPotentialTagNames.has("IS_TAMED")) {
         allPotentialTagNames.delete("TAMEABLE");
      }
      
      const orderedFinalTagNames: string[] = [];
      for (const name of interactionTagDefinitions.keys()) {
          if (allPotentialTagNames.has(name) && orderedFinalTagNames.length < 2 && !orderedFinalTagNames.includes(name)) {
              orderedFinalTagNames.push(name);
          }
      }
      for (const name of componentDerivedTagNames) {
          if (allPotentialTagNames.has(name) && orderedFinalTagNames.length < 2 && !orderedFinalTagNames.includes(name)) {
              orderedFinalTagNames.push(name);
          }
      }
      const finalTagNamesForProcessing = orderedFinalTagNames.slice(0, 2);

      // 4. Get player's mainhand item tags and typeId for remark checking
      let playerMainHandItemTags: string[] = [];
      let playerMainHandItemTypeId: string | undefined = undefined;
      try {
         const equipComponent = player.getComponent(EntityComponentTypes.Equippable) as EntityEquippableComponent | undefined;
         const mainHandItem = equipComponent?.getEquipment(EquipmentSlot.Mainhand);
         if (mainHandItem) {
            playerMainHandItemTags = mainHandItem.getTags();
            playerMainHandItemTypeId = mainHandItem.typeId;
         }
      } catch {
         // Error getting item or tags, proceed with empty tags/undefined typeId
      }

      // 5. Process the final selected tags for icon and remarks
      const processedTagsOutput: { id: string; remark: string }[] = [];
      for (const tagName of finalTagNamesForProcessing) {
         const iconId = EntityInteractionsEnum[tagName as keyof typeof EntityInteractionsEnum] || EntityInteractionsEnum.UNDEFINED;
         let remarkIcon = TagRemarksEnum.UNDEFINED; 
         
         const tagDefinitionForRemarks = interactionTagDefinitions.get(tagName);

         if (tagDefinitionForRemarks?.remarks) {
            for (const jsonRemarkKey in tagDefinitionForRemarks.remarks) {
               const enumKeyCandidate = jsonRemarkKey.toUpperCase();

               if (enumKeyCandidate in TagRemarksEnum) {
                  const remarkEnumValue = TagRemarksEnum[enumKeyCandidate as keyof typeof TagRemarksEnum];
                  const conditions = tagDefinitionForRemarks.remarks[jsonRemarkKey as keyof typeof tagDefinitionForRemarks.remarks]!;
                  let conditionMet = false;

                  // Check itemIds condition against the player's mainhand item typeId
                  if (conditions.itemIds) {
                     conditionMet = conditions.itemIds.some(idRule => EntityHandler.checkRemarkConditionRule(playerMainHandItemTypeId, idRule));
                  }

                  // Check tags condition (player's held item) if itemIds condition not met
                  if (!conditionMet && conditions.tags) {
                     conditionMet = conditions.tags.some(tagRule => playerMainHandItemTags.some(heldItemTag => EntityHandler.checkRemarkConditionRule(heldItemTag, tagRule)));
                  }

                  if (conditionMet) {
                     remarkIcon = remarkEnumValue; 
                     break; 
                  }
               }
            }
         }
         processedTagsOutput.push({ id: iconId, remark: remarkIcon });
      }

      // Ensure two tags for formatting, using defaults if necessary
      const tag1 = processedTagsOutput[0] || { id: EntityInteractionsEnum.UNDEFINED, remark: TagRemarksEnum.UNDEFINED }; // Corrected default id
      const tag2 = processedTagsOutput[1] || { id: EntityInteractionsEnum.UNDEFINED, remark: TagRemarksEnum.UNDEFINED }; // Corrected default id

      return `:${tag1.id},${tag1.remark};${tag2.id},${tag2.remark}:`;
   }

   /**
    * Creates health renderer string based on current and max health
    */
   static healthRenderer(currentHealth: number, maxHealth: number, MAX_LENGTH: number = 40): string {
      let displayCurrent = currentHealth;
      let displayMax = maxHealth;

      if (displayMax > MAX_LENGTH) {
         displayCurrent = Math.round((displayCurrent / displayMax) * MAX_LENGTH);
         displayMax = MAX_LENGTH;
      }

      const healthIcons = { empty: "a", half: "b", full: "c", padding: "y" };
      const MAX_HEARTS_DISPLAY = Math.ceil(displayMax / 2);

      displayCurrent = Math.max(0, displayCurrent);

      const fullHearts = Math.floor(displayCurrent / 2);
      const halfHearts = displayCurrent % 2;
      const emptyHearts = Math.max(0, MAX_HEARTS_DISPLAY - fullHearts - halfHearts);

      let healthString =
         healthIcons.full.repeat(fullHearts) +
         healthIcons.half.repeat(halfHearts) +
         healthIcons.empty.repeat(emptyHearts);

      const paddingNeeded = 20 - healthString.length;
      if (paddingNeeded > 0) {
         healthString += healthIcons.padding.repeat(paddingNeeded);
      } else if (paddingNeeded < 0) {
         healthString = healthString.substring(0, 20);
      }

      return healthString || "yyyyyyyyyyyyyyyyyyyy";
   }

   /**
    * Renders armor for a player or entity
    */
   static armorRenderer(entity: Player | Entity): string {
      const equipComponent = entity.getComponent(EntityComponentTypes.Equippable) as EntityEquippableComponent | undefined;
      if (!equipComponent) return "dddddddddd";

      const armorTypes: { [key: string]: number } = armor;
      const currentArmor = [
         EquipmentSlot.Head,
         EquipmentSlot.Chest,
         EquipmentSlot.Legs,
         EquipmentSlot.Feet,
      ].reduce((total, slot) => {
         const item = equipComponent.getEquipment(slot);
         return total + (armorTypes[item?.typeId ?? ""] || 0);
      }, 0);

      const maxArmor = 20;
      const armorIcons = { empty: "d", half: "e", full: "f" };

      const MAX_ARMOR_DISPLAY = Math.ceil(maxArmor / 2);
      const fullArmor = Math.floor(currentArmor / 2);
      const halfArmor = currentArmor % 2;
      const emptyArmor = Math.max(0, MAX_ARMOR_DISPLAY - fullArmor - halfArmor);

      let armorString =
         armorIcons.full.repeat(fullArmor) +
         armorIcons.half.repeat(halfArmor) +
         armorIcons.empty.repeat(emptyArmor);

      const paddingNeeded = 10 - armorString.length;
      if (paddingNeeded > 0) {
         armorString += armorIcons.empty.repeat(paddingNeeded);
      } else if (paddingNeeded < 0) {
         armorString = armorString.substring(0, 10);
      }

      return armorString || "dddddddddd";
   }

   /**
    * Renders entity effects into a formatted string
    */
   static effectsRenderer(entity: Entity): EffectsRendererType {
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
      const effectsResolvedArray: string[] = [];

      for (const effectInfo of effectList) {
         let effectData: Effect | undefined;
         try {
            effectData = entity.getEffect(effectInfo.name);
         } catch {
            effectData = undefined;
         }

         if (effectData?.duration === -1 || effectData?.amplifier === -1) {
            effectData = undefined;
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
         const effectDurationMinutes = Math.min(99, Math.floor(effectDuration / 60));
         const effectDurationSeconds = Math.floor(effectDuration % 60);
         const effectCombinedDurationStr =
            `${effectDurationMinutes.toString().padStart(2, "0")}:${effectDurationSeconds.toString().padStart(2, "0")}`;

         effectString +=
            `d${effectCombinedDurationStr}` +
            `p${effectAmplifier.toString().padStart(1, "0")}`;
      }

      return { effectString, effectsResolvedArray };
   }

   /**
    * Creates entity render data for UI display
    */
   static createRenderData(entity: Entity, player: Player, isPlayer: boolean): EntityRenderDataInterface {
      const healthComponent = entity.getComponent(EntityComponentTypes.Health) as EntityHealthComponent | undefined;
      const currentHp = Math.floor(healthComponent?.currentValue ?? 0);
      const maxHp = Math.floor(healthComponent?.effectiveMax ?? 0);

      // Determine if we should display integer health
      const intHealthDisplay =
         entity.matches({ families: ["inanimate"] }) ||
         (maxHp > 40 && !entity.matches({ type: "minecraft:player" }));

      // Get health renderer string
      let healthRenderer: string;
      if (!intHealthDisplay) {
         healthRenderer = this.healthRenderer(
            currentHp,
            maxHp,
            isPlayer ? 20 : 40
         );
      } else if (maxHp > 40 && !isPlayer) {
         healthRenderer = "xyyyyyyyyyyyyyyyyyyy"; // Special case for high HP non-players
      } else {
         healthRenderer = "yyyyyyyyyyyyyyyyyyyy"; // Default padding
      }

      return {
         entityId: this.transformEntityId(entity),
         tagIcons: this.getEntityTagIcons(entity, player),
         hp: currentHp,
         maxHp: maxHp,
         intHealthDisplay: intHealthDisplay,
         healthRenderer: healthRenderer,
         armorRenderer: this.armorRenderer(entity),
         effectsRenderer: this.effectsRenderer(entity),
      };
   }
}
