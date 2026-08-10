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

import { system, world } from "@minecraft/server";

import seedData from "../../datasets/learnedHardnessSeed.json";
import WailaLogger from "../../utils/Logger";



//#region Globals
const PROPERTY_SAMPLES = "r4isen1920_waila:break_samples";
const PROPERTY_SAMPLES_CHUNK_SUFFIX = "_chunk_";
const DYNAMIC_PROPERTY_CHUNK_LIMIT = 32760;
const DYNAMIC_PROPERTY_MAX_CHUNKS = 4;

const MAX_ENTRIES = 512;
const MIN_CONFIDENT_SAMPLES = 3;
const MAX_RELATIVE_DEVIATION = 0.25;
/** Seed entries carry a synthetic sample count so live samples can still shift them. */
const SEED_SAMPLE_WEIGHT = 8;
const FLUSH_DELAY_TICKS = 100;



//#region BreakLearningStore
/**
 * Persists observed block-breaking durations as an implied hardness per block type.
 * Samples are normalized with the same modifier stack used for prediction, so
 * systematic estimation error cancels out instead of accumulating.
 */
export class BreakLearningStore {
	private static readonly log = WailaLogger.get("BreakLearning");

	private static entries: Map<string, LearnedEntry> | undefined;
	private static seedEntries: Map<string, LearnedEntry> | undefined;
	private static dirty = false;
	private static flushHandle: number | undefined;

	/**
	 * Folds one observation into the running estimate for a block type.
	 * Uses Welford's algorithm so variance is tracked without keeping raw samples.
	 */
	static record(blockTypeId: string, impliedHardness: number): void {
		if (!Number.isFinite(impliedHardness) || impliedHardness <= 0) return;

		const entries = this.getEntries();
		const existing = entries.get(blockTypeId);

		if (!existing) {
			entries.set(blockTypeId, { mean: impliedHardness, count: 1, m2: 0, touched: this.now() });
			this.evictIfNeeded(entries);
		} else {
			const count = existing.count + 1;
			const delta = impliedHardness - existing.mean;
			const mean = existing.mean + delta / count;
			existing.m2 += delta * (impliedHardness - mean);
			existing.mean = mean;
			existing.count = count;
			existing.touched = this.now();
		}

		this.markDirty();
	}

	/**
	 * Resolves the best known hardness for a block type.
	 * Learned values only win once enough low-variance samples exist.
	 */
	static lookup(blockTypeId: string): LearnedLookup | undefined {
		const learned = this.getEntries().get(blockTypeId);
		if (learned && this.isConfident(learned)) {
			return { hardness: learned.mean, samples: learned.count, source: "learned" };
		}

		const seeded = this.getSeedEntries().get(blockTypeId);
		if (seeded) {
			return { hardness: seeded.mean, samples: seeded.count, source: "seed" };
		}

		if (learned) {
			return { hardness: learned.mean, samples: learned.count, source: "learning" };
		}

		return undefined;
	}

	/**
	 * Merged view of live samples over seed entries, shaped exactly like
	 * `datasets/learnedHardnessSeed.json` so the output can be pasted straight back in.
	 */
	static exportEntries(): Record<string, ExportedEntry> {
		const merged: Record<string, ExportedEntry> = {};

		for (const [blockTypeId, entry] of this.getSeedEntries()) {
			merged[blockTypeId] = { h: this.round(entry.mean), n: entry.count };
		}
		for (const [blockTypeId, entry] of this.getEntries()) {
			merged[blockTypeId] = { h: this.round(entry.mean), n: entry.count };
		}

		return merged;
	}

	static stats(): LearningStats {
		const entries = this.getEntries();
		let confident = 0;
		for (const entry of entries.values()) {
			if (this.isConfident(entry)) confident++;
		}
		return {
			learned: entries.size,
			confident,
			seeded: this.getSeedEntries().size,
			bytes: this.serialize(entries).length,
		};
	}

	static clear(): void {
		this.entries = new Map();
		this.dirty = true;
		this.flush();
		this.log.info("Cleared learned break samples.");
	}

	static flush(): void {
		if (!this.dirty || !this.entries) return;
		this.dirty = false;
		this.flushHandle = undefined;

		const payload = this.serialize(this.entries);
		const maxLength = DYNAMIC_PROPERTY_CHUNK_LIMIT * DYNAMIC_PROPERTY_MAX_CHUNKS;
		if (payload.length > maxLength) {
			this.log.warn(
				`Break sample payload (${payload.length}) exceeds limit (${maxLength}). Skipping write.`,
			);
			return;
		}

		this.writePayload(payload);
	}

	private static isConfident(entry: LearnedEntry): boolean {
		if (entry.count < MIN_CONFIDENT_SAMPLES) return false;
		if (entry.mean <= 0) return false;
		const variance = entry.count > 1 ? entry.m2 / (entry.count - 1) : 0;
		return Math.sqrt(variance) / entry.mean <= MAX_RELATIVE_DEVIATION;
	}

	private static markDirty(): void {
		this.dirty = true;
		if (this.flushHandle !== undefined) return;
		this.flushHandle = system.runTimeout(() => this.flush(), FLUSH_DELAY_TICKS);
	}

	private static evictIfNeeded(entries: Map<string, LearnedEntry>): void {
		if (entries.size <= MAX_ENTRIES) return;

		let oldestKey: string | undefined;
		let oldestTouched = Number.POSITIVE_INFINITY;
		for (const [blockTypeId, entry] of entries) {
			if (entry.touched < oldestTouched) {
				oldestTouched = entry.touched;
				oldestKey = blockTypeId;
			}
		}
		if (oldestKey) entries.delete(oldestKey);
	}

	private static getEntries(): Map<string, LearnedEntry> {
		if (this.entries) return this.entries;

		this.entries = new Map();
		const payload = this.readPayload();
		if (!payload) return this.entries;

		try {
			const parsed = JSON.parse(payload) as StoredPayload;
			for (const [blockTypeId, tuple] of Object.entries(parsed.e ?? {})) {
				const [mean, count, m2] = tuple;
				if (!Number.isFinite(mean) || mean <= 0) continue;
				this.entries.set(blockTypeId, { mean, count: count ?? 1, m2: m2 ?? 0, touched: 0 });
			}
		} catch (error) {
			this.log.warn(`Failed parsing break sample payload: ${error}`);
		}

		return this.entries;
	}

	private static getSeedEntries(): Map<string, LearnedEntry> {
		if (this.seedEntries) return this.seedEntries;

		this.seedEntries = new Map();
		const seed = seedData as SeedFile;
		for (const [blockTypeId, entry] of Object.entries(seed.entries ?? {})) {
			if (!Number.isFinite(entry.h) || entry.h <= 0) continue;
			this.seedEntries.set(blockTypeId, {
				mean: entry.h,
				count: Math.min(entry.n ?? SEED_SAMPLE_WEIGHT, SEED_SAMPLE_WEIGHT),
				m2: 0,
				touched: 0,
			});
		}

		return this.seedEntries;
	}

	private static serialize(entries: Map<string, LearnedEntry>): string {
		const payload: StoredPayload = { v: 1, e: {} };
		for (const [blockTypeId, entry] of entries) {
			payload.e[blockTypeId] = [this.round(entry.mean), entry.count, this.round(entry.m2)];
		}
		return JSON.stringify(payload);
	}

	private static readPayload(): string | undefined {
		const direct = world.getDynamicProperty(PROPERTY_SAMPLES);
		if (typeof direct === "string" && direct.length > 0) return direct;

		let payload = "";
		for (let index = 0; index < DYNAMIC_PROPERTY_MAX_CHUNKS; index++) {
			const chunk = world.getDynamicProperty(
				`${PROPERTY_SAMPLES}${PROPERTY_SAMPLES_CHUNK_SUFFIX}${index}`,
			);
			if (typeof chunk !== "string") break;
			payload += chunk;
		}

		return payload.length > 0 ? payload : undefined;
	}

	private static writePayload(payload: string): void {
		try {
			if (payload.length <= DYNAMIC_PROPERTY_CHUNK_LIMIT) {
				world.setDynamicProperty(PROPERTY_SAMPLES, payload);
				this.clearChunks();
				return;
			}

			world.setDynamicProperty(PROPERTY_SAMPLES, undefined);
			for (let index = 0; index < DYNAMIC_PROPERTY_MAX_CHUNKS; index++) {
				const start = index * DYNAMIC_PROPERTY_CHUNK_LIMIT;
				const chunk = payload.slice(start, start + DYNAMIC_PROPERTY_CHUNK_LIMIT);
				world.setDynamicProperty(
					`${PROPERTY_SAMPLES}${PROPERTY_SAMPLES_CHUNK_SUFFIX}${index}`,
					chunk.length > 0 ? chunk : undefined,
				);
			}
		} catch (error) {
			this.log.warn(`Failed persisting break samples: ${error}`);
		}
	}

	private static clearChunks(): void {
		for (let index = 0; index < DYNAMIC_PROPERTY_MAX_CHUNKS; index++) {
			world.setDynamicProperty(
				`${PROPERTY_SAMPLES}${PROPERTY_SAMPLES_CHUNK_SUFFIX}${index}`,
				undefined,
			);
		}
	}

	private static round(value: number): number {
		return Math.round(value * 1000) / 1000;
	}

	private static now(): number {
		return system.currentTick;
	}
}



//#region Types
interface LearnedEntry {
	mean: number;
	count: number;
	m2: number;
	touched: number;
}

interface StoredPayload {
	v: number;
	e: Record<string, [number, number, number]>;
}

interface SeedFile {
	version: number;
	entries: Record<string, ExportedEntry>;
}

export interface ExportedEntry {
	h: number;
	n: number;
}

export interface LearnedLookup {
	hardness: number;
	samples: number;
	source: "learned" | "seed" | "learning";
}

export interface LearningStats {
	learned: number;
	confident: number;
	seeded: number;
	bytes: number;
}
