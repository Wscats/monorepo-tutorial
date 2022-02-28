const child_process = require("child_process");
const fs = require("fs");

// 记录终端输出日志
const out = fs.openSync('./daemon.log', 'a');
const err = fs.openSync('./daemon.log', 'a');

const backgroundProcess = child_process.spawn(process.execPath, ['./server.js'], {
    cwd: __dirname,
    stdio: ['ignore', out, err],
    detached: true,
    windowsHide: true,
    shell: false,
});

backgroundProcess.unref();