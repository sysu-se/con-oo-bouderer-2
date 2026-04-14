import { cloneGrid, cloneSudokuJSON, normalizeGrid, normalizeMove } from './helpers.js';
import { createSudokuFromJSON } from './sudoku.js';

function assertSudoku(input) {
	if (!input || typeof input !== 'object') {
		throw new TypeError('createGame requires a Sudoku object');
	}

	if (
		typeof input.getGrid !== 'function' ||
		typeof input.clone !== 'function' ||
		typeof input.toJSON !== 'function'
	) {
		throw new TypeError('createGame requires a Sudoku object');
	}

	const json = input.toJSON();
	if (!json || json.kind !== 'Sudoku') {
		throw new TypeError('createGame requires a Sudoku object');
	}

	return input;
}

function cloneEntry(entry) {
	if (!entry || typeof entry !== 'object') {
		throw new TypeError('history entry must be an object');
	}

	return {
		move: normalizeMove(entry.move),
		before: cloneSudokuJSON(entry.before),
		after: cloneSudokuJSON(entry.after),
	};
}

class Game {
	constructor({ initialGrid, sudoku, undoStack = [], redoStack = [] }) {
		this._initialGrid = normalizeGrid(initialGrid, 'Game initialGrid');
		this._sudoku = createSudokuFromJSON(assertSudoku(sudoku).toJSON());
		this._undoStack = undoStack.map(cloneEntry);
		this._redoStack = redoStack.map(cloneEntry);
	}

	getSudoku() {
		return this._sudoku.clone();
	}

	getInitialGrid() {
		return cloneGrid(this._initialGrid);
	}

	getConflictingCells() {
		return this._sudoku.getConflictingCells();
	}

	isSolved() {
		return this._sudoku.isSolved();
	}

	guess(move) {
		const nextMove = normalizeMove(move);
		if (this._initialGrid[nextMove.row][nextMove.col] !== 0) {
			return false;
		}

		const currentGrid = this._sudoku.getGrid();
		if (currentGrid[nextMove.row][nextMove.col] === nextMove.value) {
			return false;
		}

		const before = this._sudoku.toJSON();
		this._sudoku.guess(nextMove);

		this._undoStack.push({
			move: nextMove,
			before,
			after: this._sudoku.toJSON(),
		});
		this._redoStack = [];
		return true;
	}

	undo() {
		if (!this.canUndo()) {
			return false;
		}

		const entry = this._undoStack.pop();
		this._redoStack.push(cloneEntry(entry));
		this._sudoku = createSudokuFromJSON(entry.before);
		return true;
	}

	redo() {
		if (!this.canRedo()) {
			return false;
		}

		const entry = this._redoStack.pop();
		this._undoStack.push(cloneEntry(entry));
		this._sudoku = createSudokuFromJSON(entry.after);
		return true;
	}

	canUndo() {
		return this._undoStack.length > 0;
	}

	canRedo() {
		return this._redoStack.length > 0;
	}

	toJSON() {
		return {
			kind: 'Game',
			initialSudoku: {
				kind: 'Sudoku',
				grid: cloneGrid(this._initialGrid),
			},
			currentSudoku: this._sudoku.toJSON(),
			undoStack: this._undoStack.map(cloneEntry),
			redoStack: this._redoStack.map(cloneEntry),
		};
	}

	toString() {
		return `Game(undo=${this._undoStack.length}, redo=${this._redoStack.length})\n${this._sudoku.toString()}`;
	}
}

export function createGame({ sudoku }) {
	const normalizedSudoku = assertSudoku(sudoku);
	return new Game({
		initialGrid: normalizedSudoku.getGrid(),
		sudoku: normalizedSudoku,
	});
}

export function createGameFromJSON(json) {
	if (!json || typeof json !== 'object') {
		throw new TypeError('game json must be an object');
	}

	if (json.kind != null && json.kind !== 'Game') {
		throw new TypeError('game json kind must be "Game"');
	}

	return new Game({
		initialGrid: json.initialSudoku?.grid,
		sudoku: createSudokuFromJSON(json.currentSudoku),
		undoStack: json.undoStack || [],
		redoStack: json.redoStack || [],
	});
}
