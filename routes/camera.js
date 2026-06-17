const express = require('express');
const router = express.Router();
const Camera = require('../models/Camera');
const { isAuth, isAdmin } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Налаштування збереження завантажених картинок на сервері
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Вказуємо шлях до папки uploads у корені бекенду
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    // Генеруємо унікальне ім'я файлу (timestamp + випадкове число + оригінальне розширення)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Фільтр файлів: дозволяємо завантажувати лише зображення
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Дозволено завантажувати лише зображення!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Ліміт розміру файлу: 5MB
});

// =========================================================================
// 1. Отримання камер із підтримкою фільтрації за NVR та СТРОГОГО пошуку
// =========================================================================
router.get('/', isAuth, async (req, res) => {
  try {
    const { recorderId, search } = req.query;
    let filter = {};

    // Фільтрація за конкретним реєстратором
    if (recorderId) {
      filter.recorderId = recorderId;
    }

    // Логіка строгого пошуку за кнопкою (за ім'ям, IP або S/N)
    if (search) {
      const cleanSearch = search.trim();

      // ^...$ гарантує повний збіг рядка цілком
      filter.$or = [
        { name: { $regex: `^${cleanSearch}$`, $options: 'i' } },
        { ip: { $regex: `^${cleanSearch}$`, $options: 'i' } },
        { sn: { $regex: `^${cleanSearch}$`, $options: 'i' } }
      ];
    }

    // Виконуємо запит із чітким зазначенням полів та глибоким populate
    const cameras = await Camera.find(filter)
      .select('name ip url channelNumber sn recorderId') 
      .populate({
        path: 'recorderId',
        select: 'name ip companyId', 
        populate: {
          path: 'companyId',
          select: 'name address' 
        }
      });

    res.json(cameras);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 2. Локальний роут-проксі для віддачі картинок із папки /uploads
// =========================================================================
router.get('/snapshot/:fileId', async (req, res) => {
  try {
    // Декодуємо ім'я файлу (наприклад, image-12345.png)
    const fileId = decodeURIComponent(req.params.fileId).split('/').pop().trim();
    
    // Формуємо абсолютний шлях до файлу в папці uploads
    const filePath = path.join(__dirname, '../uploads', fileId);

    console.log(`[Local Proxy] Запит файлу: ${fileId} за шляхом: ${filePath}`);

    // Перевіряємо, чи існує файл фізично на сервері
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    } else {
      console.warn(`[Local Proxy] Файл не знайдено на диску: ${fileId}`);
      return res.status(404).send("Прев'ю не знайдено на сервері");
    }

  } catch (err) {
    console.error('[Local Proxy] Помилка при віддачі локального файлу:', err.message);
    return res.status(500).send("Помилка сервера при завантаженні зображення");
  }
});

// =========================================================================
// 3. Додавання нової камери із завантаженням файлу через FormData
// =========================================================================
router.post('/', isAuth, isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, ip, channelNumber, sn, recorderId } = req.body;
    const cleanIp = ip ? ip.trim() : '';
    const cleanSn = sn ? sn.trim() : '';

    // 1. Валідація формату IP-адреси
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!cleanIp || !ipRegex.test(cleanIp)) {
      if (req.file) {
        const filePath = path.join(__dirname, '../uploads', req.file.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      return res.status(400).json({ error: "Некоректний формат IP-адреси (очікується від 0.0.0.0 до 255.255.255.255)" });
    }

    // 2. Перевірка на дублікат IP-адреси на ЦЬОМУ реєстраторі
    const existingCameraIp = await Camera.findOne({ recorderId, ip: cleanIp });
    if (existingCameraIp) {
      if (req.file) {
        const filePath = path.join(__dirname, '../uploads', req.file.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      return res.status(400).json({ error: `Камера з IP-адресою ${cleanIp} вже існує на цьому реєстраторі!` });
    }

    // 3. ГЛОБАЛЬНА ПЕРЕВІРКА СЕРІЙНОГО НОМЕРА (S/N) ПО ВСІЙ БАЗІ
    if (cleanSn) {
      const duplicateSnCamera = await Camera.findOne({ sn: { $regex: `^${cleanSn}$`, $options: 'i' } })
        .populate({
          path: 'recorderId',
          select: 'name companyId',
          populate: {
            path: 'companyId',
            select: 'name'
          }
        });

      if (duplicateSnCamera) {
        // Якщо файл встиг завантажитися — чистимо диск
        if (req.file) {
          const filePath = path.join(__dirname, '../uploads', req.file.filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        // Витягуємо назви з лінкованих моделей безпечним способом
        const recorderName = duplicateSnCamera.recorderId?.name || 'Невідомий NVR';
        const companyName = duplicateSnCamera.recorderId?.companyId?.name || 'Невідома компанія';

        return res.status(400).json({ 
          error: `Камера з S/N "${cleanSn}" вже існує в базі!\nОб'єкт: Компанія "${companyName}"\nРеєстратор: "${recorderName}"` 
        });
      }
    }
    
    const imageUrl = req.file ? req.file.filename : '';

    const newCamera = new Camera({
      name,
      ip: cleanIp,
      channelNumber: Number(channelNumber),
      url: imageUrl, 
      sn: cleanSn, 
      recorderId
    });

    const savedCamera = await newCamera.save();
    res.status(201).json(savedCamera);
  } catch (err) {
    if (req.file) {
      const filePath = path.join(__dirname, '../uploads', req.file.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.status(400).json({ error: err.message });
  }
});
  
// Оновлення текстових даних камери (без зміни фото)
router.put('/:id', isAuth, isAdmin, async (req, res) => {
  try {
    const { name, ip, channelNumber, sn } = req.body;
    const cleanIp = ip ? ip.trim() : '';
    const cleanSn = sn ? sn.trim() : '';

    // 1. Валідація IP
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!cleanIp || !ipRegex.test(cleanIp)) {
      return res.status(400).json({ error: "Некоректний формат IP-адреси камери!" });
    }

    // 2. Глобальна перевірка унікальності S/N серед ІНШИХ камер
    if (cleanSn) {
      const duplicateSnCamera = await Camera.findOne({ 
        _id: { $ne: req.params.id }, // Ігноруємо поточну камеру
        sn: { $regex: `^${cleanSn}$`, $options: 'i' } 
      }).populate({
        path: 'recorderId',
        select: 'name companyId',
        populate: { path: 'companyId', select: 'name' }
      });

      if (duplicateSnCamera) {
        const recorderName = duplicateSnCamera.recorderId?.name || 'Невідомий NVR';
        const companyName = duplicateSnCamera.recorderId?.companyId?.name || 'Невідома компанія';

        return res.status(400).json({ 
          error: `Камера з S/N "${cleanSn}" вже закріплена за іншим об'єктом!\nОб'єкт: Компанія "${companyName}"\nРеєстратор: "${recorderName}"` 
        });
      }
    }

    // 3. Оновлюємо документ камери
    const updatedCamera = await Camera.findByIdAndUpdate(
      req.params.id,
      {
        name: name ? name.trim() : '',
        ip: cleanIp,
        channelNumber: Number(channelNumber),
        sn: cleanSn
      },
      { new: true }
    );

    if (!updatedCamera) {
      return res.status(404).json({ error: "Камеру не знайдено" });
    }

    res.json(updatedCamera);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// =========================================================================
// 4. Видалення камери (база даних + автоматичне чищення файлу з диска)
// =========================================================================
router.delete('/:id', isAuth, isAdmin, async (req, res) => {
  try {
    const camera = await Camera.findById(req.params.id);
    
    if (!camera) {
      return res.status(404).json({ error: 'Камеру не знайдено' });
    }

    // Якщо у камери було завантажене прев'ю, видаляємо файл із диска сервера
    if (camera.url) {
      const filePath = path.join(__dirname, '../uploads', camera.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Server] Файл прев'ю ${camera.url} успішно видалено з диска`);
      }
    }

    // Видаляємо саму камеру з бази даних
    await Camera.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Камеру та її зображення успішно видалено', deletedCamera: camera });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;