const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    let statusLog = `=== FanCode Resolution Extraction Log ===\nTime: ${new Date().toISOString()}\n\n`;
    const capturedLinks = new Set();

    const writeStatus = (message) => {
        console.log(message);
        statusLog += message + '\n';
    };

    writeStatus("Starting FanCode Direct Stream Extractor...");

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

    // মোবাইল ডিভাইসের রিয়েল ভিউপোর্ট ও ইউজার এজেন্ট সেট করা
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36');
    await page.setViewport({
        width: 412,
        height: 915,
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true
    });

    // ব্রাউজারের নেটওয়ার্ক থেকে সরাসরি .m3u8 বা স্ট্রিম রিলেটেড যেকোনো লিংক রিয়েল-টাইমে ক্যাপচার করা
    page.on('request', (request) => {
        const url = request.url();
        const lowerUrl = url.toLowerCase();
        
        // ফ্যানকোডের স্ট্রিম বা প্লেলিস্ট লিংকগুলো ফিল্টার করা
        if (lowerUrl.includes('.m3u8')) {
            if (!capturedLinks.has(url)) {
                capturedLinks.add(url);
                writeStatus(`[FOUND STREAM LINK]: ${url}`);
            }
        }
    });

    try {
        const targetUrl = 'https://www.fancode.com/bd/football/tour/efl-championship-2026-27-19769090/matches/football-4247483/live-match-info';
        writeStatus(`Navigating to: ${targetUrl}`);

        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        writeStatus("Mobile page loaded successfully.");

        // পেজ ও প্লেয়ার পুরোপুরি রেডি হওয়ার জন্য ৮ সেকেন্ড অপেক্ষা
        await new Promise(resolve => setTimeout(resolve, 8000));

        // ভিডিও প্লেয়ার ট্রিগার করার জন্য স্ক্রোল এবং ক্লিক সিমুলেশন
        writeStatus("Simulating mobile touch and video play actions...");
        await page.evaluate(() => {
            window.scrollBy(0, 300);
            
            // ভিডিও এলিমেন্ট প্লে করার চেষ্টা
            const videos = document.querySelectorAll('video');
            videos.forEach(v => {
                v.muted = true;
                v.play().catch(e => {});
            });

            // সম্ভাব্য প্লে বাটন বা লাইভ স্ট্রিম ওভারলেতে ক্লিক করা
            const clickableElements = document.querySelectorAll('button, div, span, img');
            clickableElements.forEach(el => {
                const text = el.innerText ? el.innerText.toLowerCase() : '';
                if (text.includes('play') || text.includes('watch') || text.includes('live') || el.className.includes('play')) {
                    try { el.click(); } catch (err) {}
                }
            });
        });

        // ব্রাউজারে ভিডিও স্ট্রিম এবং সাব-লিংকগুলো জেনারেট হওয়ার জন্য পর্যাপ্ত সময় (৫০ সেকেন্ড) অপেক্ষা
        writeStatus("Waiting 50 seconds for all resolution streams to trigger...");
        await new Promise(resolve => setTimeout(resolve, 50000));
        writeStatus("Extraction monitoring finished.");

    } catch (error) {
        writeStatus(`[ERROR]: ${error.message}`);
    } finally {
        await browser.close();
        writeStatus("Browser closed.");

        // ক্যাচ করা সমস্ত লিংক সরাসরি স্ট্যাটাস ফাইলে সাজিয়ে লেখা
        statusLog += `\n--- All Captured Stream Links (${capturedLinks.size}) ---\n`;
        if (capturedLinks.size === 0) {
            statusLog += "No stream links captured in this run.\n";
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
