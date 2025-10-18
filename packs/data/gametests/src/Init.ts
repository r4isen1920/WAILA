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

import { world } from '@minecraft/server';
import { Logger } from '@bedrock-oss/bedrock-boost';


const log = Logger.getLogger('Init');
/** A list of functions to be executed when the world is loaded. */
const queue: Array<() => void> = [];
/** A flag indicating whether the world has been loaded. */
let loaded = false;


world.afterEvents.worldLoad.subscribe(() => {
   loaded = true;
   log.debug(`Loading ${queue.length} function${queue.length === 1 ? '' : 's'}.`); // handle pluralization lol
   while (queue.length > 0) {
      queue.shift()!();
   }
});


/**
 * Executes the given function after the world has been loaded.
 * If the world is already loaded, the function is executed immediately.
 * 
 * **This ensures that this function is ran not within the early execution phase, which was introduced in `@minecraft/server@2.0.0`**
 *
 * @param fn The function to be executed.
 * @author r4isen1920
 */
export default function AfterWorldLoad(fn: () => void) {
   if (loaded) {
      fn();
   } else {
      queue.push(fn);
   }
}
