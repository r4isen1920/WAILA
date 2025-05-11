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
	 * List of item identifiers that this tag applies to.
	 * When the player views on object, we will check if the object is in this list.
	 * If it is, we will display the tag.
	 * 
	 * A string value can be formatted as follows:
	 * - the type identifier string with namespace (e.g., `"minecraft:stone"`), this will match exactly the block/item for this particular namespace only
	 * - the type identifier string without namespace (e.g., `"stone"`), this will match all namespaces that have this block/item
	 * - prepend `!` to the type identifier string (e.g., `"!stone"`), this will ignore all objects that match this type identifier
	 */
	target: string[];
	/**
	 * Remark conditions for this tag.
	 * This is used to determine what remarks to display for this tag.
	 * These are displayed as small icons next to the tag.
	 */
	remarks?: TagRemarksInterface;
}

/**
 * A type which represents the remarks for a tag.
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
