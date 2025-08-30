const TelegramBot = require("node-telegram-bot-api");
const config = require("./config");
const Sentiment = require("sentiment");
const sentiment = new Sentiment();

// Wordlist + Phrase list (all lowercase, include Bengali + Roman + English)
const wordlist = [
  'চুদি', 'চোদ', 'মাগী', 'হারামি', 'গাধা', 'বোকা',
  'চুতমারানি', 'খানকিরপোলা', 'শুয়োর', 'শালা', 'মাদারচোদ', 'বাপচোদ',
  'চুতিয়া', 'chudi', 'chod', 'magi', 'harami', 'gadha', 'boka',
  'chutmarani', 'khanakirpola', 'shuar', 'shala', 'madarchod', 'bapchod',
  'chutiya', 'fuck', 'motherfucker', 'shit', 'bitch', 'asshole', 'bastard', 'idiot',
  'scam', 'fraud', 'cheat', 'looter', 'conman', 'admin fraud', 'fake', 'thief',
  'এডমিন চুদি', 'এডমিন বাটপার', 'এডমিন চোর', 'এডমিন খারাপ', 'this is a scam', 'admin fraud',
  
  // Specific user phrases (Bengali + Roman)
  '@pulumarm একজন বাটপার','pulu marma একজন বাটপার','pulu marma টাকা মেরে খায়',
  '@pulumarma  বাটপার','pulu marma চোর',
  'পুলু মারমা বাটপার','পুলু মারমা চোর',
  'পুলু মারমা একজন বাটপার','পুলু মারমা একজন চোর'
].map(w => w.toLowerCase());

const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || userId;
  const text = msg.text || "";

  // Clean text: remove punctuation, lowercase, normalize spaces
  const cleanText = text
    .replace(/[.,!?;:()\[\]{}"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // Detect bad words/phrases
  const detectedWords = wordlist.filter(word => cleanText.includes(word));

  // Sentiment analysis
  const sentimentScore = sentiment.analyze(cleanText).score;

  if (detectedWords.length > 0 || sentimentScore < -2) {
    const timestamp = new Date().toLocaleString();
    // console.log(`❌ [${timestamp}] BAD MESSAGE from ${username}: "${text}"`);
    // console.log(`Detected bad words/phrases: ${detectedWords.join(", ")}`);
    // console.log(`Sentiment score: ${sentimentScore}`);

    // Delete message
    await bot.deleteMessage(chatId, msg.message_id).catch(() => {});

    // Permanent ban
    await bot.banChatMember(chatId, userId).catch(() => {});

    // Telegram message with reason
    let reason = [];
    if(detectedWords.length > 0) reason.push(`Words/phrases: ${detectedWords.join(", ")}`);
    if(sentimentScore < -2) reason.push(`Negative sentiment detected (score: ${sentimentScore})`);

    bot.sendMessage(chatId, `⛔ User ${username} permanently banned for: ${reason.join("; ")}`);
  } else {
    // const timestamp = new Date().toLocaleString();
    // console.log(`✅ [${timestamp}] Safe message from ${username}: "${text}"`);
  }
});