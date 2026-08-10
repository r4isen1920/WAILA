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

import {
	Block,
	GameMode,
	ItemStack,
	Player,
	system,
	world,
	type Vector3,
} from "@minecraft/server";

import AfterWorldLoad from "../../utils/Init";
import WailaLogger from "../../utils/Logger";
import { BreakEstimate, BreakEstimator, BreakModifiers } from "./BreakEstimator";
import { BreakLearningStore } from "./BreakLearningStore";



//#region Globals
const TICKS_PER_SECOND = 20;
/** Below this the block is effectively instant-mined and a bar would only flicker. */
const MIN_RENDERABLE_SECONDS = 0.15;
/** Shorter observations are dominated by tick rounding and would poison the average. */
const MIN_SAMPLE_SECONDS = 0.25;
/** Guards against sessions leaking when no break/cancel event arrives. */
const SESSION_TIMEOUT_FACTOR = 3;
const SESSION_TIMEOUT_GRACE_SECONDS = 5;
const MIN_CANCEL_PROGRESS = 0.05;



//#region BreakTracker
/**
 * Tracks in-flight block breaking per player so the UI can render a progress bar,
 * and feeds observed durations back into the learning store.
 */
export class BreakTracker {
	private static instance: BreakTracker;

	private readonly log = WailaLogger.get("BreakTracker");
	private readonly sessions: Map<string, BreakSession> = new Map();

	private constructor() {
		AfterWorldLoad(() => {
			world.afterEvents.playerStartBreakingBlock.subscribe((event) =>
				this.handleStart(event.player, event.block, event.heldItemStack),
			);
			world.afterEvents.playerBreakBlock.subscribe((event) =>
				this.handleComplete(event.player, event.block.location),
			);
			world.afterEvents.playerCancelBreakingBlock.subscribe((event) =>
				this.handleCancel(event.player, event.block.location, event.breakProgress),
			);
			world.afterEvents.playerLeave.subscribe((event) => {
				this.sessions.delete(event.playerId);
			});
		});
	}

	public static getInstance(): BreakTracker {
		if (!BreakTracker.instance) {
			BreakTracker.instance = new BreakTracker();
		}
		return BreakTracker.instance;
	}

	/**
	 * Remaining break time for the player, or undefined when nothing renderable is in flight.
	 * The bar animates 0 -> full over this duration, so it lands exactly when the block breaks.
	 */
	public getProgress(player: Player): BreakProgress | undefined {
		const session = this.sessions.get(player.id);
		if (!session) return undefined;

		const elapsed = (system.currentTick - session.startTick) / TICKS_PER_SECOND;
		if (this.hasExpired(session, elapsed)) {
			this.sessions.delete(player.id);
			return undefined;
		}

		if (!session.renderable) return undefined;

		return { remainingSeconds: Math.max(0, session.estimatedSeconds - elapsed) };
	}

	public clear(player: Player): void {
		this.sessions.delete(player.id);
	}

	//#region Events
	private handleStart(player: Player, block: Block, heldItemStack?: ItemStack): void {
		const gameMode = this.safeGameMode(player);
		if (gameMode === GameMode.Creative || gameMode === GameMode.Spectator) {
			this.sessions.delete(player.id);
			return;
		}

		let estimate: BreakEstimate;
		try {
			estimate = BreakEstimator.estimate(player, block, heldItemStack);
		} catch (error) {
			this.log.warn(`Failed estimating break duration for ${block.typeId}: ${error}`);
			this.sessions.delete(player.id);
			return;
		}

		if (estimate.source === "unbreakable" || !estimate.modifiers) {
			this.sessions.delete(player.id);
			return;
		}

		// Unknown blocks still open a session so the break can be measured and learned from.
		this.sessions.set(player.id, {
			blockTypeId: block.typeId,
			location: block.location,
			startTick: system.currentTick,
			estimatedSeconds: estimate.seconds,
			modifiers: estimate.modifiers,
			renderable: estimate.source !== "unknown" && estimate.seconds >= MIN_RENDERABLE_SECONDS,
		});
	}

	private handleComplete(player: Player, location: Vector3): void {
		const session = this.takeSession(player, location);
		if (!session) return;

		const elapsed = (system.currentTick - session.startTick) / TICKS_PER_SECOND;
		this.recordSample(session, elapsed);
	}

	private handleCancel(player: Player, location: Vector3, breakProgress: number): void {
		const session = this.takeSession(player, location);
		if (!session) return;

		if (!Number.isFinite(breakProgress) || breakProgress < MIN_CANCEL_PROGRESS) return;

		const elapsed = (system.currentTick - session.startTick) / TICKS_PER_SECOND;
		this.recordSample(session, elapsed / breakProgress);
	}

	//#region Learning
	private recordSample(session: BreakSession, observedSeconds: number): void {
		if (observedSeconds < MIN_SAMPLE_SECONDS) return;

		const implied = BreakEstimator.impliedHardness(observedSeconds, session.modifiers);
		if (implied === undefined) return;

		BreakLearningStore.record(session.blockTypeId, implied);
		this.log.debug(
			`Sampled ${session.blockTypeId}: ${observedSeconds.toFixed(2)}s -> hardness ${implied.toFixed(3)}`,
		);
	}

	private takeSession(player: Player, location: Vector3): BreakSession | undefined {
		const session = this.sessions.get(player.id);
		if (!session) return undefined;

		this.sessions.delete(player.id);

		const sameBlock =
			session.location.x === location.x &&
			session.location.y === location.y &&
			session.location.z === location.z;

		return sameBlock ? session : undefined;
	}

	private hasExpired(session: BreakSession, elapsedSeconds: number): boolean {
		const limit = session.estimatedSeconds * SESSION_TIMEOUT_FACTOR + SESSION_TIMEOUT_GRACE_SECONDS;
		return elapsedSeconds > limit;
	}

	private safeGameMode(player: Player): GameMode | undefined {
		try {
			return player.getGameMode();
		} catch {
			return undefined;
		}
	}
}



//#region Types
interface BreakSession {
	blockTypeId: string;
	location: Vector3;
	startTick: number;
	estimatedSeconds: number;
	modifiers: BreakModifiers;
	renderable: boolean;
}

export interface BreakProgress {
	remainingSeconds: number;
}
