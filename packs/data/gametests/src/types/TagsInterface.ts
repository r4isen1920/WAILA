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

import { TagRemarksEnum } from "./TagsEnum";

/**
 * Represents a tag to be displayed in the UI.
 * This can either be a block tool, or an entity interaction.
 */
export default interface TagsInterface {
	/**
	 * The name of the tag. We will use this name to reference the tag.
	 */
	name: string;
	/**
	 * List of item identifiers or block tags that this tag applies to.
	 * Tag will be displayed when player views a matching object.
	 * 
	 * Format options:
	 * - `"minecraft:stone"` - exact match with namespace
	 * - `"stone"` - matches all namespaces with this identifier
	 * - `"!stone"` - ignores objects matching this identifier
	 * - `{ tag: "namespace:tag_name" }` - matches objects with this tag **(blocks only)**
	 * - `{ tag: "!namespace:tag_name" }` - ignores objects with this tag **(blocks only)**
	 */
	target: (string | { tag: string })[];
	/**
	 * Remark conditions for this tag.
	 * This is used to determine what remarks to display for this tag.
	 * These are displayed as small icons next to the tag.
	 */
	remarks?: TagRemarksInterface;
}

/**
 * A type which represents the possible remarks for a tag.
 */
type TagRemarksInterface = {
	/** The conditions to apply for this particular remark condition. */
	[K in TagRemarksEnum]?: TagRemarksConditionsInterface;
};

/**
 * Represents the conditions for a tag remark.
 */
interface TagRemarksConditionsInterface {
	/**
	 * List of block/item tags that this condition applies to.
	 * If any of these tags are present, the condition will be met and return true.
	 */
	tags?: string[];
	/**
	 * List of item identifiers that this condition applies to.
	 * If any of these items are present, the condition will be met and return true.
	 */
	itemIds?: string[];
}
