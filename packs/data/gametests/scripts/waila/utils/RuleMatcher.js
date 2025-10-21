"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleMatcher = void 0;
const bedrock_boost_1 = require("@bedrock-oss/bedrock-boost");
class RuleMatcher {
    static log = bedrock_boost_1.Logger.getLogger("RuleMatcher");
    static matches(value, rule) {
        const valueNamePart = value.includes(":") ? value.split(":")[1] : value;
        const isNegatedRule = rule.startsWith("!");
        const actualRule = isNegatedRule ? rule.substring(1) : rule;
        let positiveMatchFound = false;
        if (actualRule === value) {
            positiveMatchFound = true;
        }
        else if (!actualRule.includes(":") && actualRule === valueNamePart) {
            positiveMatchFound = true;
        }
        else if (!actualRule.includes(":") && value.includes(actualRule)) {
            positiveMatchFound = true;
        }
        else if (!actualRule.includes(":") && valueNamePart.includes(actualRule)) {
            positiveMatchFound = true;
        }
        return isNegatedRule ? !positiveMatchFound : positiveMatchFound;
    }
    static listMatches(value, rules, options) {
        if (!rules || rules.length === 0)
            return false;
        let hasPositive = false;
        for (const rule of rules) {
            if (RuleMatcher.matches(value, rule)) {
                if (rule.startsWith("!")) {
                    options?.onNegatedMatch?.();
                    return false;
                }
                hasPositive = true;
            }
        }
        return hasPositive;
    }
}
exports.RuleMatcher = RuleMatcher;
