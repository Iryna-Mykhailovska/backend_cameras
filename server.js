
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Подключаем эндпоинты маршрутизации
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/company');
const recorderRoutes = require('./routes/recorder');
const cameraRoutes = require('./routes/camera');

const app = express();

// Инициализация базы данных
connectDB();

const path = require('path');
// Делаем папку uploads публичной
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Мидлвары
app.use(cors({
  origin: ['http://localhost:5173', 'https://cctvcontrol-oeft3nf67-professorshas-projects.vercel.app'],
  credentials: true
}));
app.use(express.json()); 

// Диспетчеризация базовых URL-путей
app.use('/auth', authRoutes);
app.use('/company', companyRoutes);
app.use('/recorders', recorderRoutes);
app.use('/cameras', cameraRoutes);

// Старт сервера
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Архитектурный сервер запущен на порту ${PORT}`));


