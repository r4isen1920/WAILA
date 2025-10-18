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
	 * The fundamental type identifier of the object being looked at
	 * (e.g., minecraft:stone, minecraft:cow, minecraft:item for item entities).
	 */
	hitIdentifier: string;
	/**
	 * The primary display name or translation key for the object.
	 * If an entity has a nameTag, this will be the nameTag.
	 * For item entities, this would be 'entity.item.name'.
	 */
	displayName: string;
	/**
	 * The namespace of the object being looked at.
	 */
	namespace: string;
	/**
	 * Contains the data used to render the object being looked at.
	 */
	renderData: BlockRenderDataInterface | EntityRenderDataInterface;
	/**
	 * If the looked-at object is an entity with a nameTag, this holds
	 * the translation key for the entity's type (e.g., "entity.cow.name").
	 * Used to display as: "{displayName (nameTag)}" ({nameTagContextTranslationKey})
	 */
	nameTagContextTranslationKey?: string;
	/**
	 * If the looked-at entity is an item entity (hitIdentifier is 'minecraft:item'),
	 * this holds the type identifier of the actual item (e.g., "minecraft:diamond_sword").
	 */
	itemContextIdentifier?: string;
	/**
	 * If the looked-at block is an item frame (minecraft:frame or minecraft:glow_frame),
	 * this holds the translation key for the item inside the frame.
	 */
	itemInsideFrameTranslationKey?: string;
}

/**
 * Rendering data specifically for blocks
 */
export interface BlockRenderDataInterface {
	/**
	 * Renderer string that will be used to display the tools that can be used to efficiently break the block.
	 */
	toolIcons: string;
	/**
	 * The block states of the block being looked at.
	 */
	blockStates?: string;
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
export type EffectsRendererType = {
	/**
	 * The renderer string that will be used to display the effects of the entity.
	 * It's value is to be parsed in the client-side UI to determine how to display the effects.
	 */
	effectString: string;
	/**
	 * An array of strings that represent such status effects.
	 */
	effectsResolvedArray: string[];
};

/**
 * Rendering data for entities
 */
export interface EntityRenderDataInterface {
	/**
	 * The entity's unique identifier that can be used to render its model in the UI.
	 * This is equivalent to the item aux value for blocks and items.
	 */
	entityId: string;
	/**
	 * Renderer string that will be used to display the tags that are associated with the entity.
	 */
	tagIcons: string;
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
	effectsRenderer: EffectsRendererType;
}
