"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignatureStore = void 0;
const PROPERTY_SIGNATURE = "r4isen1920_waila:old_log";
class SignatureStore {
    isDuplicate(player, signature) {
        const previous = player.getDynamicProperty(PROPERTY_SIGNATURE);
        if (previous === signature)
            return true;
        player.setDynamicProperty(PROPERTY_SIGNATURE, signature);
        return false;
    }
    clear(player) {
        player.setDynamicProperty(PROPERTY_SIGNATURE, undefined);
    }
}
exports.SignatureStore = SignatureStore;
