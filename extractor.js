const puppeteer = require('puppeteer');
const fs = require('fs');
const https = require('https');
const http = require('http');

// ব্রাউজারের কুকিজ ও হেডার সহ মাস্টার প্লেলিস্ট ফেচ করার ফাংশন
async function parseMasterPlaylist(masterUrl, cookies, userAgent) {
    return new Promise((resolve) => {
        const urlObj = new URL(masterUrl);
        const client = urlObj.protocol === 'https:' ? https : http;

        // কুকিজ ফরম্যাট করা
        let cookieString = '';
        if (cookies && cookies.length > 0) {
            cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        }

        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': userAgent,
                'Referer': 'https://www.fancode.com/',
                'Origin': 'https://www.fancode.com',
                ...(cookieString ? { 'Cookie': cookieString } : {})
            }
        };

        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                let resolutions = [];
                const lines = data.split('\n');
                let currentRes = "Unknown";

                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i].trim();
                    if (line.includes('RESOLUTION=')) {
                        const match = line.match(/RESOLUTION=(\d+x\d+)/);
                        if (match) {
                            // হাইট বা রেজুলেশন বের করা (যেমন: 720p, 1080p)
                            const dims = match[1].split('x');
                            currentRes = dims[1] ? dims[1] + 'p' : match[1];
                        }
                    } else if (line && !line.startsWith('#')) {
                        let fullUrl = line;
                        if (!line.startsWith('http')) {
                            const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
                            fullUrl = baseUrl + line;
                        }
                        resolutions.push({ resolution: currentRes, url: fullUrl });
                        currentRes = "Unknown";
                    }
                }
                resolve(resolutions);
            });
        });

        req.on('error', (e) => {
            resolve([]);
        });

        req.end();
    });
}

(async () => {
    let statusLog = `=== FanCode Resolution Extraction Log ===\nTime: ${new Date().toISOString()}\n\n`;
    let masterM3u8Link = "";
    let capturedCookies = [];
    const userAgentString = 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';

    const writeStatus = (message) => {
        console.log(message);
        statusLog += message + '\n';
    };

    writeStatus("Starting FanCode Link Extractor...");

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=412,915'
        ]
    });

    const page = await browser.newPage();

    await page.setUserAgent(userAgentString);
    await page.setViewport({
        width: 412,
        height: 915,
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true
    });

    // নেটওয়ার্ক রিকোয়েস্ট থেকে মাস্টার .m3u8 লিংক ক্যাপচার
    page.on('request', (request) => {
        const url = request.url();
        const lowerUrl = url.toLowerCase();
        
        if (lowerUrl.includes('.m3u8') && !masterM3u8Link) {
            masterM3u8Link = url;
            writeStatus(`[FOUND MASTER M3U8 LINK]: ${url}`);
        }
    });

    try {
        const targetUrl = 'https://www.fancode.com/bd/football/tour/efl-championship-2026-27-19769090/matches/football-4247483/live-match-info';
        writeStatus(`Navigating to: ${targetUrl}`);

        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        writeStatus("Mobile page loaded successfully.");

        await new Promise(resolve => setTimeout(resolve, 6000));

        // ভিডিও প্লেয়ার ট্রিগার করা
        writeStatus("Simulating mobile touch and video play actions...");
        await page.evaluate(() => {
            window.scrollBy(0, 300);
            const videos = document.querySelectorAll('video');
            videos.forEach(v => {
                v.muted = true;
                v.play().catch(e => {});
            });

            const clickableElements = document.querySelectorAll('button, div, span, img');
            clickableElements.forEach(el => {
                const text = el.innerText ? el.innerText.toLowerCase() : '';
                if (text.includes('play') || text.includes('watch') || text.includes('live') || el.className.includes('play')) {
                    try { el.click(); } catch (err) {}
                }
            });
        });

        writeStatus("Waiting for master stream link to trigger...");
        let waitTime = 0;
        while (!masterM3u8Link && waitTime < 40) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            waitTime++;
        }

        // ব্রাউজারের কু্যাকি সংগ্রহ করা
        capturedCookies = await page.cookies();

    } catch (error) {
        writeStatus(`[ERROR]: ${error.message}`);
    } finally {
        await browser.close();
        writeStatus("Browser closed.");

        if (masterM3u8Link) {
            writeStatus("\nParsing Master Playlist with cookies and headers...");
            const resolutionLinks = await parseMasterPlaylist(masterM3u8Link, capturedCookies, userAgentString);

            statusLog += `\n--- Master Link ---\n${masterM3u8Link}\n`;
            statusLog += `\n--- All Resolution Links (${resolutionLinks.length}) ---\n`;
            
            if (resolutionLinks.length === 0) {
                statusLog += "Could not parse resolution streams (Access Forbidden or format mismatch).\n";
            } else {
                resolutionLinks.forEach((item, index) => {
                    statusLog += `${index + 1}. [${item.resolution}]: ${item.url}\n`;
                });
            }
        } else {
            statusLog += "\nNo .m3u8 master link captured in this run.\n";
        }

        fs.writeFileSync('status.txt', statusLog, 'utf-8');
        console.log("Output successfully saved to status.txt");
    }
})();
