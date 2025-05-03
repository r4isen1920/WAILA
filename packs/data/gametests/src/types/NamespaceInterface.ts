
/**
 * Represents a namespace that includes information needed for rendering objects that are looked at.
 * We can leverage this to render objects that would be otherwise not available just within the vanilla game.
 */
export default interface Namespace {
   /**
    * What the namespace is known for.
    * This is whats directly visible to the player in-game.
    */
   display_name: string;
   /**
    * Root texture path for this namespace.
    * We will assume that all the textures for this namespace are within this folder.
    */
   texture_root_path: string;
   /**
    * List of blocks that are rendered as items instead of their 3D isometric model.
    * It is mapped to the block identifier to the corresponding item texture file name.
    */
   texture_mapping?: { [key: string]: string };
}
