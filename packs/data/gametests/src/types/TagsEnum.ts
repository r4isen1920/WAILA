
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
	// Pickaxe tiers
	PICKAXE_WOOD = "aa",
	PICKAXE_STONE = "ab",
	PICKAXE_IRON = "ac",
	PICKAXE_DIAMOND = "ad",

	// Axe tiers
	AXE_WOOD = "ba",
	AXE_STONE = "bb",
	AXE_IRON = "bc",
	AXE_DIAMOND = "bd",

	// Shovel -- doesn't have tiers because all shovels can break the same blocks
	SHOVEL = "ca",

	// Hoe -- doesn't have tiers because all hoes can break the same blocks
	HOE = "da",

	// Sword -- doesn't have tiers because all swords can break the same blocks
	SWORD = "ea",

	// Miscellaneous
	IGNITABLE = "fa",
	CROPS = "fb",
	SHEARS = "fc",
	BUCKET = "fd",
	BRUSH = "fe",
	COMMANDS = "ff",

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
