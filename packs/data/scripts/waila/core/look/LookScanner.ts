import {
	LocationOutOfWorldBoundariesError,
	Player,
} from "@minecraft/server";
import { Logger } from "@bedrock-oss/bedrock-boost";

import ignoredBlockRender from "../../../data/ignoredBlockRender.json";
import { BlockHandler } from "../BlockHandler";
import { EntityHandler } from "../EntityHandler";
import { LookAtObjectInterface } from "../../../types/LookAtObjectInterface";



//#region LookScanner
export class LookScanner {
	private readonly log = Logger.getLogger("WAILA:LookScanner");

	public scan(player: Player, maxDistance: number): LookAtObjectInterface {
		try {
			const entityLookAt = player.getEntitiesFromViewDirection({ maxDistance });
			if (entityLookAt.length > 0 && entityLookAt[0]?.entity) {
				return EntityHandler.createLookupData(entityLookAt[0].entity);
			}

			const blockLookAt = player.getBlockFromViewDirection({
				includeLiquidBlocks: !player.isInWater,
				includePassableBlocks: !player.isInWater,
				maxDistance,
			});

			if (
				blockLookAt?.block &&
				!ignoredBlockRender.some((entry) => entry.includes(blockLookAt.block.typeId))
			) {
				return BlockHandler.createLookupData(blockLookAt.block);
			}

			return {
				type: undefined,
				hitIdentifier: "__r4ui:none",
			};
		} catch (error) {
			if (!(error instanceof LocationOutOfWorldBoundariesError)) {
				this.log.error(`Error while scanning look target: ${error}`);
			}
			return {
				type: undefined,
				hitIdentifier: "__r4ui:none",
			};
		}
	}
}
