const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");

const app = express();
const PORT = process.env.PORT || 3000;

// ========== BG IMAGE ARRAY ==========
const BG_IMAGES = [
  "https://i.imgur.com/Fazn5Kx.jpeg",
  "https://i.imgur.com/ttShD5R.jpeg",
  "https://i.imgur.com/5pR1BHH.jpeg",
  "https://i.imgur.com/yX3S1Is.jpeg",
  "https://i.imgur.com/ez7pM0T.jpeg",
  "https://i.imgur.com/u6yqQX6.jpeg",
  "https://i.imgur.com/R4X8YuQ.jpeg",
  "https://i.imgur.com/haEdaPU.jpeg"
];

// ========== HEALTH CHECK ==========
app.get("/", (req, res) => {
  res.json({
    status: "✅ Admin Card API is running!",
    endpoints: {
      promote: "/api/admin?name=NAME&uid=UID&threadname=GROUP&members=MEMBERS&type=promote",
      demote: "/api/admin?name=NAME&uid=UID&threadname=GROUP&members=MEMBERS&type=demote"
    },
    bg_images: BG_IMAGES
  });
});

// ========== MAIN API ==========
app.get("/api/admin", async (req, res) => {
  try {
    const { name, uid, threadname, members, type } = req.query;

    // Check required parameters
    if (!name || !uid || !threadname || !members || !type) {
      return res.status(400).json({
        error: "Missing parameters! Need: name, uid, threadname, members, type"
      });
    }

    const isPromote = type === "promote";
    const width = 800;
    const height = 500;

    // ========== SELECT BG ==========
    let bgUrl;
    if (isPromote) {
      const promoteBGs = [
        "https://i.imgur.com/Fazn5Kx.jpeg",
        "https://i.imgur.com/ttShD5R.jpeg",
        "https://i.imgur.com/5pR1BHH.jpeg",
        "https://i.imgur.com/yX3S1Is.jpeg"
      ];
      bgUrl = promoteBGs[Math.floor(Math.random() * promoteBGs.length)];
    } else {
      const demoteBGs = [
        "https://i.imgur.com/ez7pM0T.jpeg",
        "https://i.imgur.com/u6yqQX6.jpeg",
        "https://i.imgur.com/R4X8YuQ.jpeg",
        "https://i.imgur.com/haEdaPU.jpeg"
      ];
      bgUrl = demoteBGs[Math.floor(Math.random() * demoteBGs.length)];
    }

    console.log(`📸 Using BG: ${bgUrl}`);

    // ========== DOWNLOAD BG ==========
    const bgResponse = await axios.get(bgUrl, { 
      responseType: 'arraybuffer',
      timeout: 15000 
    });
    const bgBuffer = Buffer.from(bgResponse.data);

    // ========== DOWNLOAD PROFILE PICTURE ==========
    let avatarBuffer = null;
    try {
      const graphUrl = `https://graph.facebook.com/${uid}/picture?width=400&height=400&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
      const avatarResponse = await axios.get(graphUrl, { 
        responseType: 'arraybuffer',
        timeout: 15000 
      });
      avatarBuffer = Buffer.from(avatarResponse.data);
      console.log(`✅ Avatar loaded for ${uid}`);
    } catch (e) {
      console.log(`❌ Avatar load failed for ${uid}:`, e.message);
    }

    // ========== START IMAGE PROCESSING ==========
    let image = sharp(bgBuffer)
      .resize(width, height, { fit: 'cover' })
      .composite([{
        input: Buffer.from(`
          <svg width="${width}" height="${height}">
            <rect width="${width}" height="${height}" fill="rgba(0,0,0,0.5)" />
          </svg>
        `),
        blend: 'over'
      }]);

    // ========== ADD AVATAR WITH RING ==========
    if (avatarBuffer) {
      const avatarSize = 130;
      const centerX = width / 2;
      const avatarY = 80;
      const ringSize = avatarSize + 10;

      // Create circular avatar
      const maskBuffer = Buffer.from(`
        <svg width="${avatarSize}" height="${avatarSize}">
          <circle cx="${avatarSize/2}" cy="${avatarSize/2}" r="${avatarSize/2}" fill="white" />
        </svg>
      `);

      let avatarProcessed = await sharp(avatarBuffer)
        .resize(avatarSize, avatarSize, { fit: 'cover' })
        .composite([{
          input: maskBuffer,
          blend: 'dest-in'
        }])
        .png()
        .toBuffer();

      // Create ring
      const ringColor = isPromote ? "#ffd700" : "#ff4444";
      const ringBuffer = Buffer.from(`
        <svg width="${ringSize}" height="${ringSize}">
          <circle cx="${ringSize/2}" cy="${ringSize/2}" r="${ringSize/2 - 2}" 
            fill="none" stroke="${ringColor}" stroke-width="4" />
        </svg>
      `);

      const ringProcessed = await sharp(ringBuffer)
        .png()
        .toBuffer();

      // Add glow effect
      const glowBuffer = Buffer.from(`
        <svg width="${ringSize + 20}" height="${ringSize + 20}">
          <circle cx="${(ringSize + 20)/2}" cy="${(ringSize + 20)/2}" r="${(ringSize + 20)/2}" 
            fill="rgba(0,0,0,0.2)" />
        </svg>
      `);

      image = image.composite([
        {
          input: glowBuffer,
          left: centerX - (ringSize + 20)/2,
          top: avatarY - 10,
          blend: 'over'
        },
        {
          input: avatarProcessed,
          left: centerX - avatarSize/2,
          top: avatarY,
          blend: 'over'
        },
        {
          input: ringProcessed,
          left: centerX - ringSize/2,
          top: avatarY - 5,
          blend: 'over'
        }
      ]);
    }

    // ========== GENERATE TEXT SVG ==========
    const statusColor = isPromote ? "#ffd700" : "#ff4444";
    const statusText = isPromote ? "✦ ADMIN GRANTED ✦" : "✦ ADMIN REVOKED ✦";
    const displayName = name.length > 22 ? name.substring(0, 20) + "..." : name;
    const displayGroup = threadname.length > 30 ? threadname.substring(0, 28) + "..." : threadname;
    
    const timeStr = new Date().toLocaleString("en-BD", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour12: true
    });

    // ========== CREATE TEXT OVERLAY ==========
    const textSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>
          text { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
          }
        </style>
        
        <!-- User Name -->
        <text x="${width/2}" y="240" text-anchor="middle" font-size="34" font-weight="bold" fill="white">
          ${displayName}
        </text>
        
        <!-- Status Badge Background -->
        <rect x="${width/2 - 130}" y="272" width="260" height="34" rx="17" 
          fill="rgba(0,0,0,0.3)" stroke="${statusColor}" stroke-width="1.5"/>
        
        <!-- Status Text -->
        <text x="${width/2}" y="295" text-anchor="middle" font-size="16" font-weight="bold" fill="${statusColor}">
          ${statusText}
        </text>
        
        <!-- Decorative Line -->
        <line x1="${width/2 - 100}" y1="322" x2="${width/2 + 100}" y2="322" 
          stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
        
        <!-- Group Name -->
        <text x="${width/2}" y="340" text-anchor="middle" font-size="17" fill="rgba(255,255,255,0.65)">
          🏠 ${displayGroup}
        </text>
        
        <!-- Members -->
        <text x="${width/2}" y="370" text-anchor="middle" font-size="15" fill="rgba(255,255,255,0.45)">
          👥 ${members} Members
        </text>
        
        <!-- Time -->
        <text x="${width/2}" y="398" text-anchor="middle" font-size="13" fill="rgba(255,255,255,0.3)">
          📅 ${timeStr}
        </text>
        
        <!-- Footer -->
        <text x="${width/2}" y="440" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.1)">
          ✦ ADMIN CARD v2.0 ✦
        </text>
      </svg>
    `;

    image = image.composite([{
      input: Buffer.from(textSvg),
      blend: 'over'
    }]);

    // ========== GENERATE FINAL IMAGE ==========
    const outputBuffer = await image
      .png({ quality: 95 })
      .toBuffer();

    // ========== SEND RESPONSE ==========
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(outputBuffer);

  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate admin card',
      details: error.message 
    });
  }
});

// ========== ERROR HANDLING ==========
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`✅ Admin Card API running on port ${PORT}`);
  console.log(`📸 Total BG Images: ${BG_IMAGES.length}`);
  console.log(`📌 Promote BGs: 4 | Demote BGs: 4`);
  console.log(`🚀 Test: http://localhost:${PORT}/api/admin?name=Test&uid=123&threadname=Group&members=10&type=promote`);
});
