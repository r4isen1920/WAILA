import { Block, Entity, ItemStack } from "@minecraft/server";
import { LookAtObjectTypeEnum } from "./LookAtObjectTypeEnum";



//#region Base
/**
 * Represents the objects that can be looked at in the game.
 */
export interface LookAtObjectInterface {
   /**
    * The type of the object being looked at. Otherwise undefined.
    */
   type: LookAtObjectTypeEnum | undefined;
   /**
    * The type identifier of the object being looked at.
    */
   hitIdentifier: string;
   /**
    * Whether or not additional properties should be displayed for this object.
    */
   viewAdditionalProperties?: boolean;
	/**
	 * The type identifier of the item being held.
	 */
	itemHeld?: string;
}



//#region Entity
/**
 * A type which includes the status effects data for an entity.
 */
type EffectsData = {
   id: string;
   amplifier: number;
   duration: number;
};

/**
 * Represents an entity that can be looked at in the game.
 * This includes player entities, and other mobs.
 */
export interface LookAtEntityInterface extends LookAtObjectInterface {
   type: LookAtObjectTypeEnum.ENTITY;
   /**
    * The Entity reference being looked at.
    * This can be manipulated by the Script API.
    */
   entity: Entity;
   /**
    * The current health points of the entity.
    * This value can initially be undefined, but will be determined later on.
    */
   hp?: number;
   /**
    * The maximum health points of the entity.
    * This value can initially be undefined, but will be determined later on.
    */
   maxHp?: number;
   /**
    * List of status effects that the entity has.
    */
   effectsData?: Array<EffectsData>;
}

/**
 * Represents an item entity that can be looked at in the game.
 */
export interface LookAtItemEntityInterface extends LookAtObjectInterface {
   /**
    * The ItemStack reference being looked at.
    * This can be manipulated by the Script API.
    */
   itemStack?: ItemStack;
}


//#region Block
/**
 * Represents a block that can be looked at in the game.
 * This includes blocks that are not entities, such as tiles and items.
 */
export interface LookAtBlockInterface extends LookAtObjectInterface {
   type: LookAtObjectTypeEnum.TILE;
   /**
    * The Block reference being looked at.
    * This can be manipulated by the Script API.
    */
   block: Block;
}
