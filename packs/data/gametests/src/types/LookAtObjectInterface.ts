import { Block, Effect, Entity } from "@minecraft/server";
import { LookAtObjectTypeEnum } from "./LookAtObjectTypeEnum";

/**
 * Represents the object a player is currently looking at in the game.
 */
export interface LookAtObject {
   type: LookAtObjectTypeEnum | undefined;
   rawHit: Entity | Block | undefined;
   hit: string | undefined;
   hp?: number | string; // Can be string '0' initially
   maxHp?: number | string; // Can be string '0' initially
   effects?: | { id: string; amplifier: number; effectDuration?: number }[] | Effect[];
   isPlayerSneaking: boolean;
}