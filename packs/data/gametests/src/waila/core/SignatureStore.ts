import { Player } from "@minecraft/server";

const PROPERTY_SIGNATURE = "r4isen1920_waila:old_log";

export class SignatureStore {
	public isDuplicate(player: Player, signature: string): boolean {
		const previous = player.getDynamicProperty(PROPERTY_SIGNATURE) as string | undefined;
		if (previous === signature) return true;

		player.setDynamicProperty(PROPERTY_SIGNATURE, signature);
		return false;
	}

	public clear(player: Player): void {
		player.setDynamicProperty(PROPERTY_SIGNATURE, undefined);
	}
}
