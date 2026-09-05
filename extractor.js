const puppeteer = require('puppeteer');
const fs = require('fs');

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

    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36');
    await page.setViewport({
        width: 412,
        height: 915,
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true
    });

    page.on('request', (request) => {
        const url = request.url();
        const lowerUrl = url.toLowerCase();
        
        if (lowerUrl.includes('.m3u8') && !masterM3u8Link) {
            masterM3u8Link = url;
            writeStatus(`[FOUND MASTER M3U8 LINK]: ${url}`);
        }
    });

    let resolutionLinks = [];

    try {
        const targetUrl = 'https://www.fancode.com/bd/football/tour/efl-championship-2026-27-19769090/matches/football-4247483/live-match-info';
        writeStatus(`Navigating to: ${targetUrl}`);

        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        writeStatus("Mobile page loaded successfully.");

        await new Promise(resolve => setTimeout(resolve, 6000));

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

        // যদি মাস্টার লিংক পাওয়া যায়, তবে ব্রাউজারের ভেতর থেকেই ফেচ করে রেজুলেশন পার্স করা
        if (masterM3u8Link) {
            writeStatus("Parsing Master Playlist using browser fetch...");
            
            resolutionLinks = await page.evaluate(async (masterUrl) => {
                try {
                    const response = await fetch(masterUrl);
                    const data = await response.text();
                    
                    let results = [];
                    const lines = data.split('\n');
                    let currentRes = "Unknown";

                    const queryIndex = masterUrl.indexOf('?');
                    const queryString = queryIndex !== -1 ? masterUrl.substring(queryIndex) : '';
                    const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);

                    for (let i = 0; i < lines.length; i++) {
                        let line = lines[i].trim();
                        if (line.includes('RESOLUTION=')) {
                            const match = line.match(/RESOLUTION=(\d+x\d+)/);
                            if (match) {
                                const dims = match[1].split('x');
                                currentRes = dims[1] ? dims[1] + 'p' : match[1];
                            }
                        } else if (line && !line.startsWith('#')) {
                            let fullUrl = line;
                            if (!line.startsWith('http')) {
                                fullUrl = baseUrl + line;
                            }
                            if (!fullUrl.includes('?id=') && queryString) {
                                fullUrl += queryString;
                            }
                            results.push({ resolution: currentRes, url: fullUrl });
                            currentRes = "Unknown";
                        }
                    }
                    return results;
                } catch (err) {
                    return [];
                }
            }, masterM3u8Link);
        }

    } catch (error) {
        writeStatus(`[ERROR]: ${error.message}`);
    } finally {
        await browser.close();
        writeStatus("Browser closed.");

        if (masterM3u8Link) {
            statusLog += `\n--- Master Link ---\n${masterM3u8Link}\n`;
            statusLog += `\n--- All Resolution Links (${resolutionLinks.length}) ---\n`;
            
            if (resolutionLinks.length === 0) {
                statusLog += "Could not parse resolution streams from master playlist.\n";
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
