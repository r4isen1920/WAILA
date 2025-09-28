import { BindThis, CustomCmd } from "@bedrock-oss/stylish";
import { CommandPermissionLevel, CustomCommand, CustomCommandOrigin, CustomCommandParamType, CustomCommandResult, CustomCommandStatus, Player } from "@minecraft/server";


@CustomCmd
export default class WailaCommand implements CustomCommand {
    static readonly NAMESPACE = 'r4isen1920_waila';

    readonly name = WailaCommand.NAMESPACE + ':waila';
    readonly description = `Set the WAILA display on or off`; //? Localization support for command description is not yet supported for some reason !!!1!!1
    readonly permissionLevel = CommandPermissionLevel.Any;
    readonly cheatsRequired = false;


    readonly mandatoryParameters = [
        {
            name: 'isEnabled',
            type: CustomCommandParamType.Boolean,
        },
        // {
        //     name: WailaCommand.NAMESPACE + ':pos',
        //     type: CustomCommandParamType.Enum,
        //     values: [
        //         'top_left', 'top_middle', 'top_right',
        //         'left_middle', 'center', 'right_middle',
        //         'bottom_left', 'bottom_middle', 'bottom_right',
        //     ]
        // }
    ];


    @BindThis
    run(origin: CustomCommandOrigin, isEnabled: boolean): CustomCommandResult {
        const { sourceEntity } = origin;
        if (!sourceEntity || !sourceEntity.isValid || !(sourceEntity instanceof Player)) {
            return {
                status: CustomCommandStatus.Failure,
                message: 'This command can only be run by a player',
            };
        }
        sourceEntity.setDynamicProperty(WailaCommand.NAMESPACE + ':isEnabled', isEnabled);
        sourceEntity.sendMessage(`Your WAILA display has been ${isEnabled ? 'enabled' : 'disabled'}.`);

        return {
            status: CustomCommandStatus.Success,
            message: `WAILA display for ${sourceEntity.name} is now ${isEnabled ? 'enabled' : 'disabled'}`,
        };
    }
}


// system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
//     const cmd = new WailaCommand();
//     const enumTypeCmds = cmd.mandatoryParameters
//         .filter(param => param.type === CustomCommandParamType.Enum && param.values && param.values.length > 0);
//     if (enumTypeCmds.length === 0) {
//         return;
//     }
//     for (const enumCmd of enumTypeCmds) {
//         customCommandRegistry.registerEnum(enumCmd.name, enumCmd.values!);
//     }
// });
