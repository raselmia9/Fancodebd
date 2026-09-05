import m3u8

# আপনার প্রদান করা মাস্টার m3u8 লিংক
url = "https://sonydaimenew.akamaized.net/hls/live/2022319/Criclive0509/ENG/master.m3u8?hdnea=exp=1788643246~acl=/*~id=380022e3d5134de5b8816e7d51d14d45-1784647668051-019f8530c19e7c5ebc9e9e7dc8300b00~hmac=9d9c8bf7398c2dfbce157b6b4ba64e517dce3f9c51b262ed7f8b018fb113ae28"

print("--- HLS Master Playlist Parser ---")

try:
    # m3u8 ফাইল লোড করা
    playlist = m3u8.load(url)

    if playlist.is_variant:
        print("[✔] মাস্টার প্লেলিস্ট সফলভাবে রিড করা হয়েছে!\n")
        print(f"মোট রেজুলেশন ভেরিয়েন্ট পাওয়া গেছে: {len(playlist.playlists)}\n")
        
        for idx, variant in enumerate(playlist.playlists, 1):
            resolution = variant.stream_info.resolution
            bandwidth = variant.stream_info.bandwidth
            stream_uri = variant.uri
            
            # রিলেটিভ ইউআরএল হলে ফুল পাথ তৈরি করা
            if not stream_uri.startswith('http'):
                base_url = url.rsplit('/', 1)[0]
                stream_uri = f"{base_url}/{stream_uri}"

            print(f"[{idx}] রেজুলেশন: {resolution}")
            print(    f"    বিটরেট (Bandwidth): {bandwidth} bps")
            print(    f"    লিংক: {stream_uri}\n")
    else:
        print("[!] এটি কোনো মাস্টার প্লেলিস্ট নয়, এটি সরাসরি মিডিয়া প্লেলিস্ট।")

except Exception as e:
    print(f"[X] লিংক রিড করতে সমস্যা হয়েছে: {e}")
