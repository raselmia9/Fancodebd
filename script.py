import m3u8
import requests

# আপনার নতুন দেওয়া মাস্টার m3u8 লিংক
url = "https://sonydaimenew.akamaized.net/hls/live/2005444/criclive0509/HIN/master.m3u8?hdnea=exp=1788643237~acl=/*~id=380022e3d5134de5b8816e7d51d14d45-1784647668051-019f8530c19e7c5ebc9e9e7dc8300b00~hmac=53510d19bc5669ea8a25475c60fc54fac5dc689ab50a4c04f5d1048e2db47b37"

status_lines = []
status_lines.append("--- HLS Master Playlist Status Report (HIN) ---\n")

# সার্ভার যেন মনে করে কোনো রিয়েল ব্রাউজার বা অ্যান্ড্রয়েড অ্যাপ থেকে রিকোয়েস্ট যাচ্ছে
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.sonyliv.com/",
    "Accept": "*/*"
}

try:
    # হেডারসহ রিকোয়েস্ট পাঠানো হচ্ছে
    response = requests.get(url, headers=headers, timeout=15)
    status_lines.append(f"HTTP Status Code: {response.status_code}\n")
    
    if response.status_code == 200:
        status_lines.append("[✔] Link is active and accessible with custom headers.\n")
        
        # m3u8 ফাইল লোড করার জন্য রিকোয়েস্ট থেকে পাওয়া টেক্সট পাস করা হচ্ছে
        playlist = m3u8.loads(response.text, uri=url)

        if playlist.is_variant:
            status_lines.append(f"[✔] Master playlist found! Total variants: {len(playlist.playlists)}\n")
            
            for idx, variant in enumerate(playlist.playlists, 1):
                resolution = variant.stream_info.resolution
                bandwidth = variant.stream_info.bandwidth
                stream_uri = variant.uri
                
                # রিলেটিভ ইউআরএল হলে ফুল পাথ তৈরি করা
                if not stream_uri.startswith('http'):
                    base_url = url.rsplit('/', 1)[0]
                    stream_uri = f"{base_url}/{stream_uri}"

                status_lines.append(f"[{idx}] Resolution: {resolution}")
                status_lines.append(f"    Bandwidth: {bandwidth} bps")
                status_lines.append(f"    Stream Link: {stream_uri}\n")
        else:
            status_lines.append("[!] Not a master playlist, direct media playlist found.")
            for segment in playlist.segments[:5]:
                status_lines.append(f"Segment: {segment.uri}")
    else:
        status_lines.append(f"[X] Failed to fetch link. Status code: {response.status_code}")

except Exception as e:
    status_lines.append(f"[X] Error occurred: {str(e)}")

# আউটপুট একটি টেক্সট ফাইলে সেভ করা
with open("status.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(status_lines))

print("Status successfully written to status.txt")
