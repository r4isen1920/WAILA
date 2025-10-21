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

import {
	EntityComponentTypes,
	EntityEquippableComponent,
	EquipmentSlot,
	Player,
} from "@minecraft/server";



//#region Functions
export function getMainHandContext(player: Player): MainHandContext {
	try {
		const equippable = player.getComponent(
			EntityComponentTypes.Equippable,
		) as EntityEquippableComponent | undefined;
		const mainhand = equippable?.getEquipment(EquipmentSlot.Mainhand);
		if (!mainhand) {
			return { itemTypeId: "__r4ui:none", tags: [] };
		}
		return {
			itemTypeId: mainhand.typeId ?? "__r4ui:none",
			tags: mainhand.getTags(),
		};
	} catch {
		return { itemTypeId: "__r4ui:none", tags: [] };
	}
}



//#region Types
export interface MainHandContext {
	itemTypeId: string;
	tags: string[];
}
