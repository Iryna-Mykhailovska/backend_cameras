const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const { isAuth, isAdmin } = require('../middleware/auth');

router.get('/company', isAuth, async (req, res) => {
  try { res.json(await Company.find()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/company', isAuth, isAdmin, async (req, res) => {
  try {
    const newItem = new Company(req.body);
    res.status(201).json(await newItem.save());
  } catch (err) { res.status(400).json({ error: err.message }); }
});
// Оновлення даних компанії
router.put('/company/:id', isAuth, isAdmin, async (req, res) => {
  try {
    const { name, address } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Назва компанії не може бути порожньою!" });
    }

    const updatedCompany = await Company.findByIdAndUpdate(
      req.params.id,
      { 
        name: name.trim(), 
        address: address ? address.trim() : '' 
      },
      { new: true } // Повертати вже оновлений документ
    );

    if (!updatedCompany) {
      return res.status(404).json({ error: "Компанію не знайдено" });
    }

    res.json(updatedCompany);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/company/:id', isAuth, isAdmin, async (req, res) => {
  try {
    const deleted = await Company.findByIdAndDelete(req.params.id);
    res.json(deleted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;