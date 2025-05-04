import { Block, BlockInventoryComponent, BlockTypes, EntityComponentTypes } from "@minecraft/server";
import { Logger } from "@bedrock-oss/bedrock-boost";

import { LookAtBlock } from "../types/LookAtObjectInterface";
import Namespace from "../types/NamespaceInterface";
import { BlockRenderData } from "../types/LookAtObjectMetadataInterface";
import { LookAtObjectTypeEnum } from "../types/LookAtObjectTypeEnum";

import blockTools from "../data/blockTools.json";
import blockIds from "../data/blockIds.json";
import namespaces from "../data/namespaces.json";

/**
 * Handles block-specific operations for WAILA
 */
export class BlockHandler {
   private static logger = Logger.getLogger("BlockHandler");

   /**
    * Creates lookup data for a block
    */
   static createLookupData(block: Block): LookAtBlock {
      let hitId: string;
      try {
         const itemStack = block.getItemStack(1, true);
         hitId = itemStack?.typeId ?? block.typeId;
      } catch {
         hitId = block.typeId;
      }

      return {
         type: LookAtObjectTypeEnum.TILE,
         hitIdentifier: hitId,
         block: block,
         viewAdditionalProperties: false,
      };
   }

   /**
    * Returns either the item aux or the icon texture path. Prefers the icon texture path if its rendered as an item.
    */
   static resolveIcon(blockId: string): string | number {
      const namespacesType: { [key: string]: Namespace } = namespaces;
      const [blockNamespace, blockName] = blockId.split(":");
      const texturePath = namespacesType[blockNamespace]?.textures?.root || "";

      let foundItemTexture: string | null = null;
      if (namespacesType[blockNamespace]) {
         const namespace = namespacesType[blockNamespace];
         if (!namespace.textures || !namespace.textures.list) {
            return texturePath + blockName;
         }

         // Direct match
         if (namespace.textures.list.includes(blockName)) {
            foundItemTexture = blockName;
         } else {
            // Perform complex match otherwise
            const blockNameParts = blockName.split('_');

            if (blockNameParts.length > 1) {
               for (const texture of namespace.textures.list) {
                  const textureParts = texture.split('_');

                  let matchCount = 0;
                  let totalMatchedLength = 0;

                  const matchedTextureIndices = new Set<number>();
                  const matchedBlockIndices = new Set<number>();

                  // First pass: Check for exact matches and mark those parts
                  for (let i = 0; i < blockNameParts.length; i++) {
                     const blockPart = blockNameParts[i];
                     for (let j = 0; j < textureParts.length; j++) {
                        if (matchedTextureIndices.has(j)) continue;
                        
                        const texturePart = textureParts[j];
                        if (blockPart === texturePart) {
                           matchCount++;
                           totalMatchedLength += blockPart.length;
                           matchedTextureIndices.add(j);
                           matchedBlockIndices.add(i);
                           break;
                        }
                     }
                  }

                  // Second pass: Check for prefix matches for parts not already matched
                  for (let i = 0; i < blockNameParts.length; i++) {
                     if (matchedBlockIndices.has(i)) continue;

                     const blockPart = blockNameParts[i];
                     for (let j = 0; j < textureParts.length; j++) {
                        if (matchedTextureIndices.has(j)) continue;

                        const texturePart = textureParts[j];

                        const minPrefixLength = 4;
                        const maxPrefixLength = Math.min(blockPart.length, texturePart.length);

                        if (maxPrefixLength >= minPrefixLength) {
                           const prefix = blockPart.substring(0, maxPrefixLength);
                           if (texturePart.startsWith(prefix)) {
                              matchCount++;
                              totalMatchedLength += prefix.length;
                              matchedTextureIndices.add(j);
                              matchedBlockIndices.add(i);
                              break;
                           }
                        }
                     }
                  }

                  const originalBlockNameLength = blockName.replace(/_/g, '').length;

                  const textureNameLength = texture.replace(/_/g, '').length;
                  const lengthRatio = Math.min(originalBlockNameLength, textureNameLength) / 
                                     Math.max(originalBlockNameLength, textureNameLength);

                  // Consider it a match if matching ALL parts of the block name
                  // or meeting our previous criteria but with stronger thresholds
                  // Also ensure the names are not too different in length
                  if ((matchCount >= blockNameParts.length || 
                       (matchCount >= 2 && totalMatchedLength >= originalBlockNameLength * 0.8 && 
                        matchCount >= blockNameParts.length * 0.8)) &&
                      // Names shouldn't be too different in length (at least 70% similar)
                      lengthRatio >= 0.7) {
                     foundItemTexture = texture;
                     break;
                  }
               }
            }
         }
      }

      // Attempt to render if the item is either in the texture list or not a placeable block
      const isInBlockCatalog = BlockTypes.get(blockId) !== undefined;
      const shouldRenderAsItem = foundItemTexture !== null || !isInBlockCatalog;

      this.logger.debug(blockNamespace, blockName, foundItemTexture, shouldRenderAsItem);

      return shouldRenderAsItem ?
         `${texturePath}${foundItemTexture ?? blockName}` :
         this.getItemAux(blockId);
   }

   /**
    * Gets the AUX value for a block ID
    */
   static getItemAux(blockId: string): number {
      const blockIdsType: { [key: string]: string | number } = blockIds;
      const auxValue = blockIdsType[blockId];
      if (auxValue === undefined) {
         return NaN;
      }
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
      } catch {
         return "";
      }
   }

   /**
    * Gets block inventory contents
    */
   static getBlockInventory(block: Block): string | string[] {
      try {
         const inventoryComponent = block.getComponent(EntityComponentTypes.Inventory) as BlockInventoryComponent | undefined;
         const blockContainer = inventoryComponent?.container;
         if (!blockContainer) return "none";

         const items: string[] = [];
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
         inventory: this.getBlockInventory(block),
      };
   }
}
