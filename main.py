import asyncio
import os
from playwright.async_api import async_playwright
from datetime import datetime

def write_status(message, is_error=False):
    status_type = "ERROR" if is_error else "SUCCESS"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_text = f"[{timestamp}] [{status_type}] {message}\n"
    
    with open("status.txt", "w", encoding="utf-8") as f:
        f.write(log_text)
    print(log_text)

async def generate_playlist():
    url = "https://www.fancode.com/bd/live-now/all-sports"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
        )
        
        # ফ্যানকোডের জন্য পুরোপুরি বাংলাদেশি পরিচয়ে ব্রাউজার কনটেক্সট তৈরি
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1366, "height": 768},
            locale="en-BD",                  # বাংলাদেশ রিজিয়ন লোকাল
            timezone_id="Asia/Dhaka",        # ঢাকার টাইমজোন
            geolocation={"latitude": 23.8103, "longitude": 90.4125}, # ঢাকার ল্যাটিটিউড ও লংগিটিউড
            permissions=["geolocation"],     # লোকেশন পারমিশন এলাও করা
            extra_http_headers={
                "Accept-Language": "en-BD,en;q=0.9,bn;q=0.8"
            }
        )
        
        page = await context.new_page()
        
        try:
            print(f"[*] Navigating to Bangladeshi Live Page: {url}")
            await page.goto(url, timeout=60000, wait_until="networkidle")
            await asyncio.sleep(6) # পেজ পুরোপুরি লোড হওয়ার জন্য অপেক্ষা
            
            # পেজ স্ক্রোল করা যাতে ডাইনামিক কন্টেন্টগুলো সামনে চলে আসে
            await page.evaluate("window.scrollTo(0, 500)")
            await asyncio.sleep(3)
            
            # পেজ থেকে সব হাইপারলিংক সংগ্রহ করা
            links = await page.locator("a").all()
            
            m3u_content = "#EXTM3U\n"
            saved_count = 0
            seen_urls = set()
            
            for link in links:
                try:
                    href = await link.get_attribute("href")
                    if not href:
                        continue
                        
                    if "/match/" in href or "live-events" in href:
                        full_url = href if href.startswith("http") else f"https://www.fancode.com{href}"
                        
                        if full_url not in seen_urls:
                            card_text = await link.inner_text()
                            
                            # যদি ম্যাচ কার্ডে LIVE ট্যাগ থাকে
                            if "LIVE" in card_text.upper():
                                seen_urls.add(full_url)
                                
                                lines = [line.strip() for line in card_text.split("\n") if line.strip()]
                                match_title = " vs ".join(lines[:2]) if len(lines) >= 2 else "Live Match"
                                
                                m3u_content += f'#EXTINF:-1 tvg-logo="" group-title="FanCode Live (BD)", {match_title}\n'
                                m3u_content += f'{full_url}\n'
                                saved_count += 1
                                print(f"[+] Found Live Match: {match_title}")
                except Exception:
                    continue
                    
            output_file = "playlist.m3u"
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(m3u_content)
                
            if saved_count > 0:
                write_status(f"Successfully generated playlist.m3u with {saved_count} live matches.")
            else:
                write_status("No live matches found currently on the page.", is_error=False)
                
        except Exception as e:
            write_status(f"Exception occurred: {str(e)}", is_error=True)
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(generate_playlist())
