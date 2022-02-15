const { StaticRunOneTerminalOutputLifeCycle } = require('./static-run-one-terminal-output-life-cycle');
const { CompositeLifeCycle } = require('./life-cycle');
async function getTerminalOutputLifeCycle(
    initiatingProject,
    terminalOutputStrategy,
    projectNames,
    tasks,
    nxArgs,
    overrides,
    runnerOptions
) {
    if (terminalOutputStrategy === 'run-one') {
        return {
            lifeCycle: new StaticRunOneTerminalOutputLifeCycle(
                initiatingProject,
                projectNames,
                tasks,
                nxArgs
            ),
            renderIsDone: Promise.resolve(),
        };
    }
}

async function runCommand(projectsToRun, projectGraph, { nxJson }, nxArgs, overrides, terminalOutputStrategy, initiatingProject) {
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
    const projectNames = projectsToRun.map((t) => t.name);
    const { lifeCycle, renderIsDone } = await getTerminalOutputLifeCycle(initiatingProject, terminalOutputStrategy, projectNames, tasksMap, nxArgs, overrides, runnerOptions);
    const lifeCycles = [lifeCycle];
    // 使用 default-tasks-runner 来执行代码
    const promiseOrObservable = tasksRunner(
        tasksMap,
        Object.assign(
            Object.assign({}, runnerOptions), {
            lifeCycle: new CompositeLifeCycle(lifeCycles)
        }),
        {
            initiatingProject,
            target: nxArgs.target,
            projectGraph,
            nxJson,
        }
    );


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