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

import { Player, world } from "@minecraft/server";
import { Logger, LogLevel, PlayerPulseScheduler } from "@bedrock-oss/bedrock-boost";

import AfterWorldLoad from "../utils/Init";
import { WailaSettings } from "./Settings";
import { PauseManager } from "./PauseManager";
import { SignatureStore } from "./SignatureStore";
import { LookPipeline, LookAssessment } from "./look/LookPipeline";
import { LookScanner } from "./look/LookScanner";
import { UiController } from "./ui/UiController";



//#region WAILA
export default class Waila {
	private static instance: Waila;

	private readonly log = Logger.getLogger("WAILA");
	private readonly signatureStore = new SignatureStore();
	private readonly lookScanner = new LookScanner();
	private readonly lookPipeline = new LookPipeline();
	private readonly uiController = new UiController();
	private readonly playerHasTarget: Map<string, boolean> = new Map();
	private readonly pauseManager: PauseManager;

	private constructor() {
		Logger.setLevel(LogLevel.Debug);

		this.pauseManager = new PauseManager((player) => this.handleExternalClear(player));
		this.pauseManager.initialize();

		AfterWorldLoad(() => {
			world.gameRules.showTags = false;

			const pulse = new PlayerPulseScheduler((player) => {
				const isEnabled = WailaSettings.get(player, "isEnabled");
				if (isEnabled === undefined || isEnabled === true) {
					this.processPlayer(player);
				}
			}, 3);
			pulse.start();

			this.log.info(`WAILA loaded and running.`);
		});
	}

	public static getInstance(): Waila {
		if (!Waila.instance) {
			Waila.instance = new Waila();
		}
		return Waila.instance;
	}

	private processPlayer(player: Player): void {
		this.pauseManager.checkPlayerInventoryOpen(player);
		if (this.pauseManager.isPaused(player)) return;

		const settings = WailaSettings.getAllTyped(player);
		const lookAt = this.lookScanner.scan(player, WailaSettings.DEFAULT_VIEW_DISTANCE);
		const assessment = this.lookPipeline.assess(player, lookAt, settings);

		this.updateTargetState(player, assessment);

		if (!assessment.hasTarget || !assessment.signature || !assessment.context) {
			this.signatureStore.clear(player);
			return;
		}

		if (this.signatureStore.isDuplicate(player, assessment.signature)) return;

		const resolution = this.lookPipeline.finalize(assessment.context);
		this.uiController.present(player, resolution, settings);
	}

	private updateTargetState(player: Player, assessment: LookAssessment): void {
		const playerId = player.id;
		const hadTarget = this.playerHasTarget.get(playerId) ?? false;
		const hasTarget = assessment.hasTarget;

		if (!hasTarget && hadTarget) {
			this.handleExternalClear(player);
		}

		this.playerHasTarget.set(playerId, hasTarget);
	}

	private handleExternalClear(player: Player): void {
		this.uiController.clear(player);
		this.signatureStore.clear(player);
		this.playerHasTarget.set(player.id, false);
	}

	public clearUI(player: Player): void {
		this.handleExternalClear(player);
	}

	public isPaused(player: Player): boolean {
		return this.pauseManager.isPaused(player);
	}
}

Waila.getInstance();
