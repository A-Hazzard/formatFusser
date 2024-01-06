const express = require('express');
const cors = require('cors');
const app = express();
const conversationRoute = require('./routes/conversationRoutes');
const port = 3001;


app.use(cors()); // Enable CORS (Cross-Origin Resource Sharing) for all routes.
app.use(express.json()); // Allows JSON data to be accepted in the request body
app.use(express.urlencoded({ extended: true })); // For URL-encoded data like params

app.use('/api', conversationRoute);
app.use(cors( { origin: 'https://dev-formatfusser.pantheonsite.io/wp-admin/post.php?post=7&action=elementor' } ) );

app.listen(port, ()=> {
    console.log('Server running on port', port);
})