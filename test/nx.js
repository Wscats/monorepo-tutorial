// node nx run child:test
// process.argv[0] => node
// process.argv[1] => nx
// process.argv[2] => run
// process.argv[3] => child:test
const child_process = require("child_process");
const path = require("path");
// 用于衍生新的 Node.js 子进程
// 注意：子进程独立于父进程
// 除了两者之间建立的 IPC 通信通道
// 每个进程都有自己的内存，具有自己的 V8 实例
// 由于需要额外的资源分配，不建议衍生大量子 Node.js 进程
const command = process.argv[2];
const commandArgs = process.argv[3];
const child = child_process.fork(
    path.join(__dirname, 'cli'),
    // 添加参数给子进程
    // 将命令和参数传递到 cli.js 处理
    // 相当于运行 node cli run child:test
    [command, commandArgs]
);
child.on('error', (err) => {
    // 如果控制器中止，则这将在 err 为 AbortError 的情况下被调用
});
