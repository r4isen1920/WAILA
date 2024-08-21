
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

// TODO: Re-factor the entire codebase to be more readable and maintainable

import { EntityComponentTypes, EquipmentSlot, LocationOutOfWorldBoundariesError, system, TicksPerSecond, ItemTypes, world } from '@minecraft/server';

import { armor } from './data/armor';
import { blockIds } from './data/blockIds';
import { blockTools } from './data/blockTools';
import { entityInteractions } from './data/entityInteractions';
import { nameAliases } from './data/nameAliases';

import { Logger, LogLevel } from '@bedrock-oss/bedrock-boost';
const log = new Logger('WAILA')
Logger.setLevel(LogLevel.Trace)


//log.warn(
//  `item list: ${ItemTypes.getAll().length}\n`,
//  ItemTypes.getAll().map((item, index) => `${index} | ${item.id}`).join('\n')
//)


/**
 * @typedef { object } lookAtObject
 * Represents the object a player is currently looking at in the game.
 * 
 * @property { string } type - The type of the object (e.g., 'entity' or 'block').
 * @property { import('@minecraft/server').Entity | import('@minecraft/server').Block } rawHit - The actual entity or block object that was hit.
 * @property { string } hit - The identifier of the hit object.
 * @property { string } hp - The current health points of the entity, if applicable.
 * @property { string } maxHp - The maximum health points of the entity, if applicable.
 * @property { import('@minecraft/server').Effect[] } effects - The status effects applied to the entity, if applicable.
 * @property { boolean } isPlayerSneaking - Whether the player is sneaking.
 */

/**
 * @typedef { object } lookAtObjectMetadata
 * Contains metadata about the object a player is looking at, used for UI display.
 * 
 * @property { string } type - The type of the object (e.g., 'entity' or 'block').
 * @property { string } hit - The identifier of the hit object.
 * @property { string } hitItem - The identifier of the item associated with the hit object.
 * @property { number } itemAux - Auxiliary data for the item used for rendering in the UI.
 * @property { boolean } intHealthDisplay - Whether to show the health as an integer value or not.
 * @property { string } healthRenderer - The rendered string of health icons.
 * @property { string } armorRenderer - The rendered string of armor icons.
 * @property { { effectString: string, effectsResolvedArray: string[] } } effectsRenderer - The rendered string of effects.
 * @property { number } hp - The current health points of the entity.
 * @property { number } maxHp - The maximum health points of the entity.
 * @property { string } entityId - The unique identifier for the entity.
 * @property { string[] } tool - The tools applicable for interacting with the object.
 * @property { string[] } tags - The tags of the entity.
 * @property { import('@minecraft/server').BlockStates } blockStates - The states of the block.
 * @property { string | string[] } inventory - The inventory of the block.
 */


system.runInterval(iterAllPlayers, 3)


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
 * @param { import('@minecraft/server').ItemStack | string } type
 * 
 * @returns { number | undefined }
 */
function getItemAux(type) {
  let _a = blockIds.get(type?.typeId || type) * 65536;
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
    'fireball',
    'minecart',
    'potion',
    'minecraft:arrow',
    'minecraft:boat',
    'minecraft:egg',
    'minecraft:eye_of_ender_signal',
    'minecraft:item',
    'minecraft:snowball',
    'minecraft:tnt'
  ];

  const entityId = entity.id || '0000000000000';
  if (IGNORE_IDS.some(id => entity.typeId.includes(id))) return '0000000000000';
  else return `${entityId < 0 ? '-' : ''}${String(Math.abs(entityId)).padStart(12, '0')}`;
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
 * Fetches the properties and components of the
 * entity and returns the appropriate valid
 * tags for the entity
 * 
 * @param { import('@minecraft/server').Entity } entityType 
 * 
 * @returns { string[] }
 */
function getEntityTags(entityType) {

  /**
   * @type { Array<string> }
   */
  let entityTags = []

  const matches = entityInteractions.filter(items => 
    (items.value.some(item => entityType.typeId.replace(entityType.typeId.replace(/(?<=:).+/g, ''), '').toString().includes(item)) ||
    items.value.some(item => entityType.typeId.includes(item))) &&

    !items.value.some(item =>
      item.startsWith('!') &&
      (entityType.typeId.replace(entityType.typeId.replace(/(?<=:).+/g, ''), '').toString().includes(item.replace('!', '')) ||
      entityType.typeId.includes(entityType.typeId.replace('!', '')))
    )
  ).map(item => item.type)
  entityTags.push(...matches)

  /**
   * @param { import('@minecraft/server').Entity } entityType 
   * @param { import('@minecraft/server').EntityComponentTypes } componentName 
   * @returns 
   */
  const getComponentValue = (entityType, componentName) => {
    return entityType.getComponent(componentName)
  }
  /**
   * @type { Array<import('@minecraft/server').EntityComponentTypes> }
   */
  const componentList = [
    EntityComponentTypes.CanFly,
    EntityComponentTypes.CanPowerJump,
    EntityComponentTypes.FireImmune,
    EntityComponentTypes.IsBaby,
    EntityComponentTypes.IsChested,
    EntityComponentTypes.IsDyeable,
    EntityComponentTypes.IsStunned,
    EntityComponentTypes.IsTamed,
    EntityComponentTypes.Projectile,
    EntityComponentTypes.WantsJockey
  ]
  componentList.forEach(component => {
    if (getComponentValue(entityType, component)) {
      if (component == EntityComponentTypes.IsBaby) entityTags = entityTags.filter(tag => tag != 'is_rideable')
      if (component == EntityComponentTypes.IsTamed) entityTags = entityTags.filter(tag => tag != 'tameable')
      else entityTags.push(component.replace('minecraft:', ''))
    }
  })

  if (entityTags.length > 0) 
    return [...new Set(entityTags)].slice(0, 2)
  else return ['undefined', 'undefined']
}


/**
 * 
 * Draws the current health of
 * the entity in useable text
 * 
 * @param { number } currentHealth 
 * @param { number } maxHealth 
 * @param { number | undefined } MAX_LENGTH 
 * 
 * @returns { string }
 */
function healthRenderer(currentHealth, maxHealth, MAX_LENGTH=40) {

  //* Normalize value to the specified max length if it exceeds the value
  if (maxHealth > MAX_LENGTH) {
    currentHealth = Math.round((currentHealth / maxHealth) * MAX_LENGTH);
    maxHealth = MAX_LENGTH;
  }

  const healthIcons = {
    empty: 'a',
    half: 'b',
    full: 'c',
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
    .reduce((total, slot) => total + (armor.get(playerEquipment.getEquipment(slot)?.typeId) || 0), 0)
  const maxArmor = 20;

  const armorIcons = {
    empty: 'd',
    half: 'e',
    full: 'f',
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
 * Renders the effects of the entity
 * in useable text
 * 
 * @param { import('@minecraft/server').Entity } entity 
 * 
 * @returns { { effectString: string, effectsResolvedArray: string[] } }
 */
function effectsRenderer(entity) {

  const MAX_EFFECTS_TO_RESOLVE = 6

  /**
   * @type { Array<{ name: string, id: number, is_negative: boolean }> }
   * 
   * @property { string } name - The name of the effect
   * @property { number } id - The ID of the effect
   * @property { boolean } is_negative - Whether the effect is negative
   */
  const effectList = [
    { name: 'speed', id: 1, is_negative: false },
    { name: 'slowness', id: 2, is_negative: true },
    { name: 'haste', id: 3, is_negative: false },
    { name: 'mining_fatigue', id: 4, is_negative: true },
    { name: 'strength', id: 5, is_negative: false },
    { name: 'instant_health', id: 6, is_negative: false },
    { name: 'instant_damage', id: 7, is_negative: true },
    { name: 'jump_boost', id: 8, is_negative: false },
    { name: 'nausea', id: 9, is_negative: true },
    { name: 'regeneration', id: 10, is_negative: false },
    { name: 'resistance', id: 11, is_negative: false },
    { name: 'fire_resistance', id: 12, is_negative: false },
    { name: 'water_breathing', id: 13, is_negative: false },
    { name: 'invisibility', id: 14, is_negative: false },
    { name: 'blindness', id: 15, is_negative: true },
    { name: 'night_vision', id: 16, is_negative: false },
    { name: 'hunger', id: 17, is_negative: true },
    { name: 'weakness', id: 18, is_negative: true },
    { name: 'poison', id: 19, is_negative: true },
    { name: 'wither', id: 20, is_negative: true },
    { name: 'health_boost', id: 21, is_negative: false },
    { name: 'absorption', id: 22, is_negative: false },
    { name: 'saturation', id: 23, is_negative: false },
    { name: 'levitation', id: 24, is_negative: true },
    { name: 'fatal_poison', id: 25, is_negative: true },
    { name: 'slow_falling', id: 26, is_negative: false },
    { name: 'conduit_power', id: 27, is_negative: false },
    { name: 'bad_omen', id: 28, is_negative: true },
    { name: 'village_hero', id: 29, is_negative: false },
    { name: 'darkness', id: 30, is_negative: true },
    { name: 'wind_charged', id: 31, is_negative: true },
    { name: 'weaving', id: 32, is_negative: true },
    { name: 'oozing', id: 33, is_negative: true },
    { name: 'infested', id: 34, is_negative: true },
  ]

  //* Array<'d00:00p0'>
  //* Array<'min:sec.potency;'>

  let effectString = ''
  let effectsResolved = 0
  let effectsResolvedArray = []

  effectList.forEach(effect => {
    let effectData = entity.getEffect(effect.name) || { duration: 0, amplifier: 0 }
    let effectDuration = effectData.duration;
    let effectAmplifier = effectData.amplifier;

    if (effectsResolved >= MAX_EFFECTS_TO_RESOLVE) {
      effectDuration = 0;
      effectAmplifier = 0;
    } else effectAmplifier = !effectData.typeId ? 0 : Math.min(effectAmplifier + 1, 9)
    if (effectData.typeId) effectsResolved++

    effectDuration /= TicksPerSecond;
    const effectDurationMinutes = Math.min(99, Math.floor(effectDuration / 60));
    const effectDurationSeconds = Math.floor(effectDuration % 60);

    effectString +=
      `d${effectDurationMinutes.toString().padStart(2, '0')}:${effectDurationSeconds.toString().padStart(2, '0')}` +
      `p${effectAmplifier.toString().padStart(1, '0')}`
    if (effectDuration > 0) effectsResolvedArray.push(effectData.typeId)
  })

  //* d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0
  return {
    effectString,
    effectsResolvedArray
  }

}

/**
 * 
 * Fetches and parses the states of the block
 * in a readable format
 * 
 * @param { import('@minecraft/server').Block } block 
 * 
 * @returns { Record<string, boolean | number | string> }
 */
function getBlockStates(block) {
  const blockStates = Object.getOwnPropertyNames(block.permutation.getAllStates()).sort();
  if (blockStates.length === 0) return '';
  return `\n${blockStates.map(state => `§7${state.replace(/.+:/g, '')}: ${block.permutation.getAllStates()[state]}§r`).join('\n')}`;
}

/**
 * 
 * Fetches the inventory of the block
 * 
 * @param { Block } block
 * 
 * @returns { string | string[] }
 */
function getBlockInventory(block) {
  /**
   * @type { import('@minecraft/server').Container | undefined }
   */
  const blockContainer = block.getComponent(EntityComponentTypes.Inventory)?.container
  if (blockContainer === undefined) return 'none'
  let _items = [];
  for (let i = 0; i < blockContainer.size; i++) {
    const itemStack = blockContainer.getItem(i)
    if (itemStack !== undefined) _items.push(itemStack.typeId)
  }
  return _items
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

    //* Update when player is sneaking
    _a.isPlayerSneaking = player.isSneaking;

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
      _a.effects = _a.rawHit.getEffects().map(effect => 
        _a.rawHit.getEffects().length > 3 ? {
          id: effect.typeId,
          amplifier: effect.amplifier
        } : {
          id: effect.typeId, 
          amplifier: effect.amplifier,
          effectDuration: Math.floor(effect.duration / TicksPerSecond)
        }
      ) || []
    }

    if (_a.hit) return _a;


    //* Fetch block the player is looking at
    const blockLookAt = player.getBlockFromViewDirection({
      includeLiquidBlocks: !player.isInWater,
      includePassableBlocks: !player.isInWater,
      maxDistance: max_dist
    })

    if (blockLookAt) {
      _a.type = 'tile'
      _a.rawHit = blockLookAt?.block
      _a.hit = _a.rawHit.getItemStack(1, true)?.typeId || _a.rawHit.typeId
    }

    return _a;

  } catch (e) {
    if (!(e instanceof LocationOutOfWorldBoundariesError)) log.er(e);
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
        _a.armorRenderer = armorRenderer(lookAtObject.rawHit)
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
    _a.intHealthDisplay =
      lookAtObject.rawHit.matches({ families: [ 'inanimate' ] }) ||
      (entityHp?.effectiveMax > 40 && !lookAtObject.rawHit.matches({ type: 'minecraft:player' }));
    _a.hp = Math.floor(entityHp?.currentValue);
    _a.maxHp = Math.floor(entityHp?.effectiveMax);

    if (!_a.intHealthDisplay) _a.healthRenderer = healthRenderer(Math.floor(entityHp?.currentValue), Math.floor(entityHp?.effectiveMax), lookAtObject.rawHit.matches({ type: 'minecraft:player' }) ? 20 : 40);
    else if (entityHp?.effectiveMax > 40 && !lookAtObject.rawHit.matches({ type: 'minecraft:player' })) _a.healthRenderer = 'xyyyyyyyyyyyyyyyyyyy';
    else _a.healthRenderer = 'yyyyyyyyyyyyyyyyyyyy';

    //* Set entity ID metadata
    _a.entityId = transformEntityId(lookAtObject.rawHit);

    //* Fetch entity tags
    _a.tags = getEntityTags(lookAtObject.rawHit)

    //* Set effectsRenderer metadata
    _a.effectsRenderer = effectsRenderer(lookAtObject.rawHit);

  } else if (lookAtObject.type == 'tile') {

    //* Set default properties
    _a.hit = lookAtObject.hit;

    //* Fetch block tool
    _a.tool = parseBlockTools(lookAtObject.hit)

    //* Set block item AUX metadata
    _a.itemAux = getItemAux(lookAtObject.rawHit.getItemStack(1, true) || lookAtObject.rawHit)

    //* Set block states metadata
    _a.blockStates = getBlockStates(lookAtObject.rawHit)

    //* Set block inventory metadata
    _a.inventory = getBlockInventory(lookAtObject.rawHit)

    //* Set healthRenderer placeholder value
    _a.healthRenderer = 'yyyyyyyyyyyyyyyyyyyy';

    //* Set effectsRenderer placeholder value
    _a.effectsRenderer = {
      effectString: 'none',
      effectsResolvedArray: []
    }

  }

  //* Set armorRenderer placeholder value
  if (!_a.armorRenderer) _a.armorRenderer = 'dddddddddd';

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
 * @param { lookAtObject | undefined } lookAtObject 
 * Type of object to render
 */
function displayUI(player, lookAtObject=undefined) {

  //* Fetch the namespace of the provided hit typeId
  const hitNamespace = lookAtObject?.hit?.replace(/(?<=:).+/g, '')
  if (!hitNamespace) return

  //* Only send a UI update if the value has changed
  const _L = lookAtObject.type === 'entity' ? JSON.stringify(lookAtObject) : JSON.stringify({ _a: lookAtObject.hit, _b: lookAtObject.isPlayerSneaking, _c: lookAtObject?.rawHit?.permutation?.getAllStates() });
  if (player.getDynamicProperty('r4isen1920_waila:old_log') !== _L) player.setDynamicProperty('r4isen1920_waila:old_log', _L); else return;

  //* Remove information that was once displayed on screen
  if (lookAtObject.hit === 'none') { clearUI(player); return }

  //* Transform lookAtObject to a parsed object value with metadata included
  const object = fetchLookAtMetadata(lookAtObject, hitNamespace);

  /**
   * @type { Array<import('@minecraft/server').RawMessage> }
   */
  let parseStr = [];
  /**
   * @type { Array<import('@minecraft/server').RawMessage> }
   */
  let parseStrSubtitle = [];
  /**
   * @type { string }
   */
  const nameAlias = nameAliases.get(object.hit.replace(hitNamespace, ''));
  /**
   * @typedef { object } iconTypes
   * @property { object } tile - Tile icon types
   * @property { object } entity - Entity icon types
   * 
   * @type { iconTypes }
   */
  const iconTypes = {
    tile: {
      sword: 'a',
      axe: 'b',
      pickaxe: 'c',
      shovel: 'd',
      hoe: 'e',
      armor: 'f',
      crops: 'g',
      shears: 'h',
      bucket: 'i',
      brush: 'j',
      commands: 'k',
      undefined: 'z',
    },
    entity: {
      can_climb: 'a',
      can_fly: 'b',
      can_power_jump: 'c',
      fire_immune: 'd',
      is_baby: 'e',
      is_chested: 'f',
      is_dyeable: 'g',
      is_stunned: 'h',
      is_rideable: 'i',
      is_tradeable: 'j',
      projectile: 'k',
      wants_jockey: 'l',
      tameable: 'm',
      wheat: 'n',
      potato: 'o',
      hay_bale: 'p',
      seeds: 'q',
      golden_apple: 'r',
      fish: 's',
      flowers: 't',
      fungi: 'u',
      slimeball: 'v',
      cactus: 'w',
      torchflower: 'x',
      spider_eye: 'y',
      undefined: 'z',
    }
  }

  //* Parse vanilla content
  if (hitNamespace === 'minecraft:') {

    //* _r4ui:A:-00000NaN:z;z:
    //* _r4ui:B:yyyyyyyyyyyyyyyyyyyynnnnnnnnnn:z;z:d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0d00:00p0e00

    //** -605590388693

    parseStr = [

      //* Define prefix
      { text: `_r4ui:${(object.type === 'tile' || object.hitItem) ? 'A' : 'B'}:` },

      //* Define icon via item AUX renderer || health and armor renderers
      { text: `${(object.type === 'tile' || object.hitItem) ? `${object.itemAux > 0 ? '' : '-'}${String(Math.abs(object.itemAux)).padStart(object.itemAux > 0 ? 9 : 8, '0')}` : `${object.healthRenderer}${object.armorRenderer}`}` },

      //* Define block tags
      { text: `:${iconTypes[object.type][object.type === 'tile' ? object.tool[0] : object.tags[0] || 'undefined'] || 'z'};${iconTypes[object.type][object.type === 'tile' ? object.tool[1] : object.tags[1] || 'undefined'] || 'z'}:` },

      //* Resolve status effects the entity may have
      { text: `${(object.type === 'entity' && !object.hitItem) ? `${object.effectsRenderer.effectString}e${object.effectsRenderer.effectsResolvedArray.length.toString().padStart(2, '0')}` : ''}` },

      //* Translate object name
      { translate: `${object.type === 'tile' ? `${nameAlias?.startsWith('item.') ? '' : 'tile.'}${!nameAlias ? object.hit.replace(hitNamespace, '') : nameAlias}.name` : object.hit.replace(hitNamespace, '')}` },

      //* Append block states metadata when available and player is sneaking
      { text: `${((object.type === 'tile' && player.isSneaking) ? object.blockStates : '')}` },

      //* Append specific Minecraft dropped item metadata when available
      { text: `${(object.hitItem !== undefined ? `\n§7${object.hitItem}§r` : '')}` },

      //* Append integer health metadata if health is more than the allocated value
      { text: `\n${(object.maxHp > 0 && object.maxHp <= 40 && !object.intHealthDisplay ? '\n' : '')}${object.maxHp > 40 ? `§7 ${object.maxHp < 1000000 ? `${object.hp}/${object.maxHp} (${Math.round(object.hp / object.maxHp * 100)}%)` : '∞'}§r\n` : (object.maxHp > 20 ? '\n' : '')}` },

      //* Append additional newlines for status effects' renderer padding
      { text: object.effectsRenderer.effectsResolvedArray.length < 4 ? '\n\n'.repeat(object.effectsRenderer.effectsResolvedArray.length) : `${(!object.intHealthDisplay && object.maxHp > 40) ? '\n' : '\n\n'}` },

      //* Append additional newlines for armor renderer padding
      { text: !object.armorRenderer.startsWith('dd') ? '\n' : '' },

      //* Define object namespace
      { text: `${`§9§o${hitNamespace.length > 3 ? hitNamespace.replace(/_/g, ' ').replace(':', '').toTitle().abrevCaps() : hitNamespace.replace(':', '').toUpperCase()}§r`}` }

    ]
    parseStrSubtitle = [
      { text: object.entityId }
    ]

  //* Parse non-vanilla content
  } else {

    parseStr = [

      //* Define prefix
      { text: `_r4ui:${object.type === 'tile' ? 'A' : 'B'}:` },

      //* Define health renderer | item AUX, and armor renderer values are placeholders to ensure the same character length
      { text: `${object.type === 'tile' ? '-00000NaN' : `${object.healthRenderer}dddddddddd`}` },

      //* Define block tags
      { text: `:${iconTypes[object.type][object.type === 'tile' ? object.tool[0] : object.tags[0] || 'undefined'] || 'z'};${iconTypes[object.type][object.type === 'tile' ? object.tool[1] : object.tags[1] || 'undefined'] || 'z'}:` },

      //* Resolve status effects the entity may have
      { text: `${(object.type === 'entity' && !object.hitItem) ? `${object.effectsRenderer.effectString}e${object.effectsRenderer.effectsResolvedArray.length.toString().padStart(2, '0')}` : ''}` },

      //* Translate object name
      { translate: `${object.type}.${object.hit}.name` },

      //* Append block states metadata when available and player is sneaking
      { text: `${((object.type === 'tile' && player.isSneaking) ? object.blockStates : '')}` },

      //* Append integer health metadata if health is more than the allocated value
      { text: `\n${(object.maxHp > 0 && object.maxHp <= 40 && !object.intHealthDisplay ? '\n' : '')}${object.maxHp > 40 ? `§7 ${object.maxHp < 1000000 ? `${object.hp}/${object.maxHp} (${Math.round(object.hp / object.maxHp * 100)}%)` : '∞'}§r\n` : (object.maxHp > 20 ? '\n' : '')}` },

      //* Append additional newlines for status effects' renderer padding
      { text: object.effectsRenderer.effectsResolvedArray.length < 4 ? '\n\n'.repeat(object.effectsRenderer.effectsResolvedArray.length) : `${(!object.intHealthDisplay && object.maxHp > 40) ? '\n' : '\n\n'}` },

      //* Define object namespace
      { text: `${`§9§o${hitNamespace.length > 3 ? hitNamespace.replace(/_/g, ' ').replace(':', '').toTitle().abrevCaps() : hitNamespace.replace(':', '').toUpperCase()}§r`}` }

    ]
    parseStrSubtitle = [
      { text: object.entityId }
    ]
  }

  log.trace('Render:', object)
  //* player.sendMessage(parseStr)

  //* Pass the information to the JSON UI
  player.onScreenDisplay.setTitle(parseStr, {
    subtitle: parseStrSubtitle,

    fadeInDuration: 0,
    fadeOutDuration: 0,
    stayDuration: 0,
  });

  //* Reset title properties
  // TODO: transform to native function instead of runCommand
  player.runCommand(`title @s reset`)
}

