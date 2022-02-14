const { TypeScriptImportLocator } = requre('./typescript-import-locator');
import { TargetProjectLocator } from '../../target-project-locator';

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
        nxJson?.pluginsConfig &&
        nxJson?.pluginsConfig['@nrwl/js']
    ) {
        return nxJson?.pluginsConfig['@nrwl/js'];
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
} Ï

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