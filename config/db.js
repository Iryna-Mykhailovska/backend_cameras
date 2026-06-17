const mongoose = require('mongoose');

const connectDB = async () => {
  const { DB_USER, DB_PASSWORD, DB_NAME } = process.env;

  const MONGODB_URI = `mongodb://${DB_USER}:${DB_PASSWORD}@` +
    `ac-kserdhi-shard-00-00.iwuoxga.mongodb.net:27017,` +
    `ac-kserdhi-shard-00-01.iwuoxga.mongodb.net:27017,` +
    `ac-kserdhi-shard-00-02.iwuoxga.mongodb.net:27017` +
    `/${DB_NAME}?ssl=true&replicaSet=atlas-zi2ya2-shard-0&authSource=admin&retryWrites=true&w=majority`;

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ ІНФРАСТРУКТУРА: Системні бази даних підключені успішно!');
  } catch (err) {
    console.error('❌ Ошибка MongoDB:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;