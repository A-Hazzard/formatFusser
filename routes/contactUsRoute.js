const nodemailer = require('nodemailer');
const express = require('express');
const router = express.Router();
require('dotenv').config();

// Corrected nodemailer configuration
const transporter = nodemailer.createTransport({
    host: "smtp.office365.com", // hostname for Outlook/Office 365
    port: 587, // Standard port for STARTTLS
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER, //If env doesnt work, hard code it
        pass: process.env.EMAIL_PASS
    },

});
  

router.post('/send', (req, res) => {
  const { name, email, message } = req.body;
    console.log(process.env.EMAIL_USER, //If env doesnt work, hard code it
     process.env.EMAIL_PASS)
  // Validate data
  if (!name || !email || !message) {
    console.log('User left fields blank')
    return res.status(400).json({ message: 'Please fill in all fields.' });
  }
  console.log(`Name: ${name},\nEmail: ${email},\nMessage: ${message}`)

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_RECIEVER,
    subject: `New Contact Message from ${name}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #52D3D8;">You've got a new message!</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <div style="background-color: #fff; padding: 15px; border: 1px solid #52D3D8; border-radius: 10px;">
          <p><strong>Message:</strong></p>
          <p>${message}</p>
        </div>
      </div>
    `
  };

  console.log('Sending Email')

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      res.status(500).send('Error sending email');
    } else {
      console.log('Email sent: ' + info.response);
      res.status(200).send('Email successfully sent');
    }
  });
});

module.exports = router;
