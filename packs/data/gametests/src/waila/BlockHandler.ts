import { Block, BlockInventoryComponent, EntityComponentTypes } from "@minecraft/server";
import { LookAtBlock } from "../types/LookAtObjectInterface";
import { BlockRenderData } from "../types/LookAtObjectMetadataInterface";
import { LookAtObjectTypeEnum } from "../types/LookAtObjectTypeEnum";
import blockTools from "../data/blockTools.json";
import blockIds from "../data/blockIds.json";

/**
 * Handles block-specific operations for WAILA
 */
export class BlockHandler {
  /**
   * Creates lookup data for a block
   */
  static createLookupData(block: Block): LookAtBlock {
    let hitId: string;
    try {
      const itemStack = block.getItemStack(1, true);
      hitId = itemStack?.typeId ?? block.typeId;
    } catch (e) {
      hitId = block.typeId;
    }
    
    return {
      type: LookAtObjectTypeEnum.TILE,
      hitIdentifier: hitId,
      block: block,
      viewAdditionalProperties: false // Will be set by caller
    };
  }
  
  /**
   * Gets the AUX value for a block ID
   */
  static getItemAux(blockId: string): number {
    const blockIdsType: { [key: string]: string | number } = blockIds;
    const auxValue = blockIdsType[blockId];
    if (auxValue === undefined) return NaN;
    return Number(auxValue) * 65536;
  }
  
  /**
   * Parses block tools data to determine which tools work with this block
   */
  static parseBlockTools(blockId: string): string[] {
    const namespaceRemoved = blockId.replace(/(?<=:).+/g, "");
    const matches = blockTools.filter(
      (tools) =>
        (tools.value.some((block) => namespaceRemoved.includes(block)) ||
           tools.value.some((block) => blockId.includes(block))) &&
        !tools.value.some(
          (block) =>
            block.startsWith("!") &&
            (namespaceRemoved.includes(block.substring(1)) ||
               blockId.includes(block.substring(1)))
        )
    );
    
    if (matches.length > 0) {
      return matches.slice(0, 2).map((match) => match.type);
    } else {
      return ["undefined", "undefined"];
    }
  }
  
  /**
   * Gets block states in a readable format
   */
  static getBlockStates(block: Block): string {
    try {
      const permutation = block.permutation;
      const states = permutation.getAllStates();
      const blockStates = Object.keys(states).sort();
      if (blockStates.length === 0) return "";
      return `\n${blockStates
        .map((state) => `§7${state.replace(/.+:/g, "")}: ${states[state]}§r`)
        .join("\n")}`;
    } catch (e) {
      return "";
    }
  }
  
  /**
   * Gets block inventory contents
   */
  static getBlockInventory(block: Block): string | string[] {
    try {
      const inventoryComponent = block.getComponent(
        EntityComponentTypes.Inventory
      ) as BlockInventoryComponent | undefined;
      const blockContainer = inventoryComponent?.container;
      if (!blockContainer) return "none";
      
      let items: string[] = [];
      for (let i = 0; i < blockContainer.size; i++) {
        const itemStack = blockContainer.getItem(i);
        if (itemStack) {
          items.push(itemStack.typeId);
        }
      }
      return items.length > 0 ? items : "empty";
    } catch (e) {
      if (e instanceof Error && e.message.includes("Component")) {
        return "none";
      }
      return "error";
    }
  }
  
  /**
   * Creates block render data for UI display
   */
  static createRenderData(block: Block, blockId: string): BlockRenderData {
    return {
      tool: this.parseBlockTools(blockId),
      blockStates: this.getBlockStates(block),
      inventory: this.getBlockInventory(block)
    };
  }
}
