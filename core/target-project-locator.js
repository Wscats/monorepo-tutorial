const typescript = require("./typescript");
const path = require("path");
const fs = require("fs");
const app_root = require("./app-root");
const { parseJson } = require("./devkit");

function isRelativePath(path) {
    return (path === '.' ||
        path === '..' ||
        path.startsWith('./') ||
        path.startsWith('../'));
}



function readFileIfExisting(path) {
    return fs.existsSync(path) ? fs.readFileSync(path, 'utf-8') : '';
}

class TargetProjectLocator {
    constructor(nodes, externalNodes) {
        var _a, _b;
        this.nodes = nodes;
        this.externalNodes = externalNodes;
        this.projectRootMappings = createProjectRootMappings(this.nodes);
        this.npmProjects = this.externalNodes
            ? Object.values(this.externalNodes)
            : [];
        this.tsConfig = this.getRootTsConfig();
        this.paths = (_b = (_a = this.tsConfig.config) === null || _a === void 0 ? void 0 : _a.compilerOptions) === null || _b === void 0 ? void 0 : _b.paths;
        this.typescriptResolutionCache = new Map();
        this.npmResolutionCache = new Map();
    }
    /**
     * Find a project based on its import
     *
     * @param importExpr
     * @param filePath
     * @param npmScope
     *  Npm scope shouldn't be used finding a project, but, to improve backward
     *  compatibility, we fallback to checking the scope.
     *  This happens in cases where someone has the dist output in their tsconfigs
     *  and typescript will find the dist before the src.
     */
    findProjectWithImport(importExpr, filePath, npmScope) {
        const normalizedImportExpr = importExpr.split('#')[0];
        if (isRelativePath(normalizedImportExpr)) {
            const resolvedModule = path.posix.join((0, path.dirname)(filePath), normalizedImportExpr);
            return this.findProjectOfResolvedModule(resolvedModule);
        }
        const paths = this.findPaths(normalizedImportExpr);
        if (paths) {
            for (let p of paths) {
                const maybeResolvedProject = this.findProjectOfResolvedModule(p);
                if (maybeResolvedProject) {
                    return maybeResolvedProject;
                }
            }
        }
        // try to find npm package before using expensive typescript resolution
        const npmProject = this.findNpmPackage(normalizedImportExpr);
        if (npmProject) {
            return npmProject;
        }
        if (this.tsConfig.config) {
            // TODO(meeroslav): this block is probably obsolete
            // and existed only because of the incomplete `paths` matching
            // if import cannot be matched using tsconfig `paths` the compilation would fail anyway
            const resolvedProject = this.resolveImportWithTypescript(normalizedImportExpr, filePath);
            if (resolvedProject) {
                return resolvedProject;
            }
        }
        // nothing found, cache for later
        this.npmResolutionCache.set(normalizedImportExpr, undefined);
        return null;
    }
    findPaths(normalizedImportExpr) {
        if (!this.paths) {
            return undefined;
        }
        if (this.paths[normalizedImportExpr]) {
            return this.paths[normalizedImportExpr];
        }
        const wildcardPath = Object.keys(this.paths).find((path) => path.endsWith('/*') &&
            (normalizedImportExpr.startsWith(path.replace(/\*$/, '')) ||
                normalizedImportExpr === path.replace(/\/\*$/, '')));
        if (wildcardPath) {
            return this.paths[wildcardPath];
        }
        return undefined;
    }
    resolveImportWithTypescript(normalizedImportExpr, filePath) {
        let resolvedModule;
        if (this.typescriptResolutionCache.has(normalizedImportExpr)) {
            resolvedModule = this.typescriptResolutionCache.get(normalizedImportExpr);
        }
        else {
            resolvedModule = (0, typescript.resolveModuleByImport)(normalizedImportExpr, filePath, this.tsConfig.absolutePath);
            this.typescriptResolutionCache.set(normalizedImportExpr, resolvedModule ? resolvedModule : null);
        }
        // TODO: vsavkin temporary workaround. Remove it once we reworking handling of npm packages.
        if (resolvedModule && resolvedModule.indexOf('node_modules/') === -1) {
            const resolvedProject = this.findProjectOfResolvedModule(resolvedModule);
            if (resolvedProject) {
                return resolvedProject;
            }
        }
        return;
    }
    findNpmPackage(npmImport) {
        if (this.npmResolutionCache.has(npmImport)) {
            return this.npmResolutionCache.get(npmImport);
        }
        else {
            const pkg = this.npmProjects.find((pkg) => npmImport === pkg.data.packageName ||
                npmImport.startsWith(`${pkg.data.packageName}/`));
            if (pkg) {
                this.npmResolutionCache.set(npmImport, pkg.name);
                return pkg.name;
            }
        }
    }
    findProjectOfResolvedModule(resolvedModule) {
        const normalizedResolvedModule = resolvedModule.startsWith('./')
            ? resolvedModule.substring(2)
            : resolvedModule;
        const importedProject = this.findMatchingProjectFiles(normalizedResolvedModule);
        return importedProject ? importedProject.name : void 0;
    }
    getAbsolutePath(path2) {
        return path.join(app_root.appRootPath, path2);
    }
    getRootTsConfig() {
        let path = 'tsconfig.base.json';
        let absolutePath = this.getAbsolutePath(path);
        let content = readFileIfExisting(absolutePath);
        if (!content) {
            path = 'tsconfig.json';
            absolutePath = this.getAbsolutePath(path);
            content = readFileIfExisting(absolutePath);
        }
        if (!content) {
            return {
                path: null,
                absolutePath: null,
                config: null,
            };
        }
        return { path, absolutePath, config: parseJson(content) };
    }
    findMatchingProjectFiles(file) {
        for (let currentPath = file; currentPath != (0, path.dirname)(currentPath); currentPath = (0, path.dirname)(currentPath)) {
            const p = this.projectRootMappings.get(currentPath);
            if (p) {
                return p;
            }
        }
        return null;
    }
}
function createProjectRootMappings(nodes) {
    const projectRootMappings = new Map();
    for (const projectName of Object.keys(nodes)) {
        const root = nodes[projectName].data.root;
        projectRootMappings.set(root && root.endsWith('/') ? root.substring(0, root.length - 1) : root, nodes[projectName]);
    }
    return projectRootMappings;
}

module.exports = { TargetProjectLocator }