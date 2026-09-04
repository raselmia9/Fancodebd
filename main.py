import asyncio
from playwright.async_api import async_playwright

async def save_page_source():
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
        print("[*] Opening FanCode to fetch source code...")
        
        try:
            # ফ্যানকোড বাংলাদেশ পেজে প্রবেশ
            await page.goto("https://www.fancode.com/bd", timeout=60000, wait_until="domcontentloaded")
            
            # পেজ পুরোপুরি রেন্ডার হওয়ার জন্য কিছুটা সময় দেওয়া
            await asyncio.sleep(6)
            
            # পেজের সম্পূর্ণ সোর্স কোড নেওয়া
            html_content = await page.content()
            
            # সোর্স কোডটি একটি ফাইলের মধ্যে সেভ করা
            with open("fancode_source.html", "w", encoding="utf-8") as f:
                f.write(html_content)
                
            print("[+] Successfully saved page source to 'fancode_source.html'")
            
        except Exception as e:
            print(f"[!] Error: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(save_page_source())
