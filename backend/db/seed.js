/**
 * Seed script — generates 100 realistic D2C customers + 400 orders
 * Run: node db/seed.js
 */
require('dotenv').config();
const { query, pool } = require('./index');
const fs = require('fs');
const path = require('path');

const FIRST_NAMES = [
  'Priya', 'Rahul', 'Anjali', 'Vikram', 'Meera', 'Arjun', 'Pooja', 'Karan',
  'Sneha', 'Rohit', 'Divya', 'Aarav', 'Nisha', 'Aditya', 'Kavya', 'Manish',
  'Riya', 'Suresh', 'Ananya', 'Deepak', 'Shreya', 'Nikhil', 'Swati', 'Rajesh',
  'Preeti', 'Varun', 'Sanya', 'Mohit', 'Tanvi', 'Gaurav', 'Ritika', 'Harsh',
  'Ishaan', 'Nidhi', 'Amit', 'Komal', 'Siddharth', 'Neha', 'Piyush', 'Aditi',
  'Ayush', 'Simran', 'Vikas', 'Pallavi', 'Sumit', 'Radhika', 'Tarun', 'Megha',
  'Abhishek', 'Kritika', 'Shubham', 'Preethi', 'Yash', 'Sonali', 'Ankur', 'Mahi',
  'Chirag', 'Ruchika', 'Sameer', 'Bhavna', 'Dhruv', 'Aarohi', 'Akash', 'Shalini',
  'Pranav', 'Vandana', 'Rishabh', 'Lipika', 'Naveen', 'Chitra', 'Kunal', 'Jyothi',
  'Himanshu', 'Rekha', 'Tushar', 'Archana', 'Vinay', 'Usha', 'Naman', 'Supriya',
  'Saurabh', 'Lalita', 'Kiran', 'Vijay', 'Payal', 'Nitin', 'Geeta', 'Manoj',
  'Shruti', 'Praveen', 'Radha', 'Sandeep', 'Mamta', 'Alok', 'Sarla', 'Devesh',
  'Leela', 'Sanket', 'Renu', 'Kartik',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Mehta', 'Shah', 'Verma',
  'Agarwal', 'Joshi', 'Reddy', 'Nair', 'Iyer', 'Pillai', 'Rao', 'Malhotra',
  'Kapoor', 'Bose', 'Das', 'Chatterjee', 'Mukherjee', 'Banerjee', 'Sen', 'Roy',
  'Mishra', 'Tiwari', 'Pandey', 'Dubey', 'Yadav', 'Tripathi',
];

const CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata',
  'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Chandigarh', 'Indore', 'Nagpur',
];

const TIERS = ['bronze', 'silver', 'gold', 'platinum'];
const TIER_WEIGHTS = [0.4, 0.3, 0.2, 0.1]; // probability distribution

const CATEGORIES = [
  'Ethnic Wear', 'Western Wear', 'Footwear', 'Accessories', 'Activewear',
  'Home Decor', 'Beauty', 'Bags', 'Jewellery', 'Skincare',
];

const PRODUCTS = {
  'Ethnic Wear': ['Floral Kurta Set', 'Embroidered Saree', 'Anarkali Suit', 'Lehenga Choli', 'Cotton Kurti'],
  'Western Wear': ['Denim Jacket', 'Floral Dress', 'Cargo Pants', 'Crop Top Set', 'Blazer'],
  'Footwear': ['Block Heels', 'Sneakers', 'Kolhapuri Flats', 'Ankle Boots', 'Sandals'],
  'Accessories': ['Statement Earrings', 'Silk Scarf', 'Sunglasses', 'Hair Clips', 'Watch'],
  'Activewear': ['Yoga Set', 'Sports Bra', 'Running Shorts', 'Gym Tee', 'Leggings'],
  'Home Decor': ['Throw Pillow Set', 'Scented Candles', 'Wall Art Print', 'Table Runner', 'Vase'],
  'Beauty': ['Lip Gloss Kit', 'Eye Palette', 'Foundation', 'Mascara', 'Kajal'],
  'Bags': ['Tote Bag', 'Crossbody Bag', 'Clutch', 'Backpack', 'Mini Purse'],
  'Jewellery': ['Gold Hoops', 'Pearl Necklace', 'Oxidised Bangles', 'Charm Bracelet', 'Nose Pin'],
  'Skincare': ['Vitamin C Serum', 'Moisturiser SPF', 'Face Mask Set', 'Eye Cream', 'Toner'],
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(arr, weights) {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < arr.length; i++) {
    cumulative += weights[i];
    if (r <= cumulative) return arr[i];
  }
  return arr[arr.length - 1];
}

function randomDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - rand(0, daysBack));
  return d.toISOString();
}

async function seed() {
  console.log('🌱 Starting seed...');

  // Run schema
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(schema);
  console.log('✅ Schema applied');

  // Clear existing data
  await query('DELETE FROM conversions');
  await query('DELETE FROM communications');
  await query('DELETE FROM campaign_variants');
  await query('DELETE FROM campaigns');
  await query('DELETE FROM segment_customers');
  await query('DELETE FROM segments');
  await query('DELETE FROM customer_rfm');
  await query('DELETE FROM orders');
  await query('DELETE FROM customers');
  console.log('🧹 Cleared existing data');

  // Generate customers
  const customerIds = [];
  for (let i = 0; i < 100; i++) {
    const firstName = FIRST_NAMES[i] || pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
    const phone = `+91${rand(7000000000, 9999999999)}`;
    const city = pick(CITIES);
    const tier = pickWeighted(TIERS, TIER_WEIGHTS);
    const tags = [];

    const res = await query(
      `INSERT INTO customers (name, email, phone, city, tier, tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [name, email, phone, city, tier, JSON.stringify(tags)]
    );
    customerIds.push(res.rows[0].id);
  }
  console.log(`✅ Created ${customerIds.length} customers`);

  // Generate orders (4 per customer on average, skewed)
  let orderCount = 0;
  for (const customerId of customerIds) {
    // Vary order count: 20% with 1, 40% with 2-4, 30% with 5-8, 10% with 9-15
    const r = Math.random();
    const numOrders = r < 0.2 ? 1 : r < 0.6 ? rand(2, 4) : r < 0.9 ? rand(5, 8) : rand(9, 15);

    for (let j = 0; j < numOrders; j++) {
      const category = pick(CATEGORIES);
      const products = PRODUCTS[category];
      const product = pick(products);

      // Amount skewed by tier
      const baseAmount = rand(500, 3000);
      const amount = baseAmount + (Math.random() < 0.3 ? rand(2000, 15000) : 0);

      await query(
        `INSERT INTO orders (customer_id, amount, product_category, product_name, ordered_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [customerId, amount.toFixed(2), category, product, randomDate(365)]
      );
      orderCount++;
    }
  }
  console.log(`✅ Created ${orderCount} orders`);

  // Run RFM computation
  const { computeAndStoreAllRFM } = require('../services/rfm');
  await computeAndStoreAllRFM();
  console.log('✅ RFM scores computed');

  console.log('\n🎉 Seed complete!');
  console.log(`   Customers: ${customerIds.length}`);
  console.log(`   Orders:    ${orderCount}`);

  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
