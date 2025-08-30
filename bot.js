const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");
const Sentiment = require("sentiment");
const config = require("./config");

const app = express();
app.use(bodyParser.json());

// Initialize bot
const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });
const sentiment = new Sentiment();

// Bad words / phrases
const wordlist = [
  'চুদি','চোদ','মাগী','হারামি','গাধা','বোকা','চুতমারানি','খানকিরপোলা','শুয়োর',
  'শালা','মাদারচোদ','বাপচোদ','চুতিয়া','chudi','chod','magi','harami','gadha','boka',
  'chutmarani','khanakirpola','shuar','shala','madarchod','bapchod','chutiya','fuck',
  'motherfucker','shit','bitch','asshole','bastard','idiot','scam','fraud','cheat',
  'looter','conman','admin fraud','fake','thief',
  'এডমিন চুদি','এডমিন চোর','এডমিন খারাপ','this is a scam','admin fraud',
  'Pulu Marma বাটপার','Pulu Marma চোর'
];

// Track offenses
const userOffenses = {};

// Set webhook
bot.setWebHook(`${config.WEBHOOK_URL}/bot${config.BOT_TOKEN}`);

// Webhook route
app.post(`/bot${config.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Message handler
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || userId;
  const text = msg.text || "";

  const cleanText = text.replace(/[.,!?;:()\[\]{}"]/g, " ").trim().toLowerCase();

  const detectedWords = wordlist.filter(word => {
    const pattern = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const regex = new RegExp(`\\b${pattern}\\b`, "i");
    return regex.test(cleanText);
  });

  const sentimentScore = sentiment.analyze(cleanText).score;

  if(detectedWords.length > 0 || sentimentScore < -2){
    const timestamp = new Date().toLocaleString();
    console.log(`❌ [${timestamp}] BAD MESSAGE from ${username}: "${text}"`);
    console.log(`Detected bad words/phrases: ${detectedWords.join(", ")}`);
    console.log(`Sentiment score: ${sentimentScore}`);

    await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
    userOffenses[userId] = (userOffenses[userId] || 0) + 1;

    await bot.banChatMember(chatId, userId).catch(() => {});

    let reason = [];
    if(detectedWords.length > 0) reason.push(`Words/phrases: ${detectedWords.join(", ")}`);
    if(sentimentScore < -2) reason.push(`Negative sentiment (score: ${sentimentScore})`);

    bot.sendMessage(chatId, `⛔ User ${username} permanently banned for: ${reason.join("; ")}`);
  } else {
    const timestamp = new Date().toLocaleString();
    console.log(`✅ [${timestamp}] Safe message from ${username}: "${text}"`);
  }
});

// Root route
app.get('/', (req, res) => {
  res.send('Telegram Bot is running ✅');
  console.log("Visited home page");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));