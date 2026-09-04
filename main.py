import asyncio
import random
from playwright.async_api import async_playwright

# ইউনিক সেশন তৈরির জন্য ইউজার এজেন্ট
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
]

async def scrape_fancode_to_m3u():
    selected_ua = random.choice(USER_AGENTS)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
        )
        
        context = await browser.new_context(
            user_agent=selected_ua,
            viewport={"width": 1366, "height": 768}
        )
        
        page = await context.new_page()
        print(f"[*] Opening FanCode...")
        
        try:
            # ফ্যানকোড পেজে প্রবেশ
            await page.goto("https://www.fancode.com/bd", timeout=60000, wait_until="domcontentloaded")
            
            # পেজ পুরোপুরি লোড হওয়ার জন্য অপেক্ষা এবং স্ক্রোলিং
            await asyncio.sleep(5)
            await page.evaluate("window.scrollBy(0, 600)")
            await asyncio.sleep(3)

            # ম্যাচ ডেটা স্ক্র্যাপ করার লজিক
            matches = await page.evaluate('''() => {
                let liveMatches = [];
                // ফ্যানকোডের লাইভ কার্ডগুলোর ট্যাগ ও কন্টেইনার খুঁজে বের করা
                let cards = document.querySelectorAll('a[href*="/match/"]');
                
                cards.forEach(card => {
                    let title = card.innerText || card.getAttribute('aria-label') || "Live Match";
                    let link = card.href;
                    let img = card.querySelector('img');
                    let logo = img ? (img.src || img.getAttribute('data-src')) : "";
                    
                    // স্পোর্টসের নাম বা ক্যাটাগরি বের করার চেষ্টা (গ্রুপ টাইটেল হিসেবে ব্যবহারের জন্য)
                    let parent = card.closest('section') || card.parentElement;
                    let sportType = "Live Sports";
                    if (parent) {
                        let heading = parent.querySelector('h2, h3, span');
                        if (heading) sportType = heading.innerText.trim();
                    }
                    
                    if (link && !liveMatches.some(item => item.link === link)) {
                        liveMatches.push({
                            title: title.trim().replace(/\\n/g, ' - '),
                            link: link,
                            logo: logo,
                            group: sportType.replace(/\\n/g, ' ')
                        });
                    }
                });
                return liveMatches;
            ''')
            
            await browser.close()
            
            print(f"\n[+] Total Live Matches Found: {len(matches)}")

            # .m3u ফাইল জেনারেট করা
            m3u_content = "#EXTM3U\n"
            
            if matches:
                for match in matches:
                    tvg_logo = match['logo']
                    group_title = match['group']
                    match_title = match['title']
                    stream_link = match['link']
                    
                    # M3U এক্সটেনশন ফরম্যাট অনুযায়ী লাইন তৈরি
                    m3u_content += f'#EXTINF:-1 tvg-logo="{tvg_logo}" group-title="{group_title}",{match_title}\n'
                    m3u_content += f'{stream_link}\n'
                
                # ফাইল সেভ করা
                with open("fancode_live.m3u", "w", encoding="utf-8") as f:
                    f.write(m3u_content)
                print("[*] Successfully generated 'fancode_live.m3u' file!")
            else:
                print("[!] No matches found to write in M3U file. Please check selectors.")

        except Exception as e:
            print(f"[!] Error occurred: {e}")
            await browser.close()

if __name__ == "__main__":
    asyncio.run(scrape_fancode_to_m3u())
