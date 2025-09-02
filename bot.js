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
bot.on("message", (msg) => {
    console.log("Chat ID:", msg.chat.id);
});

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
// ৩. Market Update (Forex + US100 + BTC + Bank Holiday)
// ========================




// Bank Holiday API (Nager.Date) → শুধু US মার্কেট চেক করার জন্য
async function isBankHoliday() {
  try {
    const year = new Date().getFullYear();
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/US`;
    const res = await axios.get(url);
    const today = new Date().toISOString().split("T")[0];
    return res.data.some(holiday => holiday.date === today);
  } catch (err) {
    console.error("❌ Holiday API Error:", err.message);
    return false;
  }
}

async function getMarketUpdate() {
  try {
    const bankHoliday = await isBankHoliday();

    // Yahoo symbols
    const forexSymbol = "EURUSD=X"; // Example forex
    const us100Symbol = "^NDX"; // Nasdaq 100 Index
    const btcSymbol = "BTC-USD";

    // Fetch data with debugging
    const forexData = await yahooFinance.quote(forexSymbol).catch(e => {
      console.error("⚠️ Forex API Error:", e.message);
      return null;
    });
    const us100Data = await yahooFinance.quote(us100Symbol).catch(e => {
      console.error("⚠️ US100 API Error:", e.message);
      return null;
    });
    const btcData = await yahooFinance.quote(btcSymbol).catch(e => {
      console.error("⚠️ BTC API Error:", e.message);
      return null;
    });

    // Debugging raw data
    console.log("🔍 Forex Raw:", forexData);
    console.log("🔍 US100 Raw:", us100Data);
    console.log("🔍 BTC Raw:", btcData);

    // Formatting message
    let message = "🤖 Message Police Bot:\n📊 **Market Update**\n";

    if (bankHoliday) {
      message += "🏦 আজ US Bank Holiday (Market Closed)\n";
    } else {
      if (!forexData) {
        message += "⚠️ Forex Data Not Available (API Error)\n";
      } else {
        message += `💱 EUR/USD: ${forexData.regularMarketPrice}\n`;
      }

      if (!us100Data) {
        message += "⚠️ US100 Data Not Available (API Error)\n";
      } else {
        message += `📈 US100: ${us100Data.regularMarketPrice}\n`;
      }
    }

    if (!btcData) {
      message += "⚠️ BTC Data Not Available (API Error)\n";
    } else {
      message += `₿ BTC/USD: ${btcData.regularMarketPrice}\n`;
    }

    message += `🕒 Updated: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" })}`;

    console.log("\n✅ Final Message:\n", message);

    return message;
  } catch (err) {
    console.error("❌ Market Update Error:", err.message);
    return "⚠️ Market Update Failed!";
  }
}

// Run test
getMarketUpdate();

// পরে production এ ১ ঘন্টা interval করতে চাইলে:
// cron.schedule('0 * * * *', sendMarketUpdate);
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