// bot.js
const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");
const Sentiment = require("sentiment");
const cron = require("node-cron");
const config = require("./config");
const yahooFinance = require('yahoo-finance2').default;
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Initialize bot
const bot = new TelegramBot(config.BOT_TOKEN);
const sentiment = new Sentiment();

// ========================
// Wordlist / Police Mode
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

// ========================
// নতুন সদস্য স্বাগতম
// ========================
bot.on("new_chat_members", (msg) => {
  msg.new_chat_members.forEach(member => {
    bot.sendMessage(msg.chat.id, `Welcome to the group 🎉 ${member.first_name}`);
  });
});

// ========================
// টাইম-ভিত্তিক মেসেজ (বাংলাদেশ সময়)
// ========================
cron.schedule('0 8 * * *', () => {
  bot.sendMessage(config.GROUP_CHAT_ID, 'সুপ্রভাত! 🌞');
}, { timezone: 'Asia/Dhaka' });

cron.schedule('0 21 * * *', () => {
  bot.sendMessage(config.GROUP_CHAT_ID, 'শুভ রাত্রি! 🌙');
}, { timezone: 'Asia/Dhaka' });

cron.schedule('0 9 * * 5', () => {
  bot.sendMessage(config.GROUP_CHAT_ID, 'জুমা মোবারক! 🕌');
}, { timezone: 'Asia/Dhaka' });

// ========================
// Telegram send message
// ========================
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
    if (today.getDay() === 0 || today.getDay() === 6) return true;
    const year = today.getFullYear();
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/US`;
    const res = await axios.get(url);
    const todayStr = today.toISOString().split("T")[0];
    return res.data.some((holiday) => holiday.date === todayStr);
  } catch (err) {
    console.error("❌ Holiday API Error:", err.message);
    return false;
  }
}

// ---------------------------
// Market Update
// ---------------------------
async function getMarketUpdate() {
  try {
    const marketClosed = await isMarketClosed();
    const forexEURUSD = "EURUSD=X";
    const forexUSDGBP = "GBPUSD=X";
    const us100Symbol = "^NDX";
    const btcSymbol = "BTC-USD";

    const [forexEURData, forexGBPData, us100Data, btcData] = await Promise.all([
      yahooFinance.quote(forexEURUSD).catch(() => null),
      yahooFinance.quote(forexUSDGBP).catch(() => null),
      yahooFinance.quote(us100Symbol).catch(() => null),
      yahooFinance.quote(btcSymbol).catch(() => null),
    ]);

    let message = "🤖 *Message Police Bot:*\n📊 *Market Update*\n";
    if (marketClosed) {
      message += "🏦 মার্কেট বন্ধ (Weekend / US Bank Holiday)\n";
    } else {
      if (forexEURData && forexGBPData) {
        message += `💱 EUR/USD: *${forexEURData.regularMarketPrice}*\n`;
        message += `💱 USD/GBP: *${(1 / forexGBPData.regularMarketPrice).toFixed(4)}*\n`;
      } else {
        message += "⚠️ Forex Data Not Available\n";
      }

      if (us100Data) {
        message += `📈 US100: *${us100Data.regularMarketPrice}*\n`;
      } else {
        message += "⚠️ US100 Data Not Available\n";
      }
    }

    if (btcData) {
      message += `₿ BTC/USD: *${btcData.regularMarketPrice}*\n`;
    }

    message += `🕒 Updated: ${new Date().toLocaleString("en-US", {
      timeZone: "Asia/Dhaka",
    })}`;

    await sendToTelegram(message);
  } catch (err) {
    console.error("❌ Market Update Error:", err.message);
    await sendToTelegram("⚠️ Market Update Failed!");
  }
}

// প্রতি ঘন্টায় আপডেট (বাংলাদেশ সময়)
cron.schedule('0 * * * *', getMarketUpdate, { timezone: 'Asia/Dhaka' });

// ========================
// Message Police Mode
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

    const reason = [];
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

// ========================
// Server
// ========================
app.get('/', (req, res) => res.send('Bot is running ✅'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));