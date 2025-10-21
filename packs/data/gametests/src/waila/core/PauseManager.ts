import { EntityComponentTypes, Player, system, world } from "@minecraft/server";
import { Logger, Vec2, Vec3 } from "@bedrock-oss/bedrock-boost";

import pauseBlocks from "../../data/guiPauseBlocks.json";

const PROPERTY_PAUSED = "r4isen1920_waila:paused";

type ClearUiHandler = (player: Player) => void;

type IntervalHandle = number;

export class PauseManager {
	private readonly log = Logger.getLogger("WAILA:PauseManager");
	private readonly resumeWatchers: Map<string, IntervalHandle> = new Map();

	constructor(private readonly clearUi: ClearUiHandler) {}

	public initialize(): void {
		world.afterEvents.playerInteractWithBlock.subscribe(({ player, block }) => {
			if (!block) return;
			if (pauseBlocks.includes(block.typeId)) {
				this.pause(player);
			}
		});

		world.beforeEvents.playerLeave.subscribe(({ player }) => {
			this.clearUi(player);
			player.setDynamicProperty(PROPERTY_PAUSED, undefined);
			this.stopResumeWatcher(player.id);
		});
	}

	public checkPlayerInventoryOpen(player: Player): void {
		const playerCursor = player.getComponent(EntityComponentTypes.CursorInventory);
		if (!playerCursor) return;

		if (playerCursor.item !== undefined) {
			this.pause(player);
		}
	}

	public isPaused(player: Player): boolean {
		return Boolean(player.getDynamicProperty(PROPERTY_PAUSED));
	}

	private pause(player: Player): void {
		if (this.isPaused(player)) return;

		player.setDynamicProperty(PROPERTY_PAUSED, true);
		this.clearUi(player);
		this.log.info(`Player ${player.name} opened a UI, pausing updates.`);

		const initialPosition = Vec3.from(player.location);
		const initialRotation = Vec2.from(player.getRotation());

		const interval = system.runInterval(() => {
			if (!player.isValid) {
				this.stopResumeWatcher(player.id);
				return;
			}

			const currentPos = Vec3.from(player.location);
			const currentRot = Vec2.from(player.getRotation());

			const movedFar = initialPosition.distance(currentPos) > 2;
			const rotatedEnough = currentRot.distance(initialRotation) > 10;
			if (!movedFar && !rotatedEnough) return;

			this.log.info(`Player ${player.name} moved, resuming WAILA UI.`);
			this.stopResumeWatcher(player.id);
			player.setDynamicProperty(PROPERTY_PAUSED, undefined);
			this.clearUi(player);
		}, 5);

		this.resumeWatchers.set(player.id, interval);
	}

	private stopResumeWatcher(playerId: string): void {
		const handle = this.resumeWatchers.get(playerId);
		if (handle === undefined) return;
		try {
			system.clearRun(handle);
		} catch (error) {
			this.log.warn(`Failed to clear resume watcher for player ${playerId}: ${error}`);
		}
		this.resumeWatchers.delete(playerId);
	}
}
