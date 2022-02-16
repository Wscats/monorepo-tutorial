const child_process = require("child_process");
const path = require("path");
module.exports = {
    default: (options, context) => {
        const script = options.script;
        // 解析出命令之后，删除 script 属性，方便后面解析其参数信息
        delete options.script;
        // 解析命令参数
        const args = [];
        Object.keys(options).forEach((r) => {
            args.push(`--${r}=${options[r]}`);
        });
        // 执行命令
        child_process.execSync({
            install: 'npm install',
            add: 'npm install',
            addDev: 'npm install -D',
            rm: 'npm rm',
            exec: 'npx',
            run: (script, args) => `npm run ${script} -- ${args}`,
            list: 'npm ls',
        }.run(script, args), {
            stdio: ['inherit', 'inherit', 'inherit'],
            // 在 child 目录，运行 npm run test
            cwd: path.join(__dirname, context.project),
        });
    }
}