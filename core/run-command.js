function runCommand(projectsToRun, projectGraph, { nxJson }, nxArgs, overrides, terminalOutputStrategy, initiatingProject) {
    const { tasksRunner, runnerOptions } = getRunner(nxArgs, nxJson);
    console.log('runCommand');
    const tasksMap = [];
    // 组合命令信息
    // createTasksForProjectToRun
    for (const project of projectsToRun) {
        tasksMap.push({
            id: `${project.name}:${nxArgs.target}`,
            overrides,
            target: {
                project: project.name,
                // 先不演示有命令带参数的情况
                configuration: undefined,
                target: nxArgs.target
            },
            projectRoot: project.data.root,

        })
    }
    console.log(tasksMap);
}

function getRunner(nxArgs, nxJson) {
    let runner = nxArgs.runner;
    runner = runner || 'default';
    if (nxJson.tasksRunnerOptions[runner]) {
        // 这里取的是 nx.json 里面默认的 tasksRunnerOptions 的 default runner
        let modulePath = nxJson.tasksRunnerOptions[runner].runner;
        let tasksRunner;
        if (modulePath) {
            tasksRunner = require(modulePath);
            // to support both babel and ts formats
            if (tasksRunner.default) {
                tasksRunner = tasksRunner.default;
            }
        }
        return {
            tasksRunner,
            runnerOptions: Object.assign(Object.assign({}, nxJson.tasksRunnerOptions[runner].options), nxArgs),
        };
    }
}

module.exports = { runCommand }