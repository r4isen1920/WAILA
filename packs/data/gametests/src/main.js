
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

import { LocationOutOfWorldBoundariesError, TicksPerSecond, system, world } from '@minecraft/server';
import { toTitle, zFill, prettyCaps } from './utils';

import { blockIds } from './data/blockIds';
import { blockTools } from './data/blockTools';
import { entityPortraits } from './data/entityPortraits';
import { nameAliases } from './data/nameAliases';

/**
 * @typedef { object } lookAtObject
 * 
 * @property { string } type
 * @property { import('@minecraft/server').Entity | import('@minecraft/server').Block } rawHit
 * @property { string } hit
 * @property { string } hp
 * @property { string } maxHp
 */

//* Run on the 2nd tick
system.runTimeout(() => {

  //* Run every second tick
  system.runInterval(iterAllPlayers, 2)

}, TicksPerSecond * 2)


/**
 * 
 * Requests the process for each player
 * in the world
 */
function iterAllPlayers() {

  const MAX_DISTANCE = 8;

  world.getAllPlayers().forEach(
    player => {

      /**
       * @type { lookAtObject }
       */
      let lookAtObject = fetchLookAt(player, MAX_DISTANCE);

      //* Reset UI when needed
      if (player.hasTag('r4ui_reset')) { lookAtObject.hit = 'none'; player.removeTag('r4ui_reset'); }

      //* Inform UI that there is nothing on the screen the player is looking at
      if (!lookAtObject) return;
      if (lookAtObject.hit === undefined) lookAtObject.hit = 'none';

      //* Render the UI in the screen
      displayUI(player, lookAtObject);

    }
  )

}


/**
 * 
 * Parses the item AUX value of
 * the block or item
 * 
 * @param { import('@minecraft/server').ItemStack } type
 * 
 * @returns { number | undefined }
 */
function getItemAux(type) {

  let _a = blockIds.get(type?.typeId) * 65536;

  if (_a == undefined) return NaN;
  else return _a
}


/**
 * 
 * @param { import('@minecraft/server').Entity } entity 
 * @param { string } componentName 
 * 
 * @remarks
 * Returns the value of the
 * defined component from the entity
 * 
 * @returns { import('@minecraft/server').EntityComponent | '0' | undefined }
 * 
 * @legacy
 */
function getComponentValue(entity, componentName) {
  const component = entity.getComponent(componentName);
  return component !== undefined ? component.value : '0';
}


/**
 * 
 * Parses the portrait of the entity
 * from variant and mark variant values
 * 
 * @param { import('@minecraft/server').Entity } entity 
 * 
 * @returns { string | undefined }
 * 
 * @legacy
 */
function getEntityPortrait(entity) {

  if (!entity?.isValid()) return;

  const variant = getComponentValue(entity, 'variant');
  const markVariant = getComponentValue(entity, 'mark_variant');

  const baseKey = entity.typeId;
  let keys = [
    `${baseKey}:${variant}:${markVariant}`,
    `${baseKey}:${variant}:0`,
    `${baseKey}:0:${markVariant}`,
    `${baseKey}:0:0`
  ];

  //* Checks if any of the keys format match from the dictionary
  for (let key of keys) {
    if (entityPortraits[key] !== undefined) {
      return entityPortraits[key];
    }
  }
  return '000';
}


/**
 * 
 * @param { import('@minecraft/server').Entity } entity 
 * 
 * @returns { string }
 */
function transformEntityId(entity) {

  /* Entity IDs that should not be displayed */
  const IGNORE_IDS = [
    'area_effect_cloud',
    'minecart',
    'potion',
    'minecraft:boat',
    'minecraft:egg',
    'minecraft:item',
    'minecraft:tnt'
  ];

  const entityId = entity.id || '0000000000000';
  if (IGNORE_IDS.some(id => entity.typeId.includes(id))) return '0000000000000';
  else return `${entityId < 0 ? '-' : ''}${zFill(Math.abs(entityId), 12)}`;
}


/**
 * 
 * Parses the blockTools variable and returns
 * the type value if the input matches
 * or contains any value from the list.
 * 
 * @param { string } blockId 
 * 
 * @returns { string[] }
 */
function parseBlockTools(blockId) {
  const matches = blockTools.filter(tools => 
    tools.value.some(block => blockId.replace(blockId.replace(/(?<=:).+/g, ''), '').toString().includes(block)) ||
    tools.value.some(block => blockId.includes(block))
  )

  if (matches.length > 0) 
    return matches.slice(0, 2).map(match => match.type)
  else return ['undefined', 'undefined']
}


/**
 * 
 * Fetches what block or entity the
 * specified player is looking at
 * 
 * @param { import('@minecraft/server').Player } player 
 * The player to run the test against
 * @param { number } max_dist
 * Maximum range in blocks to check for
 * 
 * @returns { lookAtObject }
 */
function fetchLookAt(player, max_dist) {

  let _a = {};

  try {

    //* Fetch entity the player is looking at
    const entityLookAt = player.getEntitiesFromViewDirection({
      maxDistance: max_dist
    })


    if (entityLookAt.length > 0) {
      _a.type = 'entity'
      _a.rawHit = entityLookAt[0]?.entity
      _a.hit = _a.rawHit.typeId
      _a.hp = _a.rawHit.getComponent('health')?.currentValue || '0'
      _a.maxHp = _a.rawHit.getComponent('health')?.effectiveMax || '0'
    }

    if (_a.hit) return _a;


    //* Fetch block the player is looking at
    const blockLookAt = player.getBlockFromViewDirection({
      includeLiquidBlocks: true,
      includePassableBlocks: true,
      maxDistance: max_dist
    })

    if (blockLookAt) {
      _a.type = 'tile'
      _a.rawHit = blockLookAt?.block
      _a.hit = _a.rawHit.typeId
    }

    return _a;

  } catch (e) {
    if (!(e instanceof LocationOutOfWorldBoundariesError)) throw e;
  }

}


/**
 * 
 * Draws the current health of
 * the entity in useable text
 * 
 * @param { number } currentHealth 
 * @param { number } maxHealth 
 * @returns { string }
 */
function healthRenderer(currentHealth, maxHealth) {

  /* The UI can render 40 HP at most -- adjust with caution */
  const MAX_LENGTH = 40;

  //* Normalize value to the specified max length if it exceeds the value
  if (maxHealth > MAX_LENGTH) {
    currentHealth = Math.round((currentHealth / maxHealth) * MAX_LENGTH);
    maxHealth = MAX_LENGTH;
  }

  const healthIcons = {
    full: 'j',
    half: 'i',
    empty: 'h',
    padding: 'y'
  }

  //* Count number of max, full, half-hearts and empty hearts beforehand
  const MAX_HEARTS_DISPLAY = Math.ceil(maxHealth / 2);
  let fullHearts = Math.floor(currentHealth / 2);
  let halfHearts = currentHealth % 2;
  let emptyHearts = MAX_HEARTS_DISPLAY - fullHearts - halfHearts;

  //* Append them all together in one giant string
  let healthString = 
    healthIcons.full.repeat(fullHearts) + 
    healthIcons.half.repeat(halfHearts) + 
    healthIcons.empty.repeat(emptyHearts)

  healthString += healthIcons.padding.repeat(20 - MAX_HEARTS_DISPLAY);

  //* console.warn(`${currentHealth} / ${maxHealth}\n${healthString}`);

  if (healthString) return healthString;
  else return `yyyyyyyyyyyyyyyyyyyy`

}


/**
 * 
 * @param { lookAtObject } lookAtObject 
 * @param { string } hitNamespace 
 * 
 * @returns { object }
 */
function fetchLookAtMetadata(lookAtObject, hitNamespace) {

  /**
   * @type { object }
   */
  let _a = {};

  _a.type = lookAtObject.type;

  if (lookAtObject.type == 'entity') {

    const entityHp = lookAtObject.rawHit.getComponent('health')

    //* Set name depending on entity type that was hit
    switch (lookAtObject.hit) {
      case 'minecraft:player':
        _a.hit = `__r4ui:player.${lookAtObject.rawHit.name}`; break
      case 'minecraft:item': 
        const itemStackEntity = lookAtObject.rawHit.getComponent('item').itemStack;
        _a.hitItem = itemStackEntity.typeId;
        _a.itemAux = getItemAux(itemStackEntity)
      default:
        if (hitNamespace === 'minecraft:') _a.hit = `entity.${lookAtObject.hit}.name`;
        else _a.hit = lookAtObject.hit;
    }

    //* Set entity family type
    _a.isInanimate =
      lookAtObject.rawHit.matches({ families: ['inanimate'] }) ||
      entityHp?.effectiveMax >= 10000000;

    //* Set entity HP metadata
    if (!_a.isInanimate) {
      _a.healthRenderer = healthRenderer(Math.floor(entityHp?.currentValue), Math.floor(entityHp?.effectiveMax));
      _a.maxHp = Math.floor(entityHp?.effectiveMax);
    } else _a.healthRenderer = 'yyyyyyyyyyyyyyyyyyyy';

    //* Set entity portrait metadata
    _a.entityPortrait = getEntityPortrait(lookAtObject.rawHit)

    //* Set entity ID metadata
    _a.entityId = transformEntityId(lookAtObject.rawHit)

  } else if (lookAtObject.type == 'tile') {

    //* Set default properties
    _a.hit = lookAtObject.hit;

    //* Fetch block tool
    _a.tool = parseBlockTools(lookAtObject.hit)

    //* Set block item AUX metadata
    _a.itemAux = getItemAux(lookAtObject.rawHit.getItemStack(1))

    //* Set healthRenderer placeholder value
    _a.healthRenderer = 'yyyyyyyyyyyyyyyyyyyy';

  }

  return _a;

}


/**
 * 
 * Clears the UI for the specified
 * player
 * 
 * @param { import('@minecraft/server').Player } player 
 * @param { string } resetString 
 * 
 */
function clearUI(player) {

  const _a = {
    fadeInDuration: 0,
    fadeOutDuration: 0,
    stayDuration: 0,
  }

  player.onScreenDisplay.setTitle(' ', _a)

  //* Reset title properties
  player.runCommand(`title @s reset`)

}


/**
 * 
 * Handles final string parse and
 * sends a request to the UI
 * 
 * @param { import('@minecraft/server').Player } player 
 * The player to render the UI onto
 * @param { object } lookAtObject 
 * Type of object to render
 */
function displayUI(player, lookAtObject) {

  //* Fetch the namespace of the provided hit typeId
  const hitNamespace = lookAtObject.hit.replace(/(?<=:).+/g, '');

  //* Only send a UI update if the value has changed
  const _L = lookAtObject.type === 'entity' ? JSON.stringify(lookAtObject) : lookAtObject.hit
  if (player.getDynamicProperty('r4:oldLog') !== _L) player.setDynamicProperty('r4:oldLog', _L); else return;

  //* Remove information that was once displayed on screen
  if (lookAtObject.hit === 'none') { clearUI(player); return }

  //* Transform lookAtObject to a parsed object value with metadata included
  const object = fetchLookAtMetadata(lookAtObject, hitNamespace);

  //* Parse text string information using template literals
  let parseStr = [];
  let parseStrSubtitle = [];
  const nameAlias = nameAliases.get(object.hit.replace(hitNamespace, ''));
  const iconTypes = {
    'sword': 'a',
    'axe': 'b',
    'pickaxe': 'c',
    'shovel': 'd',
    'hoe': 'e',
    'armor': 'f',
    'crops': 'g',
    'shears': 'k',
    'bucket': 'l',
    'brush': 'm',
    'undefined': 'z',
  }

  //* Parse vanilla content
  if (hitNamespace === 'minecraft:') {

    //* _r4ui:A:-00000NaN:z;z:
    //* _r4ui:B:yyyyyyyyyyyyyyyyyyyy:z;z:

    //** -605590388693

    parseStr = [
      { text: `_r4ui:${(object.type === 'tile' || object.hitItem) ? 'A' : 'B'}:` },
      { text: `${(object.type === 'tile' || object.hitItem) ? `${object.itemAux > 0 ? '' : '-'}${zFill(Math.abs(object.itemAux), object.itemAux > 0 ? 9 : 8)}` : object.healthRenderer}` },

      { text: `${object.type === 'tile' ? `:${iconTypes[object.tool[0]]};${iconTypes[object.tool[1]]}:` : ':z;z:'}` },
      { translate: `${object.type === 'tile' ? `${nameAlias?.startsWith('item.') ? '' : 'tile.'}${!nameAlias ? object.hit.replace(hitNamespace, '') : nameAlias}.name` : object.hit.replace(hitNamespace, '')}` },
      { text: `${(object.hitItem !== undefined ? `\n§7${object.hitItem}§r` : '')}` },
      { text: `\n${(object.maxHp > 0 ? '\n' : '')}${(object.maxHp > 20 ? '\n' : '')}${`§9§o${hitNamespace.length > 3 ? prettyCaps(toTitle(hitNamespace.replace(/_/g, ' ').replace(':', ''))) : hitNamespace.replace(':', '').toUpperCase()}§r`}` }
    ]
    parseStrSubtitle = [
      { text: object.entityId }
    ]

  //* Parse non-vanilla content
  } else {

    parseStr = [
      { text: `_r4ui:${object.type === 'tile' ? 'A' : 'B'}:` },
      { text: `${object.type === 'tile' ? '-00000NaN' : object.healthRenderer}` },

      { text: `${object.type === 'tile' ? `:${iconTypes[object.tool[0]]};${iconTypes[object.tool[1]]}:` : ':z;z:'}` },
      { translate: `${object.type}.${object.hit}.name` },
      { text: `\n${(object.maxHp > 0 ? '\n' : '')}${(object.maxHp > 20 ? '\n' : '')}${`§9§o${hitNamespace.length > 3 ? prettyCaps(toTitle(hitNamespace.replace(/_/g, ' ').replace(':', ''))) : hitNamespace.replace(':', '').toUpperCase()}§r`}` }
    ]
    parseStrSubtitle = [
      { text: object.entityId }
    ]
  }

  //* console.warn(JSON.stringify(object))
  //* player.sendMessage(parseStr)
  //* player.sendMessage(parseStrSubtitle)

  //* Pass the information on the JSON UI
  player.onScreenDisplay.setTitle(parseStr, {
    subtitle: parseStrSubtitle,

    fadeInDuration: 0,
    fadeOutDuration: 0,
    stayDuration: 0,
  });

  //* Reset title properties
  player.runCommand(`title @s reset`)
}
