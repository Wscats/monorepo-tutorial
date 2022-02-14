const path = require("path");
const fs = require("fs");
function readJsonFile(path) {
    const content = fs.readFileSync(path, 'utf-8');
    return JSON.parse(content);
}
function toNewFormatOrNull(w) {
    let formatted = false;
    Object.values(w.projects || {}).forEach((projectConfig) => {
        if (projectConfig.architect) {
            renamePropertyWithStableKeys(projectConfig, 'architect', 'targets');
            formatted = true;
        }
        if (projectConfig.schematics) {
            renamePropertyWithStableKeys(projectConfig, 'schematics', 'generators');
            formatted = true;
        }
        Object.values(projectConfig.targets || {}).forEach((target) => {
            if (target.builder !== undefined) {
                renamePropertyWithStableKeys(target, 'builder', 'executor');
                formatted = true;
            }
        });
    });
    if (w.schematics) {
        renamePropertyWithStableKeys(w, 'schematics', 'generators');
        formatted = true;
    }
    if (w.version !== 2) {
        w.version = 2;
        formatted = true;
    }
    return formatted ? w : null;
}

// we have to do it this way to preserve the order of properties
// not to screw up the formatting
function renamePropertyWithStableKeys(
    obj,
    from,
    to
) {
    const copy = { ...obj };
    Object.keys(obj).forEach((k) => {
        delete obj[k];
    });
    Object.keys(copy).forEach((k) => {
        if (k === from) {
            obj[to] = copy[k];
        } else {
            obj[k] = copy[k];
        }
    });
}

function inlineProjectConfigurations(w, root) {
    Object.entries(w.projects || {}).forEach(
        ([project, config]) => {
            if (typeof config === 'string') {
                const configFilePath = path.join(root, config, 'project.json');
                const fileConfig = readJsonFile(configFilePath);
                w.projects[project] = fileConfig;
            }
        }
    );
    return w;
}

function toNewFormat(w) {
    const f = toNewFormatOrNull(w);
    // 相当于 return f ?? w;
    return f !== null && f !== void 0 ? f : w;
}

function resolveNewFormatWithInlineProjects(
    w,
    root,
) {
    return toNewFormat(inlineProjectConfigurations(w, root));
}

module.exports = { resolveNewFormatWithInlineProjects }