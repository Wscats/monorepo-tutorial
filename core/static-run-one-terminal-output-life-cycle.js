/**
 * The following life cycle's outputs are static, meaning no previous content
 * is rewritten or modified as new outputs are added. It is therefore intended
 * for use in CI environments.
 *
 * For the common case of a user executing a command on their local machine,
 * the dynamic equivalent of this life cycle is usually preferable.
 */
class StaticRunOneTerminalOutputLifeCycle {
    constructor(initiatingProject, projectNames, tasks, args) {
        this.initiatingProject = initiatingProject;
        this.projectNames = projectNames;
        this.tasks = tasks;
        this.args = args;
        this.failedTasks = [];
        this.cachedTasks = [];
    }
    startCommand() {
        if (process.env.NX_INVOKED_BY_RUNNER) {
            return;
        }
        const numberOfDeps = this.tasks.length - 1;
        if (numberOfDeps > 0) {
            console.log(`Running target ${output.output.bold(this.args.target)} for project ${output.output.bold(this.initiatingProject)} and ${output.output.bold(numberOfDeps)} task(s) it depends on`);
        }
    }
    endCommand() {
        // Silent for a single task
        if (process.env.NX_INVOKED_BY_RUNNER) {
            return;
        }
    }
    endTasks(taskResults) {
        for (let t of taskResults) {
            if (t.status === 'failure') {
                this.failedTasks.push(t.task);
            }
            else if (t.status === 'local-cache') {
                this.cachedTasks.push(t.task);
            }
            else if (t.status === 'local-cache-kept-existing') {
                this.cachedTasks.push(t.task);
            }
            else if (t.status === 'remote-cache') {
                this.cachedTasks.push(t.task);
            }
        }
    }
}

module.exports = { StaticRunOneTerminalOutputLifeCycle }