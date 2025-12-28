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

import { Logger } from "@bedrock-oss/bedrock-boost";



//#region RuleMatcher
/**
 * Shared helper for matching namespace-aware values (e.g., item or tag identifiers)
 * against rule expressions that optionally support negation and partial matches.
 */
export class RuleMatcher {
	private static readonly log = Logger.getLogger("RuleMatcher");

	/**
	 * Returns whether the given value satisfies the provided rule.
	 *
	 * Rules support:
	 * - Exact matches ("minecraft:stone")
	 * - Namespace-less matches against the name portion ("stone")
	 * - Namespace-less substring matches against either the full value or the name portion ("pickaxe")
	 * - Negations via "!" prefix
	 */
	static matches(value: string, rule: string): boolean {
		const valueNamePart = value.includes(":") ? value.split(":")[1] : value;
		const isNegatedRule = rule.startsWith("!");
		const actualRule = isNegatedRule ? rule.substring(1) : rule;

		let positiveMatchFound = false;

		if (actualRule === value) {
			positiveMatchFound = true;
		} else if (!actualRule.includes(":") && actualRule === valueNamePart) {
			positiveMatchFound = true;
		} else if (!actualRule.includes(":") && value.includes(actualRule)) {
			positiveMatchFound = true;
		} else if (!actualRule.includes(":") && valueNamePart.includes(actualRule)) {
			positiveMatchFound = true;
		}

		return isNegatedRule ? !positiveMatchFound : positiveMatchFound;
	}

	/**
	 * Walk through a list of string rules and determine whether it yields an allow/deny result.
	 *
	 * The caller can optionally provide a callback to track when a negation was encountered.
	 */
	static listMatches(
		value: string,
		rules: readonly string[] | undefined,
		options?: { onNegatedMatch?: () => void },
	): boolean {
		if (!rules || rules.length === 0) return false;

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
