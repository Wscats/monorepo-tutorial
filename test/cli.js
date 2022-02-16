const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const args = process.argv.slice(2);
const [command, ...commandArgs] = args;

switch (command) {
    case 'help':
    case '--help':
        break;
    case 'run':
    case 'r':
        // child: test ↓
        // project = child; target = test
        const [project, target] = commandArgs[0].split(':');
        const packageJson = fs.readFileSync(path.join(__dirname, `${project}/package.json`), 'utf-8').toString();
        const projectJson = fs.readFileSync(path.join(__dirname, `${project}/project.json`), 'utf-8').toString();
        const { scripts } = JSON.parse(packageJson);
        const { targets } = JSON.parse(projectJson);
        // 融合 project.json(nx) 和 package.json(npm) 的 scripts 命令
        let mergePackageAndProjectScripts = {};
        Object.keys(scripts || {}).forEach((script) => {
            mergePackageAndProjectScripts[script] = {
                // 默认的执行器
                executor: '@nrwl/workspace:run-script',
                options: {
                    script,
                },
            };
        });
        mergePackageAndProjectScripts = { ...mergePackageAndProjectScripts, ...(targets || {}) };
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
        break;
}
