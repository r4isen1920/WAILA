import { Effect, Entity, EntityComponentTypes, EntityEquippableComponent, EntityHealthComponent, EntityItemComponent, EquipmentSlot, Player, TicksPerSecond } from "@minecraft/server";
import { LookAtEntity, LookAtItemEntity } from "../types/LookAtObjectInterface";
import { EffectsRenderer, EntityRenderData } from "../types/LookAtObjectMetadataInterface";
import { LookAtObjectTypeEnum } from "../types/LookAtObjectTypeEnum";

import armor from "../data/armor.json";
import entityInteractions from "../data/entityInteractions.json";
import ignoredEntityRender from "../data/ignoredEntityRender.json";



/**
 * Handles entity-specific operations for WAILA
 */
export class EntityHandler {
   /**
    * Creates lookup data for an entity
    */
   static createLookupData(entity: Entity): LookAtEntity {
      const healthComponent = entity.getComponent(EntityComponentTypes.Health) as EntityHealthComponent | undefined;

      const lookupData: LookAtEntity = {
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
         const itemData = lookupData as LookAtItemEntity;

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
    * Fetches entity tags based on components and interactions
    */
   static getEntityTags(entity: Entity): string[] {
      let entityTags: string[] = [];
      const typeId = entity.typeId;
      const namespaceRemoved = typeId.replace(/(?<=:).+/g, "");

      // Get tags from entityInteractions.json
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

      // Helper to safely get component values
      const getComponentValue = <T>(ent: Entity, componentName: string): T | undefined => {
         try {
            return ent.getComponent(componentName) as T | undefined;
         } catch {
            return undefined;
         }
      };

      // Check for entity components
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
            const tagName = componentId.replace("minecraft:", "");

            // Handle special cases
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
   static effectsRenderer(entity: Entity): EffectsRenderer {
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
   static createRenderData(entity: Entity, isPlayer: boolean): EntityRenderData {
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
         tags: this.getEntityTags(entity),
         hp: currentHp,
         maxHp: maxHp,
         intHealthDisplay: intHealthDisplay,
         healthRenderer: healthRenderer,
         armorRenderer: this.armorRenderer(entity),
         effectsRenderer: this.effectsRenderer(entity),
      };
   }
}
