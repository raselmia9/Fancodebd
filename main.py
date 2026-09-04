import asyncio
import os
from playwright.async_api import async_playwright

async def process_match(context, match_url, match_title, group_title):
    """প্রতিটি লাইভ ম্যাচের জন্য আলাদা ট্যাব ওপেন করে m3u8 লিংক ইন্টারসেপ্ট করবে"""
    page = await context.new_page()
        m3u8_link = None
        
        # নেটওয়ার্ক ইন্টারসেপশন শুরু
        async def handle_request(route):
            nonlocal m3u8_link
            url = route.request.url
            if ".m3u8" in url and not m3u8_link:
                m3u8_link = url
            await route.continue_()

        await page.route("**/*", handle_request)
        
        try:
            print(f"[*] Opening match: {match_title}")
            await page.goto(match_url, timeout=45000, wait_until="domcontentloaded")
            
            # লিংক পাওয়ার জন্য সর্বোচ্চ ১০ সেকেন্ড অপেক্ষা করা
            for _ in range(10):
                if m3u8_link:
                    break
                await asyncio.sleep(1)
                
        except Exception as e:
            print(f"[!] Error opening {match_url}: {e}")
        finally:
            await page.close()
            
        return {
            "title": match_title,
            "group": group_title,
            "link": m3u8_link
        }

async def scrape_fancode():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
        )
        
        # ইউনিক ইউজার এজেন্ট ও ফিপ্রিন্ট দিয়ে কনটেক্সট তৈরি
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1366, "height": 768}
        )
        
        page = await context.new_page()
        print("[*] Navigating to FanCode...")
        
        try:
            await page.goto("https://www.fancode.com/bd", timeout=60000, wait_until="domcontentloaded")
            await asyncio.sleep(5) # পেজ ও লাইভ কার্ড রেন্ডার হওয়ার জন্য অপেক্ষা
            
            # স্ক্রিনশট অনুযায়ী লাইভ কার্ডগুলোর কন্টেইনার বা লিংক খুঁজে বের করা
            # ফ্যানকোডের কার্ডগুলোতে সাধারণত লাইভ ইভেন্টের লিংক থাকে
            matches = []
            
            # পেজ থেকে লাইভ কার্ডের তথ্য ও ইউআরএল সংগ্রহ করার লজিক
            match_elements = await page.locator("a[href*='/match/'], a[href*='/live-events/']").all()
            
            seen_urls = set()
            for el in match_elements:
                href = await el.get_attribute("href")
                if href and href not in seen_urls:
                    # যদি লিংকের পূর্ণাঙ্গ ইউআরএল না থাকে, তবে ডোমেন যুক্ত করতে হবে
                    full_url = href if href.startswith("http") else f"https://www.fancode.com{href}"
                    
                    # কার্ডের ভেতরে 'LIVE' লেখা আছে কি না তা যাচাই করার জন্য টেক্সট চেক
                    card_text = await el.inner_text()
                    if "LIVE" in card_text.upper():
                        seen_urls.add(href)
                        title = card_text.replace("\n", " - ")[:50] # সংক্ষেপে টাইটেল নেওয়া
                        matches.append({
                            "url": full_url,
                            "title": title,
                            "group": "FanCode Live"
                        })
            
            print(f"[+] Found {len(matches)} live matches.")
            
            # মাল্টি-প্যারালাল ট্যাব (Multi-parallel tabs) ব্যবহার করে একসাথে লিংক বের করা
            tasks = [process_match(context, m["url"], m["title"], m["group"]) for m in matches[:6]] # সর্বোচ্চ ৬টি একসাথে
            results = await asyncio.gather(*tasks)
            
            # M3U ফাইল জেনারেট করা
            m3u_content = "#EXTM3U\n"
            success_count = 0
            
            for res in results:
                if res["link"]:
                    success_count += 1
                    m3u_content += f'#EXTINF:-1 tvg-logo="" group-title="{res["group"]}", {res["title"]}\n'
                    m3u_content += f'{res["link"]}\n'
            
            with open("playlist.m3u", "w", encoding="utf-8") as f:
                f.write(m3u_content)
                
            print(f"[+] Playlist generated successfully with {success_count} live streams in 'playlist.m3u'")
            
        except Exception as e:
            print(f"[!] Scraper Error: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(scrape_fancode())
