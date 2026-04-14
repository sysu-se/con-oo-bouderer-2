# DESIGN

## 1. 本次作业的整体思路

本次作业在 HW1 的基础上完成两件事：根据 review 反馈改进领域对象，并将其真正接入 Svelte UI。

1. **改进领域对象的输入校验**
   - `Sudoku` 构造时严格校验盘面结构：必须是 9x9 数组，每个值必须是 0~9 的整数。
   - `Game` 构造时严格校验传入的 `Sudoku` 对象，不再接受裸数组或随意的 duck typing。
   - 每次 move 都经过 `normalizeMove` 校验，确保坐标和值都在合法范围内。

2. **将领域对象接入 Svelte UI 流程**
   - 通过一个 store adapter（`gameSession`）持有 `Game` 对象，对外暴露响应式视图状态。
   - 所有关键操作（Undo、Redo、Hint 等）都经由 `Game` / `Sudoku` 的接口完成，不在组件中直接操作数组。

---

## 2. 领域对象设计

### 2.1 `Sudoku`

`Sudoku` 是纯粹的盘面对象。

负责：

- 持有当前 `grid`
- 构造时严格校验（9x9 结构、值 0~9）
- 提供 `guess(move)` 接口
- 提供冲突检查/完成度判断
- 提供 `clone()` / `toJSON()` / `toString()`

不负责：

- Undo / Redo
- 游戏流程
- 初始题面的记录与判断
- Svelte 响应式通知

### 2.2 `Game`

`Game` 是一局游戏会话。

负责：

- 持有当前 `Sudoku`
- 单独保存 `initialGrid`
- 作为 UI 与领域层的主接口
- 提供 `guess()` / `undo()` / `redo()`
- 管理 undo / redo history
- 提供 `toJSON()` 做整局序列化

委托给 `Sudoku` 的方法：

- `getConflictingCells()`
- `isSolved()`

由 store adapter 读取、不由 Game 主动推送的状态（Game 本身不负责通知 UI）。

---

## 3. 相比 HW1 的改进说明

根据 review 反馈，本次做了以下实质性改进：

### 3.1 守住核心领域不变量

HW1 的问题：

- `NaN`
- 小数
- 负数
- `10`
- 畸形数组

都可能进入盘面而不被拒绝。

本次的改进：

- `normalizeGrid()` 在构造时严格校验：必须是 9x9 数组，每个值 0~9 整数。
- `normalizeMove()` 校验 `row` / `col` 在 0~8 内，`value` 在 0~9 内。
- 非法输入一律抛出带语义的异常，不再静默接受。

### 3.2 收紧 `Game` 入口

HW1 的 `createGame({ sudoku })` 同时接受：

- 真正的 `Sudoku`
- 裸 `grid`
- 任意带 `getGrid()` 的对象

导致领域边界模糊。

本次 `createGame` 改为：

- 通过 `assertSudoku` 严格校验
- 要求 `getGrid`、`clone`、`toJSON` 三个方法都存在
- 要求 `toJSON().kind === 'Sudoku'`

不满足条件一律 throw TypeError，确保 `Game` 一定持有合法的 `Sudoku`。

### 3.3 为什么 HW1 的做法不足以支撑真实接入

HW1 的领域对象虽然结构上分了层，但缺乏输入校验，实际上没有守住自身不变量。这意味着：

- 一旦接入 UI，任何异常输入都会静默地污染盘面
- 盘面被污染后，`isSolved()` 和 `getConflictingCells()` 的结果不可信
- Undo/Redo 历史中可能保存了非法状态，恢复后造成更多问题

本次改进确保：领域对象自身维护不变量，任何非法输入在入口处就被拒绝，不会进入内部状态。

---

## 4. View 层如何消费领域对象

### 4.1 View 直接消费的是什么

View **不直接消费 `Game` 对象**，而是通过 **store adapter（`gameSession`）**。

位置：

- `src/node_modules/@sudoku/stores/game-session.js`

它内部持有 `Game`，每次操作后调用 `snapshotGame()` 导出供 UI 消费的状态：

- `initialGrid`
- `currentGrid`
- `invalidCells`
- `solved`
- `canUndo`
- `canRedo`

在此之上，进一步派生出细粒度的 store 供组件使用：

- `grid`（`initialGrid` 的 derived store）
- `userGrid`（`currentGrid` 的 derived store）
- `invalidCells`
- `gameWon`
- `canUndo` / `canRedo`

组件不直接接触 `Game` 或 `Sudoku`，只读 store、调 store 方法。

### 4.2 View 层读取了什么数据

- `Board` 组件消费：
  - `grid`：初始题面，用于判断哪些格子是预置数字
  - `userGrid`：当前盘面，用于渲染每个格子的值
  - `invalidCells`：冲突格列表
- `Actions` 组件消费：
  - `canUndo`
  - `canRedo`
- `App` 组件消费：
  - `gameWon`

所有数据都沿 `gameSession -> Game -> Sudoku` 这条链从领域对象导出，不存在绕过领域对象的旧逻辑。

### 4.3 用户操作如何进入领域对象

操作链路如下：

1. 用户点击键盘 / 按下按键
2. 组件调用 `userGrid.set(...)` / `userGrid.undo()` / `userGrid.redo()` / `userGrid.applyHint(...)`
3. `userGrid` 是 `grid.js` 中定义的代理，转发给 `gameSession`
4. `gameSession` 调用 `Game.guess()` / `Game.undo()` / `Game.redo()`
5. `Game` 操作内部的 `Sudoku`
6. 操作完成后重新快照，触发 Svelte 更新

关键点：

- 组件中没有直接操作数组
- Undo / Redo 不在 `.svelte` 文件中
- 所有逻辑都在领域层完成

### 4.4 Undo / Redo / Hint 的调用链

- **Undo**：按钮点击 → `userGrid.undo()` → `gameSession.undo()` → `Game.undo()`
- **Redo**：按钮点击 → `userGrid.redo()` → `gameSession.redo()` → `Game.redo()`
- **Hint**：按钮点击 → `userGrid.applyHint(pos)` → `gameSession.applyHint(pos)` → 求解后调用 `Game.guess()`，Hint 结果也进入 history，可以 Undo

---

## 5. Svelte 响应式机制说明

### 5.1 依赖的响应式机制

本方案依赖 **Svelte writable store + derived store + `$` 自动订阅**。

`gameSession` 是一个自定义 store：

- 内部持有 `Game` 对象
- 对外暴露 `guess/undo/redo/applyHint/startNew/startCustom`
- 每次操作后重新计算 view state：
  - `initialGrid`
  - `currentGrid`
  - `invalidCells`
  - `solved`
  - `canUndo`
  - `canRedo`
- 通过 store 的 `set/update` 触发订阅者更新

组件中用 `$grid`、`$userGrid`、`$gameWon` 等语法自动订阅。

### 5.2 如果错误地直接 mutate 对象会怎样

如果绕过 store adapter 直接：

- 拿到 `Game` 对象后调用方法
- 直接修改 `Sudoku._grid[row][col]`
- 不通过 store 的更新方法

则 Svelte 不会知道数据发生了变化，界面不会刷新。

这是因为 Svelte 3 的响应式机制基于**赋值触发**：

> 只有顶层变量的赋值，或 store 的 `set`/`update` 调用，才会通知 Svelte 重新渲染。

本方案通过 **store adapter** 解决：

- 所有修改都通过 adapter 方法
- adapter 每次操作后调用 `update()` 写入新的快照
- Svelte 检测到 store 值变化，自动刷新

### 5.3 哪些状态对 UI 可见，哪些不可见

对 UI 可见（通过 store 暴露）：

- 当前 grid
- 初始 grid
- 冲突格
- 是否已解决
- 能否 undo / redo

对 UI 不可见（留在领域对象内部）：

- `Game` 的 undo / redo 栈的具体内容
- `Game` 内部的 `Sudoku` 引用
- `Sudoku` 的 `_grid` 内部数组
- 历史记录中的 before/after 快照

UI 只看到操作结果的快照，不能直接接触领域对象的内部状态。

---

## 6. history 设计

采用快照 snapshot 策略，每条历史记录保存操作前后的完整盘面。

每条 history entry 结构：

```js
{
  move,    // { row, col, value }
  before,  // 操作前的 Sudoku JSON
  after,   // 操作后的 Sudoku JSON
}
```

行为：

- `undo()` 恢复到 `before`
- `redo()` 恢复到 `after`
- 新输入清空 redo 栈
- Hint 也会产生历史记录，支持 Undo

trade-off：

- 每步存完整盘面，空间开销较大
- 但实现简单，恢复逻辑无需重放操作链

---

## 7. 序列化设计

### 7.1 `Sudoku`

`Sudoku.toJSON()` 返回：

```js
{
  kind: 'Sudoku',
  grid: number[][]
}
```

对应的 `createSudokuFromJSON(json)` 可以从上述 JSON 恢复出完整的 Sudoku 对象。

### 7.2 `Game`

`Game.toJSON()` 返回：

```js
{
  kind: 'Game',
  initialSudoku,
  currentSudoku,
  undoStack,
  redoStack,
}
```

对应的 `createGameFromJSON(json)`：

- 恢复初始题面
- 恢复当前盘面
- 恢复 undo / redo 栈
- 返回一个完整的 `Game`

所有序列化输出都是 plain data，不包含类引用。

---

## 8. trade-off

### 8.1 为什么领域对象自身不实现 subscribe

本方案选择让领域对象保持纯粹。

原因：

- `Game` / `Sudoku` 不依赖任何框架，可以在测试中直接使用。
- 如果让领域对象实现 `subscribe`，就引入了对 Svelte 或通知机制的耦合。

代价是：

- 需要额外的适配层
- 操作完成后需要手动触发快照

### 8.2 为什么拆出 `grid` / `userGrid` 两个 store

为了保持与原有 UI 组件的兼容（原有组件分别读取 grid 和 userGrid）。

拆分后 UI 组件可以精确订阅自己需要的数据，不会因为无关状态变化而重渲染。

- `grid` 始终是 `Game.getInitialGrid()`
- `userGrid` 跟随 `Game.guess/undo/redo` 变化

两者都从 `gameSession` 派生，数据源是统一的。

---

## 9. 总结

本次作业在 HW1 的基础上完成了两个核心改进：

1. **根据 review 修复了 HW1 的领域不变量问题**
   - 严格校验输入
   - 收紧类型边界
   - 拒绝非法坐标
   - 收紧 `Game` 入口

2. **将领域对象真正接入 Svelte 真实游戏流程**
   - UI 通过 store adapter 消费领域对象
   - 所有操作（Undo、Redo、Hint）都经由 `Game`
   - Svelte 通过 store 订阅机制更新，不靠直接 mutate 内部对象

领域对象和视图层的分工：

> **领域对象负责业务逻辑和状态管理，视图层只负责渲染和事件转发。**
