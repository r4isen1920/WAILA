
/**
 * @typedef { Object } entityInteractions
 * 
 * @property { String } type
 * The type of item these set of mobs can be used with
 * @property { Array } value
 * The mobs that can be used with this item
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
 * @type { Array<entityInteractions> }
 */
export const entityInteractions = [
  {
    type: 'can_climb',
    value: [
      'spider'
    ]
  },
  {
    type: 'is_tradeable',
    value: [
      'merchant',
      'wandering_trader',
      'villager'
    ]
  },
  {
    type: 'is_rideable',
    value: [
      'boat',
      'camel',
      'donkey',
      'horse',
      'minecart',
      'mule',
      'pig',
      'strider',
      '!piglin'
    ]
  },
  {
    type: 'tameable',
    value: [
      'cat',
      'donkey',
      'horse',
      'llama',
      'mule',
      'parrot',
      'skeleton_horse',
      'wolf'
    ]
  },
  {
    type: 'golden_apple',
    value: [
      'horse',
      'donkey'
    ]
  },
  {
    type: 'wheat',
    value: [
      'cow',
      'goat',
      'mooshroom',
      'sheep'
    ]
  },
  {
    type: 'potato',
    value: [
      'pig',
      '!piglin'
    ]
  },
  {
    type: 'seeds',
    value: [
      'chicken',
      'parrot'
    ]
  },
  {
    type: 'fish',
    value: [
      'cat',
      'ocelot'
    ]
  },
  {
    type: 'hay_bale',
    value: [
      'llama'
    ]
  },
  {
    type: 'flowers',
    value: [
      'bee',
      'rabbit'
    ]
  },
  {
    type: 'fungi',
    value: [
      'hoglin',
      'strider'
    ]
  },
  {
    type: 'slimeball',
    value: [
      'frog'
    ]
  },
  {
    type: 'cactus',
    value: [
      'camel'
    ]
  },
  {
    type: 'torchflower',
    value: [
      'sniffer'
    ]
  },
  {
    type: 'spider_eye',
    value: [
      'armadillo'
    ]
  }
]
