const express = require('express');
const session = require('express-session');

const app = express();
app.set('view engine', 'ejs');
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(require('./routes/netsuiteConnect'));
app.use(require('./routes/cases'));
app.listen(process.env.PORT || 3000);
