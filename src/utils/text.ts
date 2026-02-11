interface Range {
	start: number
	end: number
}

/**
 * Merges overlapping or adjacent index ranges.
 */
function mergeRanges<T extends Range>(ranges: T[]): T[] {
	if (ranges.length === 0) return []

	// Sort by start index ascending
	const sorted = [...ranges].sort((a, b) => a.start - b.start)

	return sorted.slice(1).reduce(
		(acc, current) => {
			const last = acc[acc.length - 1]

			if (current.start <= last.end) {
				// Overlap or adjacent: extend the end index
				last.end = Math.max(last.end, current.end)
			} else {
				acc.push(current)
			}
			return acc
		},
		[sorted[0]]
	)
}

/**
 * Deletes specified ranges from a text string.
 * This function is atomic: indices always refer to the original text.
 *
 * @param text The original text string.
 * @param ranges A list of {start, end} index pairs to delete.
 * @returns The new text with ranges deleted.
 */
export function deleteRangesFromText<T extends Range>(text: string, ranges: T[]) {
	// 1. Check for invalid ranges and throw error if any exist.
	validateRanges(text, ranges)

	// 2. Merge overlapping/adjacent ranges
	const mergedRanges = mergeRanges<T>(ranges)

	// 3. Sort ranges in descending order of their start index.
	const sortedRanges = [...mergedRanges].sort((a, b) => b.start - a.start)

	let newText = text
	let deleteds = []
	for (const range of sortedRanges) {
		deleteds.push({
			range,
			deleted: newText.slice(range.start, range.end),
		})
		newText = newText.slice(0, range.start) + newText.slice(range.end)
	}

	return { newText, deleteds }
}

function validateRanges(text: string, ranges: Range[]) {
	const invalidRanges = ranges.filter(
		({ start, end }) => start < 0 || end > text.length || start > end
	)
	if (invalidRanges.length > 0) {
		throw new Error(
			`Invalid ranges found. Ranges must be within [0, ${text.length}] and start <= end.`,
			{
				cause: invalidRanges,
			}
		)
	}
}
