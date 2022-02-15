const fs = require("fs");
const path = require("path");
const yargsParser = require("yargs-parser");
const net = require("net");
const { existsSync } = require('fs-extra');
const { getFileHashes, getIgnoredGlobs } = require("./core/git-hash");
const { createProjectFileMap, updateProjectFileMap } = require("./core/file-map-utils");
const { ProjectGraphBuilder } = require("./core/project-graph-builder");
const { buildWorkspaceProjectNodes } = require("./core/workspace-projects");
const { resolveNewFormatWithInlineProjects } = require("./core/workspace");
const { buildNpmPackageNodes } = require("./core/npm-packages");
const { buildExplicitDependencies, jsPluginConfig } = require("./core/build-project-graph");
const { buildImplicitProjectDependencies } = require("./core/implicit-project-dependencies");
const { createCache, writeCache } = require("./core/nx-deps-cache");
const { projectGraphAdapter } = require('./core/project-graph');
const { getProjects } = require('./core/run-one');
const { runCommand } = require('./core/run-command');

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

function normalizeNxJson(nxJson, projects) {
    return nxJson.implicitDependencies
        ? Object.assign(Object.assign({}, nxJson), {
            implicitDependencies: Object.entries(nxJson.implicitDependencies).reduce((acc, [key, val]) => {
                acc[key] = recur(projects, val);
                return acc;
            }, {})
        }) : nxJson;
}

function recur(projects, v) {
    if (v === '*') {
        return projects;
    }
    else if (Array.isArray(v)) {
        return v;
    }
    else {
        return Object.keys(v).reduce((acc, key) => {
            acc[key] = recur(projects, v[key]);
            return acc;
        }, {});
    }
}

function readCombinedDeps(appRootPath) {
    const json = readJsonFile(path.join(appRootPath, 'package.json'));
    return { ...json.dependencies, ...json.devDependencies };
}

function readRootTsConfig(appRootPath) {
    for (const tsConfigName of ['tsconfig.base.json', 'tsconfig.json']) {
        const tsConfigPath = path.join(appRootPath, tsConfigName);
        if (existsSync(tsConfigPath)) {
            return readJsonFile(tsConfigPath);
        }
    }
}

function createContext(
    workspaceJson,
    nxJson,
    fileMap,
    filesToProcess
) {
    const projects = Object.keys(workspaceJson.projects).reduce((map, projectName) => {
        map[projectName] = {
            ...workspaceJson.projects[projectName],
        };
        return map;
    }, {});
    return {
        workspace: {
            ...workspaceJson,
            ...nxJson,
            projects,
        },
        fileMap,
        filesToProcess,
    };
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
const nxDepsJsonPath = path.join(workspace.dir, 'nx-deps.json');
const nxDepsJson = fs.existsSync(nxDepsJsonPath) ? readJsonFile(nxDepsJsonPath) : null;
// 转换 workspaceJson 的数据
let workspaceJson = readJsonFile(workspaceJsonPath);
// 本质 workspaceJson + project.json
// 读取 workspaceJson 里所有子项目的 project.json 配置，并合并到 workspaceJson 的 projects 属性里面
workspaceJson = resolveNewFormatWithInlineProjects(workspaceJson, workspace.dir);
// 本质 workspaceJson + nx.json
// readWorkspaceConfiguration，将 workspaceJson 和 nx.json 合并
// 这里省略检测 nx.json 配置的合法性
workspaceJson = Object.assign(Object.assign({}, workspaceJson), nxJson);


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

        // 使用 git 命令查看变更的文件
        const gitResult = await getFileHashes(workspace.dir);
        const ignore = getIgnoredGlobs(workspace.dir);
        const fileHashes = new Map();
        gitResult.allFiles.forEach((hash, filename) => {
            if (!ignore.ignores(filename)) {
                fileHashes.set(filename, hash);
            }
        });

        const allFileData = (() => {
            const res = [];
            fileHashes.forEach((hash, file) => {
                res.push({
                    file,
                    hash,
                });
            });
            res.sort((x, y) => x.file.localeCompare(y.file));
            return res;
        })()

        // createProjectFileMap
        const projectGraphVersion = '5.0';
        const { projectFileMap, allWorkspaceFiles } = createProjectFileMap(workspaceJson, allFileData);
        // 缓存是否启用
        const cacheEnabled = process.env.NX_CACHE_PROJECT_GRAPH !== 'false';
        // 判断是否存在 nx_deps.json，如果层级执行过这个文件会被存储起来当缓存，并读取 nx_deps.json 缓存文件
        let cache = nxDepsJson;
        const normalizedNxJson = normalizeNxJson(nxJson, Object.keys(workspaceJson.projects));
        const packageJsonDeps = readCombinedDeps(workspace.dir);
        const rootTsConfig = readRootTsConfig(workspace.dir);
        let filesToProcess;
        let cachedFileData;
        if (cache) {

        } else {
            filesToProcess = projectFileMap;
            cachedFileData = {};
        }
        const context = createContext(workspaceJson, normalizedNxJson, projectFileMap, filesToProcess);
        // buildProjectGraphUsingContext 使用作用域构建 projectGraph
        const builder = new ProjectGraphBuilder();
        // 创建完 builder 之后，其实最关键是 getUpdatedProjectGraph
        buildWorkspaceProjectNodes(context, builder, workspace.dir);
        buildNpmPackageNodes(builder, workspace.dir);
        for (const proj of Object.keys(cachedFileData)) {
            for (const f of builder.graph.nodes[proj].data.files) {
                const cached = cachedFileData[proj][f.file];
                if (cached && cached.deps) {
                    f.deps = [...cached.deps];
                }
            }
        }
        // 分析 ts 代码的 import 依赖
        await buildExplicitDependencies(jsPluginConfig(nxJson), context, builder);
        buildImplicitProjectDependencies(context, builder);
        builder.setVersion(projectGraphVersion);
        // 创建 projectGraph
        let projectGraph = builder.getUpdatedProjectGraph();
        // 缓存 projectGraph
        const projectGraphCache = createCache(nxJson, packageJsonDeps, projectGraph, rootTsConfig);
        // 写入 nxdeps.json 缓存文件到 .cache 文件夹
        if (cacheEnabled) {
            writeCache(projectGraphCache);
        }
        // projectGraph 项目图的向后兼容性适配器
        // 这里如果是使用 5 的 nx 版本，但是是 4 版本的写法，会使用 projectGraphCompat5to4 函数转换一次
        projectGraph = projectGraphAdapter('5.0', projectGraphVersion, projectGraph);
        // 根据项目图配合命令 npm run xxx:xxx 参数寻找出 project.json 中对应的命令
        const { projects, projectsMap } = getProjects(projectGraph, runOpts.project);
        // 读取 nxJson 和 workspaceJson 作为环境
        const env = { nxJson, workspaceJson, workspaceResults: null };
        await runCommand(
            projects,
            projectGraph,
            env,
            nxArgs,
            overrides,
            'run-one',
            runOpts.project
        );

        // const socket = net.connect('./d.sock');
        // socket.on('error', (err) => {
        //     console.log('socekt error', err);
        // });

        // socket.on('connect', () => {
        //     socket.write('REQUEST_PROJECT_GRAPH_PAYLOAD');
        //     let serializedProjectGraphResult = '';
        //     socket.on('data', (data) => {
        //         serializedProjectGraphResult += data.toString();
        //     });
        //     socket.on('end', () => {
        //         try {
        //             const projectGraphResult = JSON.parse(serializedProjectGraphResult);
        //             console.log('projectGraphResult', projectGraphResult);
        //         }
        //         catch (e) {
        //             console.log('connect error', e);
        //         }
        //     });
        // });
        console.log('end');
    })()
}
