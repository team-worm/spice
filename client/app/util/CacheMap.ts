import { KeyNotFoundError } from "../models/errors/Errors";
export class CacheMap<T> {
	protected map: {[key: string]: T};

	constructor(protected onMissing?: (k: string) => T) {
	}

	public get(key: string): T {
		if(!this.map.hasOwnProperty(key)) {
			if(!this.onMissing) {
				throw new KeyNotFoundError(key);
			}
			this.map[key] = this.onMissing(key);
		}
		return this.map[key];
	}

	public set(key: string, value: T): void {
		this.map[key] = value;
	}

	public delete(key: string): void {
		delete this.map[key];
	}

	public has(key: string): boolean {
		return this.map.hasOwnProperty(key);
	}
}
