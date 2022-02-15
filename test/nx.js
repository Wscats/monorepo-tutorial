// nx run simple:test
const child_process = require("child_process");
const path = require("path");
// 运行 node fork 将打开新的子进程并运行 node fork child
if (process.argv[2] === 'fork') {
    const type = process.argv[3];
    const combineScript = process.argv[4];
    const [folder, script] = combineScript.split(':');
    const args = process.argv[5] || [];
    child_process.execSync({
        install: 'npm install',
        add: 'npm install',
        addDev: 'npm install -D',
        rm: 'npm rm',
        exec: 'npx',
        run: (script, args) => `npm run ${script} -- ${args}`,
        list: 'npm ls',
    }.run(script, args.join(' ')), {
        stdio: ['inherit', 'inherit', 'inherit'],
        // 定位到 child 目录
        cwd: path.join(__dirname, folder),
    });
} else {
    // 用于衍生新的 Node.js 子进程
    // 注意：衍生的 Node.js 子进程独立于父进程，
    // 除了两者之间建立的 IPC 通信通道。 
    // 每个进程都有自己的内存，具有自己的 V8 实例。 
    // 由于需要额外的资源分配，不建议衍生大量子 Node.js 进程
    const type = process.argv[2];
    const script = process.argv[3];
    const child = child_process.fork(
        __filename,
        // 添加参数给子进程
        // 相当于运行 node nx run fork child:test
        [
            // 通信标记
            'fork',
            type,
            script
        ],
        {
            env: process.env.FORCE_COLOR
        }
    );
    child.on('error', (err) => {
        // 如果控制器中止，则这将在 err 为 AbortError 的情况下被调用
    });
}
