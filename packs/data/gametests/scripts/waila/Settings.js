"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var WailaCommand_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WailaSettingsUI = exports.WailaCommand = exports.WailaSettings = void 0;
const bedrock_boost_1 = require("@bedrock-oss/bedrock-boost");
const stylish_1 = require("@bedrock-oss/stylish");
const server_1 = require("@minecraft/server");
const server_ui_1 = require("@minecraft/server-ui");
const Waila_1 = __importDefault(require("./Waila"));
class WailaSettings {
    static NAMESPACE = "r4isen1920_waila";
    static log = bedrock_boost_1.Logger.getLogger("WailaSettings");
    static DISPLAY_POSITIONS = [
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
    static SETTINGS = {
        isEnabled: {
            type: "boolean",
            labelKey: "waila.settings.isEnabled.label",
            descriptionKey: "waila.settings.isEnabled.description",
            default: true,
        },
        displayBlockStates: {
            type: "boolean",
            labelKey: "waila.settings.displayBlockStates.label",
            descriptionKey: "waila.settings.displayBlockStates.description",
            default: true,
        },
        maxDisplayDistance: {
            type: "number",
            labelKey: "waila.settings.maxDisplayDistance.label",
            descriptionKey: "waila.settings.maxDisplayDistance.description",
            default: 8,
            range: [1, 12],
        },
        displayPosition: {
            type: "enum",
            labelKey: "waila.settings.displayPosition.label",
            descriptionKey: "waila.settings.displayPosition.description",
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
    static keys() {
        return Object.keys(this.SETTINGS);
    }
    static entries() {
        return Object.entries(this.SETTINGS);
    }
    static get(player, key) {
        const setting = this.SETTINGS[key];
        if (!setting)
            throw new Error(`Unknown WAILA setting: ${key}`);
        const stored = player.getDynamicProperty(this.propertyKey(key));
        if (stored === undefined || stored === null)
            return setting.default;
        switch (setting.type) {
            case "boolean":
                return typeof stored === "boolean"
                    ? stored
                    : setting.default;
            case "number":
                return typeof stored === "number"
                    ? stored
                    : setting.default;
            case "string":
                return typeof stored === "string"
                    ? stored
                    : setting.default;
            case "enum":
                return this.normalizeEnumStoredValue(setting, stored);
        }
    }
    static getAll(player) {
        const out = {};
        for (const [key] of this.entries()) {
            out[key] = this.get(player, key);
        }
        return out;
    }
    static getAllTyped(player) {
        return {
            isEnabled: this.get(player, "isEnabled"),
            displayBlockStates: this.get(player, "displayBlockStates"),
            maxDisplayDistance: this.get(player, "maxDisplayDistance"),
            displayPosition: this.get(player, "displayPosition"),
            extendedDisplayPosition: this.get(player, "extendedDisplayPosition"),
        };
    }
    static set(player, key, value) {
        const setting = this.SETTINGS[key];
        if (!setting)
            return false;
        const parsed = this.parseIncomingValue(setting, value);
        if (parsed === undefined)
            return false;
        player.setDynamicProperty(this.propertyKey(key), parsed);
        return true;
    }
    static reset(player, key) {
        const setting = this.SETTINGS[key];
        if (!setting)
            return;
        player.setDynamicProperty(this.propertyKey(key), setting.default);
    }
    static resetAll(player) {
        for (const [key, setting] of this.entries()) {
            player.setDynamicProperty(this.propertyKey(key), setting.default);
        }
    }
    static propertyKey(settingKey) {
        return `${this.NAMESPACE}:${settingKey}`;
    }
    static normalizeEnumStoredValue(setting, stored) {
        if (typeof stored === "string") {
            const match = setting.options.find((opt) => opt.value === stored);
            if (match)
                return match.value;
        }
        if (typeof stored === "number") {
            const directMatch = setting.options.find((opt) => opt.value === stored);
            if (directMatch)
                return directMatch.value;
            const option = setting.options[stored];
            if (option)
                return option.value;
        }
        return setting.default;
    }
    static parseIncomingValue(setting, rawValue) {
        switch (setting.type) {
            case "boolean":
                return typeof rawValue === "boolean" ? rawValue : undefined;
            case "number":
                return typeof rawValue === "number" ? rawValue : undefined;
            case "string":
                return typeof rawValue === "string" ? rawValue : undefined;
            case "enum": {
                if (typeof rawValue === "number") {
                    const byIndex = setting.options[rawValue];
                    if (byIndex)
                        return byIndex.value;
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
exports.WailaSettings = WailaSettings;
let WailaCommand = class WailaCommand {
    static { WailaCommand_1 = this; }
    static NAMESPACE = WailaSettings.NAMESPACE;
    static log = bedrock_boost_1.Logger.getLogger("WailaCommand");
    name = WailaCommand_1.NAMESPACE + ":waila";
    description = `Shows the WAILA options`;
    permissionLevel = server_1.CommandPermissionLevel.Any;
    cheatsRequired = false;
    optionalParameters = [
        {
            name: "player",
            type: server_1.CustomCommandParamType.PlayerSelector,
        },
    ];
    run(origin, player) {
        const { sourceEntity } = origin;
        if (!sourceEntity ||
            !sourceEntity.isValid ||
            !(sourceEntity instanceof server_1.Player)) {
            return {
                status: server_1.CustomCommandStatus.Failure,
                message: "This command can only be run on a player",
            };
        }
        if (player && player.length === 0) {
            return {
                status: server_1.CustomCommandStatus.Failure,
                message: "No targets matched the selector.",
            };
        }
        if (player && player.length > 1) {
            return {
                status: server_1.CustomCommandStatus.Failure,
                message: "Please select only one player to edit WAILA settings for.",
            };
        }
        if (player &&
            player?.[0].id !== sourceEntity.id &&
            sourceEntity.commandPermissionLevel < server_1.CommandPermissionLevel.Admin) {
            return {
                status: server_1.CustomCommandStatus.Failure,
                message: "You do not have permission to edit other players' WAILA settings.",
            };
        }
        server_1.system.run(() => {
            WailaSettingsUI.showUI(sourceEntity, player?.[0]);
        });
        WailaCommand_1.log.info(`Displayed to: ${sourceEntity.name}, editing: ${player?.[0].name ?? "self"}`);
        return {
            status: server_1.CustomCommandStatus.Success,
            message: `WAILA UI shown for ${sourceEntity.name}`,
        };
    }
};
exports.WailaCommand = WailaCommand;
__decorate([
    stylish_1.BindThis
], WailaCommand.prototype, "run", null);
exports.WailaCommand = WailaCommand = WailaCommand_1 = __decorate([
    stylish_1.CustomCmd
], WailaCommand);
class WailaSettingsUI {
    static NAMESPACE = WailaSettings.NAMESPACE;
    static showUI(player, forPlayer) {
        const target = forPlayer ?? player;
        if (!target?.isValid) {
            return;
        }
        const form = new server_ui_1.ModalFormData()
            .title(this.str("waila.settings.title" + (player.id !== target.id ? "_for" : ""), target))
            .submitButton(this.str("waila.settings.submit"));
        const entries = WailaSettings.entries();
        const controlIndexByKey = {};
        let nextIndex = 0;
        for (let i = 0; i < entries.length; i++) {
            const [key, setting] = entries[i];
            const currentValue = WailaSettings.get(target, key);
            controlIndexByKey[key] = nextIndex;
            switch (setting.type) {
                case "boolean": {
                    const defaultValue = typeof currentValue === "boolean"
                        ? currentValue
                        : setting.default;
                    form.toggle(this.str(setting.labelKey), { defaultValue });
                    break;
                }
                case "number": {
                    const defaultValue = typeof currentValue === "number"
                        ? currentValue
                        : setting.default;
                    form.slider(this.str(setting.labelKey), setting.range[0], setting.range[1], {
                        valueStep: setting.step ?? 1,
                        defaultValue,
                    });
                    break;
                }
                case "string": {
                    const defaultValue = typeof currentValue === "string"
                        ? currentValue
                        : setting.default;
                    form.textField(this.str(setting.labelKey), setting.default, {
                        defaultValue,
                    });
                    break;
                }
                case "enum": {
                    const enumValue = typeof currentValue === "string" || typeof currentValue === "number"
                        ? currentValue
                        : setting.default;
                    const items = setting.options.map((opt) => this.str(opt.labelKey));
                    form.dropdown(this.str(setting.labelKey), items, {
                        defaultValueIndex: this.getEnumOptionIndex(setting, enumValue),
                    });
                    break;
                }
            }
            nextIndex++;
            if (setting.descriptionKey) {
                form.label(this.str(setting.descriptionKey, "§7"));
                nextIndex++;
            }
            if (i < entries.length - 1) {
                form.label("\n");
                nextIndex++;
            }
        }
        form.divider();
        form.label(this.str(player.id !== target.id
            ? "waila.settings.footer.other_player"
            : "waila.settings.footer.self_adjusting", target));
        form.show(player).then((res) => {
            if (res.canceled || !res.formValues?.length) {
                player.playSound("note.bass");
                return;
            }
            this.handleResponse(target, res, controlIndexByKey);
            Waila_1.default.getInstance().clearUI(target);
            player.playSound("note.pling");
        });
    }
    static handleResponse(player, response, controlIndexByKey) {
        for (const [key, setting] of WailaSettings.entries()) {
            const idx = controlIndexByKey[key];
            const rawValue = response.formValues[idx];
            if (setting.type === "enum") {
                WailaSettings.set(player, key, rawValue);
            }
            else {
                WailaSettings.set(player, key, rawValue);
            }
        }
    }
    static str(token, prefixOrPlayer, playerArg) {
        if (playerArg) {
            return {
                rawtext: [
                    { text: prefixOrPlayer },
                    { translate: token, with: [playerArg.name] },
                ],
            };
        }
        if (typeof prefixOrPlayer === "string") {
            return { rawtext: [{ text: prefixOrPlayer }, { translate: token }] };
        }
        else if (prefixOrPlayer) {
            return { rawtext: [{ translate: token, with: [prefixOrPlayer.name] }] };
        }
        else {
            return { rawtext: [{ translate: token }] };
        }
    }
    static getEnumOptionIndex(setting, value) {
        const index = setting.options.findIndex((opt) => opt.value === value);
        return index >= 0 ? index : 0;
    }
}
exports.WailaSettingsUI = WailaSettingsUI;
