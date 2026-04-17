# con-oo-bouderer-2 - Review

## Review 结论

代码已经把 Game/Sudoku 真正接入到 Svelte 的开局、渲染、输入、Undo/Redo 主流程中，说明这次不是“只在测试里有领域对象”的提交；但适配层仍泄露可变领域对象，开局流程也没有清空候选数这类会话态，且部分业务仍留在 store adapter，整体更接近“主流程已接通，但设计边界和业务收口还不够稳”的状态。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | good |
| JS Convention | fair |
| Sudoku Business | fair |
| OOD | fair |

## 缺点

### 1. 新开局没有清空候选数状态

- 严重程度：core
- 位置：src/node_modules/@sudoku/game.js:8-23
- 原因：startNew/startCustom 只重置了 difficulty、cursor、timer、hints，却没有重置 candidates。Board 会继续按坐标读取 $candidates，因此上一局留下的候选数会直接污染新题面，导致“开始一局游戏”不是干净会话，违背数独游戏业务。

### 2. 适配层把可变 Game 实例暴露给订阅者

- 严重程度：core
- 位置：src/node_modules/@sudoku/stores/game-session.js:14-23
- 原因：snapshotGame 把 game 直接放进 store 值里，订阅方理论上可以拿到它并直接调用可变方法，绕开 gameSession 的 update/snapshot 通道。这样破坏了领域层与 Svelte 响应式之间的封装边界，UI 是否正确刷新变成了“靠约定不要直接 mutate”。

### 3. 反序列化没有校验当前盘面与初始题面的不变量

- 严重程度：major
- 位置：src/domain/game.js:140-154
- 原因：createGameFromJSON 直接分别恢复 initialSudoku、currentSudoku 和历史栈，但没有验证 currentSudoku 是否仍保留初始 givens，也没有验证历史快照是否与 initialGrid 一致。这样可以构造出领域上非法但仍被接受的 Game，削弱了序列化设计的可靠性。

### 4. Hint 业务仍停留在 Svelte 适配层

- 严重程度：major
- 位置：src/node_modules/@sudoku/stores/game-session.js:64-72
- 原因：applyHint 在 store adapter 中直接求解并决定写入值，Game 并没有把这个 UI 操作建模成领域接口。这样“面向 UI 的游戏操作入口”没有完全收口到 Game，业务规则分散在 domain 与 adapter 两层，OOD 边界不够干净。

### 5. store 方法依赖 this，不符合常见 JS 模块写法

- 严重程度：minor
- 位置：src/node_modules/@sudoku/stores/game-session.js:48-53
- 原因：startNew/startCustom 通过 this.startWithGrid(...) 调用同对象方法，一旦方法被解构或当作回调传递就会丢失 this。对自定义 store 来说，直接闭包调用局部函数会更稳健，也更符合 JS 生态习惯。

## 优点

### 1. 输入校验集中且覆盖核心边界

- 位置：src/domain/helpers.js:24-102
- 原因：cell、index、move、grid、JSON 都走统一 normalize 入口，领域不变量没有散落在组件事件里，Sudoku/Game 的构造与操作边界相对清晰。

### 2. Game 把可编辑性与 Undo/Redo 收口为统一操作入口

- 位置：src/domain/game.js:61-104
- 原因：guess 会阻止修改初始 givens，并在成功写入后统一维护 undo/redo 栈；undo/redo 也都由 Game 自身完成，符合“会话对象管理流程”的职责划分。

### 3. UI 输入没有直接改二维数组

- 位置：src/node_modules/@sudoku/stores/grid.js:25-54
- 原因：userGrid.set/undo/redo/applyHint 都先转发到 gameSession，再落到 Game 接口，组件层没有直接写 currentGrid，满足了“真实界面真正消费领域对象”的核心要求。

### 4. 棋盘渲染来自响应式快照而非旧状态

- 位置：src/components/Board/index.svelte:40-52
- 原因：Board 直接消费 $userGrid、$grid、$invalidCells 来渲染当前盘面、题面 givens 和冲突高亮，说明领域对象已经进入真实界面的渲染链路。

### 5. 开局流程已经真正创建新的 Game 会话

- 位置：src/node_modules/@sudoku/game.js:8-24
- 原因：欢迎弹窗和菜单最终都会走 startNew/startCustom，再进入 gameSession.startWithGrid/createGame，不是只在测试里创建领域对象。

## 补充说明

- 本次结论仅基于静态阅读 src/domain/* 及其直接关联的 Svelte/store/组件接线；未运行测试，也未实际启动页面。
- 关于“界面会刷新”“主流程已接入领域对象”等判断，来自 App、Welcome、@sudoku/game、game-session、grid、Board、Keyboard、Actions 的静态调用链分析。
- 关于 Hint 在异常盘面上的运行时表现、第三方求解器返回值等，没有执行验证；相关评价只针对当前代码的职责边界和防御性设计。
