// bot.js
const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");
const Sentiment = require("sentiment");
const cron = require("node-cron");
const config = require("./config"); // BOT_TOKEN + WEBHOOK_URL
const yahooFinance = require('yahoo-finance2').default;
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Initialize bot (no polling)
const bot = new TelegramBot(config.BOT_TOKEN);
const sentiment = new Sentiment();

// ========================
// Existing wordlist / Police Mode code unchanged
// ========================
const wordlist = [
  'চুদি','চোদ','মাগী','হারামি','গাধা','বোকা','চুতমারানি','খানকিরপোলা','শুয়োর',
  'শালা','মাদারচোদ','বাপচোদ','চুতিয়া','chudi','chod','magi','harami','gadha','boka',
  'chutmarani','khanakirpola','shuar','shala','madarchod','bapchod','chutiya','fuck',
  'motherfucker','shit','bitch','asshole','bastard','idiot','fraud','cheat',
  'looter','conman','admin fraud','fake','thief',
  'এডমিন চুদি','এডমিন চোর','এডমিন খারাপ','this is a scam','admin fraud',
  'Pulu Marma বাটপার','Pulu Marma চোর','pulu marma চোর','pulu marma একজন বাটপার',
  'পুলু মারমা চোর','পুলু মারমা বাটপার','পুলু মারমা মানুষের টাকা মেরে খায়',
  'INNER CIRCLE 9 এই গ্রুপ এডমিন @PuluMarma Mushasi Miyamoto একটা প্রতারক পেইড কোর্স করানোর নামে মানুষের থেকে টাকা মেরে খায়',
  'Pulu সে নিজেও ট্রেডিং পারে না অথচ পেইড কোর্স চালু করে ফেলসে',
  'সবাই ভুয়া মেন্টর PULU হইতে সাবধান',
  'ওর গ্রুপে 10-12 টা দালাল আছে',
  'ওর দালালদের কথায় বিভ্রান্ত হবেন না',
  'যেসব ANALYSIS দেয় বেশিরভাগই SL হিট খায়',
  'Pulu যে ট্রেডিং পারে ওকে একটা প্রমাণ দিতে বলেন তো'
];
const userOffenses = {};

// Set webhook
bot.setWebHook(`${config.WEBHOOK_URL}/bot${config.BOT_TOKEN}`);

// Webhook route
app.post(`/bot${config.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});



// -------------------------------
// Debug: দেখার জন্য chat.id
// -------------------------------
// bot.on("message", (msg) => {
//     console.log("Chat ID:", msg.chat.id);
// });

// ========================
// ১. নতুন সদস্য স্বাগতম
// ========================
bot.on("new_chat_members", (msg) => {
    msg.new_chat_members.forEach(member => {
        bot.sendMessage(msg.chat.id, `Welcome to the group 🎉 ${member.first_name}`);
    });
});

// ========================
// ২. টাইম-ভিত্তিক মেসেজ (cron)
// ========================

// সকাল শুভেচ্ছা 08:00
cron.schedule('0 8 * * *', () => {
    bot.sendMessage(config.GROUP_CHAT_ID, 'সুপ্রভাত! 🌞');
});

// রাত শুভেচ্ছা 21:00
cron.schedule('0 21 * * *', () => {
    bot.sendMessage(config.GROUP_CHAT_ID, 'শুভ রাত্রি! 🌙');
});

// শুক্রবার জুমা মোবারক 09:00
cron.schedule('0 9 * * 5', () => {
    bot.sendMessage(config.GROUP_CHAT_ID, 'জুমা মোবারক! 🕌');
});

// ========================
// ========================
// ---------------------------
// Telegram send message function
// ---------------------------
async function sendToTelegram(text) {
  try {
    await bot.sendMessage(config.GROUP_CHAT_ID, text, { parse_mode: "Markdown" });
    console.log("✅ Telegram এ পাঠানো হয়েছে");
  } catch (err) {
    console.error("❌ Telegram Error:", err.message);
  }
}

// ---------------------------
// Bank Holiday + Weekend check
// ---------------------------
async function isMarketClosed() {
  try {
    const today = new Date();
    // Weekend check
    if (today.getDay() === 0 || today.getDay() === 6) return true;

    // US Bank Holiday
    const year = today.getFullYear();
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/US`;
    const res = await axios.get(url);
    const todayStr = today.toISOString().split("T")[0];
    const isHoliday = res.data.some((holiday) => holiday.date === todayStr);
    return isHoliday;
  } catch (err) {
    console.error("❌ Holiday API Error:", err.message);
    return false; // fail-safe: consider market open
  }
}

// ---------------------------
// Market Update
// ---------------------------
async function getMarketUpdate() {
  try {
    const marketClosed = await isMarketClosed();

    // Yahoo symbols
    const forexEURUSD = "EURUSD=X";
    const forexUSDGBP = "GBPUSD=X";
    const us100Symbol = "^NDX";
    const btcSymbol = "BTC-USD";

    // Fetch data
    const forexEURData = await yahooFinance.quote(forexEURUSD).catch(() => null);
    const forexGBPData = await yahooFinance.quote(forexUSDGBP).catch(() => null);
    const us100Data = await yahooFinance.quote(us100Symbol).catch(() => null);
    const btcData = await yahooFinance.quote(btcSymbol).catch(() => null);

    // Create message
    let message = "🤖 *Message Police Bot:*\n📊 *Market Update*\n";

    if (marketClosed) {
      message += "🏦 মার্কেট বন্ধ (Weekend / US Bank Holiday)\n";
    } else {
      // Forex
      if (forexEURData && forexGBPData) {
        message += `💱 EUR/USD: *${forexEURData.regularMarketPrice}*\n`;
        message += `💱 USD/GBP: *${(1 / forexGBPData.regularMarketPrice).toFixed(4)}*\n`; // inverse to get USD/GBP
      } else {
        message += "⚠️ Forex Data Not Available (API Error)\n";
      }

      // US100
      if (us100Data) {
        message += `📈 US100: *${us100Data.regularMarketPrice}*\n`;
      } else {
        message += "⚠️ US100 Data Not Available (API Error)\n";
      }
    }

    // BTC
    if (btcData) {
      message += `₿ BTC/USD: *${btcData.regularMarketPrice}*\n`;
    } else {
      message += "⚠️ BTC Data Not Available (API Error)\n";
    }

    message += `🕒 Updated: ${new Date().toLocaleString("en-US", {
      timeZone: "Asia/Dhaka",
    })}`;

    // console.log("\n✅ Final Message:\n", message);

    // Send to Telegram
    await sendToTelegram(message);

    return message;
  } catch (err) {
    console.error("❌ Market Update Error:", err.message);
    await sendToTelegram("⚠️ Market Update Failed!");
    return "⚠️ Market Update Failed!";
  }
}

// ---------------------------
// Run every 5 minutes
// ---------------------------
// cron.schedule("*/5 * * * *", getMarketUpdate);
// 
// পরে production এ ১ ঘন্টা interval করতে চাইলে:
cron.schedule('0 * * * *', sendMarketUpdate);
// ৪. Message handler (existing Police Mode)
// ========================
bot.on("message", async (msg) => {
  if (!msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || userId;
  const text = msg.text;

  const cleanText = text.replace(/[.,!?;:()\[\]{}"]/g, " ").trim().toLowerCase();
  const detectedWords = wordlist.filter(word => cleanText.includes(word.toLowerCase()));
  const sentimentScore = sentiment.analyze(cleanText).score;

  if (detectedWords.length > 0 || sentimentScore < -2) {
    await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
    userOffenses[userId] = (userOffenses[userId] || 0) + 1;
    await bot.banChatMember(chatId, userId).catch(() => {});

    let reason = [];
    if (detectedWords.length > 0) reason.push(`🧨 গালির শব্দ: ${detectedWords.join(", ")}`);
    if (sentimentScore < -2) reason.push(`😡 নেতিবাচক মেসেজ (Score: ${sentimentScore})`);

    const banMessage =
      `🚔👮 পুলিশের জরুরি অভিযান 👮🚔\n\n` +
      `🔗 অপরাধী: @${username}\n` +
      `📌 অভিযোগ: ${reason.join(" | ")}\n\n` +
      `⚖️ রায়: স্থায়ী কারাদণ্ড (BAN) ⛔\n` +
      `🚓 নোট: গ্রুপে গালি দিলে পুলিশ এসে ধরে নিয়ে যায় 🤭`;

    await bot.sendMessage(chatId, banMessage);
  }
});

// Home route
app.get('/', (req, res) => {
  res.send('Bot is running ✅');
});

// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});