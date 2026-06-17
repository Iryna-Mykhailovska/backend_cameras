const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

router.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Заповніть усі обов\'язкові поля.' });
    
    const candidate = await User.findOne({ email });
    if (candidate) return res.status(400).json({ error: 'Цей Email вже зареєстрований у системі.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword, role: role || 'user' });
    await newUser.save();

    res.status(201).json({ message: 'Користувач успішно створений!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Невірний логін або пароль.' });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, role: user.role, email: user.email });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;