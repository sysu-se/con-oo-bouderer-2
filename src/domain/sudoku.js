import {
	SUDOKU_SIZE,
	cloneGrid,
	cloneSudokuJSON,
	collectConflicts,
	isComplete,
	normalizeGrid,
	normalizeMove,
	normalizeSudokuJSON,
} from './helpers.js';

class Sudoku {
	constructor(grid) {
		this._grid = normalizeGrid(grid, 'Sudoku grid');
	}

	getGrid() {
		return cloneGrid(this._grid);
	}

	guess(move) {
		const nextMove = normalizeMove(move);
		this._grid[nextMove.row][nextMove.col] = nextMove.value;
		return this;
	}

	clone() {
		return new Sudoku(this._grid);
	}

	getConflictingCells() {
		return collectConflicts(this._grid);
	}

	isComplete() {
		return isComplete(this._grid);
	}

	isSolved() {
		return this.isComplete() && this.getConflictingCells().length === 0;
	}

	toJSON() {
		return cloneSudokuJSON({ kind: 'Sudoku', grid: this._grid });
	}

	toString() {
		const lines = [];

		for (let row = 0; row < SUDOKU_SIZE; row++) {
			if (row !== 0 && row % 3 === 0) {
				lines.push('------+-------+------');
			}

			const values = [];
			for (let col = 0; col < SUDOKU_SIZE; col++) {
				if (col !== 0 && col % 3 === 0) {
					values.push('|');
				}
				values.push(this._grid[row][col] === 0 ? '.' : String(this._grid[row][col]));
			}

			lines.push(values.join(' '));
		}

		return lines.join('\n');
	}
}

export function createSudoku(input) {
	return new Sudoku(input);
}

export function createSudokuFromJSON(json) {
	return new Sudoku(normalizeSudokuJSON(json).grid);
}
