import json
import os
import requests
from bs4 import BeautifulSoup

def generate_playlist():
    url = "https://www.fancode.com/bd"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    
    print("[*] Fetching FanCode homepage...")
    try:
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code != 200:
            print(f"[!] Failed to fetch page, status code: {response.status_code}")
            return
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # পেজে থাকা JSON-LD স্কিপ্ট ট্যাগগুলো খুঁজে বের করা
        json_scripts = soup.find_all('script', type='application/ld+json')
        print(f"[*] Found {len(json_scripts)} JSON-LD blocks.")
        
        m3u_content = "#EXTM3U\n"
        saved_count = 0
        seen_urls = set()
        
        for script in json_scripts:
            try:
                data = json.loads(script.string) if script.string else {}
                
                # যদি ডেটার ভেতরে @graph থাকে অথবা SiteNavigationElement হয়
                items = []
                if "@graph" in data:
                    items = data["@graph"]
                elif isinstance(data, list):
                    items = data
                else:
                    items = [data]
                    
                for item in items:
                    if item.get("@type") == "SiteNavigationElement":
                        name = item.get("name")
                        link = item.get("url")
                        
                        # যদি নাম এবং লিংক থাকে এবং তা ডুপ্লিকেট না হয়
                        if name and link and link not in seen_urls:
                            # হোম বা সাধারণ নেভিগেশন বাদ দিয়ে ম্যাচ বা ট্যুর লিংকগুলো ফিল্টার করা
                            if "/match/" in link or "/tour/" in link or "/cricket" in link or "/football" in link:
                                seen_urls.add(link)
                                
                                # নিরাপদ টাইটেল তৈরি
                                safe_name = isinstance(name, str) and name or "Live Event"
                                
                                m3u_content += f'#EXTINF:-1 tvg-logo="" group-title="FanCode Live", {safe_name}\n'
                                m3u_content += f'{link}\n'
                                saved_count += 1
                                print(f"[+] Added: {safe_name} -> {link}")
                                
            except Exception as inner_ex:
                continue
                
        # সরাসরি রুট ডিরেক্টরিতে 'playlist.m3u' ফাইল সেভ করা
        output_file = "playlist.m3u"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(m3u_content)
            
        print(f"[+] Successfully generated '{output_file}' with {saved_count} items!")
        
    except Exception as e:
        print(f"[!] Error: {e}")

if __name__ == "__main__":
    generate_playlist()
