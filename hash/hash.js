const child_process = require("child_process");
const fs = require("fs");
const nodePath = require("path");

function fileExists(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    }
    catch (err) {
        return false;
    }
}

async function getGitHashForFiles(potentialFilesToHash, path) {
    const filesToHash = [];
    const deleted = [];
    for (let file of potentialFilesToHash) {
        if (fileExists(nodePath.join(path, file))) {
            filesToHash.push(file);
        }
        else {
            deleted.push(file);
        }
    }
    const res = new Map();
    if (filesToHash.length) {
        const hashStdout = await spawnProcess('git', ['hash-object', ...filesToHash], path);
        const hashes = hashStdout.split('\n').filter((s) => !!s);
        if (hashes.length !== filesToHash.length) {
            throw new Error(`Passed ${filesToHash.length} file paths to Git to hash, but received ${hashes.length} hashes.`);
        }
        for (let i = 0; i < hashes.length; i++) {
            const hash = hashes[i];
            const filePath = filesToHash[i];
            res.set(filePath, hash);
        }
    }
    return { hashes: res, deleted };
}

async function spawnProcess(command, args, cwd) {
    const cp = child_process.spawn(command, args, {
        windowsHide: true,
        shell: false,
        cwd,
    });
    let stdout = '';
    for await (const data of cp.stdout) {
        stdout += data;
    }
    return stdout;
}

async function getStagedFiles(path) {
    const staged = await spawnProcess('git', ['ls-files', '-s', '-z', '--exclude-standard', '.'], path);
    const res = new Map();
    for (let line of staged.split('\0')) {
        if (!line)
            continue;
        const [_, hash, __, ...fileParts] = line.split(/\s/);
        const fileName = fileParts.join(' ');
        res.set(fileName, hash);
    }
    return res;
}
async function getUnstagedFiles(path) {
    const unstaged = await spawnProcess('git', ['ls-files', '-m', '-z', '--exclude-standard', '.'], path);
    const lines = unstaged.split('\0').filter((f) => !!f);
    return getGitHashForFiles(lines, path);
}
async function getUntrackedFiles(path) {
    const untracked = await spawnProcess('git', ['ls-files', '--other', '-z', '--exclude-standard', '.'], path);
    const lines = untracked.split('\0').filter((f) => !!f);
    return getGitHashForFiles(lines, path);
}
async function getFileHashes(path) {
    const [staged, unstaged, untracked] = await Promise.all([
        getStagedFiles(path),
        getUnstagedFiles(path),
        getUntrackedFiles(path),
    ]);
    unstaged.hashes.forEach((hash, filename) => {
        staged.set(filename, hash);
    });
    unstaged.deleted.forEach((filename) => {
        staged.delete(filename);
    });
    untracked.hashes.forEach((hash, filename) => {
        staged.set(filename, hash);
    });
    return { allFiles: staged };
}

(async () => {
    const fileHashes = await getFileHashes(__dirname);
    console.log(fileHashes);

    const res = [];
    fileHashes.allFiles.forEach((hash, file) => {
        res.push({
            file,
            hash,
        });
    });
    console.log(res);
})();
