"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AfterWorldLoad;
const server_1 = require("@minecraft/server");
const bedrock_boost_1 = require("@bedrock-oss/bedrock-boost");
const log = bedrock_boost_1.Logger.getLogger("Init");
const queue = [];
let loaded = false;
server_1.world.afterEvents.worldLoad.subscribe(() => {
    loaded = true;
    log.debug(`Loading ${queue.length} function${queue.length === 1 ? "" : "s"}.`);
    while (queue.length > 0) {
        queue.shift()();
    }
});
function AfterWorldLoad(fn) {
    if (loaded) {
        fn();
    }
    else {
        queue.push(fn);
    }
}
