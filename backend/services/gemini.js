require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === 'your_gemini_api_key_here') {
  console.warn('[Gemini] GEMINI_API_KEY not set — AI endpoints will return mock responses');
}

const genAI = apiKey && apiKey !== 'your_gemini_api_key_here'
  ? new GoogleGenerativeAI(apiKey)
  : null;

const flash = genAI ? genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }) : null;
const pro   = genAI ? genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }) : null;

/**
 * Helper: call Gemini and parse JSON from response
 */
async function callGeminiJSON(model, prompt) {
  if (!model) throw new Error('GEMINI_API_KEY is not configured. Add it to backend/.env');
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Gemini JSON parse error:', err.message);
    throw new Error(`Gemini call failed: ${err.message}`);
  }
}

async function callGeminiText(model, prompt) {
  if (!model) throw new Error('GEMINI_API_KEY is not configured');
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}


// ============================================================
// 1. NL → Campaign Builder
// ============================================================
async function buildCampaignFromNL(prompt) {
  const systemPrompt = `
You are an AI assistant for a D2C retail brand's CRM system.
Convert the following natural language campaign request into a structured campaign spec.

Natural language request: "${prompt}"

Return ONLY valid JSON in this exact format:
{
  "segment": {
    "name": "Short descriptive name",
    "description": "Why this segment",
    "filter_rules": {
      "operator": "AND",
      "conditions": [
        { "field": "monetary", "op": "gte", "value": 5000 },
        { "field": "recency_days", "op": "gte", "value": 60 }
      ]
    }
  },
  "message_template": "Hi {name}, <personalized message here>. Use {promo_code} for your discount.",
  "channel": "whatsapp",
  "reasoning": "Brief explanation of why this channel and segment were chosen"
}

Available filter fields:
- monetary (total spend in ₹, numeric)
- recency_days (days since last order, numeric)  
- frequency (number of orders, numeric)
- city (text, use "in" op with array)
- tier (bronze/silver/gold/platinum, use "eq" or "in" op)
- segment_label (Champions/Loyal/Potential Loyalists/At Risk/Cannot Lose/Hibernating/Lost)

Available operators: gte, lte, gt, lt, eq, in, contains

Channels: whatsapp, sms, email, rcs

Make the message template engaging, personalized with {name} placeholder, and include a clear CTA.
`;

  return callGeminiJSON(flash, systemPrompt);
}

// ============================================================
// 2. Proactive Segment Suggester
// ============================================================
async function suggestSegments(rfmSummary, topCustomers) {
  const prompt = `
You are a CRM marketing AI for a D2C retail brand.
Analyze the following customer data and suggest 4-6 actionable audience segments for campaigns.

RFM Distribution:
${JSON.stringify(rfmSummary, null, 2)}

Sample customers with metrics:
${JSON.stringify(topCustomers.slice(0, 20), null, 2)}

Return ONLY valid JSON array:
[
  {
    "label": "Segment Name",
    "description": "Who they are and why they matter",
    "urgency": "high|medium|low",
    "filter_rules": {
      "operator": "AND",
      "conditions": [...]
    },
    "suggested_action": "What campaign to run",
    "estimated_size": "approximate number like '20-30 customers'"
  }
]

Focus on:
- At-risk high-value customers (urgent win-back)
- Recent customers to convert to loyal
- Dormant champions to reactivate
- City-based targeting opportunities
- Cross-sell opportunities based on purchase patterns
`;

  return callGeminiJSON(flash, prompt);
}

// ============================================================
// 3. Per-Recipient Message Personalizer
// ============================================================
async function personalizeMessage(template, customer) {
  const prompt = `
You are personalizing a marketing message for a D2C retail brand.

Message template: "${template}"

Customer details:
- Name: ${customer.name}
- City: ${customer.city || 'India'}
- Last product purchased: ${customer.last_product || 'our collection'}
- Days since last order: ${customer.last_order_days_ago || 'a while'}
- Total spent: ₹${customer.total_spent || 0}
- Customer tier: ${customer.tier || 'valued customer'}

Rules:
- Keep it under 160 words
- Sound warm and human, not robotic
- Reference their last purchase naturally if relevant
- Include a clear, urgent call to action
- Do NOT use generic phrases like "valued customer"

Return ONLY valid JSON:
{
  "message": "The personalized message here"
}
`;

  return callGeminiJSON(flash, prompt);
}

// ============================================================
// 4. Channel Recommender
// ============================================================
async function recommendChannel(customer) {
  const prompt = `
Recommend the best messaging channel for this customer based on their profile.

Customer:
- Tier: ${customer.tier}
- City: ${customer.city}
- Total orders: ${customer.frequency}
- Total spent: ₹${customer.monetary}
- Days since last order: ${customer.recency_days}
- RFM segment: ${customer.segment_label}

Available channels: whatsapp, sms, email, rcs

Return ONLY valid JSON:
{
  "channel": "whatsapp",
  "confidence": 0.85,
  "reasoning": "Brief reason (1-2 sentences)"
}
`;

  return callGeminiJSON(flash, prompt);
}

// ============================================================
// 5. Campaign Performance Explainer  
// ============================================================
async function explainPerformance(campaignStats) {
  const prompt = `
You are a marketing analyst AI for a D2C retail CRM.
Analyze this campaign's performance and provide actionable insights.

Campaign Stats:
${JSON.stringify(campaignStats, null, 2)}

Provide a clear, concise analysis covering:
1. Overall performance assessment (1-2 sentences)
2. What worked well
3. What needs improvement
4. 2-3 specific actionable recommendations for the next campaign

Return ONLY valid JSON:
{
  "summary": "High-level 1-2 sentence verdict",
  "highlights": ["What worked #1", "What worked #2"],
  "improvements": ["What to improve #1", "What to improve #2"],
  "recommendations": [
    "Specific action 1",
    "Specific action 2",
    "Specific action 3"
  ],
  "performance_grade": "A|B|C|D",
  "key_metric": "The one metric that stands out most"
}
`;

  return callGeminiJSON(pro, prompt);
}

// ============================================================
// 6. RFM Segment Insights
// ============================================================
async function generateRFMInsights(rfmSummary) {
  const prompt = `
You are a CRM AI for a D2C retail brand.
Generate brief, actionable insights for each RFM segment below.

RFM Data:
${JSON.stringify(rfmSummary, null, 2)}

For each segment, return a short insight (1 sentence) and a suggested campaign action.

Return ONLY valid JSON:
{
  "segments": {
    "Champions": { "insight": "...", "action": "..." },
    "Loyal": { "insight": "...", "action": "..." },
    "Potential Loyalists": { "insight": "...", "action": "..." },
    "At Risk": { "insight": "...", "action": "..." },
    "Cannot Lose": { "insight": "...", "action": "..." },
    "Hibernating": { "insight": "...", "action": "..." },
    "Lost": { "insight": "...", "action": "..." }
  },
  "top_priority": "Which segment to act on first and why (1-2 sentences)"
}
`;

  return callGeminiJSON(flash, prompt);
}

module.exports = {
  buildCampaignFromNL,
  suggestSegments,
  personalizeMessage,
  recommendChannel,
  explainPerformance,
  generateRFMInsights,
};
