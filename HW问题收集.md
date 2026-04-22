## HW 问题收集


### 已解决

1. View 层到底应该直接消费谁？
   1. **上下文**：作业要求里反复强调，不能只是把 `Sudoku` / `Game` 写在测试里，而是要让真实界面真正消费领域对象。我一开始最困惑的就是：组件到底应该直接拿 `Game`，还是拿 `Sudoku`，还是应该再经过一层 store / adapter。
   2. **解决手段**：后面我把 `src/node_modules/@sudoku/stores/game-session.js`、`src/node_modules/@sudoku/stores/grid.js`、`src/components/Board/index.svelte` 这一条链路顺下来之后，才理清楚现在这份实现里，View 层真正直接消费的是 `grid`、`userGrid`、`invalidCells` 这些可订阅状态；`Game` 则由 `gameSession` 在内部持有。这样组件拿到的是适合渲染的响应式数据，用户输入也统一先走 `userGrid` / `gameSession`，再进入领域对象。

2. 为什么领域对象变了，Svelte 界面不一定会自动刷新？
   1. **上下文**：作业要求专门提了“为什么修改对象内部字段后，界面不一定自动更新”“为什么直接改二维数组元素，有时不会按预期刷新”。我刚开始接线时直觉上觉得，只要 `game.guess(...)` 把内部状态改掉，棋盘就应该跟着变。
   2. **解决手段**：我是顺着 `gameSession` 里的 `mutateGame -> snapshotGame -> update()` 这条流程去看的，再结合 Svelte store 的更新机制理解。现在我能明白，真正触发刷新的是 `store.update()` 推送出的新快照，而不是 `Game` 或二维数组内部字段变化本身。如果只是直接 mutate 内部对象，没有重新经过 store 发出新值，组件就不一定会更新。

3. `Sudoku` 和 `Game` 的职责边界到底该怎么分？
   1. **上下文**：写领域层时我一开始并没有完全想清楚哪些能力应该留在 `Sudoku`，哪些应该交给 `Game`。比如盘面修改、冲突检查、初始 givens 保护、Undo / Redo、history，到底该怎么分配，才不会把两个对象写得互相重叠。
   2. **解决手段**：后面我结合 `src/domain/sudoku.js`、`src/domain/game.js` 以及 `tests/hw1/04-game-undo-redo.test.js` 去梳理，才比较明确地分出来：`Sudoku` 负责盘面本身、冲突检测、完成态和序列化；`Game` 负责管理初始题面、限制对 givens 的修改、维护 undo / redo history，并对 UI 暴露会话级操作入口。这样边界比把所有逻辑都塞进一个对象里清楚很多。

### 未解决

1. `gameSession` 仍然把可变 `Game` 实例暴露给外部，响应式边界还不够稳
   1. **上下文**：`src/node_modules/@sudoku/stores/game-session.js` 里的 `snapshotGame()` 现在会把 `game` 本身直接放进 store 值里。这样理论上订阅方拿到之后，可以绕开 `guess` / `undo` / `redo` 这些通道，直接去调用 `Game` 的可变方法。
   2. **尝试解决手段**：目前我已经能识别出这个设计风险，也知道它会破坏“领域对象内部状态”和“对 UI 暴露的响应式数据”之间的边界；但我还没有把它进一步收紧成“只暴露快照数据和命令接口，不暴露可变 `Game` 实例”的版本。

2. Hint 这类面向 UI 的操作还没有完全收口到 `Game`
   1. **上下文**：按作业要求，`Game` 应该对外提供面向 UI 的游戏操作入口；但现在 `src/node_modules/@sudoku/stores/game-session.js` 里的 `applyHint()` 还是先在 adapter 层里求解，再决定往 `game.guess()` 里写什么值。也就是说，这个操作还没有真正被建模成 `Game` 自己的接口。
   2. **尝试解决手段**：目前我已经能确认这个问题的位置和原因，但还没有把 Hint 相关逻辑收回到领域层。下一步如果继续改，我会优先考虑把“提示应该如何改变局面”封装成 `Game` 的一个明确操作，而不是继续留在 store adapter 里分散处理。

3. `createGameFromJSON()` 对领域不变量的防御还不够，序列化设计还有缺口
   1. **上下文**：作业要求里专门提到要改进序列化设计。现在 `src/domain/game.js` 中的 `createGameFromJSON()` 能把 `initialSudoku`、`currentSudoku`、`undoStack`、`redoStack` 恢复出来，也能通过合法对象的 round-trip 测试；但它还没有继续验证“当前盘面是否仍保留初始 givens”“历史快照是否和初始题面一致”。
   2. **尝试解决手段**：目前我已经能定位到这个缺口，也能看出它会让外部构造出的非法 `Game JSON` 有机会被接受；但我还没有把这部分校验规则补齐。后面如果继续完善，我会优先补这类不变量检查，而不只是验证 JSON 能不能成功还原对象。
