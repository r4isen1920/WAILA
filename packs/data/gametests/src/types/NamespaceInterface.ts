
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
   author?: string | string[];
   /**
    * The texture data to be used in rendering for this namespace.
    */
   textures: NamespaceTextures;
}

/**
 * Represents the texture data for a namespace.
 */
interface NamespaceTextures {
   /**
    * Root texture path for this namespace.
    * This is prepended to the textures path.
    */
   root: string;
   /**
    * The list of textures that are available for this namespace.
    * We will use this to determine if a texture is available, and if so, we will try to render it.
    */
   list?: string[];
}
