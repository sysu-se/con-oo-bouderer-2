export const SUDOKU_SIZE = 9;
export const BOX_SIZE = 3;

export function cloneGrid(grid) {
	return grid.map((row) => row.slice());
}

function normalizeInteger(value, label) {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!/^[-]?\d+$/.test(trimmed)) {
			throw new TypeError(`${label} must be an integer string`);
		}
		value = Number(trimmed);
	}

	if (!Number.isInteger(value)) {
		throw new TypeError(`${label} must be an integer`);
	}

	return value;
}

export function normalizeCellValue(value, label = 'cell value') {
	if (value == null || value === '') {
		return 0;
	}

	const normalized = normalizeInteger(value, label);
	if (normalized < 0 || normalized > 9) {
		throw new RangeError(`${label} must be between 0 and 9`);
	}

	return normalized;
}

export function normalizeIndex(value, label = 'index') {
	const normalized = normalizeInteger(value, label);
	if (normalized < 0 || normalized >= SUDOKU_SIZE) {
		throw new RangeError(`${label} must be between 0 and ${SUDOKU_SIZE - 1}`);
	}

	return normalized;
}

export function normalizeMove(move) {
	if (!move || typeof move !== 'object') {
		throw new TypeError('move must be an object');
	}

	return {
		row: normalizeIndex(move.row, 'move.row'),
		col: normalizeIndex(move.col, 'move.col'),
		value: normalizeCellValue(move.value, 'move.value'),
	};
}

export function normalizeGrid(grid, label = 'grid') {
	if (!Array.isArray(grid) || grid.length !== SUDOKU_SIZE) {
		throw new TypeError(`${label} must be a ${SUDOKU_SIZE}x${SUDOKU_SIZE} array`);
	}

	return grid.map((row, rowIndex) => {
		if (!Array.isArray(row) || row.length !== SUDOKU_SIZE) {
			throw new TypeError(`${label}[${rowIndex}] must contain ${SUDOKU_SIZE} cells`);
		}

		return row.map((value, colIndex) =>
			normalizeCellValue(value, `${label}[${rowIndex}][${colIndex}]`),
		);
	});
}

export function normalizeSudokuJSON(json) {
	if (Array.isArray(json)) {
		return {
			kind: 'Sudoku',
			grid: normalizeGrid(json, 'sudoku json'),
		};
	}

	if (!json || typeof json !== 'object') {
		throw new TypeError('sudoku json must be an object or 9x9 array');
	}

	if (json.kind != null && json.kind !== 'Sudoku') {
		throw new TypeError('sudoku json kind must be "Sudoku"');
	}

	return {
		kind: 'Sudoku',
		grid: normalizeGrid(json.grid, 'sudoku json.grid'),
	};
}

export function cloneSudokuJSON(json) {
	const data = normalizeSudokuJSON(json);
	return {
		kind: data.kind,
		grid: cloneGrid(data.grid),
	};
}

export function collectConflicts(grid) {
	const conflicts = new Set();

	const markUnit = (cells) => {
		const seen = new Map();

		for (const cell of cells) {
			if (cell.value === 0) {
				continue;
			}

			if (!seen.has(cell.value)) {
				seen.set(cell.value, [cell]);
				continue;
			}

			for (const conflict of seen.get(cell.value)) {
				conflicts.add(`${conflict.row},${conflict.col}`);
			}
			conflicts.add(`${cell.row},${cell.col}`);
			seen.get(cell.value).push(cell);
		}
	};

	for (let row = 0; row < SUDOKU_SIZE; row++) {
		markUnit(grid[row].map((value, col) => ({ row, col, value })));
	}

	for (let col = 0; col < SUDOKU_SIZE; col++) {
		markUnit(grid.map((row, rowIndex) => ({ row: rowIndex, col, value: row[col] })));
	}

	for (let startRow = 0; startRow < SUDOKU_SIZE; startRow += BOX_SIZE) {
		for (let startCol = 0; startCol < SUDOKU_SIZE; startCol += BOX_SIZE) {
			const box = [];
			for (let row = startRow; row < startRow + BOX_SIZE; row++) {
				for (let col = startCol; col < startCol + BOX_SIZE; col++) {
					box.push({ row, col, value: grid[row][col] });
				}
			}
			markUnit(box);
		}
	}

	return Array.from(conflicts).map((key) => {
		const [row, col] = key.split(',').map(Number);
		return { row, col };
	});
}

export function isComplete(grid) {
	return grid.every((row) => row.every((value) => value !== 0));
}
