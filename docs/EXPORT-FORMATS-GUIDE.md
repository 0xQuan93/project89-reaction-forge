# Animation Export Formats Guide

## 🎬 Dual Export System

Project 89 Reaction Forge now supports **TWO export formats** for maximum compatibility:

### 1. 🎨 GIF Export (Universal)
**Best for:** Twitter/X, Discord, universal sharing

### 2. 🎥 WebM Export (High Quality)
**Best for:** Web embedding, high quality, smaller files

---

## 📊 Format Comparison

| Feature | GIF | WebM |
|---------|-----|------|
| **File Size** | 600-1000 KB | 300-500 KB |
| **Quality** | Good (256 colors) | Excellent (full color) |
| **Twitter/X** | ✅ Supported | ❌ Not supported |
| **Discord** | ✅ Supported | ✅ Supported |
| **Instagram** | ✅ Supported | ❌ Not supported |
| **Web Embed** | ✅ Universal | ✅ Modern browsers |
| **Auto-play** | ✅ Always | ⚠️ Varies |
| **Export Time** | 3-5 seconds | 3 seconds |
| **FPS** | 15 (smooth enough) | 30 (very smooth) |

---

## 🎨 GIF Export Details

### Technology
- **Library:** `gifenc` (lightweight, fast, browser-native)
- **Encoding:** Client-side, no server needed
- **Format:** Standard GIF89a with looping

### Settings
```typescript
{
  duration: 3,      // 3 seconds
  fps: 15,          // 15 frames per second
  colors: 256,      // GIF standard
}
```

### File Sizes
- **3 seconds @ 15 fps:** ~600-800 KB
- **5 seconds @ 15 fps:** ~1-1.2 MB
- **3 seconds @ 10 fps:** ~400-600 KB (if you optimize)

### Quality Tips
- **15 FPS is sweet spot** - Smooth enough, reasonable size
- **3 seconds is ideal** - Long enough to show animation, small file
- **Quantization is automatic** - gifenc handles color reduction

### Best For
- ✅ Twitter/X posts
- ✅ Discord reactions
- ✅ Instagram stories
- ✅ Email signatures
- ✅ Universal sharing

---

## 🎥 WebM Export Details

### Technology
- **API:** MediaRecorder (browser-native)
- **Codec:** VP9 (best) or VP8 (fallback)
- **Format:** WebM container

### Settings
```typescript
{
  duration: 3,              // 3 seconds
  fps: 30,                  // 30 frames per second
  bitrate: 2500000,         // 2.5 Mbps
  codec: 'vp9' or 'vp8',   // Auto-detected
}
```

### File Sizes
- **3 seconds @ 30 fps:** ~300-500 KB
- **5 seconds @ 30 fps:** ~500-800 KB
- **10 seconds @ 30 fps:** ~1-1.5 MB

### Quality
- **Full color** - No 256 color limitation
- **Smooth playback** - 30 FPS
- **Better compression** - Smaller than GIF
- **Transparency support** - If needed

### Best For
- ✅ Website embedding
- ✅ High-quality previews
- ✅ Discord (supports WebM)
- ✅ Modern platforms
- ✅ When file size matters

---

## 🚀 How to Export

### GIF Export (For Twitter/X)

1. **Select a pose**
2. **Set Animation Mode** to "Loop" or "Play Once"
3. **Click "Generate reaction"**
4. **Click "Export GIF"** button
5. **Wait 3-5 seconds** for encoding
6. **GIF downloads** as `{pose-id}.gif`
7. **Upload to Twitter/X** ✨

**Example:** `agent-taunt.gif` (750 KB, 3 seconds, 15 fps)

### WebM Export (For Quality)

1. **Select a pose**
2. **Set Animation Mode** to "Loop" or "Play Once"
3. **Click "Generate reaction"**
4. **Click "Export WebM (HQ)"** button
5. **Wait 3 seconds** for recording
6. **WebM downloads** as `{pose-id}.webm`
7. **Use on website or Discord** ✨

**Example:** `agent-taunt.webm` (400 KB, 3 seconds, 30 fps)

---

## 📱 Platform Support

### Twitter/X
- **GIF:** ✅ Full support
- **WebM:** ❌ Not supported (as of 2024)
- **Recommendation:** Use GIF export

### Discord
- **GIF:** ✅ Full support
- **WebM:** ✅ Full support
- **Recommendation:** Use WebM for better quality

### Instagram
- **GIF:** ✅ Stories support
- **WebM:** ❌ Not supported
- **Recommendation:** Use GIF export

### Facebook
- **GIF:** ✅ Full support
- **WebM:** ⚠️ Limited support
- **Recommendation:** Use GIF export

### Reddit
- **GIF:** ✅ Full support
- **WebM:** ✅ Full support
- **Recommendation:** Either works

### Web Embedding
- **GIF:** ✅ Universal
- **WebM:** ✅ Modern browsers (95%+ support)
- **Recommendation:** Use WebM for better quality/size

---

## 🎯 Use Case Guide

### "I want to post on Twitter/X"
→ **Use GIF Export** ✅

### "I want the smallest file size"
→ **Use WebM Export** (50% smaller)

### "I want the best quality"
→ **Use WebM Export** (full color, 30 fps)

### "I want universal compatibility"
→ **Use GIF Export** (works everywhere)

### "I want to embed on my website"
→ **Use WebM Export** (better quality, smaller)

### "I want to share on Discord"
→ **Use WebM Export** (better quality) or GIF (both work)

### "I want to use in email"
→ **Use GIF Export** (better email client support)

---

## 🔧 Technical Details

### GIF Encoding Process

1. **Capture frames** from canvas (15 fps)
2. **Extract image data** for each frame
3. **Quantize colors** to 256-color palette
4. **Apply palette** to each frame
5. **Encode to GIF** using gifenc
6. **Download** as .gif file

**Time:** ~3-5 seconds for 3-second animation

### WebM Recording Process

1. **Capture stream** from canvas (30 fps)
2. **Start MediaRecorder** with VP9/VP8 codec
3. **Record** for specified duration
4. **Stop and finalize** recording
5. **Download** as .webm file

**Time:** ~3 seconds for 3-second animation (real-time)

---

## 📊 File Size Optimization

### GIF Optimization

**Reduce FPS:**
```typescript
fps: 10  // Instead of 15, saves ~30% file size
```

**Shorter duration:**
```typescript
duration: 2  // Instead of 3, saves ~33% file size
```

**Expected results:**
- 2 seconds @ 10 fps: ~350-450 KB
- 3 seconds @ 10 fps: ~500-650 KB
- 3 seconds @ 15 fps: ~600-800 KB

### WebM Optimization

**Lower bitrate:**
```typescript
videoBitsPerSecond: 1500000  // 1.5 Mbps instead of 2.5
```

**Expected results:**
- 3 seconds @ 1.5 Mbps: ~200-350 KB
- 3 seconds @ 2.5 Mbps: ~300-500 KB
- 5 seconds @ 2.5 Mbps: ~500-800 KB

---

## 🎨 Quality Comparison

### Visual Quality

**GIF:**
- 256 colors (quantized palette)
- Slight color banding on gradients
- Sharp edges preserved
- Good for avatars with solid colors

**WebM:**
- Full color (millions of colors)
- Smooth gradients
- No color banding
- Better for complex scenes

### Motion Quality

**GIF @ 15 FPS:**
- Smooth enough for most animations
- Slight stutter on fast movements
- Perfect for avatar poses

**WebM @ 30 FPS:**
- Very smooth motion
- No visible stutter
- Cinema-quality playback

---

## 🐛 Troubleshooting

### GIF Export Issues

**Problem:** Export takes too long
**Solution:** Reduce duration or FPS

**Problem:** File size too large
**Solution:** Use 10 FPS instead of 15, or 2 seconds instead of 3

**Problem:** Colors look wrong
**Solution:** This is normal GIF quantization, use WebM for true colors

### WebM Export Issues

**Problem:** "Video export not supported"
**Solution:** Use a modern browser (Chrome, Firefox, Edge)

**Problem:** Twitter doesn't accept WebM
**Solution:** Use GIF export for Twitter

**Problem:** File won't play on iPhone
**Solution:** Safari has limited WebM support, use GIF

---

## 📚 Best Practices

### For Social Media
1. **Use GIF** for Twitter/X, Instagram
2. **Keep it short** - 2-3 seconds ideal
3. **15 FPS** is the sweet spot
4. **Test before posting** - verify file plays

### For Websites
1. **Use WebM** for better quality/size
2. **Provide GIF fallback** for older browsers
3. **Optimize bitrate** based on content
4. **Add poster image** for better loading

### For Discord/Chat
1. **Either format works**
2. **WebM for quality** (smaller file)
3. **GIF for compatibility** (older clients)
4. **Keep under 8 MB** (Discord limit)

---

## ✅ Quick Reference

**Export GIF:**
```
Select pose → Loop/Once → Generate → Export GIF → Wait → Download
```

**Export WebM:**
```
Select pose → Loop/Once → Generate → Export WebM (HQ) → Wait → Download
```

**File naming:**
- GIF: `{pose-id}.gif` (e.g., `agent-taunt.gif`)
- WebM: `{pose-id}.webm` (e.g., `agent-taunt.webm`)

**Typical sizes:**
- GIF: 600-800 KB (3s @ 15fps)
- WebM: 300-500 KB (3s @ 30fps)

---

## 🎯 Summary

**You now have TWO export options:**

1. **GIF Export** 🎨
   - ✅ Works on Twitter/X
   - ✅ Universal compatibility
   - ✅ 600-800 KB file size
   - ✅ 15 FPS smooth motion

2. **WebM Export** 🎥
   - ✅ Better quality (full color)
   - ✅ Smaller files (300-500 KB)
   - ✅ 30 FPS very smooth
   - ⚠️ Not for Twitter/X

**Choose based on where you're sharing:**
- **Twitter/X:** Use GIF
- **Discord:** Use WebM (better) or GIF
- **Website:** Use WebM
- **Email:** Use GIF
- **Universal:** Use GIF

---

**Built with 💜 for Project 89** 🎭✨

