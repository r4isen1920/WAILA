import {
	Player,
	RawMessage,
	TicksPerSecond,
	TitleDisplayOptions,
	system,
} from "@minecraft/server";
import { Logger } from "@bedrock-oss/bedrock-boost";

import { InventoryMirror } from "../InventoryMirror";
import { LookResolution } from "../look/LookPipeline";
import { LookAtObjectTypeEnum as LookAtObjectType } from "../../../types/LookAtObjectTypeEnum";
import { WailaSettingsValues, shouldRenderInventoryContents } from "../Settings";
import { UiBuilder } from "./UiBuilder";



//#region UI Controller
export class UiController {
	private readonly log = Logger.getLogger("WAILA:UiController");

	public present(
		player: Player,
		resolution: LookResolution,
		settings: WailaSettingsValues,
	): void {
		try {
			const shouldDisplayInventory =
				resolution.metadata.type === LookAtObjectType.TILE &&
				shouldRenderInventoryContents(settings.showInventoryContents, player.isSneaking);
			const shouldMirrorInventory =
				shouldDisplayInventory &&
				resolution.iconRequests.some((request) => request.slot >= 9 && request.slot <= 35 && request.slot !== 17);

			InventoryMirror.apply(player, resolution.iconRequests, shouldMirrorInventory);
		} catch (error) {
			this.log.warn(`Failed applying inventory mirror: ${error}`);
		}

		const { title, subtitle } = UiBuilder.build(
			player,
			resolution.metadata,
			settings,
			resolution.extendedInfoActive,
		);

		this.scheduleTitleUpdate(player, title, {
			subtitle,
			fadeInDuration: 0,
			fadeOutDuration: 0,
			stayDuration: TicksPerSecond * 60,
		});

		system.runTimeout(() => {
			try {
				InventoryMirror.restore(player);
			} catch (error) {
				this.log.warn(`Failed restoring inventory mirror: ${error}`);
			}
		}, 2);
	}

	public clear(player: Player): void {
		const options: TitleDisplayOptions = {
			fadeInDuration: 0,
			fadeOutDuration: 0,
			stayDuration: 0,
		};

		this.scheduleTitleUpdate(player, " ", options);

		system.run(() => {
            player.runCommand(`title @s reset`);
        });

		InventoryMirror.restore(player);
	}

	private scheduleTitleUpdate(
		player: Player,
		title: RawMessage[] | string,
		options?: TitleDisplayOptions & { subtitle?: RawMessage[] | RawMessage | string },
	): void {
		const normalizedTitle: RawMessage | string = Array.isArray(title)
			? ({ rawtext: title } as RawMessage)
			: title;

		const normalizedSubtitle = (() => {
			if (!options?.subtitle) return undefined;
			return Array.isArray(options.subtitle)
				? ({ rawtext: options.subtitle } as RawMessage)
				: options.subtitle;
		})();

		const finalOptions: TitleDisplayOptions = {
			fadeInDuration: options?.fadeInDuration ?? 0,
			fadeOutDuration: options?.fadeOutDuration ?? 0,
			stayDuration: options?.stayDuration ?? 0,
			...(normalizedSubtitle !== undefined && { subtitle: normalizedSubtitle }),
		};

		system.run(() => {
			if (!player.isValid) return;
			player.onScreenDisplay.setTitle(normalizedTitle, finalOptions);
		});
	}
}
