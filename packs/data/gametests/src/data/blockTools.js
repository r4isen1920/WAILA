
/**
 * @typedef { Object } blockTools
 * 
 * @property { String } type
 * The type of tool this set will use
 * @property { Array } value
 * The blocks this tool can be used on
 */

/**
 * 
 * @author
 * r4isen1920
 * 
 * Lists all tools and the
 * correct blocks they can be
 * used on
 * 
 * @type { Array<blockTools> }
 */
export const blockTools = [
  {
    type: 'commands',
    value: [
      'barrier',
      'command_block',
      'light_block',
      'structure_air',
      'structure_block',
    ]
  },
  {
    type: 'shears',
    value: [
      'carpet',
      'leaves',
      'root',
      'sprout',
      'vine',
      'waterlily',
      'weed',
      'wool',
      'minecraft:seagrass',
      '!seed',
    ]
  },
  {
    type: 'bucket',
    value: [
      'bubble',
      'lava',
      'powder_snow',
      'water_bucket',
    ]
  },
  {
    type: 'brush',
    value: [
      'minecraft:suspicious_sand',
      'minecraft:suspicious_gravel'
    ]
  },
  {
    type: 'hoe',
    value: [
      'farmland',
      'leaves',
      'sculk',
      'sponge',
      'wart_block',
      'minecraft:dried_kelp',
      'minecraft:hay_block',
      'minecraft:moss_block',
      'minecraft:shroomlight',
      'minecraft:target',
    ]
  },
  {
    type: 'axe',
    value: [
      'acacia',
      'bamboo',
      'bed',
      'bookshelf',
      'birch',
      'cherry',
      'chest',
      'fence',
      'hyphae',
      'jungle',
      'log',
      'mangrove',
      'mushroom_block',
      'oak',
      'plank',
      'sign',
      'spruce',
      'stem',
      'wood',
      'minecraft:barrel',
      'minecraft:bee_nest',
      'minecraft:beehive',
      'minecraft:campfire',
      'minecraft:cartography_table',
      'minecraft:composter',
      'minecraft:crafting_table',
      'minecraft:daylight_detector',
      'minecraft:fletching_table',
      'minecraft:jukebox',
      'minecraft:ladder',
      'minecraft:lectern',
      'minecraft:smithing_table',
    ]
  },
  {
    type: 'sword',
    value: [
      'pumpkin',
      'minecraft:cocoa',
      'minecraft:melon_block',
      'minecraft:web',
      '!seed',
    ]
  },
  {
    type: 'shovel',
    value: [
      'concrete_powder',
      'farmland',
      'grass',
      'sand',
      'snow',
      'minecraft:clay',
      'minecraft:coarse_dirt',
      'minecraft:dirt',
      'minecraft:gravel',
      'minecraft:mud',
      'minecraft:mycelium',
      'minecraft:podzol',
      'minecraft:soul_soil',
      '!stone',
      '!suspicious',
      '!wall',
    ]
  },
  {
    type: 'pickaxe',
    value: [
      'amethyst',
      'basalt',
      'blackstone',
      'brick',
      'coal',
      'copper',
      'concrete',
      'deepslate',
      'diamond',
      'dripstone',
      'emerald',
      'gold',
      'hardened_clay',
      'furnace',
      'ice',
      'iron',
      'lantern',
      'nylium',
      'obsidian',
      'ore',
      'prismarine',
      'purpur',
      'quartz',
      'rail',
      'redstone',
      'stone',
      'terracotta',
      'minecraft:ancient_debris',
      'minecraft:andesite',
      'minecraft:anvil',
      'minecraft:bell',
      'minecraft:beacon',
      'minecraft:bone_block',
      'minecraft:brewing_stand',
      'minecraft:cauldron',
      'minecraft:chain',
      'minecraft:conduit',
      'minecraft:diorite',
      'minecraft:dispenser',
      'minecraft:dropper',
      'minecraft:enchanting_table',
      'minecraft:granite',
      'minecraft:hopper',
      'minecraft:lightning_rod',
      'minecraft:lodestone',
      'minecraft:magma',
      'minecraft:mob_spawner',
      'minecraft:netherite_block',
      'minecraft:netherrack',
      'minecraft:observer',
      'minecraft:packed_mud',
      'minecraft:respawn_anchor',
      'minecraft:shulker_box',
      'minecraft:smoker',
      'minecraft:tuff',
      'minecraft:undyed_shulker_box',
      '!concrete_powder',
    ]
  },
  {
    type: 'crops',
    value: [
      'beetroot',
      'berries',
      'berry',
      'cactus',
      'carrot',
      'chorus_flower',
      'chorus_fruit',
      'chorus_plant',
      'cocoa',
      'crop',
      'flower',
      'fungus',
      'kelp',
      'melon',
      'mushroom',
      'nether_wart',
      'pickle',
      'pitcher',
      'potato',
      'pumpkin',
      'sapling',
      'seed',
      'sugar_cane',
      'torchflower',
      'wheat',
    ]
  }
]
