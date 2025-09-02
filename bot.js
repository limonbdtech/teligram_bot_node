// bot.js
const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");
const Sentiment = require("sentiment");
const cron = require("node-cron");
const axios = require("axios");
const config = require("./config"); // BOT_TOKEN + WEBHOOK_URL

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
// ========================
// ৩. Market Update (BTC + Forex + US100 + Holiday Check)
// ========================
const FINNHUB_KEY = "d2r8euhr01qlk22s5c90d2r8euhr01qlk22s5c9g";

async function sendMarketUpdate() {
    try {
        const now = new Date();
        const hour = now.getUTCHours() + 6; // BD Time (UTC+6)
        const day = now.getDay(); // 0=Sunday, 6=Saturday

        let forexMsg = "";
        let us100Msg = "";
        let bankHoliday = false;

        // -------- Check Bank Holiday (US Market) --------
        try {
            const calRes = await axios.get(`https://finnhub.io/api/v1/calendar/holidays?country=US&from=${now.toISOString().split("T")[0]}&to=${now.toISOString().split("T")[0]}&token=${FINNHUB_KEY}`);
            if (calRes.data.holidays && calRes.data.holidays.length > 0) {
                bankHoliday = true;
            }
        } catch {
            bankHoliday = false; // API fail হলে false ধরে নাও
        }

        // -------- Forex Market (Mon–Fri, 08:00–00:00) --------
        if (day !== 0 && day !== 6 && hour >= 8 && hour < 24 && !bankHoliday) {
            try {
                const forexRes = await axios.get(`https://finnhub.io/api/v1/forex/rates?base=USD&token=${FINNHUB_KEY}`);
                const usdEur = forexRes.data.rates.EUR;
                const usdGbp = forexRes.data.rates.GBP;
                forexMsg = `USD/EUR: ${usdEur.toFixed(4)}\nUSD/GBP: ${usdGbp.toFixed(4)}`;
            } catch {
                forexMsg = "📢 Forex Market Closed বা API Error";
            }
        } else if (bankHoliday) {
            forexMsg = "📢 Forex Market Closed (Bank Holiday)";
        } else {
            forexMsg = "📢 Forex Market Closed (Weekend / Off Hours)";
        }

        // -------- US100 (Nasdaq) --------
        if (day !== 0 && day !== 6 && hour >= 8 && hour < 24 && !bankHoliday) {
            try {
                const us100 = await axios.get(`https://finnhub.io/api/v1/quote?symbol=^NDX&token=${FINNHUB_KEY}`);
                const us100Price = us100.data.c;
                us100Msg = us100Price ? `US100: ${us100Price}` : "📢 US100 Data Not Available";
            } catch {
                us100Msg = "📢 US100 Market Closed বা API Error";
            }
        } else if (bankHoliday) {
            us100Msg = "📢 US100 Market Closed (Bank Holiday)";
        } else {
            us100Msg = "📢 US100 Market Closed (Weekend / Off Hours)";
        }

        // -------- Bitcoin 24/7 --------
        let btcMsg = "";
        try {
            const btc = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            const btcPrice = btc.data.bitcoin.usd;
            btcMsg = `BTC/USD: ${btcPrice}`;
        } catch {
            btcMsg = "⚠️ BTC Data Fetch Error";
        }

        // -------- Final Message --------
        const message = `📊 Market Update:\n\n${forexMsg}\n${us100Msg}\n${btcMsg}`;
        bot.sendMessage(config.GROUP_CHAT_ID, message);

    } catch (error) {
        console.error('Market Update Error:', error.message);
    }
}

// প্রতি ১ ঘন্টা Market Update
// cron.schedule('0 * * * *', sendMarketUpdate);

// // প্রতি ১০ মিনিটে Market Update (Test Mode)
// cron.schedule('*/10 * * * *', sendMarketUpdate);
// প্রতি ৫ মিনিটে Market Update (Test Mode)
cron.schedule('*/5 * * * *', sendMarketUpdate);



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