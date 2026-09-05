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
            '--window-size=1920,1080',
            '--accept-lang=en-US,en;q=0.9'
        ]
    });

    const page = await browser.newPage();

    // মোবাইল ডিভাইস বা রিয়েল ব্রাউজারের রূপ দেওয়া
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36');
    await page.setViewport({ width: 412, height: 915, isMobile: true });

    // নেটওয়ার্কের প্রতিটি রিকোয়েস্ট মনিটর করা (শুধু .m3u8 নয়, ভিডিও রিলেটেড যেকোনো লিংক বা মাস্টার ফাইল ধরতে)
    page.on('request', (request) => {
        const url = request.url();
        const lowerUrl = url.toLowerCase();
        
        // ফ্যানকোডের ভিডিও স্ট্রিম বা প্লেলিস্ট রিলেটেড লিংক ফিল্টার করা
        if (lowerUrl.includes('.m3u8') || lowerUrl.includes('manifest') || lowerUrl.includes('playlist') || lowerUrl.includes('video')) {
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
        writeStatus("Page loaded successfully.");

        // পেজ সঠিকভাবে ভিউ হয়েছে কি না তা যাচাই করার জন্য হেডিং বা টিমের নাম বের করা
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const matchTitle = await page.evaluate(() => {
            // ফ্যানকোডের ম্যাচ টাইটেল বা টিম নাম খোঁজা
            const titleElement = document.querySelector('h1') || document.querySelector('div[class*="match"]');
            return titleElement ? titleElement.innerText : "Title not found";
        });

        writeStatus(`[VERIFICATION] Page Match Title Found: ${matchTitle.replace(/\n/g, ' - ')}`);

        // ভিডিও প্লে করার বা ট্রিগার করার চেষ্টা
        writeStatus("Attempting to trigger video player...");
        await page.evaluate(() => {
            const videoElements = document.querySelectorAll('video');
            videoElements.forEach(v => v.play().catch(e => {}));

            // সব ধরনের সম্ভাব্য প্লে বাটন বা ওভারলেতে ক্লিক করা
            const clickables = document.querySelectorAll('button, div, span');
            clickables.forEach(el => {
                if (el.innerText && (el.innerText.toLowerCase().includes('watch') || el.innerText.toLowerCase().includes('play') || el.innerText.toLowerCase().includes('live'))) {
                    try { el.click(); } catch(err) {}
                }
            });
        });

        // লিংকগুলোর জন্য ৪৫ সেকেন্ড অপেক্ষা করা
        writeStatus("Waiting for video stream requests to capture...");
        await new Promise(resolve => setTimeout(resolve, 45000));
        writeStatus("Extraction process completed.");

    } catch (error) {
        writeStatus(`[ERROR]: ${error.message}`);
    } finally {
        await browser.close();
        writeStatus("Browser closed.");

        statusLog += `\n--- Summary of All Captured Links (${capturedLinks.size}) ---\n`;
        if (capturedLinks.size === 0) {
            statusLog += "No video links captured in this run. (Check if geo-block or login is required)\n";
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
