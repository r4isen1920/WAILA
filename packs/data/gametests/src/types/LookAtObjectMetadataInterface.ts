import { LookAtObjectTypeEnum } from "./LookAtObjectTypeEnum";

/**
 * UI display metadata for any object type
 */
export interface LookAtObjectMetadata {
  // Common properties
  type: LookAtObjectTypeEnum;
  hit: string;
  itemAux: number;
  displayName: string;
  namespace: string;
  
  // UI rendering data
  renderData: BlockRenderData | EntityRenderData;
}

/**
 * Rendering data for blocks
 */
export interface BlockRenderData {
  tool: string[];
  blockStates: string;
  inventory: string | string[];
}

/**
 * Rendering data for entities
 */
export interface EntityRenderData {
  entityId: string;
  tags: string[];
  
  // Health info
  hp: number;
  maxHp: number;
  intHealthDisplay: boolean;
  healthRenderer: string;
  
  // Additional entity metadata
  armorRenderer: string;
  effectsRenderer: {
    effectString: string;
    effectsResolvedArray: string[];
  };
  
  // For item entities
  hitItem?: string;
}