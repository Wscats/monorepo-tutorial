const { TypeScriptImportLocator } = require('./typescript-import-locator');
const { TargetProjectLocator } = require('./target-project-locator');
const { joinPathFragments } = require('./path')
const { parseJson } = require("./devkit");

function buildExplicitTypeScriptDependencies(
    workspace,
    graph,
    filesToProcess
) {
    const importLocator = new TypeScriptImportLocator();
    const targetProjectLocator = new TargetProjectLocator(
        graph.nodes,
        graph.externalNodes
    );
    const res = [];
    Object.keys(filesToProcess).forEach((source) => {
        Object.values(filesToProcess[source]).forEach((f) => {
            importLocator.fromFile(
                f.file,
                (importExpr, filePath, type) => {
                    const target = targetProjectLocator.findProjectWithImport(
                        importExpr,
                        f.file,
                        workspace.npmScope
                    );
                    if (target) {
                        res.push({
                            sourceProjectName: source,
                            targetProjectName: target,
                            sourceProjectFile: f.file,
                        });
                    }
                }
            );
        });
    });
    return res;
}

function processPackageJson(
    sourceProject,
    fileName,
    graph,
    collectedDeps,
    packageNameMap
) {
    try {
        const deps = readDeps(parseJson(defaultFileRead(fileName)));
        // the name matches the import path
        deps.forEach((d) => {
            // package.json refers to another project in the monorepo
            if (packageNameMap[d]) {
                collectedDeps.push({
                    sourceProjectName: sourceProject,
                    targetProjectName: packageNameMap[d],
                    sourceProjectFile: fileName,
                });
            } else if (graph.externalNodes[`npm:${d}`]) {
                collectedDeps.push({
                    sourceProjectName: sourceProject,
                    targetProjectName: `npm:${d}`,
                    sourceProjectFile: fileName,
                });
            }
        });
    } catch (e) {
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
            console.log(e);
        }
    }
}

function readDeps(packageJsonDeps) {
    // ??
    return [
        ...Object.keys(packageJsonDeps && packageJsonDeps.dependencies || {}),
        ...Object.keys(packageJsonDeps && packageJsonDeps.devDependencies || {}),
        ...Object.keys(packageJsonDeps && packageJsonDeps.peerDependencies || {}),
    ];
}

function buildExplicitPackageJsonDependencies(
    workspace,
    graph,
    filesToProcess
) {
    const res = [];
    let packageNameMap = undefined;
    Object.keys(filesToProcess).forEach((source) => {
        Object.values(filesToProcess[source]).forEach((f) => {
            if (isPackageJsonAtProjectRoot(graph.nodes, f.file)) {
                // we only create the package name map once and only if a package.json file changes
                packageNameMap = packageNameMap || createPackageNameMap(workspace);
                processPackageJson(source, f.file, graph, res, packageNameMap);
            }
        });
    });
    return res;
}

function defaultFileRead(filePath) {
    return fs.readFileSync(path.join(appRootPath, filePath), 'utf-8');
}

function createPackageNameMap(w) {
    const res = {};
    for (let projectName of Object.keys(w.projects)) {
        try {
            const packageJson = parseJson(
                defaultFileRead(path.join(w.projects[projectName].root, 'package.json'))
            );
            res[packageJson.name || `@${w.npmScope}/${projectName}`] = projectName;
        } catch (e) { }
    }
    return res;
}

function isPackageJsonAtProjectRoot(
    nodes,
    fileName
) {
    return Object.values(nodes).find(
        (projectNode) =>
            (projectNode.type === 'lib' || projectNode.type === 'app') &&
            joinPathFragments(projectNode.data.root, 'package.json') === fileName
    );
}

function buildExplicitTypescriptAndPackageJsonDependencies(
    jsPluginConfig,
    workspace,
    projectGraph,
    filesToProcess
) {
    let res = [];
    if (
        jsPluginConfig.analyzeSourceFiles === undefined ||
        jsPluginConfig.analyzeSourceFiles === true
    ) {
        res = res.concat(
            buildExplicitTypeScriptDependencies(
                workspace,
                projectGraph,
                filesToProcess
            )
        );
    }
    if (
        jsPluginConfig.analyzePackageJson === undefined ||
        jsPluginConfig.analyzePackageJson === true
    ) {
        res = res.concat(
            buildExplicitPackageJsonDependencies(
                workspace,
                projectGraph,
                filesToProcess
            )
        );
    }
    return res;
}

function jsPluginConfig(nxJson) {
    if (
        nxJson &&
        nxJson &&
        nxJson.pluginsConfig &&
        nxJson.pluginsConfig['@nrwl/js']
    ) {
        return nxJson && nxJson.pluginsConfig['@nrwl/js'];
    } else {
        return {};
    }
}

function buildExplicitDependencies(
    jsPluginConfig,
    ctx,
    builder
) {
    let totalNumOfFilesToProcess = totalNumberOfFilesToProcess(ctx);
    // using workers has an overhead, so we only do it when the number of
    // files we need to process is >= 100 and there are more than 2 CPUs
    // to be able to use at least 2 workers (1 worker per CPU and
    // 1 CPU for the main thread)
    if (totalNumOfFilesToProcess < 100 || getNumberOfWorkers() <= 2) {
        return buildExplicitDependenciesWithoutWorkers(
            jsPluginConfig,
            ctx,
            builder
        );
    } else {
        // return buildExplicitDependenciesUsingWorkers(
        //     jsPluginConfig,
        //     ctx,
        //     totalNumOfFilesToProcess,
        //     builder
        // );
    }
}

function buildExplicitDependenciesWithoutWorkers(
    jsPluginConfig,
    ctx,
    builder
) {
    buildExplicitTypescriptAndPackageJsonDependencies(
        jsPluginConfig,
        ctx.workspace,
        builder.graph,
        ctx.filesToProcess
    ).forEach((r) => {
        builder.addExplicitDependency(
            r.sourceProjectName,
            r.sourceProjectFile,
            r.targetProjectName
        );
    });
}

function getNumberOfWorkers() {
    return process.env.NX_PROJECT_GRAPH_MAX_WORKERS
        ? +process.env.NX_PROJECT_GRAPH_MAX_WORKERS
        : os.cpus().length - 1;
}

function totalNumberOfFilesToProcess(ctx) {
    let totalNumOfFilesToProcess = 0;
    Object.values(ctx.filesToProcess).forEach(
        (t) => (totalNumOfFilesToProcess += t.length)
    );
    return totalNumOfFilesToProcess;
}

module.exports = { buildExplicitDependencies, jsPluginConfig }