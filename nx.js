const fs = require("fs");
const path = require("path");
function findWorkspaceRoot(dir) {
    if (fs.existsSync(path.join(dir, 'angular.json'))) {
        return { type: 'angular', dir };
    }
    if (fs.existsSync(path.join(dir, 'nx.json'))) {
        return { type: 'nx', dir };
    }
    if (path.dirname(dir) === dir) {
        return null;
    }
    return findWorkspaceRoot(path.dirname(dir));
}

function readJsonFile(path) {
    const content = fs.readFileSync(path, 'utf-8');
    return JSON.parse(content);
}

// 读取本地 nx.json 和 workspace.json 配置文件
const workspace = findWorkspaceRoot(process.cwd());
const nxJsonPath = path.join(workspace.dir, 'nx.json');
const workspaceJsonPath = path.join(workspace.dir, 'workspace.json');
const nxJson = readJsonFile(nxJsonPath);
const workspaceJson = readJsonFile(workspaceJsonPath);
const workspaceConfig = Object.assign(Object.assign({}, workspaceJson), nxJson);
// 这里会有个 parseRunOneOptions 来过滤参数

console.log(workspaceConfig);