import asyncio
import os
from playwright.async_api import async_playwright

async def scrape_fancode_metadata():
    # 'All Live Match' ফোল্ডার তৈরি করা
    output_folder = "All Live Match"
    os.makedirs(output_folder, exist_ok=True)

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
            await asyncio.sleep(6) # কার্ডগুলো রেন্ডার হওয়ার জন্য অপেক্ষা
            
            # পেজ একটু স্ক্রোল করা যাতে ডাইনামিক সেকশনগুলো লোড হয়
            await page.evaluate("window.scrollTo(0, 600)")
            await asyncio.sleep(3)
            
            # লাইভ ম্যাচের কার্ড বা কন্টেইনারগুলো খুঁজে বের করা
            # ফ্যানকোডের কার্ডগুলোতে সাধারণত ম্যাচ লিংক এবং ইমেজ ট্যাগ থাকে
            match_cards = await page.locator("a[href*='/match/']").all()
            print(f"[*] Found {len(match_cards)} match links on the page.")
            
            m3u_content = "#EXTM3U\n"
            saved_count = 0
            seen_titles = set()
            
            for card in match_cards:
                try:
                    # ১. কার্ডের ভেতরের টেক্সট বা টাইটেল সংগ্রহ
                    card_text = await card.inner_text()
                    if not card_text:
                        continue
                        
                    # শুধু লাইভ ম্যাচগুলো ফিল্টার করা
                    if "LIVE" in card_text.upper():
                        lines = [line.strip() for line in card_text.split("\n") if line.strip()]
                        
                        # টাইটেল তৈরি (যেমন: Team A vs Team B)
                        match_title = " vs ".join(lines[:2]) if len(lines) >= 2 else "Live Match"
                        if match_title in seen_titles:
                            continue
                        seen_titles.add(match_title)
                        
                        # ২. লোগো বা ইমেজ ইউআরএল সংগ্রহ (কার্ডের ভেতরের img ট্যাগ থেকে)
                        img_element = card.locator("img").first
                        logo_url = ""
                        if await img_element.count() > 0:
                            logo_url = await img_element.get_attribute("src") or ""
                            
                        # ৩. গ্রুপ টাইটেল (টুর্নামেন্ট বা প্রতিযোগিতার নাম)
                        group_title = "FanCode Live"
                        if len(lines) > 2:
                            group_title = lines[0] # সাধারণত প্রথম লাইনটি টুর্নামেন্টের নাম হয়
                            
                        # ফাইলের নামের জন্য নিরাপদ স্ট্রিং তৈরি
                        safe_title = "".join(c for c in match_title if c.isalnum() or c in (' ', '-', '_')).strip()[:40]
                        if not safe_title:
                            safe_title = f"match_{saved_count + 1}"
                            
                        # M3U ফরম্যাটে ডেটা যোগ করা (#EXTINF ফরম্যাট)
                        m3u_content += f'#EXTINF:-1 tvg-logo="{logo_url}" group-title="{group_title}", {match_title}\n'
                        m3u_content += f'# -------------------------------------------------\n' # সাময়িকভাবে লিংক এর বদলে কমেন্ট রাখা হয়েছে
                        
                        saved_count += 1
                        print(f"[+] Extracted: {match_title} | Group: {group_title}")
                        
                except Exception as ex:
                    print(f"[!] Error parsing a card: {ex}")
                    continue
            
            # সম্পূর্ণ প্লেলিস্ট ফাইলটি 'All Live Match' ফোল্ডারে সেভ করা
            file_path = os.path.join(output_folder, "live_matches.m3u")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(m3u_content)
                
            print(f"[+] Successfully saved {saved_count} matches metadata inside '{output_folder}/live_matches.m3u'")
            
        except Exception as e:
            print(f"[!] Scraper Error: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(scrape_fancode_metadata())
