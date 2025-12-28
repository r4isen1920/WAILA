# Copilot instructions for WAILA

Purpose: Help AI coding agents work productively in this repo by knowing the architecture, workflows, and project-specific conventions.

## Big picture
- This is a Minecraft: Bedrock Edition add-on built with Regolith. Output packs live under `packs/BP` (behavior) and `packs/RP` (resource). TypeScript sources are in `packs/data/gametests/src`, compiled and bundled into `BP/scripts/main.js` via Regolith filters.
- Core runtime: `@minecraft/server` and `@minecraft/server-ui` Script API v2.x. Utilities from `@bedrock-oss/bedrock-boost` (logging, schedulers) and `@bedrock-oss/stylish` (command/UI helpers).
- Entry point is `src/main.ts` which wires up string helpers, settings/command, and the WAILA loop.
- Main components:
  - `waila/Waila.ts`: Orchestrates per-tick look-at detection, metadata resolution, and rendering to title UI. Uses `PlayerPulseScheduler` after world load.
  - `waila/BlockHandler.ts`: Block-side data: hit identifier resolution, tool icons, block state dump, inventory copying to hidden slots to render icons.
  - `waila/EntityHandler.ts`: Entity-side data: health/armor/effect renderers, item entity handling, interaction tags.
  - `waila/Settings.ts`: Player-scoped settings with dynamic properties and an in-game modal UI (`/r4isen1920_waila:waila`).
  - `Init.ts`: AfterWorldLoad utility to avoid early-execution issues introduced in Script API 2.0.
  - `types/` and `data/`: JSON-driven rules (tools, interactions, name aliases, ignores) and strong types that shape render and lookup objects.

## Build and dev workflow
- Regolith is the build tool. From repo root:
  - Build dev (debug, no minify, sourcemaps injected): `regolith run` or profile `default`.
  - Build release scripts only: `regolith run --profile scripts`.
  - Package .mcaddon: `regolith run --profile build` (produces `publish` artifacts via packer profiles `build-dev`/`build-release`).
- Script bundling is configured in `config.json` via the `gametests` filter; output goes to `packs/BP/scripts/main.js` and targets `@minecraft/server@2.1.0` and `@minecraft/server-ui@2.0.0`.
- TypeScript config is `packs/data/gametests/tsconfig.json` (NodeNext modules, strict, decorators enabled, JSON imports on). Linting is `eslint.config.mjs` with stylistic and minecraft rules.

## Runtime conventions and patterns
- Dynamic properties namespace: `r4isen1920_waila:*` (e.g., `old_log`, `item_holder_id`, `inventory_item_holder_slots`, and per-setting keys). Preserve this naming when adding features.
- Hidden icon rendering: `BlockHandler.resolveIcon()` temporarily moves items into a dedicated invisible entity with id stored in `item_holder_id`, reserves player slot 17 for the target icon, and mirrors container indices for block inventories (indices 9..35). Always pair with `resetIcon()`/`resetInventoryIcons()` to avoid orphaned items.
- Look-at pipeline:
  1) Prefer entity from `getEntitiesFromViewDirection`; else block via `getBlockFromViewDirection` with liquid/passable rules respecting `player.isInWater`.
  2) Compute a stable `hitIdentifier` (for blocks, use item form when available via `getItemStack(1, true)`). Use `__r4ui:none` sentinel when nothing is hit.
  3) Metadata resolution renders UI-specific strings (health/armor/effects/tool icons) and translation keys. Only recompute and update UI when the comparison payload changes (`r4isen1920_waila:old_log`).
- Extended info: When sneaking and `displayBlockStates` is on, block state lines (`getAllStates()` pretty-printed) are appended; also `extendedDisplayPosition` may override the anchor.
- Localization: Resource-pack `texts/*` contains `waila.*` keys. Display names prefer nameTag when present; otherwise localization keys from entities/blocks, with `nameAliases.json` mapping for block overrides and special-casing item frames.
- Effects and health: `EntityHandler` caps effect render resolves and toggles between heart bar vs integer HP when entities are inanimate or have high HP (>40). Armor is computed from `data/armor.json` by summing equipment pieces.
- Tags/icons: Tool and interaction icons are synthesized as compact strings consumed by the UI (`ui/*.r4ui`). Tag selection honors negations and cross-checks player mainhand item via `remarks` rules to adjust icon remarks.

## Files to know
- Behavior: `packs/BP/manifest.json` and UI files in `packs/RP/ui` and textures under `packs/RP/textures/r4isen1920/waila`.
- Game scripts: `packs/data/gametests/src/**` with `waila/*`, `types/*`, and `data/*` JSONs.
- Build: `config.json` Regolith profiles; `packs/data/gametests/eslint.config.mjs`; `tsconfig.json`.

## How to add features safely
- New render data: Extend `types/LookAtObjectMetadataInterface.ts` and populate from corresponding handler; ensure serialization only includes primitives/strings used by the title UI.
- New tags or tool logic: Update `data/blockTools.json` or `data/entityInteractions.json` and keep matcher semantics consistent with `checkRemarkConditionRule()`.
- Settings: Add to `WailaSettings.SETTINGS`; provide translation tokens in `packs/**/texts/*.lang`; the modal UI auto-renders from schema.
- UI wiring: Title text strings are structured markers parsed by RP UI. Keep prefixes like `_r4ui:A:`/`_r4ui:B:` and anchor flags `__r4ui:anchor.*__` intact.

## Example edits
- Showing extra info for blocks with inventories: Use `BlockHandler.getBlockInventory()` and `resolveInventoryIcons()` to mirror contents, then push `resetInventoryIcons()` after title display (see `Waila.displayUI()` cleanup with `system.runTimeout`).
- Adding a new effect: Expand the ordered effect list in `EntityHandler.effectsRenderer()` with `name`, `id`, and negativity; the renderer will include it up to the cap.

## Gotchas
- Early-execution pitfalls: Always run setup inside `AfterWorldLoad` to avoid Script API 2.0 early phase issues.
- Water context: When underwater, `includeLiquidBlocks` and `includePassableBlocks` flip; keep alignment with current behavior.
- Inventory safety: If an item holder entity despawns, handlers log and clear the reserved slot—ensure cleanup paths are called even on errors.
- Performance: UI updates only when the comparison payload changes; preserve this to avoid per-tick title spam.

## Commands and quick actions
- Open settings UI in-game: `/r4isen1920_waila:waila`.
- Build dev: run `regolith run` at repo root (Windows PowerShell is fine). Lint TypeScript by running ESLint at `packs/data/gametests`.

If anything here is unclear or you notice a missing pattern (e.g., UI token schema details), tell us which section to expand and we’ll iterate.

## UI token protocol (RP parsing) 🧩
WAILA encodes display data into the title string the RP UI parses. Minecraft UI accepts JSON regardless of file extension; see `packs/RP/ui/*`.

- Entry and binding:
  - `hud_screen.json` binds `#hud_title_text_string` into `hud_title_text` and hides the vanilla title when it starts with `_r4ui:`.
  - `_ui_defs.json` includes `ui/r4isen1920/waila/*.r4ui`.
- Modes and anchors:
  - Prefix selects mode: `_r4ui:A:` for block/item-entity; `_r4ui:B:` for non-item entities.
  - Anchor flag appended anywhere: `__r4ui:anchor.<pos>__` where `<pos>` ∈ {top_left, top_middle, top_right, left_middle, center, right_middle, bottom_left, bottom_middle, bottom_right}. `centerer` extracts this and positions the panel.
- Title payload layout (simplified):
  - Mode A (tile): `_r4ui:A:<toolTags><name>[\n itemContext][\n healthText][padding]\n§9§o<namespace>§r`.
  - Mode B (entity): `_r4ui:B:<20 hearts><10 armor>:<2 tag pairs>:<effects blob><name>...\n§9§o<namespace>§r`.
- Tag icons encoding (used by `tile.block_tags`):
  - Two pairs serialized as `id,remark;id,remark:` where:
    - For tiles, RP reads icons from `textures/r4isen1920/waila/icons/tags/tile/<id>`.
    - For entities, from `textures/r4isen1920/waila/icons/tags/entity/<id>`.
    - `remark` overlays from `textures/r4isen1920/waila/icons/tags/<remark>`.
  - UI expects placeholders `zz,z` when unavailable to keep string slice offsets stable.
- Health/armor encoding (Mode B):
  - Hearts: 20 chars where each is one of `{a (empty), b (half), c (full), x/y (padding sentinels)}`. Split into two rows by UI (`health_renderer_0/1`).
  - Armor: 10 chars where each is `{d (empty), e (half), f (full)}` (`armor_renderer`).
- Effects encoding (Mode B):
  - A continuous blob of 34 fixed-width segments, each `dMM:SSpA` (d prefix, 5 chars duration, p prefix, 1 char amplifier). Missing/overflow slots use `d00:00p0`.
  - UI computes `eNN` where `NN` is the count of non-zero effects and uses vertical vs horizontal render based on it. Expanded shows icon + localized name + roman numeral; mini mode shows icon with suffix.
- Subtitle usage:
  - `subtitle` carries: entity portrait discriminator (`entityId` as 12-digit, `'0000000000000'` to suppress portrait), block states: prepend `__r4ui:block_states__` then the multiline list.
- Name and namespace rules:
  - Title strips `tile.`/`entity.` and `.name` for display; `_r4ui:humanoid.` token nudges portrait offset for players.
  - The italic blue line shows either pack name or `Registry[namespace].name` and creator when sneaking with extended info.
- Inventory mirroring:
  - Tile icon uses hotbar slot 17; block inventories map to indices `9..35`. The `item_aux_inv_renderer` binds to `hotbar_items[#item_id_aux]` per `collection_index`.
  - Ensure cleanup via `resetInventoryIcons()` and `resetIcon()` on UI update/clear.

Example: a non-player entity with two tags and 3 effects begins like `_r4ui:B:ccccccccccccccccccccdddddddddd:ab,t;cd,f:d00:45p3d01:10p1d10:00p2...` followed by translated name and namespace, plus an anchor flag.