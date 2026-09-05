const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    let statusLog = `=== FanCode Extraction Status Log ===\nTime: ${new Date().toISOString()}\n\n`;
    const capturedLinks = new Set();

    const writeStatus = (message) => {
        console.log(message);
        statusLog += message + '\n';
    };

    writeStatus("Starting FanCode Link Extractor with Full Mobile Simulation...");

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

    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    // পারফেক্ট মোবাইল ভিউ এবং টাচ সাপোর্ট সেট করা
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36');
    await page.setViewport({
        width: 412,
        height: 915,
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true
    });

    // নেটওয়ার্ক রিকোয়েস্ট থেকে যেকোনো .m3u8 লিংক বা স্ট্রিম রিলেটেড রিকোয়েস্ট ধরা
    page.on('request', (request) => {
        const url = request.url();
        const lowerUrl = url.toLowerCase();
        
        // .m3u8 এক্সটেনশনযুক্ত যেকোনো লিংক (মাস্টার বা রেজুলেশনভিত্তিক) ক্যাপচার করা
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
        writeStatus("Mobile page loaded successfully.");

        // পেজ রেন্ডার হওয়ার জন্য সময় দেওয়া
        await new Promise(resolve => setTimeout(resolve, 6000));

        // মোবাইল ভিউতে স্ক্রিন স্ক্রোল করা এবং ভিডিও প্লেয়ার ট্রিগার করা
        writeStatus("Simulating mobile touch and video play actions...");
        await page.evaluate(() => {
            // পে একটু নিচে স্ক্রোল করা যাতে প্লেয়ার ফোকাসে আসে
            window.scrollBy(0, 300);

            // ভিডিও এলিমেন্ট প্লে করা
            const videos = document.querySelectorAll('video');
            videos.forEach(v => {
                v.muted = true;
                v.play().catch(e => {});
            });

            // ফ্যানকোডের মোবাইল ইন্টারফেসে প্লে বাটন বা ভিডিও কন্টেইনারে ক্লিক সিমুলেট করা
            const clickableElements = document.querySelectorAll('button, div, span, img');
            clickableElements.forEach(el => {
                const text = el.innerText ? el.innerText.toLowerCase() : '';
                if (text.includes('play') || text.includes('watch') || text.includes('live') || el.className.includes('play')) {
                    try {
                        el.click();
                    } catch (err) {}
                }
            });
        });

        // সমস্ত রেজুলেশন ও সাব-স্ট্রিম লোড হওয়ার জন্য পর্যাপ্ত সময় (৫০ সেকেন্ড) অপেক্ষা
        writeStatus("Waiting 50 seconds to capture all resolution streams...");
        await new Promise(resolve => setTimeout(resolve, 50000));
        writeStatus("Extraction monitoring finished.");

    } catch (error) {
        writeStatus(`[ERROR]: ${error.message}`);
    } finally {
        await browser.close();
        writeStatus("Browser closed.");

        statusLog += `\n--- All Captured M3U8 Links (${capturedLinks.size}) ---\n`;
        if (capturedLinks.size === 0) {
            statusLog += "No .m3u8 links captured.\n";
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
