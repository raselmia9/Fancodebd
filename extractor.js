const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    let statusLog = `=== FanCode Extraction Status Log ===\nTime: ${new Date().toISOString()}\n\n`;
    const capturedLinks = new Set();

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
            '--window-size=1920,1080'
        ]
    });

    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('request', (request) => {
        const url = request.url();
        if (url.includes('.m3u8')) {
            if (!capturedLinks.has(url)) {
                capturedLinks.add(url);
                writeStatus(`[FOUND M3U8 LINK]: ${url}`);
            }
        }
    });

    try {
        const targetUrl = 'https://www.fancode.com/bd/football/tour/efl-championship-2026-27-19769090/matches/football-4247483/live-match-info';
        writeStatus(`Navigating to: ${targetUrl}`);

        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        writeStatus("Page loaded. Looking for video play button...");

        // অতিরিক্ত সময় অপেক্ষা করা যাতে পেজ ও প্লেয়ার পুরোপুরি রেডি হয়
        await new Promise(resolve => setTimeout(resolve, 5000));

        // ভিডিও প্লে করার জন্য স্ক্রিপ্ট (ফ্যানকোডের প্লে বা ভিডিও এলিমেন্ট ট্রিগার করা)
        await page.evaluate(() => {
            // ভিডিও এলিমেন্ট বা প্লে বোতামে ক্লিক করার চেষ্টা
            const videoElement = document.querySelector('video');
            if (videoElement) {
                videoElement.play().catch(e => console.log(e));
            }
            
            // কমন প্লে বাটনগুলো খুঁজে ক্লিক করা
            const playButtons = document.querySelectorAll('button[class*="play"], div[class*="play"], .vjs-big-play-button');
            playButtons.forEach(btn => btn.click());
        });

        writeStatus("Play command executed. Waiting for video streams to trigger...");

        // লিংক জেনারেট হওয়ার জন্য এবার পর্যাপ্ত সময় অপেক্ষা (যেমন: ৪০ সেকেন্ড)
        await new Promise(resolve => setTimeout(resolve, 40000));
        writeStatus("Extraction waiting period completed successfully.");

    } catch (error) {
        writeStatus(`[ERROR]: ${error.message}`);
    } finally {
        await browser.close();
        writeStatus("Browser closed.");

        statusLog += `\n--- Summary of All Captured Links (${capturedLinks.size}) ---\n`;
        if (capturedLinks.size === 0) {
            statusLog += "No .m3u8 links captured in this run.\n";
        } else {
            let index = 1;
            capturedLinks.forEach(link => {
                statusLog += `${index++}. ${link}\n`;
            });
        }

        fs.writeFileSync('status.txt', statusLog, 'utf-8');
        console.log("Output successfully saved to status.txt");
    }
})();
