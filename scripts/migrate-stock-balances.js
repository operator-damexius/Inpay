const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

function loadEnvironmentFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

async function main() {
  loadEnvironmentFile(path.resolve(process.cwd(), '.env.local'));
  loadEnvironmentFile(path.resolve(process.cwd(), '.env'));

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Set MONGODB_URI in the environment or in .env.local/.env before migrating.');
  }

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'Inpay' });
  const items = mongoose.connection.db.collection('items');
  const balances = mongoose.connection.db.collection('stockbalances');
  const cursor = items.find({}, { projection: { sku: 1, name: 1, location: 1, stockOnHand: 1 } });
  let migrated = 0;
  let unchanged = 0;
  const unassigned = [];
  const invalid = [];
  const mismatched = [];

  for await (const item of cursor) {
    const quantity = item.stockOnHand == null ? 0 : Number(item.stockOnHand);
    if (!Number.isFinite(quantity) || quantity < 0) {
      invalid.push({ sku: item.sku, name: item.name, quantity: item.stockOnHand });
      continue;
    }
    if (!item.location) {
      if (quantity > 0) unassigned.push({ sku: item.sku, name: item.name, quantity });
      continue;
    }

    const existingBalances = await balances.find(
      { item: item._id },
      { projection: { quantity: 1 } }
    ).toArray();
    const existingQuantities = existingBalances.map((balance) => Number(balance.quantity));
    if (existingQuantities.some((balanceQuantity) => !Number.isFinite(balanceQuantity) || balanceQuantity < 0)) {
      invalid.push({ sku: item.sku, name: item.name, quantity: 'invalid location balance' });
      continue;
    }

    const existingTotal = existingQuantities.reduce((total, balanceQuantity) => total + balanceQuantity, 0);
    if (existingTotal > quantity) {
      mismatched.push({
        sku: item.sku,
        name: item.name,
        itemQuantity: quantity,
        locationQuantity: existingTotal,
      });
      continue;
    }

    const missingQuantity = quantity - existingTotal;
    if (missingQuantity === 0) {
      unchanged += 1;
      continue;
    }

    const result = await balances.updateOne(
      { item: item._id, location: item.location },
      {
        $setOnInsert: {
          item: item._id,
          location: item.location,
        },
        $inc: { quantity: missingQuantity },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );
    migrated += result.upsertedCount;
  }

  console.log(`Added missing stock to ${migrated} location balance(s).`);
  console.log(`Already aligned: ${unchanged} item(s).`);
  if (unassigned.length) {
    console.log('Items with stock but no assigned location need manual assignment:');
    for (const item of unassigned) {
      console.log(`- ${item.sku || '(no SKU)'}: ${item.name || '(unnamed)'} (${item.quantity})`);
    }
  }
  if (invalid.length) {
    console.log('Items with invalid on-hand quantities need manual correction:');
    for (const item of invalid) {
      console.log(`- ${item.sku || '(no SKU)'}: ${item.name || '(unnamed)'} (${item.quantity})`);
    }
  }
  if (mismatched.length) {
    console.log('Items whose location totals exceed item on-hand stock need manual reconciliation:');
    for (const item of mismatched) {
      console.log(
        `- ${item.sku || '(no SKU)'}: ${item.name || '(unnamed)'} (item: ${item.itemQuantity}, locations: ${item.locationQuantity})`
      );
    }
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Stock balance migration failed:', error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
