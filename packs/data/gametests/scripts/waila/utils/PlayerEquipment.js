"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMainHandContext = getMainHandContext;
const server_1 = require("@minecraft/server");
function getMainHandContext(player) {
    try {
        const equippable = player.getComponent(server_1.EntityComponentTypes.Equippable);
        const mainhand = equippable?.getEquipment(server_1.EquipmentSlot.Mainhand);
        if (!mainhand) {
            return { itemTypeId: "__r4ui:none", tags: [] };
        }
        return {
            itemTypeId: mainhand.typeId ?? "__r4ui:none",
            tags: mainhand.getTags(),
        };
    }
    catch {
        return { itemTypeId: "__r4ui:none", tags: [] };
    }
}
