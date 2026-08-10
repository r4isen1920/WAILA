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

import { BindThis, CustomCmd } from "@bedrock-oss/stylish";
import {
	CommandPermissionLevel,
	CustomCommand,
	CustomCommandOrigin,
	CustomCommandParamType,
	CustomCommandResult,
	CustomCommandStatus,
	Player,
	system,
} from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

import WailaLogger from "../../utils/Logger";
import { BreakEstimator } from "./BreakEstimator";
import { BreakLearningStore, ExportedEntry } from "./BreakLearningStore";



//#region CustomCmd
/**
 * Debug command for inspecting, exporting and resetting learned block-breaking durations.
 * Exported output matches `datasets/learnedHardnessSeed.json` so it can be pasted back
 * into the pack and shipped as defaults for other worlds.
 */
@CustomCmd
export class BreakDataCommand implements CustomCommand {
	static readonly log = WailaLogger.get("BreakData");

	readonly name = "r4isen1920_waila:breakdata";
	readonly description = "Exports, inspects or clears learned block break durations.";
	readonly permissionLevel = CommandPermissionLevel.Admin;
	readonly cheatsRequired = true;

	readonly mandatoryParameters = [
		{
			name: "action",
			type: CustomCommandParamType.String,
		},
	];

	readonly optionalParameters = [
		{
			name: "includeKnown",
			type: CustomCommandParamType.Boolean,
		},
	];

	@BindThis
	run(origin: CustomCommandOrigin, action: string, includeKnown?: boolean): CustomCommandResult {
		switch (action.toLowerCase()) {
			case "export":
				return this.runExport(origin, includeKnown === true);
			case "stats":
				return this.runStats();
			case "clear":
				return this.runClear();
			default:
				return {
					status: CustomCommandStatus.Failure,
					message: `Unknown action "${action}". Expected: export, stats, clear.`,
				};
		}
	}

	//#region Actions
	private runExport(origin: CustomCommandOrigin, includeKnown: boolean): CustomCommandResult {
		const entries = BreakLearningStore.exportEntries();
		const filtered: Record<string, ExportedEntry> = {};

		for (const [blockTypeId, entry] of Object.entries(entries)) {
			if (!includeKnown && BreakEstimator.hasShippedHardness(blockTypeId)) continue;
			filtered[blockTypeId] = entry;
		}

		const count = Object.keys(filtered).length;
		if (count === 0) {
			return {
				status: CustomCommandStatus.Success,
				message: includeKnown
					? "No learned break data to export yet."
					: "No learned break data outside the shipped dataset. Re-run with includeKnown: true to dump everything.",
			};
		}

		const { sourceEntity } = origin;
		if (!(sourceEntity instanceof Player)) {
			return {
				status: CustomCommandStatus.Failure,
				message: "This command must be run by a player so the export form can be shown.",
			};
		}

		// Kept on one line so the whole field can be selected and copied in one go.
		const payload = JSON.stringify({ version: 1, entries: filtered });
		system.run(() => this.showCopyForm(sourceEntity, payload, count));

		return {
			status: CustomCommandStatus.Success,
			message: `Exporting ${count} entr${count === 1 ? "y" : "ies"} (${payload.length} bytes)...`,
		};
	}

	private runStats(): CustomCommandResult {
		const stats = BreakLearningStore.stats();
		return {
			status: CustomCommandStatus.Success,
			message:
				`Learned: ${stats.learned} (${stats.confident} confident), ` +
				`seeded: ${stats.seeded}, stored: ${stats.bytes} bytes`,
		};
	}

	private runClear(): CustomCommandResult {
		system.run(() => BreakLearningStore.clear());
		return {
			status: CustomCommandStatus.Success,
			message: "Cleared learned break data. Seeded defaults are unaffected.",
		};
	}

	//#region Output
	private showCopyForm(player: Player, payload: string, count: number): void {
		new ModalFormData()
			.title("WAILA Break Data Export")
			.label(
				`${count} entr${count === 1 ? "y" : "ies"}. Select the field below, copy it, and paste it ` +
				`into packs/data/gametests/src/waila/datasets/learnedHardnessSeed.json`,
			)
			.textField("learnedHardnessSeed.json", "", { defaultValue: payload })
			.show(player)
			.catch((error) => BreakDataCommand.log.warn(`Failed showing export form: ${error}`));
	}
}
