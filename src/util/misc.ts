/**
 * Sleeps for the specified number of seconds and then resolves.
 * @param ms The number of milliseconds to sleep
 */
export function sleep(ms: number) {
	return new Promise(res => setTimeout(res, ms))
}

/**
 * Removes an item from an array.
 * Note that triple equals equality is used, and only the first instance of the item is removed.
 * @param array The array
 * @param item The item to remove
 */
export function removeFromArray<T>(array: T[], item: T): void {
	for (let i = 0; i < array.length; i++) {
		if (array[i] === item) {
			array.splice(i, 1)
			break
		}
	}
}
