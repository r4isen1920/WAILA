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

import { Logger } from "@bedrock-oss/bedrock-boost";
import { BindThis, CustomCmd } from "@bedrock-oss/stylish";
import {
	CommandPermissionLevel,
	CustomCommand,
	CustomCommandOrigin,
	CustomCommandParamType,
	CustomCommandResult,
	CustomCommandStatus,
	Player,
	RawMessage,
	system,
} from "@minecraft/server";
import { ModalFormData, ModalFormResponse } from "@minecraft/server-ui";
import Waila from "./Waila";



//#region API
/**
 * Handles options and per-player settings for WAILA.
 */
export class WailaSettings {
	static readonly NAMESPACE = "r4isen1920_waila";
	static readonly log = Logger.getLogger("WailaSettings");

	static readonly DISPLAY_POSITIONS = [
		{
			value: "top_left",
			labelKey: "waila.settings.displayPosition.option.top_left",
		},
		{
			value: "top_middle",
			labelKey: "waila.settings.displayPosition.option.top_middle",
		},
		{
			value: "top_right",
			labelKey: "waila.settings.displayPosition.option.top_right",
		},
		{
			value: "left_middle",
			labelKey: "waila.settings.displayPosition.option.left_middle",
		},
		{
			value: "center",
			labelKey: "waila.settings.displayPosition.option.center",
		},
		{
			value: "right_middle",
			labelKey: "waila.settings.displayPosition.option.right_middle",
		},
		{
			value: "bottom_left",
			labelKey: "waila.settings.displayPosition.option.bottom_left",
		},
		{
			value: "bottom_middle",
			labelKey: "waila.settings.displayPosition.option.bottom_middle",
		},
		{
			value: "bottom_right",
			labelKey: "waila.settings.displayPosition.option.bottom_right",
		},
	];
	/**
	 * List of settings
	 */
	static readonly SETTINGS: { [key: string]: WailaSetting } = {
		isEnabled: {
			type: "boolean",
			labelKey: "waila.settings.isEnabled.label",
			// descriptionKey: "waila.settings.isEnabled.description",
			default: true,
		},

		displayBlockStates: {
			type: "boolean",
			labelKey: "waila.settings.displayBlockStates.label",
			// descriptionKey: "waila.settings.displayBlockStates.description",
			default: true,
		},
		maxDisplayDistance: {
			type: "number",
			labelKey: "waila.settings.maxDisplayDistance.label",
			descriptionKey: "waila.settings.maxDisplayDistance.description",
			default: 8,
			range: [1, 12],
		},

		showInventoryContents: {
			type: "enum",
			labelKey: "waila.settings.showInventoryContents.label",
			descriptionKey: "waila.settings.showInventoryContents.description",
			default: "when_sneaking",
			options: [
				{ value: "always", labelKey: "waila.settings.showInventoryContents.option.always" },
				{ value: "when_not_sneaking", labelKey: "waila.settings.showInventoryContents.option.when_not_sneaking" },
				{ value: "when_sneaking", labelKey: "waila.settings.showInventoryContents.option.when_sneaking" },
				{ value: "never", labelKey: "waila.settings.showInventoryContents.option.never" },
			],
		},

		displayPosition: {
			type: "enum",
			labelKey: "waila.settings.displayPosition.label",
			// descriptionKey: "waila.settings.displayPosition.description",
			default: "top_middle",
			options: this.DISPLAY_POSITIONS,
		},
		extendedDisplayPosition: {
			type: "enum",
			labelKey: "waila.settings.extendedDisplayPosition.label",
			descriptionKey: "waila.settings.extendedDisplayPosition.description",
			default: "unchanged",
			options: [
				{ value: "unchanged", labelKey: "waila.settings.extendedDisplayPosition.option.unchanged" },
				...this.DISPLAY_POSITIONS
			],
		},
	};

	/** Returns all setting keys. */
	static keys(): string[] {
		return Object.keys(this.SETTINGS);
	}

	/** Returns entries of [key, setting] from the schema. */
	static entries(): [string, WailaSetting][] {
		return Object.entries(this.SETTINGS) as [string, WailaSetting][];
	}

	/**
	 * Get a single setting value for a player, normalized to the correct primitive type.
	 * Falls back to the setting default when no value has been stored yet.
	 */
	static get(player: Player, key: "isEnabled"): boolean;
	static get(player: Player, key: "displayBlockStates"): boolean;
	static get(player: Player, key: "maxDisplayDistance"): number;
	static get(player: Player, key: "displayPosition"): WailaDisplayPosition;
	static get(player: Player, key: "extendedDisplayPosition"): WailaDisplayPosition;
	static get(player: Player, key: "showInventoryContents"): WailaInventoryDisplayOption;
	static get(player: Player, key: string): WailaSettingPrimitive;
	static get(player: Player, key: string): WailaSettingPrimitive {
		const setting = this.SETTINGS[key];
		if (!setting) throw new Error(`Unknown WAILA setting: ${key}`);
		const stored = player.getDynamicProperty(this.propertyKey(key));
		if (stored === undefined || stored === null)
			return setting.default as WailaSettingPrimitive;

		switch (setting.type) {
			case "boolean":
				return typeof stored === "boolean"
					? stored
					: (setting.default as boolean);
			case "number":
				return typeof stored === "number"
					? stored
					: (setting.default as number);
			case "string":
				return typeof stored === "string"
					? stored
					: (setting.default as string);
			case "enum":
				return this.normalizeEnumStoredValue(setting, stored);
		}
	}

	/**
	 * Get all settings for a player as a simple record.
	 */
	static getAll(player: Player): Record<string, WailaSettingPrimitive> {
		const out: Record<string, WailaSettingPrimitive> = {};
		for (const [key] of this.entries()) {
			out[key] = this.get(player, key);
		}
		return out;
	}

	/**
	 * Get all settings with strong typing per known keys.
	 */
	static getAllTyped(player: Player): WailaSettingsValues {
		return {
			isEnabled: this.get(player, "isEnabled") as boolean,
			displayBlockStates: this.get(player, "displayBlockStates") as boolean,
			maxDisplayDistance: this.get(player, "maxDisplayDistance") as number,
			displayPosition: this.get(player, "displayPosition") as WailaDisplayPosition,
			extendedDisplayPosition: this.get(player, "extendedDisplayPosition") as WailaDisplayPosition,
			showInventoryContents: this.get(player, "showInventoryContents") as WailaInventoryDisplayOption,
		};
	}

	/**
	 * Set a setting value for a player. The value will be validated and normalized to the
	 * correct type based on the schema. Returns true if stored, false if rejected.
	 */
	static set(player: Player, key: string, value: unknown): boolean {
		const setting = this.SETTINGS[key];
		if (!setting) return false;

		const parsed = this.parseIncomingValue(setting, value);
		if (parsed === undefined) return false;
		player.setDynamicProperty(this.propertyKey(key), parsed as any);
		return true;
	}

	/** Reset a single setting to its default for a player. */
	static reset(player: Player, key: string): void {
		const setting = this.SETTINGS[key];
		if (!setting) return;
		player.setDynamicProperty(this.propertyKey(key), setting.default as any);
	}

	/** Reset all settings to defaults for a player. */
	static resetAll(player: Player): void {
		for (const [key, setting] of this.entries()) {
			player.setDynamicProperty(this.propertyKey(key), setting.default as any);
		}
	}

	//#region Utils
	private static propertyKey(settingKey: string) {
		return `${this.NAMESPACE}:${settingKey}`;
	}

	private static normalizeEnumStoredValue(
		setting: WailaSettingEnum,
		stored: unknown,
	): string | number {
		if (typeof stored === "string") {
			const match = setting.options.find((opt) => opt.value === stored);
			if (match) return match.value;
		}
		if (typeof stored === "number") {
			const directMatch = setting.options.find((opt) => opt.value === stored);
			if (directMatch) return directMatch.value;
			const option = setting.options[stored];
			if (option) return option.value;
		}
		return setting.default;
	}

	private static parseIncomingValue(
		setting: WailaSetting,
		rawValue: unknown,
	): WailaSettingPrimitive | undefined {
		switch (setting.type) {
			case "boolean":
				return typeof rawValue === "boolean" ? rawValue : undefined;
			case "number":
				return typeof rawValue === "number" ? rawValue : undefined;
			case "string":
				return typeof rawValue === "string" ? rawValue : undefined;
			case "enum": {
				// Accept index, label value, or already normalized value
				if (typeof rawValue === "number") {
					const byIndex = setting.options[rawValue];
					if (byIndex) return byIndex.value;
					const direct = setting.options.find((o) => o.value === rawValue);
					return direct ? direct.value : undefined;
				}
				if (typeof rawValue === "string") {
					const opt = setting.options.find((o) => o.value === rawValue);
					return opt ? opt.value : undefined;
				}
				return undefined;
			}
			default:
				return undefined;
		}
	}
}

//#region CustomCmd
/**
 * Handles the command to display the WAILA options UI.
 */
@CustomCmd
export class WailaCommand implements CustomCommand {
	static readonly NAMESPACE = WailaSettings.NAMESPACE;
	static readonly log = Logger.getLogger("WailaCommand");

	readonly name = WailaCommand.NAMESPACE + ":waila";
	readonly description = `Shows the WAILA options`; //? Localization support for command description is not yet supported for some reason !!!1!!1
	readonly permissionLevel = CommandPermissionLevel.Any;
	readonly cheatsRequired = false;

	readonly optionalParameters = [
		{
			name: "player",
			type: CustomCommandParamType.PlayerSelector,
		},
	];

	@BindThis
	run(origin: CustomCommandOrigin, player?: Player[]): CustomCommandResult {
		const { sourceEntity } = origin;
		if (
			!sourceEntity ||
			!sourceEntity.isValid ||
			!(sourceEntity instanceof Player)
		) {
			return {
				status: CustomCommandStatus.Failure,
				message: "This command can only be run on a player",
			};
		}

		if (player && player.length === 0) {
			return {
				status: CustomCommandStatus.Failure,
				message: "No targets matched the selector.",
			};
		}

		if (player && player.length > 1) {
			return {
				status: CustomCommandStatus.Failure,
				message: "Please select only one player to edit WAILA settings for.",
			};
		}

		if (
			player &&
			player?.[0].id !== sourceEntity.id && // editing another player's settings
			sourceEntity.commandPermissionLevel < CommandPermissionLevel.Admin
		) {
			return {
				status: CustomCommandStatus.Failure,
				message:
					"You do not have permission to edit other players' WAILA settings.",
			};
		}

		system.run(() => {
			WailaSettingsUI.showUI(sourceEntity, player?.[0]);
		});

		WailaCommand.log.info(
			`Displayed to: ${sourceEntity.name}, editing: ${player?.[0].name ?? "self"}`,
		);

		return {
			status: CustomCommandStatus.Success,
			message: `WAILA UI shown for ${sourceEntity.name}`,
		};
	}
}

//#region UI
export class WailaSettingsUI {
	static readonly NAMESPACE = WailaSettings.NAMESPACE;

	/**
	 * @param player The player who will manage the setting
	 * @param forPlayer The player whose setting will be edited (defaults to the managing player)
	 */
	static showUI(player: Player, forPlayer?: Player) {
		const target = forPlayer ?? player;
		if (!target?.isValid) {
			return;
		}

		const form = new ModalFormData()
			.title(
				this.str(
					"waila.settings.title" + (player.id !== target.id ? "_for" : ""),
					target,
				),
			)
			.submitButton(this.str("waila.settings.submit"));

		const entries = WailaSettings.entries();
		const controlIndexByKey: Record<string, number> = {};
		let nextIndex = 0;

		for (let i = 0; i < entries.length; i++) {
			const [key, setting] = entries[i];
			const currentValue = WailaSettings.get(target, key);

			controlIndexByKey[key] = nextIndex;

			switch (setting.type) {
				case "boolean": {
					const defaultValue =
						typeof currentValue === "boolean"
							? currentValue
							: (setting.default as boolean);
					form.toggle(this.str(setting.labelKey), { defaultValue });
					break;
				}
				case "number": {
					const defaultValue =
						typeof currentValue === "number"
							? currentValue
							: (setting.default as number);
					form.slider(
						this.str(setting.labelKey),
						setting.range[0],
						setting.range[1],
						{
							valueStep: setting.step ?? 1,
							defaultValue,
						},
					);
					break;
				}
				case "string": {
					const defaultValue =
						typeof currentValue === "string"
							? currentValue
							: (setting.default as string);
					form.textField(
						this.str(setting.labelKey),
						setting.default as string,
						{
							defaultValue,
						},
					);
					break;
				}
				case "enum": {
					const enumValue =
						typeof currentValue === "string" || typeof currentValue === "number"
							? currentValue
							: (setting.default as string | number);
					const items = setting.options.map((opt) => this.str(opt.labelKey));
					form.dropdown(this.str(setting.labelKey), items, {
						defaultValueIndex: this.getEnumOptionIndex(setting, enumValue),
					});
					break;
				}
			}
			// control consumes an index--even if its label or divider
			nextIndex++;

			if (setting.descriptionKey) {
				form.label(this.str(setting.descriptionKey, "§7")); // gray color
				nextIndex++;
			}

			if (i < entries.length - 1) {
				form.label("\n"); // divider
				nextIndex++;
			}
		}

		form.divider();
		form.label(
			this.str(
				player.id !== target.id
					? "waila.settings.footer.other_player"
					: "waila.settings.footer.self_adjusting",
				target,
			),
		);

		form.show(player).then((res) => {
			if (res.canceled || !res.formValues?.length) {
				player.playSound("note.bass");
				return;
			}
			this.handleResponse(target, res, controlIndexByKey);
			Waila.getInstance().clearUI(target); // refresh UI
			player.playSound("note.pling");
		});
	}

	static handleResponse(
		player: Player,
		response: ModalFormResponse,
		controlIndexByKey: Record<string, number>,
	) {
		for (const [key, setting] of WailaSettings.entries()) {
			const idx = controlIndexByKey[key];
			const rawValue = response.formValues![idx];
			if (setting.type === "enum") {
				WailaSettings.set(player, key, rawValue);
			} else {
				WailaSettings.set(player, key, rawValue);
			}
		}
	}

	/** Create a raw message from a translation token */
	private static str(token: string): RawMessage;
	/** Create a raw message from a translation token with a prefix */
	private static str(token: string, prefix: string): RawMessage;
	/** Create a raw message from a translation token with a player */
	private static str(token: string, player: Player): RawMessage;
	/** Create a raw message from a translation token with a prefix and a player */
	private static str(token: string, prefix: string, player: Player): RawMessage;
	private static str(
		token: string,
		prefixOrPlayer?: string | Player,
		playerArg?: Player,
	) {
		if (playerArg) {
			return {
				rawtext: [
					{ text: prefixOrPlayer as string },
					{ translate: token, with: [playerArg.name] },
				],
			};
		}

		if (typeof prefixOrPlayer === "string") {
			return { rawtext: [{ text: prefixOrPlayer }, { translate: token }] };
		} else if (prefixOrPlayer) {
			return { rawtext: [{ translate: token, with: [prefixOrPlayer.name] }] };
		} else {
			return { rawtext: [{ translate: token }] };
		}
	}

	private static getEnumOptionIndex(
		setting: WailaSettingEnum,
		value: string | number,
	) {
		const index = setting.options.findIndex((opt) => opt.value === value);
		return index >= 0 ? index : 0;
	}
}



//#region Types
/** A setting that represents a boolean value */
interface WailaSettingBoolean extends WailaSettingBase<boolean> {
	type: "boolean";
}
/** A setting that represents a numeric value */
interface WailaSettingNumber extends WailaSettingBase<number> {
	type: "number";
	range: [number, number];
	step?: number;
}
/** A setting that represents a string value */
interface WailaSettingString extends WailaSettingBase<string> {
	type: "string";
}
/** A setting that represents an enum value */
interface WailaSettingEnum extends WailaSettingBase<string | number> {
	type: "enum";
	options: { labelKey: string; value: string | number }[];
}
/** The base interface for all WAILA settings */
interface WailaSettingBase<TDefault> {
	type: string;
	labelKey: string;
	descriptionKey?: string;
	default: TDefault;
}
type WailaSetting =
	| WailaSettingBoolean
	| WailaSettingNumber
	| WailaSettingString
	| WailaSettingEnum;

type WailaSettingPrimitive = boolean | number | string;

export type WailaDisplayPosition =
	| "top_left"
	| "top_middle"
	| "top_right"
	| "left_middle"
	| "center"
	| "right_middle"
	| "bottom_left"
	| "bottom_middle"
	| "bottom_right"
	/** The value is the same as the other setting */
	| "unchanged";

export type WailaInventoryDisplayOption =
	| "always"
	| "when_not_sneaking"
	| "when_sneaking"
	| "never";

export interface WailaSettingsValues {
	isEnabled: boolean;
	displayBlockStates: boolean;
	maxDisplayDistance: number;
	displayPosition: WailaDisplayPosition;
	extendedDisplayPosition: WailaDisplayPosition;
	showInventoryContents: WailaInventoryDisplayOption;
}

export function shouldRenderInventoryContents(
	option: WailaInventoryDisplayOption,
	isSneaking: boolean,
): boolean {
	switch (option) {
		case "always":
			return true;
		case "never":
			return false;
		case "when_sneaking":
			return isSneaking;
		case "when_not_sneaking":
		default:
			return !isSneaking;
	}
}
