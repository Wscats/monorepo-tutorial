const child_process = require("child_process");
const path = require("path");
module.exports = {
    default: (options) => {
        const { args, project, target } = options;
        child_process.execSync({
            install: 'npm install',
            add: 'npm install',
            addDev: 'npm install -D',
            rm: 'npm rm',
            exec: 'npx',
            run: (script, args) => `npm run ${script} -- ${args}`,
            list: 'npm ls',
        }.run(target, args.join(' ')), {
            stdio: ['inherit', 'inherit', 'inherit'],
            // 在 child 目录，运行 npm run test
            cwd: path.join(__dirname, project),
        });
    }
}