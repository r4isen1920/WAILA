"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UiController = void 0;
const server_1 = require("@minecraft/server");
const bedrock_boost_1 = require("@bedrock-oss/bedrock-boost");
const InventoryMirror_1 = require("../InventoryMirror");
const UiBuilder_1 = require("./UiBuilder");
class UiController {
    log = bedrock_boost_1.Logger.getLogger("WAILA:UiController");
    present(player, resolution, settings) {
        try {
            InventoryMirror_1.InventoryMirror.apply(player, resolution.iconRequests);
        }
        catch (error) {
            this.log.warn(`Failed applying inventory mirror: ${error}`);
        }
        const { title, subtitle } = UiBuilder_1.UiBuilder.build(player, resolution.metadata, settings, resolution.extendedInfoActive);
        this.scheduleTitleUpdate(player, title, {
            subtitle,
            fadeInDuration: 0,
            fadeOutDuration: 0,
            stayDuration: server_1.TicksPerSecond * 60,
        });
        server_1.system.runTimeout(() => {
            try {
                InventoryMirror_1.InventoryMirror.restore(player);
            }
            catch (error) {
                this.log.warn(`Failed restoring inventory mirror: ${error}`);
            }
        }, 2);
    }
    clear(player) {
        const options = {
            fadeInDuration: 0,
            fadeOutDuration: 0,
            stayDuration: 0,
        };
        this.scheduleTitleUpdate(player, " ", options);
        try {
            player.runCommand(`title @s reset`);
        }
        catch (error) {
            this.log.warn(`Failed to run title reset command for ${player.name}: ${error}`);
        }
        InventoryMirror_1.InventoryMirror.restore(player);
    }
    scheduleTitleUpdate(player, title, options) {
        const normalizedTitle = Array.isArray(title)
            ? { rawtext: title }
            : title;
        const normalizedSubtitle = (() => {
            if (!options?.subtitle)
                return undefined;
            return Array.isArray(options.subtitle)
                ? { rawtext: options.subtitle }
                : options.subtitle;
        })();
        const finalOptions = {
            fadeInDuration: options?.fadeInDuration ?? 0,
            fadeOutDuration: options?.fadeOutDuration ?? 0,
            stayDuration: options?.stayDuration ?? 0,
            ...(normalizedSubtitle !== undefined && { subtitle: normalizedSubtitle }),
        };
        server_1.system.run(() => {
            if (!player.isValid)
                return;
            player.onScreenDisplay.setTitle(normalizedTitle, finalOptions);
        });
    }
}
exports.UiController = UiController;
