import { LookAtObjectTypeEnum } from "./LookAtObjectTypeEnum";

/**
 * Contains metadata about the object a player is looking at, used for UI display.
 */
export interface LookAtObjectMetadata {
   type: LookAtObjectTypeEnum | undefined;
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