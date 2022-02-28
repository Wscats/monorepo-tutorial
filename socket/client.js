const net = require("net");

const socket = net.connect('./d.sock');

socket.on('error', (err) => {
    console.log('socekt error', err);
});

socket.on('connect', () => {
    socket.write('REQUEST_PROJECT_GRAPH_PAYLOAD');
    let serializedProjectGraphResult = '';
    socket.on('data', (data) => {
        serializedProjectGraphResult += data.toString();
    });
    socket.on('end', () => {
        try {
            const projectGraphResult = JSON.parse(serializedProjectGraphResult);
            console.log('projectGraphResult', projectGraphResult);
        }
        catch (e) {
            console.log('connect error', e);
        }
    });
});


