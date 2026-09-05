const puppeteer = require('puppeteer');
const fs = require('fs');
const https = require('https');
const http = require('http');

// মাস্টার m3u8 লিংক থেকে ফেচ করে রেজুলেশন আলাদা করার ফাংশন
async function parseMasterPlaylist(masterUrl) {
    return new Promise((resolve) => {
        const client = masterUrl.startsWith('https') ? https : http;
        client.get(masterUrl, (res) => {
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
                            currentRes = match[1];
                        }
                    } else if (line && !line.startsWith('#')) {
                        // যদি লিংকটি রিলেটিভ পাথ হয়, তবে বেস ইউআরএল দিয়ে ফুল লিংক বানাতে হবে
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
        }).on('error', () => {
            resolve([]);
        });
    });
}

(async () => {
    let statusLog = `=== FanCode Resolution Extraction Log ===\nTime: ${new Date().toISOString()}\n\n`;
    let masterM3u8Link = "";

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

    // মোবাইল ডিভাইসের ভিউপোর্ট ও ইউজার এজেন্ট সেট করা
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36');
    await page.setViewport({
        width: 412,
        height: 915,
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true
    });

    // নেটওয়ার্ক রিকোয়েস্ট থেকে মাস্টার .m3u8 লিংক ক্যাপচার করা
    page.on('request', (request) => {
        const url = request.url();
        const lowerUrl = url.toLowerCase();
        
        // মাস্টার বা প্লেলিস্ট জাতীয় m3u8 লিংকগুলো টার্গেট করা
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

        // ভিডিও প্লেয়ার ট্রিগার করার জন্য স্ক্রোল এবং ক্লিক সিমুলেশন
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

        // মাস্টার লিংক আসার জন্য কিছু সময় অপেক্ষা
        writeStatus("Waiting for master stream link to trigger...");
        let waitTime = 0;
        while (!masterM3u8Link && waitTime < 40) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            waitTime++;
        }

    } catch (error) {
        writeStatus(`[ERROR]: ${error.message}`);
    } finally {
        await browser.close();
        writeStatus("Browser closed.");

        if (masterM3u8Link) {
            writeStatus("\nParsing Master Playlist for resolutions...");
            const resolutionLinks = await parseMasterPlaylist(masterM3u8Link);

            statusLog += `\n--- Master Link ---\n${masterM3u8Link}\n`;
            statusLog += `\n--- All Resolution Links (${resolutionLinks.length}) ---\n`;
            
            if (resolutionLinks.length === 0) {
                statusLog += "Could not parse resolution streams from master link.\n";
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
