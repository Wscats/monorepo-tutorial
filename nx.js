const fs = require("fs");
const path = require("path");
const yargsParser = require("yargs-parser");
const net = require("net");
const { getFileHashes, getIgnoredGlobs } = require("./git-hash");
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

const runOne = [
    'target',
    'configuration',
    'prod',
    'runner',
    'parallel',
    'max-parallel',
    'exclude',
    'only-failed',
    'help',
    'with-deps',
    'skip-nx-cache',
    'scan',
    'hide-cached-output',
];
const runMany = [...runOne, 'projects', 'all'];
const runAffected = [
    ...runOne,
    'untracked',
    'uncommitted',
    'all',
    'base',
    'head',
    'files',
    'plain',
    'select',
];

const ignoreArgs = ['$0', '_'];

function splitArgsIntoNxArgsAndOverrides(args, mode, options = { printWarnings: true }) {
    console.log(args, mode, options);
    const nxSpecific = mode === 'run-one' ? runOne : mode === 'run-many' ? runMany : runAffected;
    const nxArgs = {};
    const overrides = yargsParser(args._, {
        configuration: {
            'strip-dashed': true,
            'dot-notation': false,
        },
    });
    args._ = overrides._;
    delete overrides._;
    Object.entries(args).forEach(([key, value]) => {
        if (nxSpecific.includes(key) || key.startsWith('nx-')) {
            if (value !== undefined)
                nxArgs[key] = value;
        }
        else if (!ignoreArgs.includes(key)) {
            overrides[key] = value;
        }
    });
    if (!nxArgs.skipNxCache) {
        nxArgs.skipNxCache = process.env.NX_SKIP_NX_CACHE === 'true';
    }
    return { nxArgs, overrides };
}


// 读取本地 nx.json 和 workspace.json 配置文件
const workspace = findWorkspaceRoot(process.cwd());
const nxJsonPath = path.join(workspace.dir, 'nx.json');
const workspaceJsonPath = path.join(workspace.dir, 'workspace.json');
const nxJson = readJsonFile(nxJsonPath);
const workspaceJson = readJsonFile(workspaceJsonPath);
const workspaceConfig = Object.assign(Object.assign({}, workspaceJson), nxJson);
// 这里会有个 parseRunOneOptions 来过滤参数
const args = process.argv.slice(2);

const parsedArgs = yargsParser(args, {
    boolean: ['prod', 'help'],
    string: ['configuration', 'project'],
    alias: {
        c: 'configuration',
    },
    configuration: {
        'strip-dashed': true,
    },
});

let project;
let target;
let configuration;
if (parsedArgs._[0] === 'run') {
    [project, target, configuration] = parsedArgs._[1].split(':');
    parsedArgs._ = parsedArgs._.slice(2);
}
const runOpts = { project, target, configuration, parsedArgs };
delete parsedArgs['c'];
delete parsedArgs['configuration'];
delete parsedArgs['prod'];
delete parsedArgs['project'];

// nx 支持的命令
const supportedNxCommands = [
    'affected',
    'affected:apps',
    'affected:libs',
    'affected:build',
    'affected:test',
    'affected:e2e',
    'affected:dep-graph',
    'affected:graph',
    'affected:lint',
    'print-affected',
    'daemon',
    'dep-graph',
    'graph',
    'format',
    'format:check',
    'format:write',
    'workspace-schematic',
    'workspace-generator',
    'workspace-lint',
    'migrate',
    'report',
    'run-many',
    'connect-to-nx-cloud',
    'clear-cache',
    'reset',
    'list',
    'help',
    '--help',
    '--version',
];

// 判断是否用内置命令
const running = runOpts !== false;
if (supportedNxCommands.includes(process.argv[2])) {

}
// 判断是否运行一条命令，例如 nx run xxx
else if (running) {
    (async () => {
        // 将 parsedArgs (执行命令参数)拆分为 Nx 参数并覆盖，最终所有参数组合成 nxArgs
        const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(Object.assign(Object.assign({}, runOpts.parsedArgs), { configuration: runOpts.configuration, target: runOpts.target }), 'run-one');

        console.log(workspaceConfig);

        // 使用 git 命令查看变更的文件
        const gitResult = await getFileHashes(workspace.dir);
        const ignore = getIgnoredGlobs(workspace.dir);
        const fileHashes = new Map();
        gitResult.allFiles.forEach((hash, filename) => {
            if (!ignore.ignores(filename)) {
                fileHashes.set(filename, hash);
            }
        });

        console.log(gitResult);
        console.log(fileHashes);
        const projectGraphVersion = '5.0';

        const socket = net.connect('./d.sock');
        socket.on('error', (err) => {
            console.log('socekt error', err);
        });

        socket.on('connect', () => {
            socket.write('REQUEST_PROJECT_GRAPH_PAYLOAD');
            let serializedProjectGraphResult = '';
            socket.on('data', (data) => {
                serializedProjectGraphResult += data.toString();
            });
            socket.on('end', () => {
                try {
                    const projectGraphResult = JSON.parse(serializedProjectGraphResult);
                    console.log('projectGraphResult', projectGraphResult);
                }
                catch (e) {
                    console.log('connect error', e);
                }
            });
        });
    })()
}
