const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const Canvas = require("canvas");
const axios = require("axios");

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

    if (!name || !uid || !threadname || !members || !type) {
      return res.status(400).json({
        error: "Missing parameters! Need: name, uid, threadname, members, type"
      });
    }

    const isPromote = type === "promote";
    const width = 800;
    const height = 500;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // ========== RANDOM BG IMAGE ==========
    let bgUrl;
    if (isPromote) {
      // Promote-র জন্য শুধু Promote BG গুলো
      const promoteBGs = [
        "https://i.imgur.com/Fazn5Kx.jpeg",
        "https://i.imgur.com/ttShD5R.jpeg",
        "https://i.imgur.com/5pR1BHH.jpeg",
        "https://i.imgur.com/yX3S1Is.jpeg"
      ];
      bgUrl = promoteBGs[Math.floor(Math.random() * promoteBGs.length)];
    } else {
      // Demote-র জন্য শুধু Demote BG গুলো
      const demoteBGs = [
        "https://i.imgur.com/ez7pM0T.jpeg",
        "https://i.imgur.com/u6yqQX6.jpeg",
        "https://i.imgur.com/R4X8YuQ.jpeg",
        "https://i.imgur.com/haEdaPU.jpeg"
      ];
      bgUrl = demoteBGs[Math.floor(Math.random() * demoteBGs.length)];
    }

    console.log(`📸 Using BG: ${bgUrl}`);

    try {
      const response = await axios.get(bgUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      const bgImage = await Canvas.loadImage(buffer);
      ctx.drawImage(bgImage, 0, 0, width, height);
    } catch (e) {
      console.log("BG load failed, using fallback");
      ctx.fillStyle = isPromote ? "#0a1a0a" : "#1a0a0a";
      ctx.fillRect(0, 0, width, height);
    }

    // ========== DARK OVERLAY ==========
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, width, height);

    // ========== PROFILE PICTURE ==========
    let avatar = null;
    let avatarLoaded = false;
    
    try {
      const graphUrl = `https://graph.facebook.com/${uid}/picture?width=200&height=200&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
      const response = await axios.get(graphUrl, { 
        responseType: 'arraybuffer',
        timeout: 10000 
      });
      const buffer = Buffer.from(response.data, 'binary');
      avatar = await Canvas.loadImage(buffer);
      avatarLoaded = true;
    } catch (e) {
      console.log("Avatar load failed");
    }

    // ========== DRAW AVATAR ==========
    const centerX = width / 2;
    const avatarY = 80;
    const avatarSize = 120;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (avatarLoaded && avatar) {
      ctx.drawImage(avatar, centerX - avatarSize/2, avatarY, avatarSize, avatarSize);
    } else {
      ctx.fillStyle = isPromote ? "#ffd700" : "#ff4444";
      ctx.fillRect(centerX - avatarSize/2, avatarY, avatarSize, avatarSize);
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "60px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("👤", centerX, avatarY + avatarSize/2 + 5);
    }
    ctx.restore();

    // ========== RING ==========
    const ringColor = isPromote ? "#ffd700" : "#ff4444";
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ========== USER NAME ==========
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    let displayName = name.length > 22 ? name.substring(0, 20) + "..." : name;
    ctx.fillText(displayName, centerX, avatarY + avatarSize + 30);
    ctx.shadowBlur = 0;

    // ========== STATUS ==========
    const statusColor = isPromote ? "#ffd700" : "#ff4444";
    const statusText = isPromote ? "✦ ADMIN GRANTED ✦" : "✦ ADMIN REVOKED ✦";
    
    ctx.shadowColor = statusColor;
    ctx.shadowBlur = 15;
    ctx.fillStyle = statusColor;
    ctx.font = "bold 18px Arial";
    ctx.textBaseline = "top";
    ctx.fillText(statusText, centerX, avatarY + avatarSize + 70);
    ctx.shadowBlur = 0;

    // ========== LINE ==========
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 80, avatarY + avatarSize + 100);
    ctx.lineTo(centerX + 80, avatarY + avatarSize + 100);
    ctx.stroke();

    // ========== GROUP INFO ==========
    ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 5;
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "16px Arial";
    let displayGroup = threadname.length > 30 ? threadname.substring(0, 28) + "..." : threadname;
    ctx.fillText("🏠 " + displayGroup, centerX, avatarY + avatarSize + 115);

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "14px Arial";
    ctx.fillText("👥 " + members + " Members", centerX, avatarY + avatarSize + 142);
    ctx.shadowBlur = 0;

    // ========== TIME ==========
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

    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "12px Arial";
    ctx.fillText("📅 " + timeStr, centerX, avatarY + avatarSize + 167);

    // ========== SEND IMAGE ==========
    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`✅ Admin Card API running on port ${PORT}`);
  console.log(`📸 Total BG Images: ${BG_IMAGES.length}`);
  console.log(`📌 Promote BGs: 4 | Demote BGs: 4`);
});
