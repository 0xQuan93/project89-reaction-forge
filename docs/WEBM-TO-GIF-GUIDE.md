# WebM to GIF Conversion Guide

## 🎯 Why WebM?

GIF encoding libraries have compatibility issues in the browser, but **WebM works perfectly** and is actually better quality. Here's the simple workflow:

---

## 📹 Step 1: Export WebM

1. Select your pose
2. Set Animation Mode to "Loop" or "Play Once"
3. Click **"Export Animation"**
4. Wait 3 seconds
5. Download `{pose-id}.webm`

**File size:** ~300-500 KB  
**Quality:** Excellent (30 FPS, full color)

---

## 🎨 Step 2: Convert to GIF (For Twitter/X)

### Option A: ezgif.com (Easiest, Free)

1. Go to **https://ezgif.com/webm-to-gif**
2. Click "Choose File" and select your `.webm` file
3. Click "Upload video!"
4. **Adjust settings (optional):**
   - Method: "FFmpeg" (best quality)
   - FPS: 15 (good balance)
   - Width: Leave as-is (original size)
5. Click "Convert to GIF!"
6. Click "Save" to download your GIF

**Result:** Twitter-ready GIF (~600-800 KB)

### Option B: CloudConvert (Free, No Ads)

1. Go to **https://cloudconvert.com/webm-to-gif**
2. Upload your `.webm` file
3. Click "Convert"
4. Download your GIF

### Option C: Convertio (Free, Simple)

1. Go to **https://convertio.co/webm-gif/**
2. Upload your `.webm` file
3. Click "Convert"
4. Download your GIF

---

## 🚀 Quick Workflow

```
Reaction Forge → Export Animation → ezgif.com → Twitter ✨
```

**Total time:** ~1 minute (3s export + 30s convert + 30s upload)

---

## 📊 Quality Comparison

### WebM (Original Export)
- **Size:** 300-500 KB
- **Quality:** Excellent
- **FPS:** 30
- **Colors:** Full color
- **Use for:** Discord, websites, high quality

### GIF (After Conversion)
- **Size:** 600-800 KB
- **Quality:** Good
- **FPS:** 15 (recommended)
- **Colors:** 256 colors
- **Use for:** Twitter/X, Instagram, universal

---

## 💡 Pro Tips

### For Best GIF Quality

**On ezgif.com:**
1. Use "FFmpeg" method (not "Gifsicle")
2. Keep FPS at 15 (smooth enough)
3. Don't reduce size (keep original dimensions)
4. Use "Optimize" after conversion (optional, reduces file size)

### For Smaller File Size

**On ezgif.com:**
1. Reduce FPS to 10
2. Use "Lossy GIF" compression (under "Optimize")
3. Reduce colors to 128 (if needed)

**Result:** ~400-500 KB GIF

### For Twitter/X Specifically

**Twitter GIF limits:**
- Max size: 15 MB (you'll be way under this)
- Max dimensions: 1280×1080
- Recommended: 600×600 to 800×800

**Your exports are already optimized for Twitter!**

---

## 🎨 Alternative: Use Discord/Web

If you don't want to convert:

### Discord
- ✅ **Upload WebM directly** to Discord
- Better quality than GIF
- Smaller file size
- Auto-plays perfectly

### Websites
- ✅ **Embed WebM directly** in HTML
- Use `<video>` tag with autoplay + loop
- Better quality and performance
- 95%+ browser support

```html
<video autoplay loop muted playsinline>
  <source src="agent-taunt.webm" type="video/webm">
</video>
```

---

## 🔧 Batch Conversion

If you export multiple animations:

### Using ezgif.com
1. Go to https://ezgif.com/webm-to-gif
2. Convert first file
3. Use browser back button
4. Upload next file
5. Repeat

### Using Command Line (Advanced)

Install FFmpeg, then:
```bash
ffmpeg -i input.webm -vf "fps=15,scale=800:-1:flags=lanczos" output.gif
```

---

## ❓ FAQ

### Q: Why not export GIF directly?
**A:** GIF encoding libraries have compatibility issues in browsers. WebM is more reliable and better quality.

### Q: Is the conversion lossless?
**A:** No, GIF has 256 colors vs WebM's millions. But the quality is still very good!

### Q: Can I automate this?
**A:** Yes! Use FFmpeg or online API services. But for occasional use, ezgif.com is easiest.

### Q: Does Discord support WebM?
**A:** Yes! Upload WebM directly to Discord for best quality.

### Q: What about Instagram?
**A:** Instagram doesn't support WebM. Convert to GIF first.

### Q: File size too large?
**A:** Use ezgif.com's "Optimize" feature after conversion, or reduce FPS to 10.

---

## 📱 Platform Support

| Platform | WebM | GIF | Recommendation |
|----------|------|-----|----------------|
| Twitter/X | ❌ | ✅ | Convert to GIF |
| Discord | ✅ | ✅ | Use WebM (better) |
| Instagram | ❌ | ✅ | Convert to GIF |
| Facebook | ⚠️ | ✅ | Convert to GIF |
| Reddit | ✅ | ✅ | Either works |
| Website | ✅ | ✅ | Use WebM (better) |
| Email | ❌ | ✅ | Convert to GIF |

---

## ✅ Summary

**Workflow:**
1. Export WebM from Reaction Forge (3 seconds)
2. Convert to GIF on ezgif.com (30 seconds)
3. Upload to Twitter/X

**Benefits:**
- ✅ Reliable export (no library issues)
- ✅ Best quality WebM for Discord/web
- ✅ Easy conversion for Twitter
- ✅ One-click process

**Links:**
- **ezgif.com/webm-to-gif** - Best converter
- **cloudconvert.com** - Alternative
- **convertio.co** - Another option

---

**Built with 💜 for Project 89** 🎭✨

