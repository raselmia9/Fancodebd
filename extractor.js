const puppeteer = require('puppeteer');
const fs = require('fs');

// বিভিন্ন রিয়েল মোবাইল ও ডেস্কটপ ইউজার-এজেন্টের তালিকা, যাতে প্রতিবার আলাদা ডিভাইস মনে হয়
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
];

(async () => {
    let statusLog = `=== FanCode Extraction Status Log ===\nTime: ${new Date().toISOString()}\n\n`;
    const capturedLinks = new Set();

    const writeStatus = (message) => {
        console.log(message);
        statusLog += message + '\n';
    };

    writeStatus("Starting FanCode Link Extractor with Stealth & Fresh Profile...");

    // প্রতিবার রেন্ডম ইউজার-এজেন্ট সিলেক্ট করা (নতুন ডিভাইসের রূপ দেওয়ার জন্য)
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--lang=en-US,en;q=0.9', // ভাষা ইংরেজি সেট করা
            '--disable-blink-features=AutomationControlled' // বোট ডিটেকশন হাইড করার মূল ফ্ল্যাগ
        ]
    });

    // প্রতিবার একদম নতুন ও ফ্রেশ ব্রাউজার কনটেক্সট (কুকিজ ও ক্যাশ ছাড়া, যেন নতুন ডিভাইস হয়)
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    // ইউজারের লোকেশন বাংলাদেশ (ঢাকা) হিসেবে টাইমজোন ও জিওলোকেশন সেট করা
    await page.emulateTimezone('Asia/Dhaka');
    await page.setGeolocation({ latitude: 23.8103, longitude: 90.4125 });
    
    // পারমিশন গ্র্যান্ট করা
    const client = await page.target().createCDPSession();
    await client.send('Browser.grantPermissions', {
        origin: 'https://www.fancode.com',
        permissions: ['geolocation']
    });

    await page.setUserAgent(randomUserAgent);
    await page.setViewport({ width: 1920, height: 1080 });

    // ব্রাউজারের অটোমেশন প্রপার্টি লুকানো (যাতে ফ্যানকোড বুঝতে না পারে এটি পাপেটিয়ার বট)
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.navigator.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    // নেটওয়ার্ক রিকোয়েস্ট মনিটর করা (.m3u8 খোঁজার জন্য)
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
        writeStatus(`Using User-Agent: ${randomUserAgent}`);

        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        writeStatus("Page loaded successfully. Waiting for video player elements...");

        // প্লেয়ার লোড হওয়ার জন্য কিছুটা সময় অপেক্ষা
        await new Promise(resolve => setTimeout(resolve, 8000));

        // ভিডিও প্লে করার জন্য স্ক্রিপ্ট ইনজেক্ট করা
        await page.evaluate(() => {
            const videoElement = document.querySelector('video');
            if (videoElement) {
                videoElement.play().catch(e => {});
            }
            
            const playButtons = document.querySelectorAll('button[class*="play"], div[class*="play"], .vjs-big-play-button, [data-testid="play-button"]');
            playButtons.forEach(btn => btn.click());
        });

        writeStatus("Simulated play action. Waiting for streams to trigger...");

        // লিংক ক্যাপচার হওয়ার জন্য পর্যাপ্ত সময় অপেক্ষা (যেমন: ৪৫ সেকেন্ড)
        await new Promise(resolve => setTimeout(resolve, 45000));
        writeStatus("Extraction period finished.");

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
