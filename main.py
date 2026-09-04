import json
import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime

def write_status(message, is_error=False):
    status_type = "ERROR" if is_error else "SUCCESS"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_text = f"[{timestamp}] [{status_type}] {message}\n"
    
    with open("status.txt", "w", encoding="utf-8") as f:
        f.write(log_text)
    print(log_text)

def generate_playlist():
    # এখন আমরা সরাসরি লাইভ পেজটি ব্যবহার করছি
    url = "https://www.fancode.com/bd/live-now/all-sports"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    
    try:
        print(f"[*] Fetching Live URL: {url}")
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code != 200:
            write_status(f"Failed to fetch live page, status code: {response.status_code}", is_error=True)
            return
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # পেজে থাকা সব হাইপারলিংক বা ট্যাগ স্ক্যান করা
        links = soup.find_all('a', href=True)
        
        m3u_content = "#EXTM3U\n"
        saved_count = 0
        seen_urls = set()
        
        for link in links:
            href = link['href']
            # শুধুমাত্র লাইভ ম্যাচ বা ম্যাচ রিলেটেড ইউআরএল ফিল্টার করা
            if "/match/" in href or "live-events" in href:
                # যদি পূর্ণাঙ্গ ইউআরএল না থাকে, তবে ডোমেইন যোগ করে নেওয়া
                full_url = href if href.startswith("http") else f"https://www.fancode.com{href}"
                
                if full_url not in seen_urls:
                    card_text = link.get_text(separator=" ", strip=True)
                    
                    # শুধুমাত্র যেগুলোতে LIVE লেখা আছে বা ম্যাচ কার্ডের টেক্সট পাওয়া গেছে
                    if "LIVE" in card_text.upper() or len(card_text) > 5:
                        seen_urls.add(full_url)
                        
                        # পরিপাটি টাইটেল তৈরি
                        match_title = card_text if card_text else "Live Match"
                        # অতিরিক্ত বড় টেক্সট হলে কেটে ছোট করে নেওয়া
                        if len(match_title) > 100:
                            match_title = match_title[:100] + "..."
                            
                        m3u_content += f'#EXTINF:-1 tvg-logo="" group-title="FanCode Live Now", {match_title}\n'
                        m3u_content += f'{full_url}\n'
                        saved_count += 1
                        
        output_file = "playlist.m3u"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(m3u_content)
            
        if saved_count > 0:
            write_status(f"Successfully generated playlist.m3u with {saved_count} live matches.")
        else:
            write_status("No live matches found currently on the page.", is_error=False)
            
    except Exception as e:
        write_status(f"Exception occurred: {str(e)}", is_error=True)

if __name__ == "__main__":
    generate_playlist()
