const express = require('express');
const cors = require('cors');
const app = express();
const conversationRoute = require('./routes/conversionsRoutes');
const contactUsRouter = require('./routes/contactUsRoute'); // Include the contactUs route
const port = 3001;
require('dotenv').config();

app.use(cors()); // Enable CORS for all routes.
app.use(express.json()); // Allows JSON data in the request body
app.use(express.urlencoded({ extended: true })); // For URL-encoded data

app.use('/api', conversationRoute);
app.use('/contact', contactUsRouter); // Use the contactUs router

app.listen(port, () => {
    console.log('Server running on port', port);
});
