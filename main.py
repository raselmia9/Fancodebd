import asyncio
import json
import random
from playwright.async_api import async_playwright

# ইউনিক সেশন বা ফিঙ্গারপ্রিন্ট তৈরির জন্য ইউজার এজেন্টের তালিকা
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
]

async def scrape_fancode_live():
    # র‍্যান্ডম ইউজার এজেন্ট এবং স্ক্রিন রেজোলিউশন নির্বাচন
    selected_ua = random.choice(USER_AGENTS)
    viewport_width = random.choice([1366, 1440, 1536])
    viewport_height = random.choice([768, 900, 864])

    async with async_playwright() as p:
        # গিটহাব অ্যাকশনস-এর জন্য headless=True রাখা বাধ্যতামূলক
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
        )
        
        # নতুন ব্রাউজার কন্টেক্সট তৈরি যেখানে ইউনিক ডিভাইস আইডি বা ফিঙ্গারপ্রিন্ট সেট হবে
        context = await browser.new_context(
            user_agent=selected_ua,
            viewport={"width": viewport_width, "height": viewport_height}
        )
        
        page = await context.new_page()
        print(f"[*] Opening FanCode with User-Agent: {selected_ua[:35]}...")
        
        try:
            # ফ্যানকোড বাংলাদেশ পেজে যাওয়া
            await page.goto("https://www.fancode.com/bd", timeout=60000, wait_until="domcontentloaded")
            
            # "All Live Now" সেকশন লোড হওয়ার জন্য অপেক্ষা করা
            await page.wait_for_selector("text=All Live Now", timeout=20000)
            
            # পেজ একটু স্ক্রোল করা যাতে সব লাইভ এলিমেন্ট রেন্ডার হয়
            await page.evaluate("window.scrollBy(0, 500)")
            await asyncio.sleep(3)

            # লাইভ ম্যাচের তথ্য (টাইটেল, লিংক, লোগো) এক্সট্রাক্ট করা
            matches = await page.evaluate('''() => {
                let liveMatches = [];
                let cards = document.querySelectorAll('a[href*="/match/"]');
                
                cards.forEach(card => {
                    let title = card.innerText || card.getAttribute('aria-label') || "Live Match";
                    let link = card.href;
                    let img = card.querySelector('img');
                    let logo = img ? (img.src || img.getAttribute('data-src')) : "No Logo";
                    
                    if (link && !liveMatches.some(item => item.link === link)) {
                        liveMatches.push({
                            title: title.trim().replace(/\\n/g, ' - '),
                            link: link,
                            logo: logo
                        });
                    }
                });
                return liveMatches;
            ''')
            
            await browser.close()
            
            print(f"\n[+] Total Live Matches Found: {len(matches)}")
            for idx, m in enumerate(matches, 1):
                print(f"{idx}. Title: {m['title']}")
                print(f"   Link: {m['link']}")
                print(f"   Logo: {m['logo']}\n")
                
            # চাইলে JSON ফাইলে আউটপুট সেভ করে রাখতে পারেন
            with open("live_matches.json", "w", encoding="utf-8") as f:
                json.dump(matches, f, indent=4, ensure_ascii=False)
                
        except Exception as e:
            print(f"[!] Error occurred: {e}")
            await browser.close()

if __name__ == "__main__":
    asyncio.run(scrape_fancode_live())
