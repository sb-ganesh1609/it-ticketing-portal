const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Add this explicit route near the top of server.js
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Session Middleware
app.use(session({
  secret: 'it-helpdesk-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 Hours
}));

// Default Hardcoded Credentials (Replace or expand as needed)
const USERS = {
  admin: { password: 'adminpassword', role: 'admin', name: 'IT Admin' },
  user: { password: 'userpassword', role: 'user', name: 'John Doe' }
};

// Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const foundUser = USERS[username];

  if (foundUser && foundUser.password === password) {
    req.session.user = {
      username,
      role: foundUser.role,
      name: foundUser.name
    };
    return res.json({ message: 'Login successful', role: foundUser.role });
  }

  res.status(401).json({ error: 'Invalid username or password' });
});

// Logout API
app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out successfully' });
});

// Current User Session Check
app.get('/api/me', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// Protect Admin Pages
app.use('/admin.html', (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.redirect('/login.html');
  }
});

// Protect Main End-User Portal Page
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    if (!req.session.user) {
      return res.redirect('/login.html');
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

function generateTicketNumber() {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `INC-${randomNum}`;
}

// Create Ticket
app.post('/api/tickets', (req, res) => {
  const { title, category, priority, description, requester_name, requester_email } = req.body;

  if (!title || !category || !priority || !description || !requester_name || !requester_email) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const ticketNumber = generateTicketNumber();
  const sql = `
    INSERT INTO tickets (ticket_number, title, category, priority, description, requester_name, requester_email)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [ticketNumber, title, category, priority, description, requester_name, requester_email], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Ticket submitted successfully!', ticketNumber, ticketId: this.lastID });
  });
});

// Fetch Tickets (Admin Only)
app.get('/api/tickets', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized access' });
  }

  const { status, category } = req.query;
  let sql = 'SELECT * FROM tickets';
  const params = [];
  const conditions = [];

  if (status) { conditions.push('status = ?'); params.push(status); }
  if (category) { conditions.push('category = ?'); params.push(category); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Search Tickets
app.get('/api/tickets/search', (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Search query is required.' });

  const cleanQuery = query.trim();
  const sql = `SELECT * FROM tickets WHERE ticket_number = ? OR requester_email = ? ORDER BY created_at DESC`;

  db.all(sql, [cleanQuery, cleanQuery], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Update Ticket Status (Admin Only)
app.patch('/api/tickets/:id', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized access' });
  }

  const { id } = req.params;
  const { status, priority } = req.body;
  const updates = [];
  const params = [];

  if (status) { updates.push('status = ?'); params.push(status); }
  if (priority) { updates.push('priority = ?'); params.push(priority); }
  if (updates.length === 0) return res.status(400).json({ error: 'No update fields provided.' });

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  const sql = `UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`;

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Ticket updated successfully.' });
  });
});

app.listen(PORT, () => {
  console.log(`IT Ticketing Server running at http://localhost:${PORT}`);
});