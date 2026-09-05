const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    let statusLog = `=== FanCode Resolution Extraction Log ===\nTime: ${new Date().toISOString()}\n\n`;
    const capturedLinks = new Set();

    const writeStatus = (message) => {
        console.log(message);
        statusLog += message + '\n';
    };

    writeStatus("Starting FanCode Deep Stream Extractor...");

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

    // মোবাইল ডিভাইসের রিয়েল ভিউপোর্ট ও ইউজার এজেন্ট
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36');
    await page.setViewport({
        width: 412,
        height: 915,
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true
    });

    // নেটওয়ার্কের সমস্ত m3u8 লিংক রিয়েল-টাইমে ট্র্যাক করা (মাস্টার এবং সাব-রেজুলেশন উভয়ই)
    page.on('request', (request) => {
        const url = request.url();
        const lowerUrl = url.toLowerCase();
        
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

        // প্লেয়ার পুরোপুরি ইনিশিয়ালাইজ হওয়ার জন্য ১০ সেকেন্ড অপেক্ষা
        await new Promise(resolve => setTimeout(resolve, 10000));

        writeStatus("Executing deep interaction to force video playback...");
        
        // ভিডিও প্লে করার জন্য বিভিন্ন পজিশনে ক্লিক এবং প্লে কমান্ড সিমুলেশন
        await page.evaluate(async () => {
            window.scrollBy(0, 400);
            
            // ভিডিও ট্যাগগুলো ফোর্স প্লে করা
            const videos = document.querySelectorAll('video');
            videos.forEach(v => {
                v.muted = true;
                v.play().catch(e => {});
            });

            // ফ্যানকোডের প্লে বাটন বা ভিডিও কন্টেইনারে ক্লিক সিমুলেট করা
            const potentialPlayButtons = document.querySelectorAll('button, div, span, a');
            potentialPlayButtons.forEach(el => {
                const text = el.innerText ? el.innerText.toLowerCase() : '';
                const className = el.className ? typeof el.className === 'string' ? el.className.toLowerCase() : '' : '';
                
                if (text.includes('play') || text.includes('watch') || text.includes('live') || className.includes('play') || className.includes('video')) {
                    try {
                        el.click();
                    } catch (err) {}
                }
            });
        });

        // ভিডিও প্লে শুরু হওয়ার পর রেজুলেশন ফেচ হওয়ার জন্য ৯০ সেকেন্ড সময় দেওয়া (যাতে সব সাব-লিংক চলে আসে)
        writeStatus("Waiting 90 seconds for all resolution streams and chunks to trigger...");
        
        for (let i = 1; i <= 9; i++) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            writeStatus(`Monitoring playback... (${i * 10}s elapsed, captured links: ${capturedLinks.size})`);
            
            // মাঝপথে স্ক্রিন স্ক্রোল বা টাচ করে প্লেয়ার সচল রাখা
            await page.evaluate(() => {
                window.scrollBy(0, 10);
                window.scrollBy(0, -10);
            }).catch(e => {});
        }

        writeStatus("Extraction monitoring finished.");

    } catch (error) {
        writeStatus(`[ERROR]: ${error.message}`);
    } finally {
        await browser.close();
        writeStatus("Browser closed.");

        // ক্যাচ করা সমস্ত লিংক ফাইলে সাজিয়ে লেখা
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
