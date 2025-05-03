import { LookAtObjectTypeEnum } from "./LookAtObjectTypeEnum";



/**
 * Represents the metadata of an object being looked at in the game.
 */
export interface LookAtObjectMetadata {
   /**
    * The type of object being looked at.
    */
   type: LookAtObjectTypeEnum;
   /**
    * The type identifier of the object being looked at.
    */
   hitIdentifier: string;
   /**
    * This can either be an item aux value or a texture path.
    */
   icon: string | number;
   /**
    * The display name of the object being looked at.
    */
   displayName: string;
   /**
    * The namespace of the object being looked at.
    */
   namespace: string;
   /**
    * Contains the data used to render the object being looked at.
    */
   renderData: BlockRenderData | EntityRenderData;
}

/**
 * Rendering data specifically for blocks
 */
export interface BlockRenderData {
   /**
    * Tools that can be used to break or interact with the block.
    */
   tool: string[];
   /**
    * The block states of the block being looked at.
    */
   blockStates: string;
   /**
    * Content or contents within the block.
    * This is used for blocks that can contain items, such as chests or barrels.
    */
   inventory: string | string[];
}

/**
 * A type which includes the status effects data for an entity.
 * That is formatted for rendering in the UI.
 */
export type EffectsRenderer = {
   /**
    * The renderer string that will be used to display the effects of the entity.
    * It's value is to be parsed in the client-side UI to determine how to display the effects.
    */
   effectString: string;
   /**
    * An array of strings that represent such status effects.
    */
   effectsResolvedArray: string[];
}

/**
 * Rendering data for entities
 */
export interface EntityRenderData {
   /**
    * The entity's unique identifier that can be used to render its model in the UI.
    * This is equivalent to the item aux value for blocks and items.
    */
   entityId: string;
   /**
    * The tags associated with the entity for categorization and identification.
    */
   tags: string[];
   /**
    * The current health points of the entity.
    */
   hp: number;
   /**
    * The maximum health points of the entity.
    */
   maxHp: number;
   /**
    * Whether or not the literal integer value of the health should be displayed.
    * This is used for entities that have massive health points, that cannot be displayed compactly.
    */
   intHealthDisplay: boolean;
   /**
    * The renderer string that is used to display the health of the entity.
    * It's value is to be parsed in the client-side UI to determine how to display the health.
    */
   healthRenderer: string;
   /**
    * The renderer string that is used to display the armor of the entity.
    * It's value is to be parsed in the client-side UI to determine how to display the armor.
    */
   armorRenderer: string;
   /**
    * The renderer string that is used to display the effects of the entity.
    */
   effectsRenderer: EffectsRenderer;
   /**
    * The item identifier of the entity being looked at.
    * This is present if the entity being looked at is an item entity.
    */
   hitItem?: string;
}