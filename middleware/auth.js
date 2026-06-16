const jwt = require('jsonwebtoken');

const isAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Доступ запрещен. Вы не авторизованы.' });
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: 'Токен недействителен или устарел.' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') next();
  else res.status(403).json({ error: 'Отказ в доступе. Требуются права Администратора.' });
};

module.exports = { isAuth, isAdmin };