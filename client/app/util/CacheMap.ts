import { KeyNotFoundError } from "../models/Errors";

export class CacheMap<K, V> {
	// can't extend Map until running es6
	private map: Map<K, V>;

	constructor(protected onMissing?: (k: K) => V) {
		this.map = new Map<K, V>();
	}

	public get(key: K): V {
		if(!this.has(key)) {
			if(!this.onMissing) {
				throw new KeyNotFoundError(key.toString());
			}
			this.set(key, this.onMissing(key));
		}
		return this.map.get(key) as V;
	}

	public set(key: K, value: V): void {
		this.map.set(key, value);
	}

	public has(key: K): boolean {
		return this.map.has(key);
	}

	public keys(): IterableIterator<K> {
		return this.map.keys();
	}

	public delete(key: K): void {
		this.map.delete(key);
	}

	public get size(): number {
		return this.map.size;
	}
}
