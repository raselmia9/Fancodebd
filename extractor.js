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

    // মোবাইল ডিভাইসের ভিউপোর্ট ও ইউজার এজেন্ট সেট করা
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36');
    await page.setViewport({ width: 412, height: 915, isMobile: true });

    // নেটওয়ার্ক রিকোয়েস্ট থেকে যেকোনো .m3u8 লিংক ফিল্টার করে ক্যাপচার করা
    page.on('request', (request) => {
        const url = request.url();
        const lowerUrl = url.toLowerCase();
        
        // এখানে শুধু .m3u8 থাকলেই সেটি ক্যাচ করবে (সব রেজুলেশন বা কোয়ালিটির লিংকসহ)
        if (lowerUrl.includes('.m3u8')) {
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
        writeStatus("Page loaded successfully.");

        // পেজের টিম নাম ভেরিফিকেশন চেক করা
        await new Promise(resolve => setTimeout(resolve, 5000));
        const matchTitle = await page.evaluate(() => {
            const titleElement = document.querySelector('h1') || document.querySelector('div[class*="match"]');
            return titleElement ? titleElement.innerText : "Match title not found";
        });
        writeStatus(`[MATCH INFO]: ${matchTitle.replace(/\n/g, ' - ')}`);

        // ভিডিও প্লে বা ট্রিগার করার জন্য কমান্ড পাঠানো
        writeStatus("Triggering video playback...");
        await page.evaluate(() => {
            const videoElements = document.querySelectorAll('video');
            videoElements.forEach(v => v.play().catch(e => {}));

            // পেজের প্লে বাটনগুলোতে ক্লিক করার চেষ্টা
            const clickables = document.querySelectorAll('button, div, span');
            clickables.forEach(el => {
                if (el.innerText && (el.innerText.toLowerCase().includes('watch') || el.innerText.toLowerCase().includes('play') || el.innerText.toLowerCase().includes('live'))) {
                    try { el.click(); } catch(err) {}
                }
            });
        });

        // ভিডিও প্লে হওয়ার পর সমস্ত লিংকের জন্য ৩০ থেকে ৪০ সেকেন্ড অপেক্ষা করা
        writeStatus("Waiting 40 seconds for all stream resolutions to capture...");
        await new Promise(resolve => setTimeout(resolve, 40000));
        writeStatus("Waiting period completed.");

    } catch (error) {
        writeStatus(`[ERROR]: ${error.message}`);
    } finally {
        await browser.close();
        writeStatus("Browser closed.");

        // স্ট্যাটাস ফাইলে শুধু ক্যাপচার হওয়া .m3u8 লিংকগুলোর পরিষ্কার তালিকা তৈরি করা
        statusLog += `\n--- All Captured M3U8 Links (${capturedLinks.size}) ---\n`;
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
