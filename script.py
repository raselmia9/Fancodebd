import m3u8
import requests

# আপনার প্রদান করা মাস্টার m3u8 লিংক
url = "https://sonydaimenew.akamaized.net/hls/live/2022319/Criclive0509/ENG/master.m3u8?hdnea=exp=1788643246~acl=/*~id=380022e3d5134de5b8816e7d51d14d45-1784647668051-019f8530c19e7c5ebc9e9e7dc8300b00~hmac=9d9c8bf7398c2dfbce157b6b4ba64e517dce3f9c51b262ed7f8b018fb113ae28"

status_lines = []
status_lines.append("--- HLS Master Playlist Status Report ---\n")

try:
    # প্রথমে রিকোয়েস্ট পাঠিয়ে লিংকটি সচল আছে কিনা চেক করা
    response = requests.get(url, timeout=10)
    status_lines.append(f"HTTP Status Code: {response.status_code}\n")
    
    if response.status_code == 200:
        status_lines.append("[✔] Link is active and reachable.\n")
        
        # m3u8 ফাইল লোড করা
        playlist = m3u8.load(url)

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
            for segment in playlist.segments[:5]:  # প্রথম ৫টি সেগমেন্ট দেখানো যাক
                status_lines.append(f"Segment: {segment.uri}")
    else:
        status_lines.append(f"[X] Failed to fetch link. Status code: {response.status_code}")

except Exception as e:
    status_lines.append(f"[X] Error occurred: {str(e)}")

# আউটপুট একটি টেক্সট ফাইলে সেভ করা
with open("status.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(status_lines))

print("Status successfully written to status.txt")
