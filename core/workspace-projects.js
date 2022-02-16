const path = require("path");
const fs = require("fs");
const { statSync, existsSync, readFileSync } = require("fs-extra");
const { sync } = require("fast-glob");


function findPluginPackageJson(path, plugin) {
    while (true) {
        if (!path.startsWith(appRootPath)) {
            throw new Error("Couldn't find a package.json for Nx plugin:" + plugin);
        }
        if (existsSync(join(path, 'package.json'))) {
            return join(path, 'package.json');
        }
        path = path.dirname(path);
    }
}

let nxPluginCache = null;
function loadNxPlugins(plugins) {
    return plugins && plugins.length
        ? nxPluginCache ||
        (nxPluginCache = plugins.map((path) => {
            const pluginPath = require.resolve(path, {
                paths: [appRootPath],
            });

            const { name } = readJsonFile(
                findPluginPackageJson(pluginPath, path)
            );
            const plugin = require(pluginPath);
            plugin.name = name;

            return plugin;
        }))
        : [];
}

function mergePluginTargetsWithNxTargets(
    projectRoot,
    targets,
    plugins
) {
    let newTargets = {};
    for (const plugin of plugins) {
        if (!plugin.projectFilePatterns && plugin.projectFilePatterns.length || !plugin.registerProjectTargets) {
            continue;
        }

        const projectFiles = sync(`+(${plugin.projectFilePatterns.join('|')})`, {
            cwd: path.join(appRootPath, projectRoot),
        });
        for (const projectFile of projectFiles) {
            newTargets = {
                ...newTargets,
                ...plugin.registerProjectTargets(path.join(projectRoot, projectFile)),
            };
        }
    }
    return { ...newTargets, ...targets };
}

function readJsonFile(path) {
    const content = fs.readFileSync(path, 'utf-8');
    return JSON.parse(content);
}

function buildTargetFromScript(
    script,
    nx
) {
    const nxTargetConfiguration = nx && nx.targets && nx.targets[script] || {};

    return {
        ...nxTargetConfiguration,
        executor: '@nrwl/workspace:run-script',
        options: {
            ...(nxTargetConfiguration.options || {}),
            script,
        },
    };
}

function mergeNpmScriptsWithTargets(
    projectRoot,
    targets
) {
    try {
        const { scripts, nx } = readJsonFile(
            `${projectRoot}/package.json`
        );
        const res = {};
        // handle no scripts
        Object.keys(scripts || {}).forEach((script) => {
            res[script] = buildTargetFromScript(script, nx);
        });
        return { ...res, ...(targets || {}) };
    } catch (e) {
        return undefined;
    }
}

function buildWorkspaceProjectNodes(
    ctx,
    builder,
    appRootPath,
) {
    const toAdd = [];
    Object.keys(ctx.workspace.projects).forEach((key) => {
        const p = ctx.workspace.projects[key];
        const projectRoot = path.join(appRootPath, p.root);
        if (existsSync(path.join(projectRoot, 'package.json'))) {
            p.targets = mergeNpmScriptsWithTargets(projectRoot, p.targets);
        }
        p.targets = mergePluginTargetsWithNxTargets(
            p.root,
            p.targets,
            loadNxPlugins(ctx.workspace.plugins)
        );
        const projectType =
            p.projectType === 'application'
                ? key.endsWith('-e2e')
                    ? 'e2e'
                    : 'app'
                : 'lib';
        const tags =
            ctx.workspace.projects && ctx.workspace.projects[key]
                ? ctx.workspace.projects[key].tags || []
                : [];

        toAdd.push({
            name: key,
            type: projectType,
            data: {
                ...p,
                tags,
                files: ctx.fileMap[key],
            },
        });
    });

    // Sort by root directory length (do we need this?)
    toAdd.sort((a, b) => {
        if (!a.data.root) return -1;
        if (!b.data.root) return -1;
        return a.data.root.length > b.data.root.length ? -1 : 1;
    });

    toAdd.forEach((n) => {
        builder.addNode({
            name: n.name,
            type: n.type,
            data: n.data,
        });
    });
}

module.exports = { buildWorkspaceProjectNodes }