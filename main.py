import asyncio
import os
from playwright.async_api import async_playwright

async def process_match(context, match_url, match_title, group_title):
    page = await context.new_page()
    m3u8_link = None
    
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
            await page.goto("https://www.fancode.com/bd", timeout=60000, wait_until="domcontentloaded")
            await asyncio.sleep(5)
            
            matches = []
            match_elements = await page.locator("a[href*='/match/'], a[href*='/live-events/']").all()
            
            seen_urls = set()
            for el in match_elements:
                href = await el.get_attribute("href")
                if href and href not in seen_urls:
                    full_url = href if href.startswith("http") else f"https://www.fancode.com{href}"
                    card_text = await el.inner_text()
                    
                    if "LIVE" in card_text.upper():
                        seen_urls.add(href)
                        # ফাইলের নামের জন্য নিরাপদ টাইটেল তৈরি করা
                        raw_title = card_text.replace("\n", " ").strip()
                        safe_title = "".join(c for c in raw_title if c.isalnum() or c in (' ', '-', '_')).strip()[:40]
                        if not safe_title:
                            safe_title = "live_match"
                            
                        matches.append({
                            "url": full_url,
                            "title": raw_title[:50],
                            "safe_title": safe_title,
                            "group": "FanCode Live"
                        })
            
            print(f"[+] Found {len(matches)} live matches.")
            
            tasks = [process_match(context, m["url"], m["title"], m["group"]) for m in matches[:6]]
            results = await asyncio.gather(*tasks)
            
            success_count = 0
            for i, res in enumerate(results):
                if res["link"]:
                    success_count += 1
                    safe_name = matches[i]["safe_title"]
                    file_path = os.path.join(output_folder, f"{safe_name}.m3u")
                    
                    # প্রতিটি ম্যাচের জন্য தனி আলাদা .m3u ফাইল তৈরি
                    m3u_content = f"#EXTM3U\n"
                    m3u_content += f'#EXTINF:-1 tvg-logo="" group-title="{res["group"]}", {res["title"]}\n'
                    m3u_content += f'{res["link"]}\n'
                    
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(m3u_content)
                        
            print(f"[+] Successfully generated {success_count} M3U files inside '{output_folder}' folder.")
            
        except Exception as e:
            print(f"[!] Scraper Error: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(scrape_fancode())
