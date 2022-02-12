const { createServer, Server, Socket } = require("net");
const { unlinkSync } = require('fs');

const FULL_OS_SOCKET_PATH = './d.sock';
const server = createServer(async (socket) => {
    socket.on('data', async (data) => {
        // const payload = data.toString();
        // const result = await getCachedSerializedProjectGraphPromise();
        // const serializedResult = serializeResult(
        //     result.error,
        //     result.serializedProjectGraph
        // );
        serializedResult = JSON.stringify({ test: 'eno' });
        socket.write(serializedResult, () => {
            socket.end();
        });
    });
});

async function startServer() {
    return new Promise((resolve) => {
        // 要监听套接字 d.sock
        server.listen(FULL_OS_SOCKET_PATH, async () => {
            console.log(`Started listening`);
            return resolve(server);
        });

    });
};

async function stopServer() {
    return new Promise((resolve, reject) => {
        server.close((err) => {
            if (err) {
                if (!err.message.startsWith('Server is not running')) {
                    return reject(err);
                }
            }
            unlinkSync(FULL_OS_SOCKET_PATH);
            return resolve();
        });
    });
}


(async () => {
    try {
        await startServer();
    } catch (err) {
        console.error('Something unexpected went wrong when starting the server');
        process.exit(1);
    }
})();
