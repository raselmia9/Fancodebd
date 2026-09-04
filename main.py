import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        # ব্রাউজার চালু করা
        browser = await p.chromium.launch(headless=True)
        
        # বাংলাদেশ লোকেশন এবং ইউজার-এজেন্ট সেট করা
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            locale="bn-BD",
            timezone_id="Asia/Dhaka"
        )
        
        page = await context.new_page()
        print("FanCode লাইভ পেজে প্রবেশ করা হচ্ছে...")
        
        try:
            await page.goto("https://www.fancode.com/bd/live-now/all-sports", timeout=60000)
            await page.wait_for_selector("a[href*='/match/']", timeout=15000)
        except Exception as e:
            print(f"পেজ লোড হতে সমস্যা হয়েছে: {e}")
            await browser.close()
            return

        # পেজ একটু স্ক্রোল করা যাতে সব কার্ড লোড হয়
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(3)

        # কার্ড থেকে লোগো এবং ম্যাচ টাইটেল সংগ্রহ করা
        matches = await page.evaluate('''() => {
            const matchCards = [];
            const cards = document.querySelectorAll('a[href*="/match/"]');
            
            cards.forEach(card => {
                const titleElement = card.querySelector('div, span');
                const imgElement = card.querySelector('img');
                
                const title = titleElement ? titleElement.innerText.trim() : "Live Match";
                const logo = imgElement ? imgElement.src : "";
                
                if (title && !matchCards.some(m => m.title === title)) {
                    matchCards.push({ title, logo });
                }
            });
            
            return matchCards;
        }''')

        await browser.close()

        # m3u ফাইল কন্টেন্ট তৈরি
        m3u_content = "#EXTM3U\n"
        
        if not matches:
            print("কোনো লাইভ ম্যাচ কার্ড পাওয়া যায়নি!")
            return

        for match in matches:
            title = match['title'].replace('\n', ' - ')
            logo = match['logo']
            
            m3u_content += f'#EXTINF:-1 tvg-logo="{logo}" group-title="FanCode Live",{title}\n'
            m3u_content += f'https://www.fancode.com\n'

        # ফাইল সেভ করা (আপনার প্রজেক্টের রিকোয়ারমেন্ট অনুযায়ী ফাইলের নাম দিতে পারেন)
        output_filename = "Modified_DaddyLive_Playlist.m3u"
        with open(output_filename, "w", encoding="utf-8") as f:
            f.write(m3u_content)

        print(f"সফলভাবে '{output_filename}' ফাইল আপডেট করা হয়েছে!")

if __name__ == "__main__":
    asyncio.run(main())
