import asyncio
import os
from playwright.async_api import async_playwright

async def scrape_fancode_metadata():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
        )
        
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1366, "height": 768}
        )
        
        page = await context.new_page()
        print("[*] Navigating to FanCode...")
        
        try:
            # ফ্যানকোডের হোমপেজ ভিজিট করা
            await page.goto("https://www.fancode.com/bd", timeout=60000, wait_until="networkidle")
            print("[*] Waiting for page content to render...")
            await asyncio.sleep(8) # রেন্ডার হওয়ার জন্য পর্যাপ্ত সময়
            
            # পেজ একটু স্ক্রোল করা যাতে সব সেকশন লোড হয়
            await page.evaluate("window.scrollTo(0, 800)")
            await asyncio.sleep(4)
            
            # সব ধরনের লিংকিং এলিমেন্ট বা কার্ড খোঁজা
            all_links = await page.locator("a").all()
            print(f"[*] Total <a> tags found on page: {len(all_links)}")
            
            m3u_content = "#EXTM3U\n"
            saved_count = 0
            seen_titles = set()
            
            for link in all_links:
                try:
                    href = await link.get_attribute("href")
                    if not href:
                        continue
                    
                    # ম্যাচ বা ইভেন্ট সম্পর্কিত লিংকগুলো ফিল্টার করা
                    if "/match/" in href or "/live-events/" in href:
                        card_text = await link.inner_text()
                        if not card_text:
                            continue
                        
                        # যদি কার্ডের ভেতর LIVE লেখা থাকে
                        if "LIVE" in card_text.upper():
                            lines = [line.strip() for line in card_text.split("\n") if line.strip()]
                            match_title = " vs ".join(lines[:2]) if len(lines) >= 2 else "Live Match"
                            
                            if match_title in seen_titles:
                                continue
                            seen_titles.add(match_title)
                            
                            # লোগো সংগ্রহ
                            img_element = link.locator("img").first
                            logo_url = ""
                            if await img_element.count() > 0:
                                logo_url = await img_element.get_attribute("src") or ""
                                
                            group_title = lines[0] if len(lines) > 2 else "FanCode Live"
                            
                            # M3U ফরম্যাটে যোগ করা (লিংকের জায়গায় সাময়িকভাবে কমেন্ট রাখা হয়েছে)
                            m3u_content += f'#EXTINF:-1 tvg-logo="{logo_url}" group-title="{group_title}", {match_title}\n'
                            m3u_content += f'# -------------------------------------------------\n'
                            
                            saved_count += 1
                            print(f"[+] Found Match: {match_title} | Group: {group_title}")
                            
                except Exception as ex:
                    continue
            
            # সরাসরি মূল ডিরেক্টরিতে 'playlist.m3u' ফাইল সেভ করা
            file_name = "playlist.m3u"
            with open(file_name, "w", encoding="utf-8") as f:
                f.write(m3u_content)
                
            print(f"[+] Successfully saved {saved_count} matches to '{file_name}' in root directory.")
            
        except Exception as e:
            print(f"[!] Scraper Error: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(scrape_fancode_metadata())
