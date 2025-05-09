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
      const namespacesType = namespaces as Record<string, Namespace>;
      const [blockNamespace, blockName] = blockId.split(":");

      const namespaceData = namespacesType[blockNamespace];
      const texturePath = namespaceData?.textures?.root || "";

      // Handle cases where namespace or texture list is missing or empty
      if (!namespaceData?.textures?.list || namespaceData.textures.list.length === 0) {
         const isInBlockCatalog = BlockTypes.get(blockId) !== undefined;
         if (isInBlockCatalog) {
            // It's a block, but no texture list to find a specific item icon. Use aux.
            this.logger.debug(`resolveIcon (early exit): No texture list for ${blockNamespace}. Block ${blockId} is in catalog. Using aux.`);
            return this.getItemAux(blockId);
         } else {
            // It's an item (not a block), and no texture list. Assume direct name mapping.
            this.logger.debug(`resolveIcon (early exit): No texture list for ${blockNamespace}. Item ${blockId} not in catalog. Using default name.`);
            return `${texturePath}${blockName}`;
         }
      }

      const rawTextureList = namespaceData.textures.list; // Can be (string | { [key: string]: string })[]
      let foundItemTexture: string | null = null;

      // 1. Direct match phase
      // Priority 1: Object key match (e.g., { "bed": "bed_white" })
      for (const entry of rawTextureList) {
         if (typeof entry === 'object' && entry !== null && Object.prototype.hasOwnProperty.call(entry, blockName)) {
            foundItemTexture = entry[blockName];
            break; 
         }
      }

      // Priority 2: Direct string match (e.g., "apple")
      if (foundItemTexture === null) {
         for (const entry of rawTextureList) {
            if (typeof entry === 'string' && entry === blockName) {
               foundItemTexture = blockName;
               break;
            }
         }
      }
      
      // 2. Complex match phase (if no direct match found)
      if (foundItemTexture === null) {
         const blockNameParts = blockName.split('_');

         // Only attempt complex match if blockName has multiple parts (e.g., "oak_log")
         if (blockNameParts.length > 1) {
            // Prepare a flat list of all available texture strings for complex matching
            const textureStringsForComplexMatch: string[] = [];
            for (const entry of rawTextureList) {
                if (typeof entry === 'string') {
                    textureStringsForComplexMatch.push(entry);
                } else if (typeof entry === 'object' && entry !== null) {
                    textureStringsForComplexMatch.push(...Object.values(entry));
                }
            }

            for (const textureString of textureStringsForComplexMatch) { // Iterate over normalized strings
               const textureFileName = textureString.split('/').pop() ?? textureString;
               const textureParts = textureFileName.split('_');

               let matchCount = 0;
               let totalMatchedLength = 0;
               const matchedTextureIndices = new Set<number>();
               const matchedBlockIndices = new Set<number>();

               // First pass: Check for exact part matches
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

               // Second pass: Check for common prefix matches for parts not already matched
               const minPrefixLength = 4;
               for (let i = 0; i < blockNameParts.length; i++) {
                  if (matchedBlockIndices.has(i)) continue;
                  const blockPart = blockNameParts[i];
                  for (let j = 0; j < textureParts.length; j++) {
                     if (matchedTextureIndices.has(j)) continue;
                     const texturePart = textureParts[j];

                     let commonPrefixLen = 0;
                     const lenToCompare = Math.min(blockPart.length, texturePart.length);
                     for (let k = 0; k < lenToCompare; k++) {
                        if (blockPart[k] === texturePart[k]) commonPrefixLen++;
                        else break;
                     }

                     if (commonPrefixLen >= minPrefixLength) {
                        matchCount++;
                        totalMatchedLength += commonPrefixLen;
                        matchedTextureIndices.add(j);
                        matchedBlockIndices.add(i);
                        break;
                     }
                  }
               }

               const originalBlockNameLength = blockName.replace(/_/g, '').length;
               const textureNameLength = textureFileName.replace(/_/g, '').length; // Use textureFileName

               if (originalBlockNameLength === 0 || textureNameLength === 0) continue; // Avoid division by zero

               const lengthRatio = Math.min(originalBlockNameLength, textureNameLength) / 
                                  Math.max(originalBlockNameLength, textureNameLength);
               
               // Thresholds for considering a complex match valid
               const minMatchCountForComplex = 2;
               const minTotalMatchedLengthRatio = 0.8;
               const minMatchCountRatio = blockNameParts.length > 0 ? 0.8 : 1.0; // Ensure all parts match if only one part
               const minLengthRatioSimilarity = 0.7;

               const isSufficientlyCompleteMatch = matchCount >= blockNameParts.length;
               const isStrongPartialMatch = 
                  matchCount >= minMatchCountForComplex && 
                  totalMatchedLength >= originalBlockNameLength * minTotalMatchedLengthRatio && 
                  matchCount >= blockNameParts.length * minMatchCountRatio;

               if ((isSufficientlyCompleteMatch || isStrongPartialMatch) && lengthRatio >= minLengthRatioSimilarity) {
                  foundItemTexture = textureString; // Use the full texture string from the list
                  break; 
               }
            }
         }
      }

      const isInBlockCatalog = BlockTypes.get(blockId) !== undefined;
      // Render as an item if:
      // 1. A specific item texture was found (foundItemTexture is not null).
      // OR
      // 2. The blockId does not correspond to a placeable block (i.e., it's an item like a sword or apple).
      const shouldRenderAsItem = foundItemTexture !== null || !isInBlockCatalog;

      this.logger.debug(
         `resolveIcon: blockId='${blockId}', namespace='${blockNamespace}', name='${blockName}', ` +
         `foundTexture='${foundItemTexture}', inCatalog=${isInBlockCatalog}, renderAsItem=${shouldRenderAsItem}`
      );

      if (shouldRenderAsItem) {
         // If foundItemTexture is null at this point, it implies !isInBlockCatalog was true (it's an item),
         // and no specific texture (direct or complex match) was found.
         // In this scenario, blockName itself is used as the texture file name.
         return `${texturePath}${foundItemTexture ?? blockName}`;
      } else {
         // This case is reached if:
         // - foundItemTexture is null (no suitable item texture was found through direct or complex matching)
         // - AND isInBlockCatalog is true (it's a placeable block).
         // Fall back to using the block's auxiliary value for rendering.
         return this.getItemAux(blockId);
      }
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
