
/**
 * List of remarks that can be used to describe the state of a tag.
 */
export enum TagRemarksEnum {
	/** Indicates that this tag is correct. Used, for instance, if the player is holding the correct tool. */
	CORRECT = "a",
	/** Indicates that this tag is incorrect. Used, for instance, if the player is holding the wrong tool. */
	INCORRECT = "b",
	/** Undefined tag. This will not display any indicator in the UI whatsoever. */
	UNDEFINED = "z",
}

/**
 * List of all block tools that can be used to efficiently break blocks.
 */
export enum BlockToolsEnum {
	SWORD = "aa",
	AXE = "ab",
	PICKAXE = "ac",
	SHOVEL = "ad",
	HOE = "ae",
	ARMOR = "af",
	CROPS = "ag",
	SHEARS = "ah",
	BUCKET = "ai",
	BRUSH = "aj",
	COMMANDS = "ak",
	UNDEFINED = "zz",
}

/**
 * List of entity interactions that can be performed on entities.
 */
export enum EntityInteractionsEnum {
	CAN_CLIMB = "aa",
	CAN_FLY = "ab",
	CAN_POWER_JUMP = "ac",
	FIRE_IMMUNE = "ad",
	IS_BABY = "ae",
	IS_CHESTED = "af",
	IS_DYEABLE = "ag",
	IS_STUNNED = "ah",
	IS_RIDEABLE = "ai",
	IS_TRADEABLE = "aj",
	PROJECTILE = "ak",
	WANTS_JOCKEY = "al",
	TAMEABLE = "am",
	WHEAT = "an",
	POTATO = "ao",
	HAY_BALE = "ap",
	SEEDS = "aq",
	GOLDEN_APPLE = "ar",
	FISH = "as",
	FLOWERS = "at",
	FUNGI = "au",
	SLIMEBALL = "av",
	CACTUS = "aw",
	TORCHFLOWER = "ax",
	SPIDER_EYE = "ay",
	UNDEFINED = "zz",
}
