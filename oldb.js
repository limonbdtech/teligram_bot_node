// bot.js
const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");
const config = require("./config"); // BOT_TOKEN + GROUP_CHAT_ID + WEBHOOK_URL
const yahooFinance = require("yahoo-finance2").default;
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// Initialize bot
const bot = new TelegramBot(config.BOT_TOKEN);
bot.setWebHook(`${config.WEBHOOK_URL}/bot${config.BOT_TOKEN}`);

// Webhook route
app.post(`/bot${config.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

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

    console.log("\n✅ Final Message:\n", message);

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
cron.schedule("*/5 * * * *", getMarketUpdate);

// ---------------------------
// Express Home Route
// ---------------------------
app.get("/", (req, res) => {
  res.send("Bot is running ✅");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});