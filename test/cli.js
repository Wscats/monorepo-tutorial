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
        // 根据 project 参数知道要去 child 目录下寻找 package.json 和 /project.json
        // 读取 package.json
        const packageJson = fs.readFileSync(path.join(__dirname, `${project}/package.json`), 'utf-8').toString();
        // 读取 project.json
        const projectJson = fs.readFileSync(path.join(__dirname, `${project}/project.json`), 'utf-8').toString();
        // 解析 package.json
        const { scripts } = JSON.parse(packageJson);
        // 解析 project.json
        const { targets } = JSON.parse(projectJson);
        let mergePackageAndProjectScripts = {};
        // 遍历所有的命令，如果自定义了执行器则 require 对应的执行器执行命令
        // 否则默认都是使用 run-script 执行器，还有 package.json 的命令默认都是使用 run-script 执行器
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
        // 合并 project.json(nx) 和 package.json(npm) 的 scripts 命令
        mergePackageAndProjectScripts = { ...mergePackageAndProjectScripts, ...(targets || {}) };
        // 获取 run-script 执行器
        const module = require(mergePackageAndProjectScripts[target]['executor']);
        // 使用 run-script 执行器运行命令
        // option: 命令信息和带有的参数信息，告诉 run-script 具体执行那个命令，并且使用了那些具体参数
        // context: 作用域信息，可用于传递文件夹位置，项目目录，cli版本信息等
        module.default(mergePackageAndProjectScripts[target]['options'], {
            // 执行命令的项目位置
            project
            // 如果命令足够复杂，还可以传递更多的信息
        });
        break;
}
