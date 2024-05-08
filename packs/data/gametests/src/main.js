
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

import { EntityComponentTypes, EquipmentSlot, LocationOutOfWorldBoundariesError, system, world } from '@minecraft/server';
import { toTitle, zFill, prettyCaps } from './utils';

import { armor } from './data/armor';
import { blockIds } from './data/blockIds';
import { blockTools } from './data/blockTools';
import { nameAliases } from './data/nameAliases';

import { Logger } from '@bedrock-oss/bedrock-boost';
const log = new Logger('WAILA')


/**
 * @typedef { object } lookAtObject
 * Represents the object a player is currently looking at in the game.
 * 
 * @property { string } type - The type of the object (e.g., 'entity' or 'block').
 * @property { import('@minecraft/server').Entity | import('@minecraft/server').Block } rawHit - The actual entity or block object that was hit.
 * @property { string } hit - The identifier of the hit object.
 * @property { string } hp - The current health points of the entity, if applicable.
 * @property { string } maxHp - The maximum health points of the entity, if applicable.
 */

/**
 * @typedef { object } lookAtObjectMetadata
 * Contains metadata about the object a player is looking at, used for UI display.
 * 
 * @property { string } type - The type of the object (e.g., 'entity' or 'block').
 * @property { string } hit - The identifier of the hit object.
 * @property { string } hitItem - The identifier of the item associated with the hit object.
 * @property { number } itemAux - Auxiliary data for the item used for rendering in the UI.
 * @property { boolean } hideHealth - Whether to hide the health bar in the UI.
 * @property { string } healthRenderer - The rendered string of health icons.
 * @property { number } hp - The current health points of the entity.
 * @property { number } maxHp - The maximum health points of the entity.
 * @property { string } armor - The rendered string of armor icons.
 * @property { string } entityId - The unique identifier for the entity.
 * @property { string[] } tool - The tools applicable for interacting with the object.
 */


system.runInterval(iterAllPlayers, 2)


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
    (tools.value.some(block => blockId.replace(blockId.replace(/(?<=:).+/g, ''), '').toString().includes(block)) ||
    tools.value.some(block => blockId.includes(block))) &&

    !tools.value.some(block =>
      block.startsWith('!') &&
      (blockId.replace(blockId.replace(/(?<=:).+/g, ''), '').toString().includes(block.replace('!', '')) ||
      blockId.includes(block.replace('!', '')))
    )
  )

  if (matches.length > 0) 
    return matches.slice(0, 2).map(match => match.type)
  else return ['undefined', 'undefined']
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

  const MAX_HEARTS_DISPLAY = Math.ceil(maxHealth / 2);
  let fullHearts = Math.floor(currentHealth / 2);
  let halfHearts = currentHealth % 2;
  let emptyHearts = MAX_HEARTS_DISPLAY - fullHearts - halfHearts;

  let healthString = 
    healthIcons.full.repeat(fullHearts) + 
    healthIcons.half.repeat(halfHearts) + 
    healthIcons.empty.repeat(emptyHearts)

  healthString += healthIcons.padding.repeat(20 - MAX_HEARTS_DISPLAY);

  if (healthString) return healthString;
  else return `yyyyyyyyyyyyyyyyyyyy`

}

/**
 * 
 * Renders the armor of the player
 * in useable text
 * 
 * @param { import('@minecraft/server').Player } player 
 * @returns { string }
 */
function armorRenderer(player) {

  /**
   * @type { import('@minecraft/server').EntityEquippableComponent }
   */
  const playerEquipment = player.getComponent(EntityComponentTypes.Equippable)
  const currentArmor =
    [ EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet ]
    .reduce((total, slot) => total + armor.get(playerEquipment.getEquipment(slot)?.typeId), 0) || 0
  const maxArmor = 20;

  const armorIcons = {
    full: 'p',
    half: 'o',
    empty: 'n'
  }

  //* Count number of max, full, half-armor and empty armor beforehand
  const MAX_ARMOR_DISPLAY = Math.ceil(maxArmor / 2);
  let fullarmor = Math.floor(currentArmor / 2);
  let halfarmor = currentArmor % 2;
  let emptyarmor = MAX_ARMOR_DISPLAY - fullarmor - halfarmor;

  //* Append them all together in one giant string
  let armorString = 
    armorIcons.full.repeat(fullarmor) + 
    armorIcons.half.repeat(halfarmor) + 
    armorIcons.empty.repeat(emptyarmor)

  if (armorString) return armorString;
  else return `nnnnnnnnnn`

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
      _a.hp = _a.rawHit.getComponent(EntityComponentTypes.Health)?.currentValue || '0'
      _a.maxHp = _a.rawHit.getComponent(EntityComponentTypes.Health)?.effectiveMax || '0'
    }

    if (_a.hit) return _a;


    //* Fetch block the player is looking at
    const blockLookAt = player.getBlockFromViewDirection({
      includeLiquidBlocks: false,
      includePassableBlocks: true,
      maxDistance: max_dist
    })

    if (blockLookAt) {
      _a.type = 'tile'
      _a.rawHit = blockLookAt?.block
      _a.hit = _a.rawHit.getItemStack(1, true)?.typeId || _a.rawHit.typeId
    }

    return _a;

  } catch (e) {
    if (!(e instanceof LocationOutOfWorldBoundariesError)) log.warn(e);
  }

}


/**
 * 
 * @param { lookAtObject } lookAtObject 
 * @param { string } hitNamespace 
 * 
 * @returns { lookAtObjectMetadata }
 */
function fetchLookAtMetadata(lookAtObject, hitNamespace) {

  /**
   * @type { lookAtObjectMetadata }
   */
  let _a = {};

  _a.type = lookAtObject.type;

  if (lookAtObject.type == 'entity') {

    const entityHp = lookAtObject.rawHit.getComponent(EntityComponentTypes.Health)

    //* Set name depending on entity type that was hit
    switch (lookAtObject.hit) {
      case 'minecraft:player':
        _a.hit = `__r4ui:player.${lookAtObject.rawHit.name}`
        _a.armor = armorRenderer(lookAtObject.rawHit)
        break
      case 'minecraft:item': 
        const itemStackEntity = lookAtObject.rawHit.getComponent(EntityComponentTypes.Item).itemStack;
        _a.hitItem = itemStackEntity.typeId;
        _a.itemAux = getItemAux(itemStackEntity)
      default:
        if (hitNamespace === 'minecraft:') _a.hit = `entity.${lookAtObject.hit}.name`;
        else _a.hit = lookAtObject.hit;
    }

    //* Set entity HP metadata
    _a.hideHealth =
      lookAtObject.rawHit.matches({ families: ['inanimate'] }) ||
      entityHp?.effectiveMax > 40;
    _a.hp = Math.floor(entityHp?.currentValue);
    _a.maxHp = Math.floor(entityHp?.effectiveMax);

    if (!_a.hideHealth) _a.healthRenderer = healthRenderer(Math.floor(entityHp?.currentValue), Math.floor(entityHp?.effectiveMax));
    else _a.healthRenderer = 'yyyyyyyyyyyyyyyyyyyy';

    //* Set entity ID metadata
    _a.entityId = transformEntityId(lookAtObject.rawHit)

  } else if (lookAtObject.type == 'tile') {

    //* Set default properties
    _a.hit = lookAtObject.hit;

    //* Fetch block tool
    _a.tool = parseBlockTools(lookAtObject.hit)

    //* Set block item AUX metadata
    _a.itemAux = getItemAux(lookAtObject.rawHit.getItemStack(1, true))

    //* Set healthRenderer placeholder value
    _a.healthRenderer = 'yyyyyyyyyyyyyyyyyyyy';

    //* Set armorRenderer placeholder value
    _a.armorRenderer = 'nnnnnnnnnn';

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
 * @param { object | undefined } lookAtObject 
 * Type of object to render
 */
function displayUI(player, lookAtObject=undefined) {

  //* Fetch the namespace of the provided hit typeId
  const hitNamespace = lookAtObject?.hit?.replace(/(?<=:).+/g, '')
  if (!hitNamespace) return

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
      { text: `\n${(object.maxHp > 0 && object.maxHp <= 40 && !object.hideHealth ? '\n' : '')}${object.maxHp > 40 ? `§7 ${object.hp}/${object.maxHp} (${Math.round(object.hp / object.maxHp * 100)}%)§r\n` : (object.maxHp > 20 ? '\n' : '')}${`§9§o${hitNamespace.length > 3 ? prettyCaps(toTitle(hitNamespace.replace(/_/g, ' ').replace(':', ''))) : hitNamespace.replace(':', '').toUpperCase()}§r`}${object.maxHp > 40 ? '\n ' : ''}` }
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
      { text: `\n${(object.maxHp > 0 && object.maxHp <= 40 && !object.hideHealth ? '\n' : '')}${object.maxHp > 40 ? `§7 ${object.hp} / ${object.maxHp} (${Math.round(object.hp / object.maxHp * 100)}%)§r\n` : (object.maxHp > 20 ? '\n' : '')}${`§9§o${hitNamespace.length > 3 ? prettyCaps(toTitle(hitNamespace.replace(/_/g, ' ').replace(':', ''))) : hitNamespace.replace(':', '').toUpperCase()}§r`}${object.maxHp > 40 ? '\n ' : ''}` }
    ]
    parseStrSubtitle = [
      { text: object.entityId }
    ]
  }

  log.info(
    'Render:', object.hit
  )

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

