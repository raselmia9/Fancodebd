const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    let statusLog = `=== FanCode Resolution Extraction Log ===\nTime: ${new Date().toISOString()}\n\n`;
    const capturedLinks = new Set();

    const writeStatus = (message) => {
        console.log(message);
        statusLog += message + '\n';
    };

    writeStatus("Starting FanCode Player Visibility Extractor...");

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

    // নেটওয়ার্কের সমস্ত .m3u8 লিংক রিয়েল-টাইমে ট্র্যাক করা
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

        // ১. প্লেয়ার বা ভিডিও সেকশনটি DOM-এ পুরোপুরি দৃশ্যমান (Visible) হওয়া পর্যন্ত ডায়নামিক্যালি অপেক্ষা করা (সর্বোচ্চ ২৫ সেকেন্ড)
        writeStatus("Waiting for the top video player element to become visible...");
        let playerReady = false;
        for (let attempt = 1; attempt <= 25; attempt++) {
            playerReady = await page.evaluate(() => {
                // ফ্যানকোডের প্লেয়ার উইন্ডো বা ভিডিও কন্টেইনার খুঁজে দেখা
                const playerContainer = document.querySelector('video') || document.querySelector('[class*="player"]') || document.querySelector('[class*="video"]');
                if (playerContainer) {
                    const rect = playerContainer.getBoundingClientRect();
                    // চেক করা যে প্লেয়ারটি স্ক্রিনের উপরের দিকে দৃশ্যমান আছে কি না
                    return rect.width > 0 && rect.height > 0;
                }
                return false;
            });

            if (playerReady) {
                writeStatus(`Video player detected and visible on attempt ${attempt}!`);
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // প্লেয়ার লোড হওয়ার পর আরও কিছুটা স্থায়িত্বের জন্য ৩ সেকেন্ড অপেক্ষা
        await new Promise(resolve => setTimeout(resolve, 3000));

        // ২. এবার ওভারলে বা প্লে বাটনে ক্লিক করা (যাতে ভিডিও প্লে শুরু হয়)
        writeStatus("Interacting with the video player elements...");
        await page.evaluate(() => {
            // "Continue Watching" বা যেকোনো প্লে বাটন টেক্সট দিয়ে খুঁজে ক্লিক করা
            const elements = document.querySelectorAll('button, div, span, a');
            for (let el of elements) {
                const text = el.innerText ? el.innerText.trim().toLowerCase() : '';
                if (text.includes('continue watching') || text.includes('continue') || text.includes('watch') || text.includes('play')) {
                    el.click();
                }
            }

            // ভিডিও ট্যাগগুলোকেও সরাসরি প্লে কমান্ড দেওয়া
            const videos = document.querySelectorAll('video');
            videos.forEach(v => {
                v.muted = true;
                v.play().catch(e => {});
            });
        });

        // ৩. ভিডিও প্লে হওয়ার পর সমস্ত রেজুলেশন ও স্ট্রিম চংক আসার জন্য ৯০ সেকেন্ড সময় দিয়ে মনিটর করা
        writeStatus("Waiting 90 seconds for all resolution streams to trigger...");
        for (let i = 1; i <= 9; i++) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            writeStatus(`Monitoring playback... (${i * 10}s elapsed, captured links: ${capturedLinks.size})`);
        }

        writeStatus("Extraction monitoring finished.");

    } catch (error) {
        writeStatus(`[ERROR]: ${error.message}`);
    } finally {
        await browser.close();
        writeStatus("Browser closed.");

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
