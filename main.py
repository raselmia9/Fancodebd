import json
import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime

def write_status(message, is_error=False):
    status_type = "ERROR" if is_error else "SUCCESS"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_text = f"[{timestamp}] [{status_type}] {message}\n"
    
    # status.txt ফাইলে স্ট্যাটাস সেভ করা
    with open("status.txt", "w", encoding="utf-8") as f:
        f.write(log_text)
    print(log_text)

def generate_playlist():
    url = "https://www.fancode.com/bd"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code != 200:
            err_msg = f"Failed to fetch page, status code: {response.status_code}"
            write_status(err_msg, is_error=True)
            return
            
        soup = BeautifulSoup(response.text, 'html.parser')
        json_scripts = soup.find_all('script', type='application/ld+json')
        
        if not json_scripts:
            write_status("No JSON-LD blocks found on the page.", is_error=True)
            return

        m3u_content = "#EXTM3U\n"
        saved_count = 0
        seen_urls = set()
        
        for script in json_scripts:
            try:
                data = json.loads(script.string) if script.string else {}
                items = data.get("@graph", []) if "@graph" in data else (data if isinstance(data, list) else [data])
                    
                for item in items:
                    if item.get("@type") == "SiteNavigationElement":
                        name = item.get("name")
                        link = item.get("url")
                        
                        if name and link and link not in seen_urls:
                            if "/match/" in link or "/tour/" in link or "/cricket" in link or "/football" in link:
                                seen_urls.add(link)
                                safe_name = name if isinstance(name, str) else "Live Event"
                                m3u_content += f'#EXTINF:-1 tvg-logo="" group-title="FanCode Live", {safe_name}\n'
                                m3u_content += f'{link}\n'
                                saved_count += 1
            except Exception:
                continue
                
        output_file = "playlist.m3u"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(m3u_content)
            
        # সফল হওয়ার স্ট্যাটাস লেখা
        write_status(f"Successfully generated playlist.m3u with {saved_count} items.")
        
    except Exception as e:
        write_status(f"Exception occurred: {str(e)}", is_error=True)

if __name__ == "__main__":
    generate_playlist()
    
