const express = require('express');
const router = express.Router();
const Recorder = require('../models/Recorder');
const { isAuth, isAdmin } = require('../middleware/auth');

router.get('/', isAuth, async (req, res) => {
  try {
    const { companyId } = req.query;
    const filter = companyId ? { companyId } : {};
    res.json(await Recorder.find(filter).populate('companyId', 'name'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', isAuth, isAdmin, async (req, res) => {
  try {
    const newItem = new Recorder(req.body);
    res.status(201).json(await newItem.save());
  } catch (err) { res.status(400).json({ error: err.message }); }
});
// Оновлення даних реєстратора
router.put('/:id', isAuth, isAdmin, async (req, res) => {
  try {
    const { name, ip, channels } = req.body;
    const cleanIp = ip ? ip.trim() : '';

    // Валідація IP-адреси
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!cleanIp || !ipRegex.test(cleanIp)) {
      return res.status(400).json({ error: "Некоректний формат IP-адреси реєстратора!" });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Назва реєстратора не може бути порожньою!" });
    }

    const updatedRecorder = await Recorder.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        ip: cleanIp,
        channels: Number(channels)
      },
      { new: true }
    );

    if (!updatedRecorder) {
      return res.status(404).json({ error: "Реєстратор не знайдено" });
    }

    res.json(updatedRecorder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.delete('/:id', isAuth, isAdmin, async (req, res) => {
  try { res.json(await Recorder.findByIdAndDelete(req.params.id)); } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;