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
        // 读取 package.json
        const packageJson = fs.readFileSync(path.join(__dirname, `${project}/package.json`), 'utf-8').toString();
        // 读取 project.json
        const projectJson = fs.readFileSync(path.join(__dirname, `${project}/project.json`), 'utf-8').toString();
        // 解析 package.json
        const { scripts } = JSON.parse(packageJson);
        // 解析 project.json
        const { targets } = JSON.parse(projectJson);
        // 合并 project.json(nx) 和 package.json(npm) 的 scripts 命令
        let mergePackageAndProjectScripts = {};
        Object.keys(scripts || {}).forEach((script) => {
            mergePackageAndProjectScripts[script] = {
                // 默认的执行器
                executor: './run-script',
                // 命令参数
                options: {
                    script,
                },
            };
        });
        mergePackageAndProjectScripts = { ...mergePackageAndProjectScripts, ...(targets || {}) };
        // 获取 run-script 执行器
        const module = require(mergePackageAndProjectScripts[target]['executor']);
        // 使用 run-script 执行器运行命令
        module.default({ args, project, target });
        break;
}
